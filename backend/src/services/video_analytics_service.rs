// 📊 Service d'analytics vidéo avancé
// Track watch time, skip rate, completion rate, heatmaps, performance créateurs

use crate::core::types::{AppError, AppResult};
use crate::AppState;
use chrono::{DateTime, Duration, Utc};
use log::{error, info};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{FromRow, PgPool};
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoAnalyticsEvent {
    pub video_id: i32,
    pub user_id: Option<i32>,
    pub session_id: String,
    pub event_type: VideoEventType,
    pub timestamp: DateTime<Utc>,
    pub position_seconds: f64,
    pub duration_seconds: f64,
    pub device_info: Option<DeviceInfo>,
    pub quality: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VideoEventType {
    Play,
    Pause,
    Seek,
    Complete,
    Skip,
    QualityChange,
    BufferStart,
    BufferEnd,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub platform: String, // "ios", "android", "web"
    pub app_version: String,
    pub connection_type: String, // "wifi", "cellular", "unknown"
    pub network_quality: String, // "4g", "3g", "2g", "wifi"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoAnalyticsSummary {
    pub video_id: i32,
    pub total_views: i64,
    pub unique_viewers: i64,
    pub avg_watch_time_seconds: f64,
    pub completion_rate: f64,  // % de vidéos regardées jusqu'à la fin
    pub skip_rate: f64,        // % de vidéos sautées
    pub engagement_score: f64, // Score 0-100 basé sur interactions
    pub top_dropoff_points: Vec<DropoffPoint>,
    pub quality_distribution: QualityDistribution,
    pub performance_metrics: PerformanceMetrics,
    pub heatmap_data: Vec<HeatmapPoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DropoffPoint {
    pub position_seconds: f64,
    pub percentage_dropped: f64,
    pub cumulative_drops: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityDistribution {
    pub count_1080p: i64,
    pub count_720p: i64,
    pub count_480p: i64,
    pub count_360p: i64,
    pub count_auto: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub avg_buffer_time_ms: f64,
    pub buffer_events_per_view: f64,
    pub error_rate: f64,
    pub avg_load_time_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeatmapPoint {
    pub position_seconds: f64,
    pub intensity: f64, // 0-1, intensité des réactions à ce point
    pub reactions_count: i64,
    pub comments_count: i64,
    pub shares_count: i64,
}

pub struct VideoAnalyticsService {
    pool: Arc<PgPool>,
}

impl VideoAnalyticsService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    /// Enregistre un événement analytics
    pub async fn track_event(&self, event: VideoAnalyticsEvent) -> AppResult<()> {
        let event_type_str = match event.event_type {
            VideoEventType::Play => "play",
            VideoEventType::Pause => "pause",
            VideoEventType::Seek => "seek",
            VideoEventType::Complete => "complete",
            VideoEventType::Skip => "skip",
            VideoEventType::QualityChange => "quality_change",
            VideoEventType::BufferStart => "buffer_start",
            VideoEventType::BufferEnd => "buffer_end",
            VideoEventType::Error => "error",
        };

        let device_info_json =
            event.device_info.map(|d| serde_json::to_string(&d)).transpose().unwrap_or(None);

        sqlx::query(
            r#"
            INSERT INTO video_analytics_events (
                video_id, user_id, session_id, event_type, 
                timestamp, position_seconds, duration_seconds,
                device_info, quality
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            "#,
        )
        .bind(event.video_id)
        .bind(event.user_id)
        .bind(&event.session_id)
        .bind(&event_type_str)
        .bind(event.timestamp)
        .bind(event.position_seconds)
        .bind(event.duration_seconds)
        .bind(&device_info_json)
        .bind(&event.quality)
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Database(format!("Erreur insertion événement analytics: {}", e)))?;

        // Mettre à jour les agrégats en temps réel
        self.update_realtime_aggregates(event.video_id).await?;

        Ok(())
    }

    /// Calcule les analytics complets pour une vidéo
    pub async fn get_video_analytics(
        &self,
        video_id: i32,
        days: i32,
    ) -> AppResult<VideoAnalyticsSummary> {
        let since_date = Utc::now() - Duration::days(days as i64);

        // 1️⃣ Vues et viewers uniques
        let views_data: (i64, i64, Option<f64>) = sqlx::query_as(
            r#"
            SELECT 
                COUNT(*) as total_views,
                COUNT(DISTINCT user_id) as unique_viewers,
                AVG(position_seconds) as avg_position
            FROM video_analytics_events 
            WHERE video_id = $1 
              AND timestamp >= $2
              AND event_type = 'play'
            "#,
        )
        .bind(video_id)
        .bind(since_date)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| AppError::Database(format!("Erreur récupération vues: {}", e)))?;

        // 2️⃣ Taux de complétion
        let completion_data: (Option<f64>, i64) = sqlx::query_as(
            r#"
            WITH video_sessions AS (
                SELECT 
                    session_id,
                    MAX(CASE WHEN event_type = 'complete' THEN 1 ELSE 0 END) as completed,
                    MAX(position_seconds) as max_position,
                    MAX(duration_seconds) as video_duration
                FROM video_analytics_events 
                WHERE video_id = $1 
                  AND timestamp >= $2
                GROUP BY session_id
            )
            SELECT 
                AVG(CASE WHEN completed = 1 THEN 100.0 
                     WHEN video_duration > 0 THEN (max_position / video_duration) * 100 
                     ELSE 0 END) as completion_rate,
                COUNT(*) as total_sessions
            FROM video_sessions
            "#,
        )
        .bind(video_id)
        .bind(since_date)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| AppError::Database(format!("Erreur calcul complétion: {}", e)))?;

        // 3️⃣ Taux de skip
        let skip_data: (Option<f64>,) = sqlx::query_as(
            r#"
            WITH session_events AS (
                SELECT 
                    session_id,
                    COUNT(*) FILTER (WHERE event_type = 'skip') as skip_count,
                    COUNT(*) FILTER (WHERE event_type = 'play') as play_count
                FROM video_analytics_events 
                WHERE video_id = $1 
                  AND timestamp >= $2
                GROUP BY session_id
            )
            SELECT 
                AVG(CASE WHEN play_count > 0 THEN (skip_count::float / play_count::float) * 100 ELSE 0 END) as skip_rate
            FROM session_events
            WHERE play_count > 0
            "#
        )
        .bind(video_id)
        .bind(since_date)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| AppError::Database(format!("Erreur calcul skip rate: {}", e)))?;

        // 4️⃣ Points de dropoff
        let dropoff_points = self.calculate_dropoff_points(video_id, since_date).await?;

        // 5️⃣ Distribution qualité
        let quality_dist = self.get_quality_distribution(video_id, since_date).await?;

        // 6️⃣ Métriques performance
        let performance = self.get_performance_metrics(video_id, since_date).await?;

        // 7️⃣ Heatmap des réactions
        let heatmap = self.generate_heatmap(video_id, since_date).await?;

        // 8️⃣ Score d'engagement
        let engagement_score = self.calculate_engagement_score(
            views_data.0.unwrap_or(0) as f64,
            completion_data.0.unwrap_or(0.0),
            skip_data.0.unwrap_or(0.0),
            &performance,
        );

        Ok(VideoAnalyticsSummary {
            video_id,
            total_views: views_data.0.unwrap_or(0),
            unique_viewers: views_data.1.unwrap_or(0),
            avg_watch_time_seconds: views_data.2.unwrap_or(0.0),
            completion_rate: completion_data.0.unwrap_or(0.0),
            skip_rate: skip_data.0.unwrap_or(0.0),
            engagement_score,
            top_dropoff_points: dropoff_points,
            quality_distribution: quality_dist,
            performance_metrics: performance,
            heatmap_data: heatmap,
        })
    }

    /// Calcule les points où les utilisateurs abandonnent la vidéo
    async fn calculate_dropoff_points(
        &self,
        video_id: i32,
        since_date: DateTime<Utc>,
    ) -> AppResult<Vec<DropoffPoint>> {
        let rows: Vec<(Option<f64>, Option<f64>, Option<i64>)> = sqlx::query_as(
            r#"
            WITH session_positions AS (
                SELECT 
                    session_id,
                    MAX(position_seconds) as max_position,
                    MAX(duration_seconds) as video_duration
                FROM video_analytics_events 
                WHERE video_id = $1 
                  AND timestamp >= $2
                  AND event_type IN ('play', 'pause', 'seek')
                GROUP BY session_id
            ),
            dropoff_buckets AS (
                SELECT 
                    width_bucket(max_position, 0, video_duration, 20) as bucket,
                    COUNT(*) as drop_count,
                    video_duration / 20 as bucket_size
                FROM session_positions
                WHERE max_position < video_duration * 0.95  -- Exclure les complétions
                GROUP BY bucket, video_duration
                ORDER BY bucket
            )
            SELECT 
                bucket * bucket_size as position_seconds,
                (drop_count::float / SUM(drop_count) OVER ()) * 100 as percentage_dropped,
                SUM(drop_count) OVER (ORDER BY bucket) as cumulative_drops
            FROM dropoff_buckets
            "#,
        )
        .bind(video_id)
        .bind(since_date)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Database(format!("Erreur calcul dropoff: {}", e)))?;

        let points = rows
            .into_iter()
            .map(|row| DropoffPoint {
                position_seconds: row.0.unwrap_or(0.0),
                percentage_dropped: row.1.unwrap_or(0.0),
                cumulative_drops: row.2.unwrap_or(0),
            })
            .collect();

        Ok(points)
    }

    /// Distribution des qualités utilisées
    async fn get_quality_distribution(
        &self,
        video_id: i32,
        since_date: DateTime<Utc>,
    ) -> AppResult<QualityDistribution> {
        let row: (i64, i64, i64, i64, i64) = sqlx::query_as(
            r#"
            SELECT 
                COUNT(*) FILTER (WHERE quality = '1080p') as count_1080p,
                COUNT(*) FILTER (WHERE quality = '720p') as count_720p,
                COUNT(*) FILTER (WHERE quality = '480p') as count_480p,
                COUNT(*) FILTER (WHERE quality = '360p') as count_360p,
                COUNT(*) FILTER (WHERE quality = 'auto' OR quality IS NULL) as count_auto
            FROM video_analytics_events 
            WHERE video_id = $1 
              AND timestamp >= $2
              AND event_type = 'play'
            "#,
        )
        .bind(video_id)
        .bind(since_date)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| AppError::Database(format!("Erreur distribution qualité: {}", e)))?;

        Ok(QualityDistribution {
            count_1080p: row.0,
            count_720p: row.1,
            count_480p: row.2,
            count_360p: row.3,
            count_auto: row.4,
        })
    }

    /// Métriques de performance (buffer, erreurs, etc.)
    async fn get_performance_metrics(
        &self,
        video_id: i32,
        since_date: DateTime<Utc>,
    ) -> AppResult<PerformanceMetrics> {
        let row: (Option<f64>, Option<f64>, Option<f64>, f64) = sqlx::query_as(
            r#"
            WITH buffer_sessions AS (
                SELECT 
                    session_id,
                    EXTRACT(EPOCH FROM (
                        MAX(CASE WHEN event_type = 'buffer_end' THEN timestamp END) -
                        MIN(CASE WHEN event_type = 'buffer_start' THEN timestamp END)
                    )) as buffer_duration_ms
                FROM video_analytics_events 
                WHERE video_id = $1 
                  AND timestamp >= $2
                  AND event_type IN ('buffer_start', 'buffer_end')
                GROUP BY session_id
                HAVING buffer_duration_ms IS NOT NULL
            ),
            error_sessions AS (
                SELECT 
                    COUNT(*) as error_count,
                    COUNT(DISTINCT session_id) as sessions_with_errors
                FROM video_analytics_events 
                WHERE video_id = $1 
                  AND timestamp >= $2
                  AND event_type = 'error'
            )
            SELECT 
                COALESCE(AVG(buffer_duration_ms * 1000), 0) as avg_buffer_time_ms,
                (SELECT COUNT(*) FROM video_analytics_events WHERE video_id = $1 AND timestamp >= $2 AND event_type = 'play')::float / 
                (SELECT COUNT(DISTINCT session_id) FROM video_analytics_events WHERE video_id = $1 AND timestamp >= $2 AND event_type = 'play') as buffer_events_per_view,
                COALESCE((SELECT error_count FROM error_sessions)::float / 
                         NULLIF((SELECT COUNT(DISTINCT session_id) FROM video_analytics_events WHERE video_id = $1 AND timestamp >= $2 AND event_type = 'play'), 0), 0) as error_rate,
                1500.0 as avg_load_time_ms  -- Placeholder: à implémenter avec tracking load time
            FROM buffer_sessions, error_sessions
            "#
        )
        .bind(video_id)
        .bind(since_date)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| AppError::Database(format!("Erreur métriques performance: {}", e)))?;

        Ok(PerformanceMetrics {
            avg_buffer_time_ms: row.0.unwrap_or(0.0),
            buffer_events_per_view: row.1.unwrap_or(0.0),
            error_rate: row.2.unwrap_or(0.0),
            avg_load_time_ms: row.3,
        })
    }

    /// Génère heatmap des réactions par position
    async fn generate_heatmap(
        &self,
        video_id: i32,
        since_date: DateTime<Utc>,
    ) -> AppResult<Vec<HeatmapPoint>> {
        let rows: Vec<(Option<f64>, Option<f64>, i64, i64, i64)> = sqlx::query_as(
            r#"
            WITH reaction_buckets AS (
                SELECT 
                    width_bucket(position_seconds, 0, 
                        (SELECT MAX(duration_seconds) FROM video_analytics_events WHERE video_id = $1 AND timestamp >= $2), 
                        50) as bucket,
                    COUNT(*) FILTER (WHERE event_type = 'complete') as reactions,
                    video_duration / 50 as bucket_size
                FROM video_analytics_events 
                WHERE video_id = $1 
                  AND timestamp >= $2
                  AND event_type IN ('complete', 'pause')  -- Pauses comme proxy d'engagement
                GROUP BY bucket, video_duration
            )
            SELECT 
                bucket * bucket_size as position_seconds,
                (reactions::float / NULLIF(MAX(reactions) OVER (), 0)) as intensity,
                reactions as reactions_count,
                0 as comments_count,  -- À implémenter avec tracking commentaires
                0 as shares_count     -- À implémenter avec tracking shares
            FROM reaction_buckets
            ORDER BY position_seconds
            "#
        )
        .bind(video_id)
        .bind(since_date)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Database(format!("Erreur génération heatmap: {}", e)))?;

        let heatmap = rows
            .into_iter()
            .map(|row| HeatmapPoint {
                position_seconds: row.0.unwrap_or(0.0),
                intensity: row.1.unwrap_or(0.0),
                reactions_count: row.2,
                comments_count: row.3,
                shares_count: row.4,
            })
            .collect();

        Ok(heatmap)
    }

    /// Calcule un score d'engagement 0-100
    fn calculate_engagement_score(
        &self,
        views: f64,
        completion_rate: f64,
        skip_rate: f64,
        performance: &PerformanceMetrics,
    ) -> f64 {
        let view_score = (views / 1000.0).min(10.0) * 10.0; // 0-100 points
        let completion_score = completion_rate; // 0-100 points
        let skip_penalty = skip_rate * 0.5; // -0-50 points
        let performance_penalty = (performance.avg_buffer_time_ms / 1000.0 * 10.0).min(20.0); // -0-20 points
        let error_penalty = performance.error_rate * 100.0; // -0-100 points

        let total_score =
            view_score + completion_score - skip_penalty - performance_penalty - error_penalty;
        total_score.max(0.0).min(100.0)
    }

    /// Met à jour les agrégats en temps réel pour dashboard créateurs
    async fn update_realtime_aggregates(&self, video_id: i32) -> AppResult<()> {
        sqlx::query(
            r#"
            INSERT INTO video_analytics_realtime (video_id, last_updated, total_views, avg_watch_time)
            SELECT 
                $1,
                NOW(),
                COUNT(*) FILTER (WHERE event_type = 'play'),
                AVG(position_seconds) FILTER (WHERE event_type = 'play')
            FROM video_analytics_events 
            WHERE video_id = $1 
              AND timestamp >= NOW() - INTERVAL '1 hour'
            ON CONFLICT (video_id) DO UPDATE SET
                last_updated = EXCLUDED.last_updated,
                total_views = EXCLUDED.total_views,
                avg_watch_time = EXCLUDED.avg_watch_time
            "#
        )
        .bind(video_id)
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Database(format!("Erreur mise à jour agrégats temps réel: {}", e)))?;

        Ok(())
    }

    /// Analytics pour créateurs (top vidéos, performance globale)
    pub async fn get_creator_analytics(
        &self,
        user_id: i32,
        days: i32,
    ) -> AppResult<serde_json::Value> {
        let since_date = Utc::now() - Duration::days(days as i64);

        let analytics: (i64, i64, i64, Option<f64>, i64, f64) = sqlx::query_as(
            r#"
            WITH creator_videos AS (
                SELECT DISTINCT vt.video_id
                FROM video_transcoding vt
                JOIN media m ON m.id = vt.video_id
                JOIN services s ON s.id = m.service_id
                WHERE s.user_id = $1
                  AND vt.status = 'completed'
            ),
            video_stats AS (
                SELECT 
                    v.video_id,
                    COUNT(*) FILTER (WHERE e.event_type = 'play') as views,
                    COUNT(DISTINCT e.session_id) as unique_viewers,
                    AVG(e.position_seconds) as avg_watch_time,
                    COUNT(*) FILTER (WHERE e.event_type = 'complete') as completions
                FROM creator_videos v
                LEFT JOIN video_analytics_events e ON e.video_id = v.video_id
                  AND e.timestamp >= $2
                GROUP BY v.video_id
            )
            SELECT 
                COUNT(*) as total_videos,
                COALESCE(SUM(views), 0) as total_views,
                COALESCE(SUM(unique_viewers), 0) as total_unique_viewers,
                COALESCE(AVG(avg_watch_time), 0) as avg_watch_time_all_videos,
                COALESCE(SUM(completions), 0) as total_completions,
                COALESCE(AVG(CASE WHEN views > 0 THEN (completions::float / views::float) * 100 ELSE 0 END), 0) as avg_completion_rate
            FROM video_stats
            "#
        )
        .bind(user_id)
        .bind(since_date)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| AppError::Database(format!("Erreur analytics créateur: {}", e)))?;

        Ok(serde_json::json!({
            "total_videos": analytics.0,
            "total_views": analytics.1,
            "total_unique_viewers": analytics.2,
            "avg_watch_time_seconds": analytics.3,
            "total_completions": analytics.4,
            "avg_completion_rate": analytics.5,
            "period_days": days
        }))
    }
}

