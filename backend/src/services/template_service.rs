// ✅ NOUVEAU: Service de gestion des templates vidéo par industrie

use crate::core::types::{AppError, AppResult};
use crate::models::template_model::VideoTemplate;
use sqlx::PgPool;

pub struct TemplateService {
    pool: PgPool,
}

impl TemplateService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Liste tous les templates avec filtres optionnels
    pub async fn list_templates(
        &self,
        industry: Option<&str>,
        subcategory: Option<&str>,
        search_query: Option<&str>,
        is_premium: Option<bool>,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> AppResult<(Vec<VideoTemplate>, i64)> {
        let mut query = sqlx::QueryBuilder::new("SELECT * FROM video_templates WHERE 1=1");

        if let Some(industry) = industry {
            query.push(" AND industry = ");
            query.push_bind(industry);
        }

        if let Some(subcategory) = subcategory {
            query.push(" AND subcategory = ");
            query.push_bind(subcategory);
        }

        if let Some(search) = search_query {
            query.push(" AND (name ILIKE ");
            query.push_bind(format!("%{}%", search));
            query.push(" OR description ILIKE ");
            query.push_bind(format!("%{}%", search));
            query.push(" OR EXISTS (SELECT 1 FROM unnest(tags) AS tag WHERE tag ILIKE ");
            query.push_bind(format!("%{}%", search));
            query.push("))");
        }

        if let Some(premium) = is_premium {
            query.push(" AND is_premium = ");
            query.push_bind(premium);
        }

        // Compter le total avant pagination
        let mut count_query =
            sqlx::QueryBuilder::new("SELECT COUNT(*) FROM video_templates WHERE 1=1");

        if let Some(industry) = industry {
            count_query.push(" AND industry = ");
            count_query.push_bind(industry);
        }
        if let Some(subcategory) = subcategory {
            count_query.push(" AND subcategory = ");
            count_query.push_bind(subcategory);
        }
        if let Some(search) = search_query {
            count_query.push(" AND (name ILIKE ");
            count_query.push_bind(format!("%{}%", search));
            count_query.push(" OR description ILIKE ");
            count_query.push_bind(format!("%{}%", search));
            count_query.push(" OR EXISTS (SELECT 1 FROM unnest(tags) AS tag WHERE tag ILIKE ");
            count_query.push_bind(format!("%{}%", search));
            count_query.push("))");
        }
        if let Some(premium) = is_premium {
            count_query.push(" AND is_premium = ");
            count_query.push_bind(premium);
        }

        let total: i64 = count_query
            .build_query_scalar()
            .fetch_one(&self.pool)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        // Ajouter tri et pagination
        query.push(" ORDER BY popularity_score DESC, usage_count DESC");

        if let Some(limit) = limit {
            query.push(" LIMIT ");
            query.push_bind(limit);
        }

        if let Some(offset) = offset {
            query.push(" OFFSET ");
            query.push_bind(offset);
        }

        let templates = query
            .build_query_as::<VideoTemplate>()
            .fetch_all(&self.pool)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok((templates, total))
    }

    /// Récupère un template par son nom
    pub async fn get_template_by_name(&self, name: &str) -> AppResult<Option<VideoTemplate>> {
        let template =
            sqlx::query_as::<_, VideoTemplate>("SELECT * FROM video_templates WHERE name = $1")
                .bind(name)
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(template)
    }

    /// Récupère les templates par industrie
    pub async fn get_templates_by_industry(&self, industry: &str) -> AppResult<Vec<VideoTemplate>> {
        let templates = sqlx::query_as::<_, VideoTemplate>(
            "SELECT * FROM video_templates WHERE industry = $1 ORDER BY popularity_score DESC, usage_count DESC"
        )
        .bind(industry)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(templates)
    }

    /// Récupère les templates par sous-catégorie
    pub async fn get_templates_by_subcategory(
        &self,
        industry: &str,
        subcategory: &str,
    ) -> AppResult<Vec<VideoTemplate>> {
        let templates = sqlx::query_as::<_, VideoTemplate>(
            "SELECT * FROM video_templates WHERE industry = $1 AND subcategory = $2 ORDER BY popularity_score DESC, usage_count DESC"
        )
        .bind(industry)
        .bind(subcategory)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(templates)
    }

    /// Incrémente le compteur d'utilisation d'un template
    pub async fn increment_usage(&self, template_id: i32) -> AppResult<()> {
        sqlx::query("UPDATE video_templates SET usage_count = usage_count + 1 WHERE id = $1")
            .bind(template_id)
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }

    /// Met à jour le score de popularité d'un template
    pub async fn update_popularity_score(&self, template_id: i32, score: f64) -> AppResult<()> {
        sqlx::query("UPDATE video_templates SET popularity_score = $1 WHERE id = $2")
            .bind(score)
            .bind(template_id)
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }

    /// Recherche de templates par tags
    pub async fn search_templates_by_tags(&self, tags: &[String]) -> AppResult<Vec<VideoTemplate>> {
        let templates = sqlx::query_as::<_, VideoTemplate>(
            "SELECT * FROM video_templates WHERE tags && $1::text[] ORDER BY popularity_score DESC",
        )
        .bind(tags)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(templates)
    }
}
