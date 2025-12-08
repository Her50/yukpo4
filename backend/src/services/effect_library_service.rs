// ✅ NOUVEAU: Service de gestion de la bibliothèque d'effets vidéo étendue

use crate::core::types::{AppError, AppResult};
use crate::models::effect_model::Effect;
use log::{info, warn};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffectSearchParams {
    pub category: Option<String>,
    pub tags: Option<Vec<String>>,
    pub search_query: Option<String>,
    pub is_premium: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffectListResponse {
    pub effects: Vec<Effect>,
    pub total: i64,
    #[allow(dead_code)]
    pub limit: i64,
    #[allow(dead_code)]
    pub offset: i64,
}

pub struct EffectLibraryService {
    pool: PgPool,
}

impl EffectLibraryService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Récupère tous les effets avec filtres optionnels
    pub async fn list_effects(&self, params: EffectSearchParams) -> AppResult<EffectListResponse> {
        let limit = params.limit.unwrap_or(50).min(100); // Max 100
        let offset = params.offset.unwrap_or(0);

        let mut query_builder = sqlx::QueryBuilder::new(
            "SELECT id, name, category, description, ffmpeg_filter, parameters, tags, is_premium, popularity_score, created_at, updated_at FROM effects WHERE 1=1"
        );

        if let Some(category) = &params.category {
            query_builder.push(" AND category = ");
            query_builder.push_bind(category);
        }

        if let Some(ref tags) = params.tags {
            if !tags.is_empty() {
                query_builder.push(" AND tags && ");
                query_builder.push_bind(tags);
            }
        }

        if let Some(ref search_query) = params.search_query {
            if !search_query.is_empty() {
                query_builder.push(" AND (name ILIKE ");
                query_builder.push_bind(format!("%{}%", search_query));
                query_builder.push(" OR description ILIKE ");
                query_builder.push_bind(format!("%{}%", search_query));
                query_builder.push(")");
            }
        }

        if let Some(is_premium) = params.is_premium {
            query_builder.push(" AND is_premium = ");
            query_builder.push_bind(is_premium);
        }

        query_builder.push(" ORDER BY popularity_score DESC, name ASC");
        query_builder.push(" LIMIT ");
        query_builder.push_bind(limit);
        query_builder.push(" OFFSET ");
        query_builder.push_bind(offset);

        let effects: Vec<Effect> = query_builder
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(|e| {
                warn!("[EffectLibrary] Erreur requête effets: {}", e);
                AppError::Database(format!("Erreur récupération effets: {}", e))
            })?;

        // Compter le total
        let total_query = format!(
            "SELECT COUNT(*) FROM effects WHERE 1=1{}",
            build_where_clause(&params)
        );
        let total: i64 = sqlx::query_scalar(&total_query)
            .fetch_one(&self.pool)
            .await
            .unwrap_or(0);

        info!(
            "[EffectLibrary] ✅ {} effets trouvés (limit: {}, offset: {})",
            effects.len(),
            limit,
            offset
        );

        Ok(EffectListResponse {
            effects,
            total,
            limit,
            offset,
        })
    }

    /// Récupère un effet par son nom
    pub async fn get_effect_by_name(&self, name: &str) -> AppResult<Option<Effect>> {
        let effect = sqlx::query_as::<_, Effect>(
            "SELECT id, name, category, description, ffmpeg_filter, parameters, tags, is_premium, popularity_score, created_at, updated_at FROM effects WHERE name = $1"
        )
        .bind(name)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            warn!("[EffectLibrary] Erreur récupération effet {}: {}", name, e);
            AppError::Database(format!("Erreur récupération effet: {}", e))
        })?;

        Ok(effect)
    }

    /// Récupère les effets par catégorie
    pub async fn get_effects_by_category(&self, category: &str) -> AppResult<Vec<Effect>> {
        let effects = sqlx::query_as::<_, Effect>(
            "SELECT id, name, category, description, ffmpeg_filter, parameters, tags, is_premium, popularity_score, created_at, updated_at FROM effects WHERE category = $1 ORDER BY popularity_score DESC, name ASC"
        )
        .bind(category)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            warn!("[EffectLibrary] Erreur récupération effets catégorie {}: {}", category, e);
            AppError::Database(format!("Erreur récupération effets: {}", e))
        })?;

        info!(
            "[EffectLibrary] ✅ {} effets trouvés pour catégorie {}",
            effects.len(),
            category
        );

        Ok(effects)
    }

    /// Recherche d'effets par tags
    pub async fn search_effects_by_tags(&self, tags: &[String]) -> AppResult<Vec<Effect>> {
        if tags.is_empty() {
            return Ok(vec![]);
        }

        let effects = sqlx::query_as::<_, Effect>(
            "SELECT id, name, category, description, ffmpeg_filter, parameters, tags, is_premium, popularity_score, created_at, updated_at FROM effects WHERE tags && $1 ORDER BY popularity_score DESC, name ASC"
        )
        .bind(tags)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            warn!("[EffectLibrary] Erreur recherche par tags: {}", e);
            AppError::Database(format!("Erreur recherche effets: {}", e))
        })?;

        info!(
            "[EffectLibrary] ✅ {} effets trouvés pour tags {:?}",
            effects.len(),
            tags
        );

        Ok(effects)
    }

    /// Met à jour le score de popularité d'un effet
    pub async fn update_popularity_score(&self, effect_id: i32, score: f64) -> AppResult<()> {
        sqlx::query("UPDATE effects SET popularity_score = $1 WHERE id = $2")
            .bind(score)
            .bind(effect_id)
            .execute(&self.pool)
            .await
            .map_err(|e| {
                warn!("[EffectLibrary] Erreur mise à jour popularité: {}", e);
                AppError::Database(format!("Erreur mise à jour: {}", e))
            })?;

        Ok(())
    }
}

fn build_where_clause(params: &EffectSearchParams) -> String {
    let mut clauses = Vec::new();

    if let Some(category) = &params.category {
        clauses.push(format!(" AND category = '{}'", category));
    }

    if let Some(ref tags) = params.tags {
        if !tags.is_empty() {
            let tags_str = tags
                .iter()
                .map(|t| format!("'{}'", t))
                .collect::<Vec<_>>()
                .join(",");
            clauses.push(format!(" AND tags && ARRAY[{}]", tags_str));
        }
    }

    if let Some(ref search_query) = params.search_query {
        if !search_query.is_empty() {
            clauses.push(format!(
                " AND (name ILIKE '%{}%' OR description ILIKE '%{}%')",
                search_query, search_query
            ));
        }
    }

    if let Some(is_premium) = params.is_premium {
        clauses.push(format!(" AND is_premium = {}", is_premium));
    }

    clauses.join("")
}
