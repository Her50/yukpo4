use axum::{extract::State, Json};
use chrono::Utc;
use serde_json::json;
use std::sync::Arc;

use crate::{
    core::types::AppResult,
    services::pipeline_health_service::{compute_pipeline_health, PipelineHealthStatus},
    state::AppState,
};

pub async fn mongo_health(
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<serde_json::Value>> {
    state.mongo_history.ping().await?;

    Ok(Json(json!({
        "service": "mongo_history",
        "status": "ok",
        "timestamp": Utc::now().to_rfc3339(),
    })))
}

pub async fn pipeline_health(
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<PipelineHealthStatus>> {
    let status = compute_pipeline_health(state).await?;
    Ok(Json(status))
}
