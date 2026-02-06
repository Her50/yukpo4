// ✅ Service pour gestion fournitures scolaires

use crate::core::types::{AppError, AppResult};
use crate::models::orientation_scolaire::{
    CreateFournituresRequest, FournituresScolaires, SearchFournituresRequest,
};
use crate::state::AppState;
use log::{error, info};
use sqlx::PgPool;
use std::sync::Arc;

pub struct FournituresScolairesService {
    pool: Arc<PgPool>,
    #[allow(dead_code)]
    state: Arc<AppState>,
}

impl FournituresScolairesService {
    pub fn new(pool: Arc<PgPool>, state: Arc<AppState>) -> Self {
        Self { pool, state }
    }

    /// Upload une liste de fournitures
    pub async fn upload_fournitures(
        &self,
        request: CreateFournituresRequest,
    ) -> AppResult<FournituresScolaires> {
        info!(
            "[FOURNITURES_SCOLAIRES] Upload fournitures: etablissement_id={}, niveau={}",
            request.etablissement_id, request.niveau
        );

        let fournitures = sqlx::query_as::<_, FournituresScolaires>(
            r#"
            INSERT INTO fournitures_scolaires (
                etablissement_id, type_etablissement, niveau, classe,
                annee_scolaire, liste_fournitures, fichier_url, fichier_nom, is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (etablissement_id, niveau, annee_scolaire)
            DO UPDATE SET
                liste_fournitures = EXCLUDED.liste_fournitures,
                fichier_url = EXCLUDED.fichier_url,
                fichier_nom = EXCLUDED.fichier_nom,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
            "#,
        )
        .bind(request.etablissement_id)
        .bind(request.type_etablissement)
        .bind(request.niveau)
        .bind(request.classe)
        .bind(request.annee_scolaire)
        .bind(request.liste_fournitures)
        .bind(request.fichier_url)
        .bind(request.fichier_nom)
        .bind(true) // is_active
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            error!("[FOURNITURES_SCOLAIRES] Erreur upload: {}", e);
            AppError::Internal(format!("Erreur upload fournitures: {}", e))
        })?;

        info!(
            "[FOURNITURES_SCOLAIRES] ✅ Fournitures uploadées: id={}",
            fournitures.id
        );
        Ok(fournitures)
    }

    /// Obtenir les fournitures d'un établissement
    pub async fn get_fournitures_by_etablissement(
        &self,
        etablissement_id: i32,
        page: Option<i64>,
        limit: Option<i64>,
    ) -> AppResult<(Vec<FournituresScolaires>, i64)> {
        let page = page.unwrap_or(1).max(1);
        let limit = limit.unwrap_or(20).min(100).max(1);
        let offset = (page - 1) * limit;

        let fournitures = sqlx::query_as::<_, FournituresScolaires>(
            r#"
            SELECT * FROM fournitures_scolaires
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
            error!("[FOURNITURES_SCOLAIRES] Erreur get: {}", e);
            AppError::Internal(format!("Erreur récupération fournitures: {}", e))
        })?;

        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*)::bigint FROM fournitures_scolaires WHERE etablissement_id = $1 AND is_active = true"
        )
        .bind(etablissement_id)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            error!("[FOURNITURES_SCOLAIRES] Erreur count: {}", e);
            AppError::Internal(format!("Erreur count fournitures: {}", e))
        })?;

        Ok((fournitures, total))
    }

    /// Rechercher des fournitures
    pub async fn search_fournitures(
        &self,
        request: SearchFournituresRequest,
    ) -> AppResult<(Vec<FournituresScolaires>, i64)> {
        let page = request.page.unwrap_or(1).max(1);
        let limit = request.limit.unwrap_or(20).min(100).max(1);
        let offset = (page - 1) * limit;

        let mut conditions = vec!["is_active = true".to_string()];
        let mut query = sqlx::QueryBuilder::new("SELECT * FROM fournitures_scolaires WHERE ");

        if let Some(etablissement_id) = request.etablissement_id {
            conditions.push(format!("etablissement_id = {}", etablissement_id));
        }

        if let Some(type_etablissement) = &request.type_etablissement {
            conditions.push(format!("type_etablissement = '{}'", type_etablissement));
        }

        if let Some(niveau) = &request.niveau {
            conditions.push(format!("niveau = '{}'", niveau));
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

        let fournitures = query
            .build_query_as::<FournituresScolaires>()
            .fetch_all(&*self.pool)
            .await
            .map_err(|e| {
                error!("[FOURNITURES_SCOLAIRES] Erreur search: {}", e);
                AppError::Internal(format!("Erreur recherche fournitures: {}", e))
            })?;

        let count_query = format!(
            "SELECT COUNT(*)::bigint FROM fournitures_scolaires WHERE {}",
            conditions.join(" AND ")
        );
        let total: i64 =
            sqlx::query_scalar(&count_query).fetch_one(&*self.pool).await.map_err(|e| {
                error!("[FOURNITURES_SCOLAIRES] Erreur count: {}", e);
                AppError::Internal(format!("Erreur count fournitures: {}", e))
            })?;

        Ok((fournitures, total))
    }
}
