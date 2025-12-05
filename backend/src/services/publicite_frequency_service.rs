use log;
use sqlx::PgPool;

/// Service pour gérer la fréquence d'affichage des publicités
pub struct PubliciteFrequencyService;

impl PubliciteFrequencyService {
    /// Vérifier si une publicité peut être affichée à un utilisateur selon la fréquence
    pub async fn can_display(
        pool: &PgPool,
        publicite_id: i32,
        user_id: i32,
        frequency_type: Option<&str>, // "daily" | "weekly" | "unlimited"
    ) -> Result<bool, sqlx::Error> {
        let freq_type = frequency_type.unwrap_or("daily");

        let can_display: bool = sqlx::query_scalar(
            r#"
            SELECT check_publicite_frequency($1, $2, $3)
            "#,
        )
        .bind(publicite_id)
        .bind(user_id)
        .bind(freq_type)
        .fetch_one(pool)
        .await?;

        Ok(can_display)
    }

    /// Enregistrer une impression (affichage) de publicité
    pub async fn record_impression(
        pool: &PgPool,
        publicite_id: i32,
        user_id: i32,
        placement: &str, // "feed", "stories", "carousel", etc.
    ) -> Result<i32, sqlx::Error> {
        let impression_id: i32 = sqlx::query_scalar(
            r#"
            SELECT record_publicite_impression($1, $2, $3)
            "#,
        )
        .bind(publicite_id)
        .bind(user_id)
        .bind(placement)
        .fetch_one(pool)
        .await?;

        log::debug!(
            "[Frequency] Impression enregistrée: pub_id={}, user_id={}, placement={}, id={}",
            publicite_id,
            user_id,
            placement,
            impression_id
        );

        Ok(impression_id)
    }

    /// Obtenir le nombre d'impressions pour un utilisateur et une publicité
    pub async fn get_impression_count(
        pool: &PgPool,
        publicite_id: i32,
        user_id: i32,
        period: &str, // "day" | "week" | "month" | "all"
    ) -> Result<i64, sqlx::Error> {
        let query = match period {
            "day" => {
                r#"
                SELECT COUNT(*)::bigint
                FROM publicite_impressions
                WHERE publicite_id = $1
                AND user_id = $2
                AND viewed_at >= CURRENT_DATE
            "#
            }
            "week" => {
                r#"
                SELECT COUNT(*)::bigint
                FROM publicite_impressions
                WHERE publicite_id = $1
                AND user_id = $2
                AND viewed_at >= DATE_TRUNC('week', CURRENT_DATE)
            "#
            }
            "month" => {
                r#"
                SELECT COUNT(*)::bigint
                FROM publicite_impressions
                WHERE publicite_id = $1
                AND user_id = $2
                AND viewed_at >= DATE_TRUNC('month', CURRENT_DATE)
            "#
            }
            _ => {
                r#"
                SELECT COUNT(*)::bigint
                FROM publicite_impressions
                WHERE publicite_id = $1
                AND user_id = $2
            "#
            }
        };

        let count: i64 = sqlx::query_scalar(query)
            .bind(publicite_id)
            .bind(user_id)
            .fetch_one(pool)
            .await?;

        Ok(count)
    }

    /// Filtrer les publicités selon la fréquence pour un utilisateur
    pub async fn filter_by_frequency(
        pool: &PgPool,
        publicite_ids: Vec<i32>,
        user_id: i32,
        frequency_type: Option<&str>,
    ) -> Result<Vec<i32>, sqlx::Error> {
        if publicite_ids.is_empty() {
            return Ok(vec![]);
        }

        let freq_type = frequency_type.unwrap_or("daily");

        // Filtrer les publicités qui peuvent être affichées
        let filtered_ids: Vec<i32> = sqlx::query_scalar(
            r#"
            SELECT id
            FROM publicites
            WHERE id = ANY($1)
            AND (
                frequency_config IS NULL
                OR frequency_config = '{}'::jsonb
                OR check_publicite_frequency(id, $2, $3)
            )
            "#,
        )
        .bind(&publicite_ids)
        .bind(user_id)
        .bind(freq_type)
        .fetch_all(pool)
        .await?;

        Ok(filtered_ids)
    }
}
