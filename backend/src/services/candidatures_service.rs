use crate::core::types::{AppError, AppResult};
use crate::models::offres_emploi_model::{
    Candidature, CreateCandidatureRequest, UpdateStatutCandidatureRequest,
};
use crate::utils::redis_helper;
use log::{error, info};
use sqlx::PgPool;

/// Service pour la gestion des candidatures
pub struct CandidaturesService {
    pool: PgPool,
    redis_client: Option<redis::Client>,
}

impl CandidaturesService {
    pub fn new(pool: PgPool, redis_client: Option<redis::Client>) -> Self {
        Self { pool, redis_client }
    }

    /// Crée une nouvelle candidature
    pub async fn create_candidature(
        &self,
        candidat_id: i32,
        request: CreateCandidatureRequest,
    ) -> AppResult<Candidature> {
        info!(
            "[create_candidature] Création candidature pour candidat_id={}, offre_id={}",
            candidat_id, request.offre_id
        );

        // Vérifier si la candidature existe déjà
        let existing = sqlx::query_as::<_, Candidature>(
            "SELECT * FROM candidatures WHERE offre_id = $1 AND candidat_id = $2",
        )
        .bind(request.offre_id)
        .bind(candidat_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            error!("[create_candidature] Erreur vérification: {}", e);
            AppError::Internal(format!("Erreur vérification candidature: {}", e))
        })?;

        if existing.is_some() {
            return Err(AppError::BadRequest(
                "Vous avez déjà postulé à cette offre".to_string(),
            ));
        }

