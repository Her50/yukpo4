// ✅ Service pour gestion concours d'entrée

use crate::core::types::{AppError, AppResult};
use crate::models::orientation_scolaire::{
    ConcoursEntree, CreateConcoursRequest, SearchConcoursRequest,
};
use crate::state::AppState;
use log::{error, info};
use sqlx::PgPool;
use std::sync::Arc;

pub struct ConcoursEntreeService {
    #[allow(dead_code)]
    pool: Arc<PgPool>,
    #[allow(dead_code)]
    state: Arc<AppState>,
}

impl ConcoursEntreeService {
    pub fn new(pool: Arc<PgPool>, state: Arc<AppState>) -> Self {
        Self { pool, state }
    }

    /// Créer un concours d'entrée
    pub async fn create_concours(
        &self,
        request: CreateConcoursRequest,
    ) -> AppResult<ConcoursEntree> {
        info!(
            "[CONCOURS_ENTREE] Création concours: etablissement_id={}, nom={}",
            request.etablissement_id, request.nom_concours
        );

        let concours = sqlx::query_as::<_, ConcoursEntree>(
            r#"
            INSERT INTO concours_entree (
                etablissement_id, nom_concours, description, filiere, specialite,
                date_ouverture_inscription, date_fermeture_inscription, date_concours,
                date_resultats, documentation_url, documentation_nom, programme_concours,
                conditions_admission, frais_inscription, nombre_places, is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *
            "#,
        )
        .bind(request.etablissement_id)
        .bind(request.nom_concours)
        .bind(request.description)
        .bind(request.filiere)
        .bind(request.specialite)
        .bind(request.date_ouverture_inscription)
        .bind(request.date_fermeture_inscription)
        .bind(request.date_concours)
        .bind(request.date_resultats)
        .bind(request.documentation_url)
        .bind(request.documentation_nom)
        .bind(request.programme_concours)
        .bind(request.conditions_admission)
        .bind(request.frais_inscription)
        .bind(request.nombre_places)
        .bind(true) // is_active
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            error!("[CONCOURS_ENTREE] Erreur création: {}", e);
            AppError::Internal(format!("Erreur création concours: {}", e))
        })?;

        // Invalider le cache des concours actifs
        self.invalidate_cache_actifs().await;