// Singleton global
lazy_static::lazy_static! {
    pub static ref VIDEO_ANALYTICS_SERVICE: std::sync::Arc<tokio::sync::Mutex<Option<VideoAnalyticsService>>> =
        std::sync::Arc::new(tokio::sync::Mutex::new(None));
}

pub async fn get_analytics_service(pool: Arc<PgPool>) -> Arc<VideoAnalyticsService> {
    let mut service = VIDEO_ANALYTICS_SERVICE.lock().await;
    if service.is_none() {
        *service = Some(VideoAnalyticsService::new(pool));
    }
    Arc::clone(service.as_ref().unwrap())
}

// Legacy functions for compatibility
#[derive(Debug, serde::Serialize, FromRow)]
pub struct QualityScoreRecord {
    pub media_id: i32,
    pub service_id: i32,
    pub quality_score: f32,
    pub occurred_at: DateTime<Utc>,
}

#[derive(Debug, FromRow)]
struct MediaCountRow {
    total: i64,
}

#[derive(Debug, FromRow)]
struct EngagementStatsRow {
    views: i64,
    shares: i64,
    avg_quality: f64,
}

#[derive(Debug, FromRow)]
struct DistributionStatsRow {
    completed: i64,
    pending: i64,
}

pub async fn record_engagement(
    state: Arc<AppState>,
    media_id: i32,
    event_type: &str,
    channel: Option<String>,
    user_id: Option<i32>,
    session_id: Option<String>,
    metadata: Option<Value>,
) -> AppResult<()> {
    let service_id: Option<i32> = sqlx::query_scalar("SELECT service_id FROM media WHERE id = $1")
        .bind(media_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|err| {
            error!(
                "[VideoAnalytics] Erreur récupération service pour media {}: {:?}",
                media_id, err
            );
            AppError::from(err)
        })?
        .ok_or_else(|| AppError::NotFound("Média introuvable".to_string()))?;

    sqlx::query(
        "INSERT INTO media_engagement (media_id, service_id, event_type, channel, user_id, session_id, metadata, occurred_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"
    )
    .bind(media_id)
    .bind(service_id)
    .bind(event_type)
    .bind(channel)
    .bind(user_id)
    .bind(session_id)
    .bind(metadata)
    .bind(Utc::now())
    .execute(&state.pg)
    .await
    .map_err(|err| {
        error!("[VideoAnalytics] Erreur insertion media_engagement: {:?}", err);
        AppError::from(err)
    })?;

    info!(
        "[VideoAnalytics] Enregistrement engagement media_id={} event_type={}",
        media_id, event_type
    );

    Ok(())
}

