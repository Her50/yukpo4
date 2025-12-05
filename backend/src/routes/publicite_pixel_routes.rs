use axum::{
    extract::{Json, Query, State},
    http::StatusCode,
    response::Json as ResponseJson,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::{
    core::types::AppResult,
    services::publicite_pixel_service::{PixelEvent, PixelResponse, PublicitePixelService},
    state::AppState,
};

pub fn publicite_pixel_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::<Arc<AppState>>::new()
        .route("/api/publicites/pixel/events", post(track_event_handler))
        .route(
            "/api/publicites/pixel/events/batch",
            post(track_events_batch_handler),
        )
        .route(
            "/api/publicites/pixel/events/user",
            get(get_user_events_handler),
        )
        .route(
            "/api/publicites/pixel/lookalike",
            post(create_lookalike_handler),
        )
        .with_state(state)
}

#[derive(Debug, Deserialize)]
pub struct TrackEventRequest {
    pub event_name: String,
    pub user_id: Option<i32>,
    pub event_id: Option<String>,
    pub event_time: Option<i64>,
    pub action_source: Option<String>,
    pub custom_data: Option<serde_json::Value>,
    pub user_data: Option<serde_json::Value>,
}

async fn track_event_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<TrackEventRequest>,
) -> AppResult<ResponseJson<PixelResponse>> {
    let event = PixelEvent {
        event_name: payload.event_name,
        user_id: payload.user_id,
        event_id: payload.event_id,
        event_time: payload.event_time,
        action_source: payload.action_source.unwrap_or_else(|| "app".to_string()),
        custom_data: payload.custom_data,
        user_data: payload.user_data,
    };

    let response = PublicitePixelService::track_event(&state.pg, event).await?;
    Ok(ResponseJson(response))
}

#[derive(Debug, Deserialize)]
pub struct TrackEventsBatchRequest {
    pub events: Vec<TrackEventRequest>,
}

async fn track_events_batch_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<TrackEventsBatchRequest>,
) -> AppResult<ResponseJson<PixelResponse>> {
    let events: Vec<PixelEvent> = payload
        .events
        .into_iter()
        .map(|e| PixelEvent {
            event_name: e.event_name,
            user_id: e.user_id,
            event_id: e.event_id,
            event_time: e.event_time,
            action_source: e.action_source.unwrap_or_else(|| "app".to_string()),
            custom_data: e.custom_data,
            user_data: e.user_data,
        })
        .collect();

    let response = PublicitePixelService::track_events_batch(&state.pg, events).await?;
    Ok(ResponseJson(response))
}

#[derive(Debug, Deserialize)]
pub struct GetUserEventsQuery {
    pub user_id: i32,
    pub event_name: Option<String>,
    pub limit: Option<i32>,
}

async fn get_user_events_handler(
    State(state): State<Arc<AppState>>,
    Query(params): Query<GetUserEventsQuery>,
) -> AppResult<ResponseJson<Vec<serde_json::Value>>> {
    let events = PublicitePixelService::get_user_events(
        &state.pg,
        params.user_id,
        params.event_name.as_deref(),
        params.limit,
    )
    .await?;
    Ok(ResponseJson(events))
}

#[derive(Debug, Deserialize)]
pub struct CreateLookalikeRequest {
    pub source_audience_id: i32,
    pub similarity: f64,
    pub size: Option<i32>,
}

async fn create_lookalike_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateLookalikeRequest>,
) -> AppResult<ResponseJson<serde_json::Value>> {
    let audience_id = PublicitePixelService::create_lookalike_audience(
        &state.pg,
        payload.source_audience_id,
        payload.similarity,
        payload.size,
    )
    .await?;
    Ok(ResponseJson(
        serde_json::json!({ "audience_id": audience_id }),
    ))
}
