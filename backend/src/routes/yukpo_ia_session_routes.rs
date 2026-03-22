//! API REST sessions YukpoIA (CRUD + pagination messages).

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json as ResponseJson,
    Json,
};
use log::error;
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::yukpo_ia_session_store::{self, MessagePageRow};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct CreateSessionBody {
    pub title: Option<String>,
    pub context_screen: Option<String>,
    pub context_type: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct PatchSessionBody {
    pub title: Option<String>,
    pub is_archived: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ListSessionsQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub include_archived: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct MessagesQuery {
    pub before: Option<chrono::DateTime<chrono::Utc>>,
    pub limit: Option<i64>,
}

pub async fn create_yukpo_ia_session(
    State(state): State<Arc<AppState>>,
    axum::Extension(user): axum::Extension<AuthenticatedUser>,
    Json(body): Json<CreateSessionBody>,
) -> Result<ResponseJson<serde_json::Value>, StatusCode> {
    let meta = body.metadata.unwrap_or_else(|| serde_json::json!({}));
    let row = yukpo_ia_session_store::create_session(
        &state.pg,
        user.id,
        body.title.as_deref(),
        body.context_screen.as_deref(),
        body.context_type.as_deref(),
        meta,
    )
    .await
    .map_err(|e| {
        error!("[YukpoIA sessions] create: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(ResponseJson(serde_json::to_value(row).unwrap_or_default()))
}

pub async fn list_yukpo_ia_sessions(
    State(state): State<Arc<AppState>>,
    axum::Extension(user): axum::Extension<AuthenticatedUser>,
    Query(q): Query<ListSessionsQuery>,
) -> Result<ResponseJson<serde_json::Value>, StatusCode> {
    let limit = q.limit.unwrap_or(30).clamp(1, 100);
    let offset = q.offset.unwrap_or(0).max(0);
    let include = q.include_archived.unwrap_or(false);

    let rows = yukpo_ia_session_store::list_sessions(&state.pg, user.id, limit, offset, include)
        .await
        .map_err(|e| {
            error!("[YukpoIA sessions] list: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(ResponseJson(serde_json::json!({ "sessions": rows })))
}

pub async fn get_yukpo_ia_session(
    State(state): State<Arc<AppState>>,
    axum::Extension(user): axum::Extension<AuthenticatedUser>,
    Path(session_id): Path<Uuid>,
    Query(q): Query<MessagesQuery>,
) -> Result<ResponseJson<serde_json::Value>, StatusCode> {
    let sess = yukpo_ia_session_store::get_session(&state.pg, user.id, session_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let Some(session) = sess else {
        return Err(StatusCode::NOT_FOUND);
    };

    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let messages: Vec<MessagePageRow> =
        yukpo_ia_session_store::fetch_messages_page(&state.pg, session_id, q.before, limit)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(ResponseJson(serde_json::json!({
        "session": session,
        "messages": messages,
    })))
}

pub async fn patch_yukpo_ia_session(
    State(state): State<Arc<AppState>>,
    axum::Extension(user): axum::Extension<AuthenticatedUser>,
    Path(session_id): Path<Uuid>,
    Json(body): Json<PatchSessionBody>,
) -> Result<ResponseJson<serde_json::Value>, StatusCode> {
    let ok = yukpo_ia_session_store::update_session(
        &state.pg,
        user.id,
        session_id,
        body.title.as_deref(),
        body.is_archived,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !ok {
        return Err(StatusCode::NOT_FOUND);
    }
    let sess = yukpo_ia_session_store::get_session(&state.pg, user.id, session_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(ResponseJson(serde_json::json!({ "session": sess })))
}

pub async fn delete_yukpo_ia_session(
    State(state): State<Arc<AppState>>,
    axum::Extension(user): axum::Extension<AuthenticatedUser>,
    Path(session_id): Path<Uuid>,
) -> Result<ResponseJson<serde_json::Value>, StatusCode> {
    let ok = yukpo_ia_session_store::delete_session(&state.pg, user.id, session_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if !ok {
        return Err(StatusCode::NOT_FOUND);
    }
    Ok(ResponseJson(serde_json::json!({ "ok": true })))
}