pub async fn list_recent_quality_scores(
    state: Arc<AppState>,
    limit: i64,
) -> AppResult<Vec<QualityScoreRecord>> {
    let rows: Vec<QualityScoreRecord> = sqlx::query_as(
        r#"
        SELECT
            media_id,
            service_id,
            COALESCE((metadata ->> 'quality_score')::float, 0.0) AS quality_score,
            occurred_at
        FROM media_engagement
        WHERE event_type = 'quality_score'
        ORDER BY occurred_at DESC
        LIMIT $1
        "#,
    )
    .bind(limit.max(1))
    .fetch_all(&state.pg)
    .await
    .map_err(|err| {
        error!(
            "[VideoAnalytics] Erreur récupération quality score: {:?}",
            err
        );
        AppError::from(err)
    })?;

    Ok(rows
        .into_iter()
        .map(|row| QualityScoreRecord {
            media_id: row.media_id,
            service_id: row.service_id,
            quality_score: row.quality_score as f32,
            occurred_at: row.occurred_at,
        })
        .collect())
}

pub async fn schedule_distribution_targets(
    state: &Arc<AppState>,
    media_id: i32,
    service_id: i32,
    targets: &[String],
) -> AppResult<()> {
    if targets.is_empty() {
        return Ok(());
    }

    for target in targets {
        sqlx::query(
            "INSERT INTO media_distribution (media_id, service_id, target, status)
             VALUES ($1, $2, $3, 'scheduled')
             ON CONFLICT DO NOTHING",
        )
        .bind(media_id)
        .bind(service_id)
        .bind(target)
        .execute(&state.pg)
        .await
        .map_err(|err| {
            error!(
                "[VideoAnalytics] Erreur insertion media_distribution media_id={} target={}: {:?}",
                media_id, target, err
            );
            AppError::from(err)
        })?;
    }

    Ok(())
}

