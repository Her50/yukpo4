use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{Duration, Utc};
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;
use std::collections::HashMap;
use std::sync::Arc;

use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::content_engagement_service::ContentEngagementService;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct EngagementPayload {
    pub action: String, // "like" ou "save"
    pub set: bool,
}

#[derive(Deserialize)]
pub struct EngagementQuery {
    pub ids: String,
}

#[derive(Deserialize)]
pub struct ContentAnalyticsQuery {
    pub days: Option<i64>,
    pub limit: Option<i64>,
    pub content_type: Option<String>,
}

#[derive(Deserialize)]
pub struct TrackWatchTimePayload {
    pub watch_duration_ms: i32,
    pub video_duration_ms: Option<i32>,
    pub device_type: Option<String>,
    pub location_gps: Option<String>,
}

pub async fn toggle_content_engagement(
    Path(content_id): Path<String>,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<EngagementPayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let action = payload.action.to_lowercase();
    if action != "like" && action != "save" {
        return Err(StatusCode::BAD_REQUEST);
    }

    let (liked, saved) = match action.as_str() {
        "like" => (Some(payload.set), None),
        "save" => (None, Some(payload.set)),
        _ => (None, None),
    };

    ContentEngagementService::upsert_engagement(&state.pg, user.id, &content_id, liked, saved)
        .await
        .map_err(|e| {
            log::error!("[ContentEngagement] upsert error: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let (likes_count, saves_count) = ContentEngagementService::get_counts(&state.pg, &content_id)
        .await
        .map_err(|e| {
            log::error!("[ContentEngagement] get_counts error: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(json!({
        "success": true,
        "content_id": content_id,
        "likes": likes_count,
        "saves": saves_count,
        "liked": liked.unwrap_or(false),
        "saved": saved.unwrap_or(false),
    })))
}

pub async fn get_content_engagement(
    State(state): State<Arc<AppState>>,
    maybe_user: Option<Extension<AuthenticatedUser>>,
    Query(query): Query<EngagementQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let ids: Vec<String> = query
        .ids
        .split(',')
        .map(|id| id.trim().to_string())
        .filter(|id| !id.is_empty())
        .collect();

    if ids.is_empty() {
        return Ok(Json(json!({ "success": true, "data": [] })));
    }

    let user_id = maybe_user.as_ref().map(|Extension(user)| user.id);
    let data = ContentEngagementService::get_bulk_status(&state.pg, user_id, &ids)
        .await
        .map_err(|e| {
            log::error!("[ContentEngagement] bulk status error: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(json!({
        "success": true,
        "data": data,
    })))
}

pub async fn get_content_analytics(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ContentAnalyticsQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let days = query.days.unwrap_or(7).clamp(1, 180);
    let limit = query.limit.unwrap_or(10).clamp(1, 50);
    let since = Utc::now() - Duration::days(days as i64);

    let summary_row = sqlx::query(
        r#"
        SELECT 
            COUNT(*)::BIGINT AS impressions,
            SUM(CASE WHEN clicked THEN 1 ELSE 0 END)::BIGINT AS clicks,
            AVG(GREATEST(view_duration_ms, 0))::DOUBLE PRECISION AS avg_view_duration
        FROM content_visibility_tracking
        WHERE appeared_at >= $1
        "#,
    )
    .bind(since)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[ContentAnalytics] summary error: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let impressions: i64 = summary_row
        .try_get::<Option<i64>, _>("impressions")
        .unwrap_or(Some(0))
        .unwrap_or(0);
    let clicks: i64 =
        summary_row.try_get::<Option<i64>, _>("clicks").unwrap_or(Some(0)).unwrap_or(0);
    let avg_view_duration: f64 = summary_row
        .try_get::<Option<f64>, _>("avg_view_duration")
        .unwrap_or(Some(0.0))
        .unwrap_or(0.0);
    let summary_ctr = if impressions > 0 {
        clicks as f64 / impressions as f64
    } else {
        0.0
    };

    let breakdown_rows = sqlx::query(
        r#"
        SELECT content_type,
               COUNT(*)::BIGINT AS impressions,
               SUM(CASE WHEN clicked THEN 1 ELSE 0 END)::BIGINT AS clicks,
               AVG(GREATEST(view_duration_ms, 0))::DOUBLE PRECISION AS avg_view_duration
        FROM content_visibility_tracking
        WHERE appeared_at >= $1
        GROUP BY content_type
        "#,
    )
    .bind(since)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[ContentAnalytics] breakdown error: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let breakdown: Vec<serde_json::Value> = breakdown_rows
        .into_iter()
        .filter_map(|row| {
            let content_type: String = row.try_get("content_type").ok()?;
            let impressions: i64 =
                row.try_get::<Option<i64>, _>("impressions").unwrap_or(Some(0)).unwrap_or(0);
            let clicks: i64 =
                row.try_get::<Option<i64>, _>("clicks").unwrap_or(Some(0)).unwrap_or(0);
            let avg_view_duration: f64 = row
                .try_get::<Option<f64>, _>("avg_view_duration")
                .unwrap_or(Some(0.0))
                .unwrap_or(0.0);
            let ctr = if impressions > 0 {
                clicks as f64 / impressions as f64
            } else {
                0.0
            };
            Some(json!({
                "content_type": content_type,
                "impressions": impressions,
                "clicks": clicks,
                "ctr": ctr,
                "avg_view_duration_ms": avg_view_duration,
            }))
        })
        .collect();

    let top_rows = sqlx::query(
        r#"
        SELECT 
            content_id,
            content_type,
            clicks,
            impressions,
            avg_view_duration,
            last_seen
        FROM (
            SELECT 
                content_id,
                content_type,
                SUM(CASE WHEN clicked THEN 1 ELSE 0 END)::BIGINT AS clicks,
                COUNT(*)::BIGINT AS impressions,
                AVG(GREATEST(view_duration_ms, 0))::DOUBLE PRECISION AS avg_view_duration,
                MAX(appeared_at) AS last_seen
            FROM content_visibility_tracking
            WHERE appeared_at >= $1
              AND ($3::text IS NULL OR content_type = $3)
            GROUP BY content_id, content_type
        ) stats
        ORDER BY CASE WHEN impressions = 0 THEN 0 ELSE clicks::FLOAT / impressions::FLOAT END DESC
        LIMIT $2
        "#,
    )
    .bind(since)
    .bind(limit as i64)
    .bind(query.content_type.as_deref())
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[ContentAnalytics] top content error: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let content_ids: Vec<String> = top_rows
        .iter()
        .filter_map(|row| row.get::<Option<String>, _>("content_id"))
        .collect();

    let engagement_rows = if content_ids.is_empty() {
        vec![]
    } else {
        sqlx::query(
            r#"
            SELECT content_id,
                   SUM(CASE WHEN liked THEN 1 ELSE 0 END)::BIGINT AS likes,
                   SUM(CASE WHEN saved THEN 1 ELSE 0 END)::BIGINT AS saves
            FROM content_engagement
            WHERE content_id = ANY($1)
            GROUP BY content_id
            "#,
        )
        .bind(&content_ids)
        .fetch_all(&state.pg)
        .await
        .map_err(|e| {
            log::error!("[ContentAnalytics] engagement counts error: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    };

    let engagement_map: HashMap<String, (i64, i64)> = engagement_rows
        .into_iter()
        .filter_map(|row| {
            let cid = row.get::<Option<String>, _>("content_id")?;
            let likes = row.get::<Option<i64>, _>("likes").unwrap_or(0);
            let saves = row.get::<Option<i64>, _>("saves").unwrap_or(0);
            Some((cid, (likes, saves)))
        })
        .collect();

    let top_content: Vec<serde_json::Value> = top_rows
        .into_iter()
        .filter_map(|row| {
            let content_id = row.get::<Option<String>, _>("content_id")?;
            let content_type = row.get::<Option<String>, _>("content_type")?;
            let impressions =
                row.try_get::<Option<i64>, _>("impressions").unwrap_or(Some(0)).unwrap_or(0);
            let clicks = row.try_get::<Option<i64>, _>("clicks").unwrap_or(Some(0)).unwrap_or(0);
            let avg_view_duration = row
                .try_get::<Option<f64>, _>("avg_view_duration")
                .unwrap_or(Some(0.0))
                .unwrap_or(0.0);
            let last_seen = row
                .try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("last_seen")
                .ok()
                .flatten()
                .map(|dt| dt.to_rfc3339());
            let ctr = if impressions > 0 {
                clicks as f64 / impressions as f64
            } else {
                0.0
            };
            let (likes, saves) = engagement_map.get(&content_id).copied().unwrap_or((0, 0));
            Some(json!({
                "content_id": content_id,
                "content_type": content_type,
                "impressions": impressions,
                "clicks": clicks,
                "ctr": ctr,
                "avg_view_duration_ms": avg_view_duration,
                "likes": likes,
                "saves": saves,
                "last_seen": last_seen,
            }))
        })
        .collect();

    Ok(Json(json!({
        "success": true,
        "data": {
            "summary": {
                "days": days,
                "impressions": impressions,
                "clicks": clicks,
                "ctr": summary_ctr,
                "avg_view_duration_ms": avg_view_duration,
            },
            "breakdown": breakdown,
            "top_content": top_content,
        }
    })))
}

/// ✅ NOUVEAU: Tracker le temps de visionnage d'une vidéo
pub async fn track_watch_time(
    Path(content_id): Path<String>,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<TrackWatchTimePayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Valider les données
    if payload.watch_duration_ms < 0 {
        return Err(StatusCode::BAD_REQUEST);
    }

    if let Some(video_duration) = payload.video_duration_ms {
        if video_duration <= 0 || payload.watch_duration_ms > video_duration {
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    // Mettre à jour ou créer l'engagement avec temps de visionnage
    let result = sqlx::query(
        r#"
        INSERT INTO content_engagement (
            user_id, 
            content_id, 
            watch_duration_ms, 
            video_duration_ms,
            device_type,
            location_gps,
            created_at,
            updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        ON CONFLICT (user_id, content_id) 
        DO UPDATE SET
            watch_duration_ms = GREATEST(
                EXCLUDED.watch_duration_ms,
                content_engagement.watch_duration_ms
            ),
            video_duration_ms = COALESCE(EXCLUDED.video_duration_ms, content_engagement.video_duration_ms),
            device_type = COALESCE(EXCLUDED.device_type, content_engagement.device_type),
            location_gps = COALESCE(EXCLUDED.location_gps, content_engagement.location_gps),
            updated_at = NOW()
        RETURNING 
            watch_duration_ms,
            video_duration_ms,
            completion_rate
        "#,
    )
    .bind(user.id)
    .bind(&content_id)
    .bind(payload.watch_duration_ms)
    .bind(payload.video_duration_ms)
    .bind(payload.device_type.as_deref())
    .bind(payload.location_gps.as_deref())
    .fetch_one(&state.pg)
    .await;

    match result {
        Ok(row) => {
            let watch_duration: i32 = row.try_get("watch_duration_ms").unwrap_or(0);
            let video_duration: Option<i32> = row.try_get("video_duration_ms").ok();
            let completion_rate: Option<f64> = row.try_get("completion_rate").ok();

            // Mettre à jour les préférences utilisateur si nécessaire (toutes les 10 interactions)
            let _ = sqlx::query("SELECT update_user_preferences($1)")
                .bind(user.id)
                .execute(&state.pg)
                .await;

            Ok(Json(json!({
                "success": true,
                "content_id": content_id,
                "watch_duration_ms": watch_duration,
                "video_duration_ms": video_duration,
                "completion_rate": completion_rate,
            })))
        }
        Err(e) => {
            log::error!("[TrackWatchTime] Error: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