        // Récupérer le profil du candidat
        let profil_id: Option<i32> =
            sqlx::query_scalar("SELECT id FROM profils_candidats WHERE user_id = $1")
                .bind(candidat_id)
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| {
                    error!("[create_candidature] Erreur récupération profil: {}", e);
                    AppError::Internal(format!("Erreur récupération profil: {}", e))
                })?;

        // Créer la candidature
        let candidature = sqlx::query_as::<_, Candidature>(
            r#"
            INSERT INTO candidatures (
                offre_id, candidat_id, profil_id, lettre_motivation,
                cv_url, documents_complementaires, statut
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'en_attente')
            RETURNING *
            "#,
        )
        .bind(request.offre_id)
        .bind(candidat_id)
        .bind(profil_id)
        .bind(&request.lettre_motivation)
        .bind(&request.cv_url)
        .bind(
            request
                .documents_complementaires
                .as_ref()
                .map(|v| serde_json::to_string(v).unwrap_or_default()),
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            error!("[create_candidature] Erreur création: {}", e);
            AppError::Internal(format!("Erreur création candidature: {}", e))
        })?;

        // Invalider les caches
        self.invalidate_candidature_cache(request.offre_id, candidat_id)
            .await;

        info!(
            "[create_candidature] ✅ Candidature créée avec id={}",
            candidature.id
        );
        Ok(candidature)
    }

    /// Liste les candidatures pour une offre (employeur)
    pub async fn list_candidatures_offre(
        &self,
        offre_id: i32,
        statut: Option<String>,
        page: Option<i64>,
        limit: Option<i64>,
    ) -> AppResult<(Vec<Candidature>, i64)> {
        let page = page.unwrap_or(1).max(1);
        let limit = limit.unwrap_or(20).min(100).max(1);
        let offset = (page - 1) * limit;

        let mut query = String::from("SELECT * FROM candidatures WHERE offre_id = $1");

        if let Some(st) = &statut {
            query.push_str(&format!(" AND statut = '{}'", st.replace("'", "''")));
        }

        query.push_str(" ORDER BY date_candidature DESC");
        query.push_str(&format!(" LIMIT {} OFFSET {}", limit, offset));

        let candidatures = sqlx::query_as::<_, Candidature>(&query)
            .bind(offre_id)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| {
                error!("[list_candidatures_offre] Erreur: {}", e);
                AppError::Internal(format!("Erreur liste candidatures: {}", e))
            })?;

        // Compter le total
        let mut count_query =
            String::from("SELECT COUNT(*)::bigint FROM candidatures WHERE offre_id = $1");

        if let Some(st) = &statut {
            count_query.push_str(&format!(" AND statut = '{}'", st.replace("'", "''")));
        }

        let total: i64 = sqlx::query_scalar(&count_query)
            .bind(offre_id)
            .fetch_one(&self.pool)
            .await
            .unwrap_or(0);

        Ok((candidatures, total))
    }

    /// Liste les candidatures d'un candidat
    pub async fn list_candidatures_candidat(
        &self,
        candidat_id: i32,
        statut: Option<String>,
        page: Option<i64>,
        limit: Option<i64>,
    ) -> AppResult<(Vec<Candidature>, i64)> {
        let page = page.unwrap_or(1).max(1);
        let limit = limit.unwrap_or(20).min(100).max(1);
        let offset = (page - 1) * limit;

        let mut query = String::from("SELECT * FROM candidatures WHERE candidat_id = $1");

        if let Some(st) = &statut {
            query.push_str(&format!(" AND statut = '{}'", st.replace("'", "''")));
        }

        query.push_str(" ORDER BY date_candidature DESC");
        query.push_str(&format!(" LIMIT {} OFFSET {}", limit, offset));

        let candidatures = sqlx::query_as::<_, Candidature>(&query)
            .bind(candidat_id)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| {
                error!("[list_candidatures_candidat] Erreur: {}", e);
                AppError::Internal(format!("Erreur liste candidatures: {}", e))
            })?;

        // Compter le total
        let mut count_query =
            String::from("SELECT COUNT(*)::bigint FROM candidatures WHERE candidat_id = $1");

        if let Some(st) = &statut {
            count_query.push_str(&format!(" AND statut = '{}'", st.replace("'", "''")));
        }

        let total: i64 = sqlx::query_scalar(&count_query)
            .bind(candidat_id)
            .fetch_one(&self.pool)
            .await
            .unwrap_or(0);

        Ok((candidatures, total))
    }

    /// Met à jour le statut d'une candidature (employeur)
    pub async fn update_statut_candidature(
        &self,
        candidature_id: i32,
        request: UpdateStatutCandidatureRequest,
    ) -> AppResult<Candidature> {
        info!(
            "[update_statut_candidature] Mise à jour statut candidature_id={}, nouveau_statut={}",
            candidature_id, request.statut
        );

        // Valider le statut
        let valid_statuts = ["en_attente", "en_cours", "acceptee", "refusee", "annulee"];
        if !valid_statuts.contains(&request.statut.as_str()) {
            return Err(AppError::BadRequest(format!(
                "Statut invalide. Utiliser: {}",
                valid_statuts.join(", ")
            )));
        }

        let candidature = sqlx::query_as::<_, Candidature>(
            r#"
            UPDATE candidatures SET
                statut = $2,
                date_modification_statut = CURRENT_TIMESTAMP,
                notes_employeur = $3,
                evaluation_candidat = $4,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(candidature_id)
        .bind(&request.statut)
        .bind(&request.notes_employeur)
        .bind(
            request
                .evaluation_candidat
                .as_ref()
                .map(|v| serde_json::to_string(v).unwrap_or_default()),
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            error!("[update_statut_candidature] Erreur: {}", e);
            AppError::Internal(format!("Erreur mise à jour statut: {}", e))
        })?
        .ok_or_else(|| AppError::NotFound("Candidature non trouvée".to_string()))?;

        // Invalider les caches
        self.invalidate_candidature_cache(candidature.offre_id, candidature.candidat_id)
            .await;

        info!("[update_statut_candidature] ✅ Statut mis à jour");
        Ok(candidature)
    }

    /// Récupère les détails d'une candidature
    pub async fn get_candidature_details(&self, candidature_id: i32) -> AppResult<Candidature> {
        let candidature =
            sqlx::query_as::<_, Candidature>("SELECT * FROM candidatures WHERE id = $1")
                .bind(candidature_id)
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| {
                    error!("[get_candidature_details] Erreur: {}", e);
                    AppError::Internal(format!("Erreur récupération candidature: {}", e))
                })?
                .ok_or_else(|| AppError::NotFound("Candidature non trouvée".to_string()))?;

        Ok(candidature)
    }

    /// Invalide les caches de candidature
    async fn invalidate_candidature_cache(&self, offre_id: i32, candidat_id: i32) {
        if let Some(redis) = &self.redis_client {
            let _ = redis_helper::delete_pattern(
                redis,
                &format!("emploi:candidatures:offre:{}:*", offre_id),
            )
            .await;
            let _ = redis_helper::delete_pattern(
                redis,
                &format!("emploi:candidatures:candidat:{}:*", candidat_id),
            )
            .await;
            let _ =
                redis_helper::delete_with_retry(redis, &format!("emploi:stats:{}", offre_id)).await;
        }
    }
}
