use std::sync::Arc;

use axum::{
    extract::{Json, Path, Query, State},
    Extension,
};
use log::info;
use serde::Deserialize;
use serde_json::json;

use crate::{
    core::types::AppResult,
    middlewares::jwt::AuthenticatedUser,
    services::video_analytics_service::{
        list_recent_quality_scores, record_engagement, update_distribution_status,
    },
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct EngagementPayload {
    pub channel: Option<String>,
    pub session_id: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct DistributionStatusPayload {
    pub status: String,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct QualityQuery {
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct OverviewQuery {
    pub days: Option<i64>,
}

pub async fn track_view(
    State(state): State<Arc<AppState>>,
    Path(media_id): Path<i32>,
    Extension(user): Extension<Option<AuthenticatedUser>>,
    Json(payload): Json<EngagementPayload>,
) -> AppResult<Json<serde_json::Value>> {
    info!(
        "[MediaAnalytics] Tracking view media_id={} channel={:?}",
        media_id, payload.channel
    );

    record_engagement(
        state,
        media_id,
        "view",
        payload.channel,
        user.map(|u| u.id),
        payload.session_id,
        payload.metadata,
    )
    .await?;

    Ok(Json(json!({ "success": true })))
}

pub async fn track_share(
    State(state): State<Arc<AppState>>,
    Path(media_id): Path<i32>,
    Extension(user): Extension<Option<AuthenticatedUser>>,
    Json(payload): Json<EngagementPayload>,
) -> AppResult<Json<serde_json::Value>> {
    info!(
        "[MediaAnalytics] Tracking share media_id={} channel={:?}",
        media_id, payload.channel
    );

    record_engagement(
        state,
        media_id,
        "share",
        payload.channel,
        user.map(|u| u.id),
        payload.session_id,
        payload.metadata,
    )
    .await?;

    Ok(Json(json!({ "success": true })))
}

pub async fn update_distribution(
    State(state): State<Arc<AppState>>,
    Path((media_id, target)): Path<(i32, String)>,
    Json(payload): Json<DistributionStatusPayload>,
) -> AppResult<Json<serde_json::Value>> {
    update_distribution_status(state, media_id, &target, &payload.status, payload.metadata).await?;

    Ok(Json(json!({ "success": true })))
}

pub async fn list_quality_scores(
    State(state): State<Arc<AppState>>,
    Query(params): Query<QualityQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let limit = params.limit.unwrap_or(20).clamp(1, 200);
    let items = list_recent_quality_scores(state, limit).await?;

    let average = if items.is_empty() {
        0.0
    } else {
        let sum: f32 = items.iter().map(|entry| entry.quality_score).sum();
        sum / items.len() as f32
    };

    Ok(Json(json!({
        "success": true,
        "data": {
            "average_quality_score": average,
            "items": items,
        }
    })))
}

pub async fn video_overview(
    State(state): State<Arc<AppState>>,
    Query(params): Query<OverviewQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let horizon = params.days.unwrap_or(7);
    let overview =
        crate::services::video_analytics_service::video_analytics_overview(state, horizon).await?;

    Ok(Json(json!({
        "success": true,
        "data": overview,
    })))
}
