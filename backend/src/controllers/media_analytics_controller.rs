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
    Path(media_id): Path<String>,
    Extension(user): Extension<Option<AuthenticatedUser>>,
    payload: Result<Json<EngagementPayload>, axum::extract::JsonRejection>,
) -> AppResult<Json<serde_json::Value>> {
    // ✅ CORRECTION 2025-12-01: Validation media_id AVANT le parsing JSON pour éviter 500
    let media_id_trimmed = media_id.trim();
    
    if media_id_trimmed.is_empty() || media_id_trimmed == "undefined" || media_id_trimmed == "null" {
        return Err(crate::core::types::AppError::BadRequest(format!(
            "media_id invalide: '{}'. Le paramètre media_id est requis et doit être un entier valide.",
            media_id
        )));
    }
    
    // ✅ CORRECTION 2025-12-01: Gérer l'erreur de parsing JSON gracieusement (retourner 400 au lieu de 500)
    let payload = payload.map_err(|e| {
        crate::core::types::AppError::BadRequest(format!(
            "Payload JSON invalide: {}. Vérifiez que le body contient un JSON valide.",
            e
        ))
    })?;
    
    // Valider que media_id est un entier valide
    let media_id_int = media_id_trimmed.parse::<i32>().map_err(|_| {
        crate::core::types::AppError::BadRequest(format!(
            "media_id invalide: '{}'. Doit être un entier, reçu: '{}'",
            media_id_trimmed, media_id
        ))
    })?;
    
    // Valider que l'ID est positif
    if media_id_int <= 0 {
        return Err(crate::core::types::AppError::BadRequest(format!(
            "media_id invalide: '{}'. Doit être un entier positif.",
            media_id_int
        )));
    }

    info!(
        "[MediaAnalytics] Tracking view media_id={} channel={:?}",
        media_id_int, payload.channel
    );

    record_engagement(
        state,
        media_id_int,
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
    payload: Result<Json<EngagementPayload>, axum::extract::JsonRejection>,
) -> AppResult<Json<serde_json::Value>> {
    // ✅ CORRECTION 2025-12-01: Gérer l'erreur de parsing JSON gracieusement (retourner 400 au lieu de 500)
    let payload = payload.map_err(|e| {
        crate::core::types::AppError::BadRequest(format!(
            "Payload JSON invalide: {}. Vérifiez que le body contient un JSON valide.",
            e
        ))
    })?;
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
