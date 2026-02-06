// ✅ Service pour gestion programmes scolaires

use crate::core::types::{AppError, AppResult};
use crate::models::orientation_scolaire::{
    CreateProgrammeRequest, ProgrammeScolaire, SearchProgrammesRequest,
};
use crate::state::AppState;
use log::{error, info};
use sqlx::PgPool;
use std::sync::Arc;

pub struct ProgrammesScolairesService {
    pool: Arc<PgPool>,
    #[allow(dead_code)]
    state: Arc<AppState>,
}

impl ProgrammesScolairesService {
    pub fn new(pool: Arc<PgPool>, state: Arc<AppState>) -> Self {
        Self { pool, state }
    }

    /// Upload un programme scolaire
    pub async fn upload_programme(
        &self,
        request: CreateProgrammeRequest,
    ) -> AppResult<ProgrammeScolaire> {
        info!(
            "[PROGRAMMES_SCOLAIRES] Upload programme: etablissement_id={}, niveau={}",
            request.etablissement_id, request.niveau
        );

        let programme = sqlx::query_as::<_, ProgrammeScolaire>(
            r#"
            INSERT INTO programmes_scolaires (
                etablissement_id, type_etablissement, niveau, classe, filiere,
                specialite, titre, description, annee_scolaire, fichier_url,
                fichier_nom, fichier_taille, is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (etablissement_id, niveau, annee_scolaire, COALESCE(filiere, ''))
            DO UPDATE SET
                titre = EXCLUDED.titre,
                description = EXCLUDED.description,
                fichier_url = EXCLUDED.fichier_url,
                fichier_nom = EXCLUDED.fichier_nom,
                fichier_taille = EXCLUDED.fichier_taille,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
            "#,
        )
        .bind(request.etablissement_id)
        .bind(request.type_etablissement)
        .bind(request.niveau)
        .bind(request.classe)
        .bind(request.filiere)
        .bind(request.specialite)
        .bind(request.titre)
        .bind(request.description)
        .bind(request.annee_scolaire)
        .bind(request.fichier_url)
        .bind(request.fichier_nom)
        .bind(request.fichier_taille)
        .bind(true) // is_active
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            error!("[PROGRAMMES_SCOLAIRES] Erreur upload: {}", e);
            AppError::Internal(format!("Erreur upload programme: {}", e))
        })?;

        info!(
            "[PROGRAMMES_SCOLAIRES] ✅ Programme uploadé: id={}",
            programme.id
        );
        Ok(programme)
    }

    /// Obtenir les programmes d'un établissement
    pub async fn get_programmes_by_etablissement(
        &self,
        etablissement_id: i32,
        page: Option<i64>,
        limit: Option<i64>,
    ) -> AppResult<(Vec<ProgrammeScolaire>, i64)> {
        let page = page.unwrap_or(1).max(1);
        let limit = limit.unwrap_or(20).min(100).max(1);
        let offset = (page - 1) * limit;

        let programmes = sqlx::query_as::<_, ProgrammeScolaire>(
            r#"
            SELECT * FROM programmes_scolaires
            WHERE etablissement_id = $1 AND is_active = true
            ORDER BY annee_scolaire DESC, niveau ASC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(etablissement_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| {
            error!("[PROGRAMMES_SCOLAIRES] Erreur get: {}", e);
            AppError::Internal(format!("Erreur récupération programmes: {}", e))
        })?;

        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*)::bigint FROM programmes_scolaires WHERE etablissement_id = $1 AND is_active = true"
        )
        .bind(etablissement_id)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            error!("[PROGRAMMES_SCOLAIRES] Erreur count: {}", e);
            AppError::Internal(format!("Erreur count programmes: {}", e))
        })?;

        Ok((programmes, total))
    }

    /// Rechercher des programmes
    pub async fn search_programmes(
        &self,
        request: SearchProgrammesRequest,
    ) -> AppResult<(Vec<ProgrammeScolaire>, i64)> {
        let page = request.page.unwrap_or(1).max(1);
        let limit = request.limit.unwrap_or(20).min(100).max(1);
        let offset = (page - 1) * limit;

        let mut conditions = vec!["is_active = true".to_string()];
        let mut query = sqlx::QueryBuilder::new("SELECT * FROM programmes_scolaires WHERE ");

        if let Some(etablissement_id) = request.etablissement_id {
            conditions.push(format!("etablissement_id = {}", etablissement_id));
        }

        if let Some(type_etablissement) = &request.type_etablissement {
            conditions.push(format!("type_etablissement = '{}'", type_etablissement));
        }

        if let Some(niveau) = &request.niveau {
            conditions.push(format!("niveau = '{}'", niveau));
        }

        if let Some(filiere) = &request.filiere {
            conditions.push(format!("filiere = '{}'", filiere));
        }

        if let Some(annee_scolaire) = &request.annee_scolaire {
            conditions.push(format!("annee_scolaire = '{}'", annee_scolaire));
        }

        query.push(conditions.join(" AND "));
        query.push(" ORDER BY annee_scolaire DESC, niveau ASC");
        query.push(" LIMIT ");
        query.push_bind(limit);
        query.push(" OFFSET ");
        query.push_bind(offset);

        let programmes = query
            .build_query_as::<ProgrammeScolaire>()
            .fetch_all(&*self.pool)
            .await
            .map_err(|e| {
            error!("[PROGRAMMES_SCOLAIRES] Erreur search: {}", e);
            AppError::Internal(format!("Erreur recherche programmes: {}", e))
        })?;

        let count_query = format!(
            "SELECT COUNT(*)::bigint FROM programmes_scolaires WHERE {}",
            conditions.join(" AND ")
        );
        let total: i64 =
            sqlx::query_scalar(&count_query).fetch_one(&*self.pool).await.map_err(|e| {
                error!("[PROGRAMMES_SCOLAIRES] Erreur count: {}", e);
                AppError::Internal(format!("Erreur count programmes: {}", e))
            })?;

        Ok((programmes, total))
    }
}