        info!("[CONCOURS_ENTREE] ✅ Concours créé: id={}", concours.id);
        Ok(concours)
    }

    /// Lister les concours actifs (à venir)
    pub async fn list_concours_actifs(
        &self,
        page: Option<i64>,
        limit: Option<i64>,
    ) -> AppResult<(Vec<ConcoursEntree>, i64)> {
        // Vérifier le cache
        let cache_key = "orientation:concours:actifs";
        if let Ok(Some(cached)) =
            crate::utils::redis_helper::get_with_retry(&self.state.redis_client, cache_key).await
        {
            if let Ok(result) = serde_json::from_str::<(Vec<ConcoursEntree>, i64)>(&cached) {
                return Ok(result);
            }
        }

        let page = page.unwrap_or(1).max(1);
        let limit = limit.unwrap_or(20).min(100).max(1);
        let offset = (page - 1) * limit;
        let today = chrono::Utc::now().date_naive();

        let concours = sqlx::query_as::<_, ConcoursEntree>(
            r#"
            SELECT * FROM concours_entree
            WHERE is_active = true AND date_concours >= $1
            ORDER BY date_concours ASC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(today)
        .bind(limit)
        .bind(offset)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| {
            error!("[CONCOURS_ENTREE] Erreur list actifs: {}", e);
            AppError::Internal(format!("Erreur liste concours actifs: {}", e))
        })?;

        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*)::bigint FROM concours_entree WHERE is_active = true AND date_concours >= $1"
        )
        .bind(today)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            error!("[CONCOURS_ENTREE] Erreur count: {}", e);
            AppError::Internal(format!("Erreur count concours actifs: {}", e))
        })?;

        let result = (concours, total);

        // Mettre en cache (TTL 5 minutes)
        if let Ok(json_str) = serde_json::to_string(&result) {
            let _ = crate::utils::redis_helper::set_with_retry(
                &self.state.redis_client,
                cache_key,
                &json_str,
                Some(300u64), // 5 minutes
            )
            .await;
        }

        Ok(result)
    }

    /// Obtenir les détails d'un concours
    pub async fn get_concours_details(&self, concours_id: i32) -> AppResult<ConcoursEntree> {
        let concours = sqlx::query_as::<_, ConcoursEntree>(
            "SELECT * FROM concours_entree WHERE id = $1 AND is_active = true",
        )
        .bind(concours_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| {
            error!("[CONCOURS_ENTREE] Erreur get details: {}", e);
            AppError::Internal(format!("Erreur récupération concours: {}", e))
        })?
        .ok_or_else(|| AppError::NotFound("Concours non trouvé".to_string()))?;

        Ok(concours)
    }

    /// Rechercher des concours
    pub async fn search_concours(
        &self,
        request: SearchConcoursRequest,
    ) -> AppResult<(Vec<ConcoursEntree>, i64)> {
        let page = request.page.unwrap_or(1).max(1);
        let limit = request.limit.unwrap_or(20).min(100).max(1);
        let offset = (page - 1) * limit;

        let mut query =
            sqlx::QueryBuilder::new("SELECT * FROM concours_entree WHERE is_active = true");

        if let Some(etablissement_id) = request.etablissement_id {
            query.push(" AND etablissement_id = ");
            query.push_bind(etablissement_id);
        }

        if let Some(filiere) = &request.filiere {
            query.push(" AND filiere = ");
            query.push_bind(filiere);
        }

        if let Some(date_min) = request.date_min {
            query.push(" AND date_concours >= ");
            query.push_bind(date_min);
        }

        if let Some(date_max) = request.date_max {
            query.push(" AND date_concours <= ");
            query.push_bind(date_max);
        }

        if request.actifs_seulement.unwrap_or(false) {
            let today = chrono::Utc::now().date_naive();
            query.push(" AND date_concours >= ");
            query.push_bind(today);
        }

        query.push(" ORDER BY date_concours ASC");
        query.push(" LIMIT ");
        query.push_bind(limit);
        query.push(" OFFSET ");
        query.push_bind(offset);

        let concours = query
            .build_query_as::<ConcoursEntree>()
            .fetch_all(&*self.pool)
            .await
            .map_err(|e| {
                error!("[CONCOURS_ENTREE] Erreur search: {}", e);
                AppError::Internal(format!("Erreur recherche concours: {}", e))
            })?;

        // Count query
        let mut count_query = sqlx::QueryBuilder::new(
            "SELECT COUNT(*)::bigint FROM concours_entree WHERE is_active = true",
        );

        if let Some(etablissement_id) = request.etablissement_id {
            count_query.push(" AND etablissement_id = ");
            count_query.push_bind(etablissement_id);
        }

        if let Some(filiere) = &request.filiere {
            count_query.push(" AND filiere = ");
            count_query.push_bind(filiere);
        }

        if let Some(date_min) = request.date_min {
            count_query.push(" AND date_concours >= ");
            count_query.push_bind(date_min);
        }

        if let Some(date_max) = request.date_max {
            count_query.push(" AND date_concours <= ");
            count_query.push_bind(date_max);
        }

        if request.actifs_seulement.unwrap_or(false) {
            let today = chrono::Utc::now().date_naive();
            count_query.push(" AND date_concours >= ");
            count_query.push_bind(today);
        }

        let total: i64 = count_query
            .build_query_scalar()
            .fetch_one(&*self.pool)
            .await
            .map_err(|e| {
                error!("[CONCOURS_ENTREE] Erreur count: {}", e);
                AppError::Internal(format!("Erreur count concours: {}", e))
            })?;

        Ok((concours, total))
    }

    /// Invalider le cache des concours actifs
    async fn invalidate_cache_actifs(&self) {
        let key = "orientation:concours:actifs";
        let _ = crate::utils::redis_helper::del_with_retry(&self.state.redis_client, key).await;
    }
}
