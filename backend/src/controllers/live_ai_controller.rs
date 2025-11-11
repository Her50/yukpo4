use axum::{extract::State, http::StatusCode, Json};
use serde_json::json;
use std::sync::Arc;

use crate::{
    core::types::AppResult,
    services::live_ai_service::{
        LiveAIAutomationService, LiveFollowupRequest, LiveInviteRequest, LiveTeaserRequest,
    },
    state::AppState,
};

pub async fn generate_live_teaser(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LiveTeaserRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let response = LiveAIAutomationService::generate_teaser(state.clone(), &payload).await?;
    Ok(Json(json!({
        "success": true,
        "data": response
    })))
}

pub async fn generate_live_followup(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LiveFollowupRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let response = LiveAIAutomationService::generate_followup(state.clone(), &payload).await?;
    Ok(Json(json!({
        "success": true,
        "data": response
    })))
}

pub async fn generate_live_invites(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LiveInviteRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let response = LiveAIAutomationService::generate_invites(state.clone(), &payload).await?;
    Ok(Json(json!({
        "success": true,
        "data": response
    })))
}

pub async fn healthcheck() -> (StatusCode, &'static str) {
    (StatusCode::OK, "live-ai-ready")
}