pub async fn update_distribution_status(
    state: Arc<AppState>,
    media_id: i32,
    target: &str,
    status: &str,
    metadata: Option<Value>,
) -> AppResult<()> {
    sqlx::query(
        "UPDATE media_distribution
         SET status = $1, metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE($2, '{}'::jsonb), updated_at = NOW()
         WHERE media_id = $3 AND target = $4"
    )
    .bind(status)
    .bind(metadata)
    .bind(media_id)
    .bind(target)
    .execute(&state.pg)
    .await
    .map_err(|err| {
        error!(
            "[VideoAnalytics] Erreur mise à jour media_distribution media_id={} target={}: {:?}",
            media_id, target, err
        );
        AppError::from(err)
    })?;

    Ok(())
}

#[derive(Debug, Serialize)]
pub struct VideoAnalyticsOverview {
    pub horizon_days: i64,
    pub videos_generated: i64,
    pub total_views: i64,
    pub total_shares: i64,
    pub average_quality_score: f32,
    pub distribution_success: i64,
    pub distribution_pending: i64,
}

pub async fn video_analytics_overview(
    state: Arc<AppState>,
    horizon_days: i64,
) -> AppResult<VideoAnalyticsOverview> {
    let days = horizon_days.clamp(1, 30);
    let days_i32 = days as i32;

    let media_row: MediaCountRow = sqlx::query_as(
        r#"
        SELECT COUNT(*) AS total
        FROM media
        WHERE media_type = 'video'
          AND uploaded_at >= NOW() - ($1::int * INTERVAL '1 day')
        "#,
    )
    .bind(days_i32)
    .fetch_one(&state.pg)
    .await
    .map_err(AppError::from)?;

    let engagement_row: EngagementStatsRow = sqlx::query_as(
        r#"
        SELECT
            COUNT(*) FILTER (WHERE event_type = 'view')   AS views,
            COUNT(*) FILTER (WHERE event_type = 'share')  AS shares,
            COALESCE(AVG((metadata ->> 'quality_score')::float), 0.0) AS avg_quality
        FROM media_engagement
        WHERE occurred_at >= NOW() - ($1::int * INTERVAL '1 day')
          AND event_type IN ('view', 'share', 'quality_score')
        "#,
    )
    .bind(days_i32)
    .fetch_one(&state.pg)
    .await
    .map_err(AppError::from)?;

    let distribution_row: DistributionStatsRow = sqlx::query_as(
        r#"
        SELECT
            COUNT(*) FILTER (WHERE status = 'completed')                       AS completed,
            COUNT(*) FILTER (WHERE status IN ('scheduled', 'processing'))      AS pending
        FROM media_distribution
        WHERE updated_at >= NOW() - ($1::int * INTERVAL '1 day')
        "#,
    )
    .bind(days_i32)
    .fetch_one(&state.pg)
    .await
    .map_err(AppError::from)?;

    Ok(VideoAnalyticsOverview {
        horizon_days: days,
        videos_generated: media_row.total,
        total_views: engagement_row.views,
        total_shares: engagement_row.shares,
        average_quality_score: engagement_row.avg_quality as f32,
        distribution_success: distribution_row.completed,
        distribution_pending: distribution_row.pending,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::{backend_test_db_lock, setup_backend_test_context};
    use serde_json::json;
    use sqlx::Row;

    #[tokio::test]
    async fn video_analytics_overview_aggregates_metrics() {
        let _lock = backend_test_db_lock().await;

        let Some(ctx) = setup_backend_test_context().await else {
            eprintln!("[tests] ⚠️ Contexte de test indisponible, test ignoré.");
            return;
        };

        let pool = ctx.pool.clone();

        let service_row = sqlx::query(
            r#"
            INSERT INTO services (user_id, data, is_active, created_at, updated_at)
            VALUES ($1, '{}'::jsonb, TRUE, NOW(), NOW())
            RETURNING id
            "#,
        )
        .bind(ctx.user_id)
        .fetch_one(&pool)
        .await
        .expect("insert service");
        let service_id: i32 = service_row.get::<i32, _>("id");

        let media_row = sqlx::query(
            r#"
            INSERT INTO media (service_id, type, path, media_type, uploaded_at)
            VALUES ($1, 'video', '/tmp/test.mp4', 'video', NOW())
            RETURNING id
            "#,
        )
        .bind(service_id)
        .fetch_one(&pool)
        .await
        .expect("insert media");
        let media_id: i32 = media_row.get::<i32, _>("id");

        // Deux vues
        for session in ["sess-view-1", "sess-view-2"] {
            sqlx::query(
                r#"
                INSERT INTO media_engagement (media_id, service_id, event_type, channel, user_id, session_id, metadata)
                VALUES ($1, $2, 'view', $3, $4, $5, $6)
                "#,
            )
            .bind(media_id)
            .bind(service_id)
            .bind(Some("web"))
            .bind(Some(ctx.user_id))
            .bind(Some(session))
            .bind(json!({}))
            .execute(&pool)
            .await
            .expect("insert view engagement");
        }

        // Un partage
        sqlx::query(
            r#"
            INSERT INTO media_engagement (media_id, service_id, event_type, channel, user_id, session_id, metadata)
            VALUES ($1, $2, 'share', $3, $4, $5, $6)
            "#,
        )
        .bind(media_id)
        .bind(service_id)
        .bind(Some("mobile"))
        .bind(Some(ctx.user_id))
        .bind(Some("sess-share"))
        .bind(json!({}))
        .execute(&pool)
        .await
        .expect("insert share engagement");

        // Deux scores qualité
        for (score, session) in [(4.0_f64, "sess-quality-1"), (3.0_f64, "sess-quality-2")] {
            sqlx::query(
                r#"
                INSERT INTO media_engagement (media_id, service_id, event_type, channel, user_id, session_id, metadata)
                VALUES ($1, $2, 'quality_score', $3, $4, $5, $6)
                "#,
            )
            .bind(media_id)
            .bind(service_id)
            .bind(Some("analytics"))
            .bind(Some(ctx.user_id))
            .bind(Some(session))
            .bind(json!({ "quality_score": score }))
            .execute(&pool)
            .await
            .expect("insert quality engagement");
        }

        // Distribution : 1 complété, 1 en attente
        sqlx::query(
            r#"
            INSERT INTO media_distribution (media_id, service_id, target, status)
            VALUES ($1, $2, 'instagram', 'completed')
            "#,
        )
        .bind(media_id)
        .bind(service_id)
        .execute(&pool)
        .await
        .expect("insert completed distribution");

        sqlx::query(
            r#"
            INSERT INTO media_distribution (media_id, service_id, target, status)
            VALUES ($1, $2, 'tiktok', 'scheduled')
            "#,
        )
        .bind(media_id)
        .bind(service_id)
        .execute(&pool)
        .await
        .expect("insert pending distribution");

        let overview = video_analytics_overview(ctx.state.clone(), 7)
            .await
            .expect("overview should succeed");

        assert_eq!(overview.horizon_days, 7);
        assert_eq!(overview.videos_generated, 1);
        assert_eq!(overview.total_views, 2);
        assert_eq!(overview.total_shares, 1);
        assert!(
            (overview.average_quality_score - 3.5).abs() < 0.01,
            "Le score moyen devrait être 3.5"
        );
        assert_eq!(overview.distribution_success, 1);
        assert_eq!(overview.distribution_pending, 1);
    }
}
