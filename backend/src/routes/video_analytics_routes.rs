// 📊 Routes pour analytics vidéo avancé
// Endpoints pour tracking, métriques créateurs, dashboards

use crate::services::video_analytics_service::get_analytics_service;
use crate::state::AppState;
use axum::{
    extract::{Path, State, Query},
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use chrono::{DateTime, Utc};

#[derive(Debug, Deserialize)]
pub struct TrackEventRequest {
    pub video_id: i32,
    pub user_id: Option<i32>,
    pub session_id: String,
    pub event_type: String,  // "play", "pause", "seek", "complete", "skip", etc.
    pub position_seconds: f64,
    pub duration_seconds: f64,
    pub device_info: Option<serde_json::Value>,
    pub quality: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct VideoAnalyticsQuery {
    pub days: Option<i32>,  // Période en jours (défaut: 7)
    pub video_id: Option<i32>,
    pub user_id: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsResponse {
    pub success: bool,
    pub data: serde_json::Value,
    pub period_days: i32,
}

/// Track un événement analytics (play, pause, etc.)
pub async fn track_video_event(
    State(state): State<Arc<AppState>>,
    Json(request): Json<TrackEventRequest>,
) -> Result<Json<serde_json::Value>, crate::core::types::AppError> {
    let pool = Arc::clone(&state.pg);
    let service = get_analytics_service(pool).await;

    // Convertir string en enum VideoEventType
    let event_type = match request.event_type.as_str() {
        "play" => crate::services::video_analytics_service::VideoEventType::Play,
        "pause" => crate::services::video_analytics_service::VideoEventType::Pause,
        "seek" => crate::services::video_analytics_service::VideoEventType::Seek,
        "complete" => crate::services::video_analytics_service::VideoEventType::Complete,
        "skip" => crate::services::video_analytics_service::VideoEventType::Skip,
        "quality_change" => crate::services::video_analytics_service::VideoEventType::QualityChange,
        "buffer_start" => crate::services::video_analytics_service::VideoEventType::BufferStart,
        "buffer_end" => crate::services::video_analytics_service::VideoEventType::BufferEnd,
        "error" => crate::services::video_analytics_service::VideoEventType::Error,
        _ => return Err(crate::core::types::AppError::BadRequest("event_type invalide".to_string())),
    };

    let device_info = request.device_info.map(|d| {
        serde_json::from_value::<crate::services::video_analytics_service::DeviceInfo>(d)
            .unwrap_or_else(|_| crate::services::video_analytics_service::DeviceInfo {
                platform: "unknown".to_string(),
                app_version: "1.0".to_string(),
                connection_type: "unknown".to_string(),
                network_quality: "unknown".to_string(),
            })
    });

    let event = crate::services::video_analytics_service::VideoAnalyticsEvent {
        video_id: request.video_id,
        user_id: request.user_id,
        session_id: request.session_id,
        event_type,
        timestamp: Utc::now(),
        position_seconds: request.position_seconds,
        duration_seconds: request.duration_seconds,
        device_info,
        quality: request.quality,
    };

    service.track_event(event).await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Événement tracké avec succès"
    })))
}

/// Analytics complets pour une vidéo spécifique
pub async fn get_video_analytics(
    State(state): State<Arc<AppState>>,
    Path(video_id): Path<i32>,
    Query(query): Query<VideoAnalyticsQuery>,
) -> Result<Json<AnalyticsResponse>, crate::core::types::AppError> {
    let pool = Arc::clone(&state.pg);
    let service = get_analytics_service(pool).await;
    let days = query.days.unwrap_or(7);

    let analytics = service.get_video_analytics(video_id, days).await?;

    Ok(Json(AnalyticsResponse {
        success: true,
        data: serde_json::to_value(&analytics).unwrap_or(serde_json::Value::Null),
        period_days: days,
    }))
}

/// Analytics pour un créateur (toutes ses vidéos)
pub async fn get_creator_analytics(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<i32>,
    Query(query): Query<VideoAnalyticsQuery>,
) -> Result<Json<AnalyticsResponse>, crate::core::types::AppError> {
    let pool = Arc::clone(&state.pg);
    let service = get_analytics_service(pool).await;
    let days = query.days.unwrap_or(30);

    let analytics = service.get_creator_analytics(user_id, days).await?;

    Ok(Json(AnalyticsResponse {
        success: true,
        data: analytics,
        period_days: days,
    }))
}

/// Top vidéos avec meilleures analytics
pub async fn get_top_videos(
    State(state): State<Arc<AppState>>,
    Query(query): Query<VideoAnalyticsQuery>,
) -> Result<Json<serde_json::Value>, crate::core::types::AppError> {
    let days = query.days.unwrap_or(7);
    let limit = 50;

    let rows = sqlx::query!(
        r#"
        SELECT 
            vas.video_id,
            vas.total_views,
            vas.unique_viewers,
            vas.avg_watch_time,
            vas.completion_rate,
            vas.engagement_score,
            m.path as video_path,
            s.category,
            s.user_id as creator_id,
            u.name as creator_name,
            -- Thumbnail et metadata
            (
                SELECT m2.path FROM media m2 
                WHERE m2.service_id = m.service_id 
                AND (m2.type = 'image' OR m2.media_type = 'image')
                ORDER BY COALESCE(m2.is_main_image, FALSE) DESC, m2.id ASC
                LIMIT 1
            ) as thumbnail_path,
            -- Titre du service
            s.data->'titre_service'->>'valeur' as service_title
        FROM video_analytics_realtime vas
        JOIN media m ON m.id = vas.video_id
        JOIN services s ON s.id = m.service_id
        LEFT JOIN users u ON u.id = s.user_id
        WHERE vas.last_updated >= NOW() - INTERVAL $1 days
        ORDER BY vas.engagement_score DESC, vas.total_views DESC
        LIMIT $2
        "#,
        days as i32,
        limit
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| crate::core::types::AppError::Database(format!("Erreur top vidéos: {}", e)))?;

    let videos = rows.into_iter().map(|row| serde_json::json!({
        "video_id": row.video_id,
        "total_views": row.total_views,
        "unique_viewers": row.unique_viewers,
        "avg_watch_time_seconds": row.avg_watch_time,
        "completion_rate": row.completion_rate,
        "engagement_score": row.engagement_score,
        "video_path": row.video_path,
        "thumbnail_path": row.thumbnail_path,
        "category": row.category,
        "creator_id": row.creator_id,
        "creator_name": row.creator_name,
        "service_title": row.service_title
    })).collect::<Vec<_>>();

    Ok(Json(serde_json::json!({
        "success": true,
        "videos": videos,
        "period_days": days,
        "total_count": videos.len()
    })))
}

