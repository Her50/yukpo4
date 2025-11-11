use axum::{
    async_trait,
    extract::{FromRequestParts, Path, Query, State},
    http::request::Parts,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::AuthenticatedUser,
    models::live_model::{
        ConfigureFlashSalesRequest, CreateLiveSessionRequest, LiveJoinInformation,
        SaveReplayRequest,
    },
    services::{
        live_audience_service, live_flash_sale_service::LiveFlashSaleService,
        live_stream_service::LiveStreamingService, notification_service,
        notification_service::NotificationType, push_notification_service,
    },
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct PaginationQuery {
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct JoinQuery {
    pub viewer_user_id: Option<i32>,
    pub allow_publish: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct FlashSaleReservationPayload {
    pub quantity: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct FlashSaleCommentaryPayload {
    pub message: String,
}

pub struct Authenticated(pub AuthenticatedUser);

#[async_trait]
impl<S> FromRequestParts<S> for Authenticated
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts
            .extensions()
            .get::<AuthenticatedUser>()
            .cloned()
            .map(Authenticated)
            .ok_or_else(|| AppError::Unauthorized("Authentification requise".into()))
    }
}

pub async fn list_upcoming_sessions(
    State(state): State<Arc<AppState>>,
    Query(query): Query<PaginationQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let limit = query.limit.unwrap_or(10);
    let sessions = LiveStreamingService::list_upcoming_sessions(&state.pg, limit).await?;

    Ok(Json(json!({
        "success": true,
        "data": sessions
    })))
}

pub async fn start_live_session(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateLiveSessionRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let response = LiveStreamingService::create_session(state.clone(), payload).await?;

    let mut audience_targets: Vec<i32> = response
        .linked_services
        .as_ref()
        .map(|items| items.iter().map(|item| item.id).collect())
        .unwrap_or_default();
    if let Some(primary) = response.session.service_id {
        if !audience_targets.contains(&primary) {
            audience_targets.push(primary);
        }
    }

    if !audience_targets.is_empty() {
        if let Err(err) = live_audience_service::notify_live_scheduled(
            &state.pg,
            response.session.host_user_id,
            &audience_targets,
            response.session.id,
            &response.session.title,
            response.session.start_at,
        )
        .await
        {
            log::warn!("Live scheduled audience notification failed: {:?}", err);
        }
    }

    Ok(Json(json!({
        "success": true,
        "data": response
    })))
}

pub async fn get_live_session(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let details = LiveStreamingService::get_session(&state.pg, session_id).await?;

    let Some(details) = details else {
        return Err(AppError::NotFound("Session live introuvable".to_string()));
    };

    Ok(Json(json!({
        "success": true,
        "data": details
    })))
}

pub async fn get_join_information(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<Uuid>,
    Query(query): Query<JoinQuery>,
) -> AppResult<Json<LiveJoinInformation>> {
    let info = LiveStreamingService::get_join_information(
        state.clone(),
        session_id,
        query.viewer_user_id,
        query.allow_publish.unwrap_or(false),
    )
    .await?;

    Ok(Json(info))
}

pub async fn register_replay(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<Uuid>,
    Json(payload): Json<SaveReplayRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let replay = LiveStreamingService::save_replay(&state.pg, session_id, payload).await?;

    if let Ok(Some(details)) = LiveStreamingService::get_session(&state.pg, session_id).await {
        let host_user_id = details.session.host_user_id;
        let title = details.session.title.clone();
        let replay_url = replay.replay_url.clone();

        let notification_title = format!("🎬 Replay disponible : {title}");
        let notification_body = format!("Le live \"{title}\" est maintenant disponible en replay.");
        let metadata = Some(json!({
            "live_session_id": session_id,
            "replay_url": replay_url,
            "status": details.session.status,
        }));

        if let Err(err) = notification_service::create_notification(
            &state.pg,
            host_user_id,
            NotificationType::LiveReplayReady,
            notification_title.clone(),
            notification_body.clone(),
            metadata.clone(),
        )
        .await
        {
            log::warn!("Live replay notification DB failed: {err:?}");
        }

        if let Err(err) = push_notification_service::send_push_notification(
            &state.pg,
            host_user_id,
            notification_title,
            notification_body,
            metadata,
            Some("default".into()),
        )
        .await
        {
            log::warn!("Live replay push notification failed: {err:?}");
        }

        let mut audience_targets: Vec<i32> = details
            .linked_services
            .as_ref()
            .map(|items| items.iter().map(|item| item.id).collect())
            .unwrap_or_default();
        if let Some(primary) = details.session.service_id {
            if !audience_targets.contains(&primary) {
                audience_targets.push(primary);
            }
        }

        if !audience_targets.is_empty() {
            if let Err(err) = live_audience_service::notify_live_replay_ready(
                &state.pg,
                host_user_id,
                &audience_targets,
                session_id,
                &details.session.title,
                &replay.replay_url,
            )
            .await
            {
                log::warn!("Live replay audience notification failed: {:?}", err);
            }
        }
    }

    Ok(Json(json!({
        "success": true,
        "data": replay
    })))
}

pub async fn get_lives_analytics(
    State(state): State<Arc<AppState>>,
    Query(query): Query<PaginationQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let limit = query.limit.unwrap_or(20);
    let analytics = LiveStreamingService::get_live_analytics(&state.pg, limit).await?;

    let payload: Vec<serde_json::Value> = analytics
        .into_iter()
        .map(|(session, metrics)| {
            json!({
                "session": session,
                "metrics": metrics
            })
        })
        .collect();

    Ok(Json(json!({
        "success": true,
        "data": payload
    })))
}

pub async fn configure_flash_sales(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<Uuid>,
    Authenticated(user): Authenticated,
    Json(payload): Json<ConfigureFlashSalesRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let configured =
        LiveFlashSaleService::configure_flash_sales(state.clone(), session_id, user.id, payload)
            .await?;

    Ok(Json(json!({
        "success": true,
        "data": configured
    })))
}

pub async fn list_flash_sales(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let sales = LiveFlashSaleService::list_flash_sales(&state.pg, session_id).await?;

    Ok(Json(json!({
        "success": true,
        "data": sales
    })))
}

pub async fn reserve_flash_sale(
    State(state): State<Arc<AppState>>,
    Path(flash_sale_id): Path<Uuid>,
    Authenticated(user): Authenticated,
    Json(payload): Json<FlashSaleReservationPayload>,
) -> AppResult<Json<serde_json::Value>> {
    let summary = LiveFlashSaleService::reserve_slot(
        &state.pg,
        flash_sale_id,
        user.id,
        payload.quantity.unwrap_or(1),
    )
    .await?;

    Ok(Json(json!({
        "success": true,
        "data": summary
    })))
}
pub async fn list_flash_sale_reservations(
    State(state): State<Arc<AppState>>,
    Path(flash_sale_id): Path<Uuid>,
    Authenticated(user): Authenticated,
) -> AppResult<Json<serde_json::Value>> {
    let reservations =
        LiveFlashSaleService::list_reservations_for_host(&state.pg, flash_sale_id, user.id).await?;

    Ok(Json(json!({
        "success": true,
        "data": reservations
    })))
}

pub async fn list_flash_sale_commentaries(
    State(state): State<Arc<AppState>>,
    Path(flash_sale_id): Path<Uuid>,
    Query(query): Query<PaginationQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let limit = query.limit.unwrap_or(20);
    let commentaries =
        LiveFlashSaleService::list_commentaries(&state.pg, flash_sale_id, Some(limit)).await?;

    Ok(Json(json!({
        "success": true,
        "data": commentaries
    })))
}

pub async fn create_flash_sale_commentary(
    State(state): State<Arc<AppState>>,
    Path(flash_sale_id): Path<Uuid>,
    Authenticated(user): Authenticated,
    Json(payload): Json<FlashSaleCommentaryPayload>,
) -> AppResult<Json<serde_json::Value>> {
    let commentary = LiveFlashSaleService::add_host_commentary(
        state.clone(),
        flash_sale_id,
        user.id,
        payload.message,
    )
    .await?;

    Ok(Json(json!({
        "success": true,
        "data": commentary
    })))
}
