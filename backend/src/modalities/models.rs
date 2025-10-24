use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CustomModality {
    pub id: Uuid,
    pub product_type: String,
    pub field_name: String,
    pub modality: String,
    pub added_by: Option<String>,
    pub added_at: DateTime<Utc>,
    pub usage_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCustomModalityRequest {
    pub product_type: String,
    pub field_name: String,
    pub modality: String,
    pub added_by: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IncrementUsageRequest {
    pub product_type: String,
    pub field_name: String,
    pub modality: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomModalityResponse {
    pub success: bool,
    pub data: Option<Vec<CustomModality>>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PopularModalitiesRequest {
    pub product_type: String,
    pub field_name: String,
    pub limit: Option<i32>,
}

impl CustomModality {
    /// Créer une nouvelle modalité personnalisée
    pub async fn create(
        pool: &sqlx::PgPool,
        request: CreateCustomModalityRequest,
    ) -> Result<Self, sqlx::Error> {
        let modality = sqlx::query_as::<_, CustomModality>(
            r#"
            INSERT INTO custom_modalities (product_type, field_name, modality, added_by)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#
        )
        .bind(&request.product_type)
        .bind(&request.field_name)
        .bind(request.modality.trim())
        .bind(&request.added_by)
        .fetch_one(pool)
        .await?;

        Ok(modality)
    }

    /// Obtenir toutes les modalités personnalisées pour un champ spécifique
    pub async fn get_by_field(
        pool: &sqlx::PgPool,
        product_type: &str,
        field_name: &str,
    ) -> Result<Vec<String>, sqlx::Error> {
        #[derive(sqlx::FromRow)]
        struct ModalityRow {
            modality: String,
        }
        
        let modalities = sqlx::query_as::<_, ModalityRow>(
            r#"
            SELECT modality
            FROM custom_modalities
            WHERE product_type = $1 AND field_name = $2
            ORDER BY usage_count DESC, added_at DESC
            "#
        )
        .bind(product_type)
        .bind(field_name)
        .fetch_all(pool)
        .await?;

        Ok(modalities.into_iter().map(|m| m.modality).collect())
    }

    /// Incrémenter le compteur d'utilisation d'une modalité
    pub async fn increment_usage(
        pool: &sqlx::PgPool,
        request: IncrementUsageRequest,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            UPDATE custom_modalities
            SET usage_count = usage_count + 1,
                updated_at = NOW()
            WHERE product_type = $1 
              AND field_name = $2 
              AND LOWER(TRIM(modality)) = LOWER(TRIM($3))
            "#
        )
        .bind(&request.product_type)
        .bind(&request.field_name)
        .bind(&request.modality)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Obtenir les modalités les plus populaires
    pub async fn get_popular(
        pool: &sqlx::PgPool,
        request: PopularModalitiesRequest,
    ) -> Result<Vec<CustomModality>, sqlx::Error> {
        let limit = request.limit.unwrap_or(10);
        
        let modalities = sqlx::query_as::<_, CustomModality>(
            r#"
            SELECT *
            FROM custom_modalities
            WHERE product_type = $1 AND field_name = $2
            ORDER BY usage_count DESC, added_at DESC
            LIMIT $3
            "#
        )
        .bind(&request.product_type)
        .bind(&request.field_name)
        .bind(limit)
        .fetch_all(pool)
        .await?;

        Ok(modalities)
    }

    /// Obtenir toutes les modalités personnalisées
    pub async fn get_all(pool: &sqlx::PgPool) -> Result<Vec<CustomModality>, sqlx::Error> {
        let modalities = sqlx::query_as::<_, CustomModality>(
            r#"
            SELECT *
            FROM custom_modalities
            ORDER BY usage_count DESC, added_at DESC
            "#
        )
        .fetch_all(pool)
        .await?;

        Ok(modalities)
    }

    /// Supprimer une modalité personnalisée (pour la modération)
    pub async fn delete(
        pool: &sqlx::PgPool,
        id: Uuid,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            DELETE FROM custom_modalities
            WHERE id = $1
            "#
        )
        .bind(id)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Vérifier si une modalité existe déjà
    pub async fn exists(
        pool: &sqlx::PgPool,
        product_type: &str,
        field_name: &str,
        modality: &str,
    ) -> Result<bool, sqlx::Error> {
        #[derive(sqlx::FromRow)]
        struct CountRow {
            count: Option<i64>,
        }
        
        let count = sqlx::query_as::<_, CountRow>(
            r#"
            SELECT COUNT(*) as count
            FROM custom_modalities
            WHERE product_type = $1 
              AND field_name = $2 
              AND LOWER(TRIM(modality)) = LOWER(TRIM($3))
            "#
        )
        .bind(product_type)
        .bind(field_name)
        .bind(modality)
        .fetch_one(pool)
        .await?;

        Ok(count.count.unwrap_or(0) > 0)
    }

    /// Obtenir les statistiques des modalités
    pub async fn get_stats(pool: &sqlx::PgPool) -> Result<ModalityStats, sqlx::Error> {
        #[derive(sqlx::FromRow)]
        struct StatsRow {
            total_modalities: Option<i64>,
            total_product_types: Option<i64>,
            total_field_names: Option<i64>,
            total_usage: Option<i64>,
            avg_usage: Option<f64>,
        }
        
        let stats = sqlx::query_as::<_, StatsRow>(
            r#"
            SELECT 
                COUNT(*) as total_modalities,
                COUNT(DISTINCT product_type) as total_product_types,
                COUNT(DISTINCT field_name) as total_field_names,
                SUM(usage_count) as total_usage,
                AVG(usage_count) as avg_usage
            FROM custom_modalities
            "#
        )
        .fetch_one(pool)
        .await?;

        Ok(ModalityStats {
            total_modalities: stats.total_modalities.unwrap_or(0) as i32,
            total_product_types: stats.total_product_types.unwrap_or(0) as i32,
            total_field_names: stats.total_field_names.unwrap_or(0) as i32,
            total_usage: stats.total_usage.unwrap_or(0) as i32,
            avg_usage: stats.avg_usage.unwrap_or(0.0) as f64,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModalityStats {
    pub total_modalities: i32,
    pub total_product_types: i32,
    pub total_field_names: i32,
    pub total_usage: i32,
    pub avg_usage: f64,
}