/// Métriques globales pour dashboard admin
pub async fn get_global_analytics(
    State(state): State<Arc<AppState>>,
    Query(query): Query<VideoAnalyticsQuery>,
) -> Result<Json<serde_json::Value>, crate::core::types::AppError> {
    let days = query.days.unwrap_or(7);

    let metrics = sqlx::query!(
        r#"
        WITH daily_stats AS (
            SELECT 
                DATE_TRUNC('day', timestamp) as day,
                COUNT(*) FILTER (WHERE event_type = 'play') as daily_views,
                COUNT(DISTINCT user_id) as daily_viewers,
                COUNT(DISTINCT session_id) as daily_sessions
            FROM video_analytics_events 
            WHERE timestamp >= NOW() - INTERVAL $1 days
            GROUP BY DATE_TRUNC('day', timestamp)
        )
        SELECT 
            COUNT(DISTINCT video_id) as total_videos,
            SUM(daily_views) as total_views,
            AVG(daily_views) as avg_daily_views,
            COUNT(DISTINCT user_id) as total_viewers,
            AVG(daily_viewers) as avg_daily_viewers,
            COUNT(DISTINCT session_id) as total_sessions,
            MAX(daily_views) as peak_daily_views,
            MIN(daily_views) as min_daily_views
        FROM daily_stats
        "#,
        days as i32
    )
    .fetch_one(&state.pg)
    .await
    .map_err(|e| crate::core::types::AppError::Database(format!("Erreur analytics globaux: {}", e)))?;

    Ok(Json(serde_json::json!({
        "success": true,
        "period_days": days,
        "metrics": {
            "total_videos": metrics.total_views,
            "total_views": metrics.total_views,
            "avg_daily_views": metrics.avg_daily_views,
            "total_viewers": metrics.total_viewers,
            "avg_daily_viewers": metrics.avg_daily_viewers,
            "total_sessions": metrics.total_sessions,
            "peak_daily_views": metrics.peak_daily_views,
            "min_daily_views": metrics.min_daily_views
        }
    })))
}

/// Performance metrics par qualité de connexion
pub async fn get_performance_analytics(
    State(state): State<Arc<AppState>>,
    Query(query): Query<VideoAnalyticsQuery>,
) -> Result<Json<serde_json::Value>, crate::core::types::AppError> {
    let days = query.days.unwrap_or(7);

    let performance = sqlx::query!(
        r#"
        SELECT 
            device_info->>'platform' as platform,
            device_info->>'connection_type' as connection_type,
            device_info->>'network_quality' as network_quality,
            quality,
            COUNT(*) as event_count,
            AVG(
                CASE 
                    WHEN event_type = 'buffer_start' THEN 
                        EXTRACT(EPOCH FROM (
                            (SELECT timestamp FROM video_analytics_events e2 
                             WHERE e2.video_id = e1.video_id AND e2.session_id = e1.session_id 
                             AND e2.event_type = 'buffer_end' AND e2.timestamp > e1.timestamp
                             ORDER BY e2.timestamp LIMIT 1) - e1.timestamp
                        )
                END
            ) as avg_buffer_time_ms,
            COUNT(*) FILTER (WHERE event_type = 'error') as error_count
        FROM video_analytics_events e1
        WHERE timestamp >= NOW() - INTERVAL $1 days
          AND event_type IN ('play', 'buffer_start', 'error')
        GROUP BY platform, connection_type, network_quality, quality
        ORDER BY event_count DESC
        "#,
        days as i32
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| crate::core::types::AppError::Database(format!("Erreur performance analytics: {}", e)))?;

    let performance_data = performance.into_iter().map(|row| serde_json::json!({
        "platform": row.platform,
        "connection_type": row.connection_type,
        "network_quality": row.network_quality,
        "quality": row.quality,
        "event_count": row.event_count,
        "avg_buffer_time_ms": row.avg_buffer_time_ms,
        "error_count": row.error_count,
        "error_rate": if row.event_count > 0 { row.error_count as f64 / row.event_count as f64 * 100.0 } else { 0.0 }
    })).collect::<Vec<_>>();

    Ok(Json(serde_json::json!({
        "success": true,
        "period_days": days,
        "performance_data": performance_data
    })))
}

/// Routes analytics vidéo
pub fn video_analytics_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/track", post(track_video_event))
        .route("/video/:video_id", get(get_video_analytics))
        .route("/creator/:user_id", get(get_creator_analytics))
        .route("/top", get(get_top_videos))
        .route("/global", get(get_global_analytics))
        .route("/performance", get(get_performance_analytics))
}
