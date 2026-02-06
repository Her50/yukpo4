/**
 * Service d'analytics avancés pour Video Feed
 * Heatmaps, A/B testing, cohort analysis, funnel analysis
 */
use crate::core::types::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoAnalytics {
    pub video_id: String,
    pub total_views: i64,
    pub unique_viewers: i64,
    pub avg_watch_duration: f64,
    pub completion_rate: f64,
    pub engagement_rate: f64,
    pub drop_off_points: Vec<DropOffPoint>,
    pub heatmap_data: Vec<HeatmapPoint>,
    pub audience_retention: Vec<RetentionPoint>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DropOffPoint {
    pub timestamp_seconds: f64,
    pub drop_off_percentage: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HeatmapPoint {
    pub timestamp_seconds: f64,
    pub interaction_count: i64,
    pub interaction_type: String, // "like", "comment", "share", "skip"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RetentionPoint {
    pub timestamp_seconds: f64,
    pub retention_percentage: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ABTestResult {
    pub test_id: String,
    pub variant_a: TestVariant,
    pub variant_b: TestVariant,
    pub winner: Option<String>, // "A", "B", or null if inconclusive
    pub confidence: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TestVariant {
    pub name: String,
    pub participants: i64,
    pub conversions: i64,
    pub conversion_rate: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CohortAnalysis {
    pub cohort_date: String,
    pub cohort_size: i64,
    pub retention_days: Vec<DayRetention>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DayRetention {
    pub day: i32,
    pub retained_users: i64,
    pub retention_rate: f64,
}

pub struct AdvancedAnalyticsService;

impl AdvancedAnalyticsService {
    /// Analyse complète d'une vidéo
    pub async fn analyze_video(pool: &PgPool, video_id: &str) -> AppResult<VideoAnalytics> {
        // Récupérer données de base
        let base_stats_row = sqlx::query(
            r#"
            SELECT 
                COUNT(*) as total_views,
                COUNT(DISTINCT user_id) as unique_viewers,
                AVG(watch_duration_ms) as avg_watch_duration,
                AVG(completion_rate) as avg_completion_rate
            FROM content_engagement
            WHERE content_id = $1
            AND created_at > NOW() - INTERVAL '30 days'
            "#,
        )
        .bind(video_id)
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur analytics base: {}", e)))?;

        // Calculer engagement rate
        let engagement_row = sqlx::query(
            r#"
            SELECT 
                COUNT(CASE WHEN liked = TRUE THEN 1 END) as likes,
                COUNT(CASE WHEN saved = TRUE THEN 1 END) as saves,
                COUNT(CASE WHEN shared = TRUE THEN 1 END) as shares,
                COUNT(*) as total_views
            FROM content_engagement
            WHERE content_id = $1
            AND created_at > NOW() - INTERVAL '30 days'
            "#,
        )
        .bind(video_id)
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur engagement: {}", e)))?;

        let likes: i64 = engagement_row.get::<Option<i64>, _>("likes").unwrap_or(0);
        let saves: i64 = engagement_row.get::<Option<i64>, _>("saves").unwrap_or(0);
        let shares: i64 = engagement_row.get::<Option<i64>, _>("shares").unwrap_or(0);
        let total_views_eng: i64 = engagement_row.get::<Option<i64>, _>("total_views").unwrap_or(1);

        let total_engagements = (likes + saves + shares) as f64;
        let total_views = total_views_eng as f64;
        let engagement_rate = (total_engagements / total_views) * 100.0;

        // Analyser points de drop-off
        let drop_off_points = Self::analyze_drop_offs(pool, video_id).await?;

        // Générer heatmap
        let heatmap_data = Self::generate_heatmap(pool, video_id).await?;

        // Analyser rétention audience
        let audience_retention = Self::analyze_audience_retention(pool, video_id).await?;

        Ok(VideoAnalytics {
            video_id: video_id.to_string(),
            total_views: base_stats_row.get::<Option<i64>, _>("total_views").unwrap_or(0),
            unique_viewers: base_stats_row.get::<Option<i64>, _>("unique_viewers").unwrap_or(0),
            avg_watch_duration: base_stats_row
                .get::<Option<f64>, _>("avg_watch_duration")
                .unwrap_or(0.0)
                / 1000.0, // en secondes
            completion_rate: base_stats_row
                .get::<Option<f64>, _>("avg_completion_rate")
                .unwrap_or(0.0)
                * 100.0,
            engagement_rate,
            drop_off_points,
            heatmap_data,
            audience_retention,
        })
    }

    /// Analyse les points de drop-off (où les utilisateurs quittent)
    async fn analyze_drop_offs(pool: &PgPool, video_id: &str) -> AppResult<Vec<DropOffPoint>> {
        let data_rows = sqlx::query(
            r#"
            SELECT 
                FLOOR(watch_duration_ms / 1000.0 / 5) * 5 as timestamp_bucket,
                COUNT(*) as viewers_at_time,
                COUNT(CASE WHEN watch_duration_ms < (FLOOR(watch_duration_ms / 1000.0 / 5) * 5 + 5) * 1000 THEN 1 END) as dropped_off
            FROM content_engagement
            WHERE content_id = $1
            AND watch_duration_ms IS NOT NULL
            GROUP BY timestamp_bucket
            ORDER BY timestamp_bucket
            "#
        )
        .bind(video_id)
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur drop-off: {}", e)))?;

        let mut drop_offs = Vec::new();
        let mut previous_count = 0i64;

        for row in data_rows {
            let timestamp = row.get::<Option<f64>, _>("timestamp_bucket").unwrap_or(0.0);
            let current_count = row.get::<Option<i64>, _>("viewers_at_time").unwrap_or(0);
            let dropped = row.get::<Option<i64>, _>("dropped_off").unwrap_or(0);

            if previous_count > 0 {
                let drop_off_pct = (dropped as f64 / previous_count as f64) * 100.0;
                drop_offs.push(DropOffPoint {
                    timestamp_seconds: timestamp,
                    drop_off_percentage: drop_off_pct,
                });
            }

            previous_count = current_count;
        }

        Ok(drop_offs)
    }

    /// Génère heatmap des interactions
    async fn generate_heatmap(pool: &PgPool, video_id: &str) -> AppResult<Vec<HeatmapPoint>> {
        let data_rows = sqlx::query(
            r#"
            SELECT 
                FLOOR(watch_duration_ms / 1000.0) as timestamp_seconds,
                COUNT(CASE WHEN liked = TRUE THEN 1 END) as likes,
                COUNT(CASE WHEN saved = TRUE THEN 1 END) as saves,
                COUNT(CASE WHEN shared = TRUE THEN 1 END) as shares,
                COUNT(CASE WHEN watch_duration_ms < (FLOOR(watch_duration_ms / 1000.0) + 1) * 1000 THEN 1 END) as skips
            FROM content_engagement
            WHERE content_id = $1
            AND watch_duration_ms IS NOT NULL
            GROUP BY timestamp_seconds
            ORDER BY timestamp_seconds
            "#
        )
        .bind(video_id)
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur heatmap: {}", e)))?;

        let mut heatmap = Vec::new();

        for row in data_rows {
            let timestamp = row.get::<Option<f64>, _>("timestamp_seconds").unwrap_or(0.0);

            // Likes
            let likes: i64 = row.get::<Option<i64>, _>("likes").unwrap_or(0);
            if likes > 0 {
                heatmap.push(HeatmapPoint {
                    timestamp_seconds: timestamp,
                    interaction_count: likes,
                    interaction_type: "like".to_string(),
                });
            }

            // Saves
            let saves: i64 = row.get::<Option<i64>, _>("saves").unwrap_or(0);
            if saves > 0 {
                heatmap.push(HeatmapPoint {
                    timestamp_seconds: timestamp,
                    interaction_count: saves,
                    interaction_type: "save".to_string(),
                });
            }

            // Shares
            let shares: i64 = row.get::<Option<i64>, _>("shares").unwrap_or(0);
            if shares > 0 {
                heatmap.push(HeatmapPoint {
                    timestamp_seconds: timestamp,
                    interaction_count: shares,
                    interaction_type: "share".to_string(),
                });
            }

            // Skips
            let skips: i64 = row.get::<Option<i64>, _>("skips").unwrap_or(0);
            if skips > 0 {
                heatmap.push(HeatmapPoint {
                    timestamp_seconds: timestamp,
                    interaction_count: skips,
                    interaction_type: "skip".to_string(),
                });
            }
        }

        Ok(heatmap)
    }

    /// Analyse rétention audience
    async fn analyze_audience_retention(
        pool: &PgPool,
        video_id: &str,
    ) -> AppResult<Vec<RetentionPoint>> {
        // Récupérer durée vidéo (approximative depuis max watch_duration)
        let max_duration = sqlx::query_scalar::<_, Option<i64>>(
            r#"
            SELECT MAX(watch_duration_ms)
            FROM content_engagement
            WHERE content_id = $1
            "#,
        )
        .bind(video_id)
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur durée max: {}", e)))?;

        let video_duration_seconds = (max_duration.unwrap_or(60000) / 1000) as f64;
        let total_viewers = sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COUNT(DISTINCT user_id)
            FROM content_engagement
            WHERE content_id = $1
            "#,
        )
        .bind(video_id)
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur viewers: {}", e)))?;

        // Analyser rétention par segments de 10%
        let mut retention = Vec::new();
        let segments = 10;

        for i in 0..segments {
            let segment_start = (video_duration_seconds * (i as f64 / segments as f64)) as i64;
            let segment_end = (video_duration_seconds * ((i + 1) as f64 / segments as f64)) as i64;

            let viewers_at_segment = sqlx::query_scalar::<_, i64>(
                r#"
                SELECT COUNT(DISTINCT user_id)
                FROM content_engagement
                WHERE content_id = $1
                AND watch_duration_ms >= $2
                AND watch_duration_ms < $3
                "#,
            )
            .bind(video_id)
            .bind(segment_start * 1000)
            .bind(segment_end * 1000)
            .fetch_one(pool)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur segment: {}", e)))?;

            let retention_pct = if total_viewers > 0 {
                (viewers_at_segment as f64 / total_viewers as f64) * 100.0
            } else {
                0.0
            };

            retention.push(RetentionPoint {
                timestamp_seconds: segment_start as f64,
                retention_percentage: retention_pct,
            });
        }

        Ok(retention)
    }

    /// Analyse A/B test
    pub async fn analyze_ab_test(_pool: &PgPool, test_id: &str) -> AppResult<ABTestResult> {
        // Table ab_tests n'existe pas encore - retourner résultat vide
        log::warn!("Table ab_tests n'existe pas, retour résultat vide");
        return Ok(ABTestResult {
            test_id: test_id.to_string(),
            variant_a: TestVariant {
                name: "A".to_string(),
                participants: 0,
                conversions: 0,
                conversion_rate: 0.0,
            },
            variant_b: TestVariant {
                name: "B".to_string(),
                participants: 0,
                conversions: 0,
                conversion_rate: 0.0,
            },
            winner: None,
            confidence: 0.0,
        });

        /* TODO: Décommenter quand table ab_tests sera créée
        let data = sqlx::query!(
            r#"
            SELECT
                variant,
                COUNT(*) as participants,
                COUNT(CASE WHEN converted = TRUE THEN 1 END) as conversions
            FROM ab_tests
            WHERE test_id = $1
            GROUP BY variant
            "#,
            test_id
        )
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur A/B test: {}", e)))?;

        let mut variant_a = None;
        let mut variant_b = None;

        for row in data {
            let variant = TestVariant {
                name: row.variant.unwrap_or_default(),
                participants: row.participants.unwrap_or(0),
                conversions: row.conversions.unwrap_or(0),
                conversion_rate: if row.participants.unwrap_or(0) > 0 {
                    (row.conversions.unwrap_or(0) as f64 / row.participants.unwrap_or(0) as f64)
                        * 100.0
                } else {
                    0.0
                },
            };

            if variant.name == "A" {
                variant_a = Some(variant);
            } else if variant.name == "B" {
                variant_b = Some(variant);
            }
        }

        let variant_a = variant_a.unwrap_or_else(|| TestVariant {
            name: "A".to_string(),
            participants: 0,
            conversions: 0,
            conversion_rate: 0.0,
        });

        let variant_b = variant_b.unwrap_or_else(|| TestVariant {
            name: "B".to_string(),
            participants: 0,
            conversions: 0,
            conversion_rate: 0.0,
        });

        // Déterminer gagnant (test statistique simplifié)
        let winner = if variant_a.participants > 30 && variant_b.participants > 30 {
            let diff = (variant_a.conversion_rate - variant_b.conversion_rate).abs();
            if diff > 5.0 {
                // Différence significative (>5%)
                if variant_a.conversion_rate > variant_b.conversion_rate {
                    Some("A".to_string())
                } else {
                    Some("B".to_string())
                }
            } else {
                None // Inconclusif
            }
        } else {
            None // Pas assez de données
        };

        let confidence = if variant_a.participants > 100 && variant_b.participants > 100 {
            0.95
        } else if variant_a.participants > 50 && variant_b.participants > 50 {
            0.80
        } else {
            0.50
        };

        Ok(ABTestResult {
            test_id: test_id.to_string(),
            variant_a,
            variant_b,
            winner,
            confidence,
        })
        */
    }

    /// Analyse cohorte d'utilisateurs
    pub async fn analyze_cohorts(
        pool: &PgPool,
        start_date: &str,
        end_date: &str,
    ) -> AppResult<Vec<CohortAnalysis>> {
        let data_rows = sqlx::query(
            r#"
            WITH user_cohorts AS (
                SELECT 
                    DATE_TRUNC('week', created_at) as cohort_date,
                    user_id,
                    MIN(created_at) as first_activity
                FROM content_engagement
                WHERE created_at >= $1::date
                AND created_at <= $2::date
                GROUP BY cohort_date, user_id
            )
            SELECT 
                cohort_date::text,
                COUNT(DISTINCT user_id) as cohort_size
            FROM user_cohorts
            GROUP BY cohort_date
            ORDER BY cohort_date
            "#,
        )
        .bind(start_date)
        .bind(end_date)
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur cohortes: {}", e)))?;

        let mut cohorts = Vec::new();

        for row in data_rows {
            let cohort_date = row.get::<Option<String>, _>("cohort_date").unwrap_or_default();
            let cohort_size = row.get::<Option<i64>, _>("cohort_size").unwrap_or(0);

            // Analyser rétention par jour
            let mut retention_days = Vec::new();

            for day in 1..=30 {
                let retained = sqlx::query_scalar::<_, i64>(
                    r#"
                    SELECT COUNT(DISTINCT uc.user_id)
                    FROM user_cohorts uc
                    INNER JOIN content_engagement ce ON ce.user_id = uc.user_id
                    WHERE uc.cohort_date = $1::date
                    AND ce.created_at >= uc.first_activity + INTERVAL '1 day' * $2
                    AND ce.created_at < uc.first_activity + INTERVAL '1 day' * ($2 + 1)
                    "#,
                )
                .bind(&cohort_date)
                .bind(day)
                .fetch_one(pool)
                .await
                .map_err(|e| AppError::Internal(format!("Erreur rétention jour {}: {}", day, e)))?;

                let retention_rate = if cohort_size > 0 {
                    (retained as f64 / cohort_size as f64) * 100.0
                } else {
                    0.0
                };

                retention_days.push(DayRetention {
                    day,
                    retained_users: retained,
                    retention_rate,
                });
            }

            cohorts.push(CohortAnalysis {
                cohort_date,
                cohort_size,
                retention_days,
            });
        }

        Ok(cohorts)
    }
}
