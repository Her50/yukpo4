use serde_json::Value;
use sqlx::PgPool;

/// Service pour filtrer les publicités selon le ciblage avancé et retargeting
pub struct PubliciteFilteringService;

impl PubliciteFilteringService {
    /// Filtrer les publicités selon le ciblage avancé
    pub async fn filter_by_targeting(
        pool: &PgPool,
        publicite_ids: Vec<i32>,
        user_age: Option<i32>,
        user_gender: Option<String>,
        user_interests: Option<Vec<String>>,
        user_behaviors: Option<Vec<String>>,
    ) -> Result<Vec<i32>, sqlx::Error> {
        if publicite_ids.is_empty() {
            return Ok(vec![]);
        }

        let age = user_age.unwrap_or(30);
        let gender = user_gender.unwrap_or_else(|| "all".to_string());
        let interests = user_interests.unwrap_or_default();
        let behaviors = user_behaviors.unwrap_or_default();

        // Utiliser la fonction SQL matches_targeting
        let filtered_ids: Vec<i32> = sqlx::query_scalar(
            r#"
            SELECT id
            FROM publicites
            WHERE id = ANY($1)
            AND (
                targeting IS NULL 
                OR targeting = '{}'::jsonb
                OR matches_targeting(
                    targeting,
                    $2,
                    $3,
                    $4::text[],
                    $5::text[]
                )
            )
            "#,
        )
        .bind(&publicite_ids)
        .bind(age)
        .bind(&gender)
        .bind(&interests)
        .bind(&behaviors)
        .fetch_all(pool)
        .await?;

        Ok(filtered_ids)
    }

    /// Filtrer les publicités selon le retargeting
    pub async fn filter_by_retargeting(
        pool: &PgPool,
        publicite_ids: Vec<i32>,
        user_id: i32,
    ) -> Result<Vec<i32>, sqlx::Error> {
        if publicite_ids.is_empty() {
            return Ok(vec![]);
        }

        // Utiliser la fonction SQL matches_retargeting
        let filtered_ids: Vec<i32> = sqlx::query_scalar(
            r#"
            SELECT id
            FROM publicites
            WHERE id = ANY($1)
            AND (
                retargeting IS NULL
                OR retargeting = '{}'::jsonb
                OR matches_retargeting(retargeting, $2)
            )
            "#,
        )
        .bind(&publicite_ids)
        .bind(user_id)
        .fetch_all(pool)
        .await?;

        Ok(filtered_ids)
    }

    /// Sélectionner la meilleure variante A/B pour une publicité
    pub async fn select_best_ab_variant(
        pool: &PgPool,
        publicite_id: i32,
    ) -> Result<Option<String>, sqlx::Error> {
        // Récupérer les performances des variantes
        let variant_perf: Option<Value> = sqlx::query_scalar(
            r#"
            SELECT variant_performance
            FROM publicites
            WHERE id = $1
            "#,
        )
        .bind(publicite_id)
        .fetch_optional(pool)
        .await?;

        if let Some(perf) = variant_perf {
            if let Some(perf_obj) = perf.as_object() {
                // Trouver la variante avec le meilleur CTR
                let mut best_variant: Option<String> = None;
                let mut best_ctr = 0.0;

                for (variant_id, variant_data) in perf_obj {
                    if let Some(ctr) = variant_data.get("ctr").and_then(|v| v.as_f64()) {
                        if ctr > best_ctr {
                            best_ctr = ctr;
                            best_variant = Some(variant_id.clone());
                        }
                    }
                }

                return Ok(best_variant);
            }
        }

        Ok(None)
    }

    /// Mettre à jour les performances d'une variante A/B
    pub async fn update_variant_performance(
        pool: &PgPool,
        publicite_id: i32,
        variant_id: &str,
        views: i32,
        clicks: i32,
    ) -> Result<(), sqlx::Error> {
        let ctr = if views > 0 {
            (clicks as f64 / views as f64) * 100.0
        } else {
            0.0
        };

        sqlx::query(
            r#"
            UPDATE publicites
            SET variant_performance = COALESCE(variant_performance, '{}'::jsonb) || 
                jsonb_build_object(
                    $2,
                    jsonb_build_object(
                        'views', $3,
                        'clicks', $4,
                        'ctr', $5
                    )
                )
            WHERE id = $1
            "#,
        )
        .bind(publicite_id)
        .bind(variant_id)
        .bind(views)
        .bind(clicks)
        .bind(ctr)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Obtenir les placements actifs pour une publicité
    pub async fn get_active_placements(
        pool: &PgPool,
        publicite_id: i32,
    ) -> Result<Vec<String>, sqlx::Error> {
        let placements: Option<Value> = sqlx::query_scalar(
            r#"
            SELECT placements
            FROM publicites
            WHERE id = $1
            "#,
        )
        .bind(publicite_id)
        .fetch_optional(pool)
        .await?;

        if let Some(placements_value) = placements {
            if let Some(placements_array) = placements_value.as_array() {
                let active_placements: Vec<String> = placements_array
                    .iter()
                    .filter_map(|p| p.get("type").and_then(|t| t.as_str()).map(|s| s.to_string()))
                    .collect();
                return Ok(active_placements);
            }
        }

        Ok(vec!["feed".to_string()]) // Par défaut: feed
    }
}
