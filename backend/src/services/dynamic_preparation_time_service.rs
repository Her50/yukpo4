use crate::core::types::AppResult;
use chrono::{DateTime, Utc};
use log::{info, warn};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

/// Service pour calculer dynamiquement les durées de préparation par catégorie
pub struct DynamicPreparationTimeService {
    pool: PgPool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryPreparationStats {
    pub category: String,
    pub avg_preparation_minutes: f64,
    pub median_preparation_minutes: f64,
    pub sample_count: i32,
    pub last_calculated_at: DateTime<Utc>,
}

impl DynamicPreparationTimeService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Récupère ou calcule le temps de préparation pour une catégorie
    pub async fn get_preparation_time_for_category(
        &self,
        category: &str,
    ) -> AppResult<Option<i32>> {
        // Récupérer les stats de la catégorie
        let median: Option<f64> = sqlx::query_scalar(
            r#"
            SELECT median_preparation_minutes
            FROM category_preparation_stats
            WHERE category = $1
            "#,
        )
        .bind(category)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(median) = median {
            // Utiliser la médiane comme valeur par défaut (plus robuste que la moyenne)
            return Ok(Some(median as i32));
        }

        // Pas de stats disponibles, retourner None (utiliser valeur par défaut)
        Ok(None)
    }

    /// Calcule et met à jour les statistiques de préparation pour toutes les catégories
    pub async fn recalculate_all_category_stats(&self) -> AppResult<usize> {
        info!("[DynamicPreparationTime] Recalcul des statistiques par catégorie...");

        // Récupérer toutes les catégories uniques depuis les services
        let categories: Vec<String> = sqlx::query_scalar(
            r#"
            SELECT DISTINCT category
            FROM services
            WHERE category IS NOT NULL
            AND category != ''
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        let mut updated_count = 0;

        for category in categories {
            if category.is_empty() {
                continue;
            }

            match self.recalculate_category_stats(&category).await {
                Ok(_) => {
                    updated_count += 1;
                    info!(
                        "[DynamicPreparationTime] ✅ Stats mises à jour pour catégorie: {}",
                        category
                    );
                }
                Err(e) => {
                    warn!(
                        "[DynamicPreparationTime] ❌ Erreur calcul stats pour catégorie {}: {}",
                        category, e
                    );
                }
            }
        }

        info!(
            "[DynamicPreparationTime] ✅ Recalcul terminé: {} catégories mises à jour",
            updated_count
        );

        Ok(updated_count)
    }

    /// Calcule les statistiques de préparation pour une catégorie spécifique
    pub async fn recalculate_category_stats(&self, category: &str) -> AppResult<()> {
        // Récupérer les temps de préparation observés pour cette catégorie
        // Depuis product_orders où le statut est 'ready' ou 'delivered'
        struct PreparationTimeRow {
            preparation_time_minutes: Option<i32>,
            actual_minutes: Option<f64>,
        }

        let preparation_times: Vec<PreparationTimeRow> = sqlx::query(
            r#"
            SELECT 
                po.preparation_time_minutes,
                EXTRACT(EPOCH FROM (po.estimated_ready_at - po.validated_at)) / 60.0 as actual_minutes
            FROM product_orders po
            INNER JOIN services s ON s.id = po.service_id
            WHERE s.category = $1
            AND po.status IN ('ready', 'delivered', 'picked_up')
            AND po.preparation_time_minutes IS NOT NULL
            AND po.validated_at IS NOT NULL
            AND po.estimated_ready_at IS NOT NULL
            AND po.estimated_ready_at >= po.validated_at
            ORDER BY po.validated_at DESC
            LIMIT 1000
            "#,
        )
        .bind(category)
        .map(|row: sqlx::postgres::PgRow| PreparationTimeRow {
            preparation_time_minutes: row.get::<Option<_>, _>("preparation_time_minutes"),
            actual_minutes: row.get::<Option<_>, _>("actual_minutes"),
        })
        .fetch_all(&self.pool)
        .await?;

        if preparation_times.is_empty() {
            // Pas assez de données, utiliser valeurs par défaut
            self.upsert_category_stats(category, 30.0, 30.0, 0).await?;
            return Ok(());
        }

        // Calculer moyenne et médiane
        let mut times: Vec<f64> = preparation_times
            .iter()
            .filter_map(|row| {
                // Utiliser actual_minutes si disponible, sinon preparation_time_minutes
                if let Some(actual) = row.actual_minutes {
                    if actual > 0.0 && actual < 10080.0 {
                        // Entre 0 et 7 jours (raisonnable)
                        Some(actual)
                    } else {
                        row.preparation_time_minutes.map(|t| t as f64)
                    }
                } else {
                    row.preparation_time_minutes.map(|t| t as f64)
                }
            })
            .collect();

        if times.is_empty() {
            self.upsert_category_stats(category, 30.0, 30.0, 0).await?;
            return Ok(());
        }

        times.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

        let count = times.len();
        let sum: f64 = times.iter().sum();
        let avg = sum / count as f64;

        // Calculer la médiane
        let median = if count % 2 == 0 {
            let mid = count / 2;
            (times[mid - 1] + times[mid]) / 2.0
        } else {
            times[count / 2]
        };

        // Mettre à jour les stats
        self.upsert_category_stats(category, avg, median, count as i32)
            .await?;

        Ok(())
    }

    /// Met à jour ou crée les statistiques d'une catégorie
    async fn upsert_category_stats(
        &self,
        category: &str,
        avg: f64,
        median: f64,
        sample_count: i32,
    ) -> AppResult<()> {
        sqlx::query(
            r#"
            INSERT INTO category_preparation_stats (
                category,
                avg_preparation_minutes,
                median_preparation_minutes,
                sample_count,
                last_calculated_at
            )
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (category) DO UPDATE SET
                avg_preparation_minutes = EXCLUDED.avg_preparation_minutes,
                median_preparation_minutes = EXCLUDED.median_preparation_minutes,
                sample_count = EXCLUDED.sample_count,
                last_calculated_at = EXCLUDED.last_calculated_at,
                updated_at = NOW()
            "#,
        )
        .bind(category)
        .bind(avg)
        .bind(median)
        .bind(sample_count)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Récupère les statistiques d'une catégorie
    pub async fn get_category_stats(
        &self,
        category: &str,
    ) -> AppResult<Option<CategoryPreparationStats>> {
        let row = sqlx::query(
            r#"
            SELECT 
                category,
                avg_preparation_minutes,
                median_preparation_minutes,
                sample_count,
                last_calculated_at
            FROM category_preparation_stats
            WHERE category = $1
            "#,
        )
        .bind(category)
        .map(|row: sqlx::postgres::PgRow| CategoryPreparationStats {
            category: row.get::<String, _>("category"),
            avg_preparation_minutes: row.get::<f64, _>("avg_preparation_minutes"),
            median_preparation_minutes: row.get::<f64, _>("median_preparation_minutes"),
            sample_count: row.get::<i32, _>("sample_count"),
            last_calculated_at: row.get::<DateTime<Utc>, _>("last_calculated_at"),
        })
        .fetch_optional(&self.pool)
        .await?;

        Ok(row)
    }
}
