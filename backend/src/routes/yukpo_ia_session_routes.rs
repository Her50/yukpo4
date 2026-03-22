//! API REST sessions YukpoIA (CRUD + pagination messages).

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json as ResponseJson,
    Json,
};
use log::error;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Instant;
use uuid::Uuid;

use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::yukpo_ia_session_store;
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

#[derive(Debug, Deserialize)]
pub struct PreferencesPatchBody {
    pub long_term_memory_enabled: bool,
    /// Si `true`, enregistre le consentement explicite (horodatage) pour la mémoire long terme.
    #[serde(default)]
    pub long_term_memory_consent_acknowledged: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct GdprDeleteBody {
    /// Doit être `true` (évite suppressions accidentelles).
    pub confirm: bool,
}

#[derive(Debug, Serialize)]
pub struct PreferencesResponse {
    pub long_term_memory_enabled: bool,
    pub long_term_memory_consent_at: Option<chrono::DateTime<chrono::Utc>>,
    /// Préférence + consentement : la mémoire long terme est réellement appliquée.
    pub long_term_memory_active: bool,
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

    let limit = q.limit.unwrap_or(50).clamp(1, 100);
    let (messages, has_more) =
        yukpo_ia_session_store::fetch_messages_page(&state.pg, session_id, q.before, limit)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(ResponseJson(serde_json::json!({
        "session": session,
        "messages": messages,
        "has_more": has_more,
    })))
}

/// Pagination légère : messages uniquement (scroll infini côté client).
pub async fn list_yukpo_ia_session_messages(
    State(state): State<Arc<AppState>>,
    axum::Extension(user): axum::Extension<AuthenticatedUser>,
    Path(session_id): Path<Uuid>,
    Query(q): Query<MessagesQuery>,
) -> Result<ResponseJson<serde_json::Value>, StatusCode> {
    let ok = yukpo_ia_session_store::verify_session_owner(&state.pg, user.id, session_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if !ok {
        return Err(StatusCode::NOT_FOUND);
    }
    let limit = q.limit.unwrap_or(40).clamp(1, 100);
    let (messages, has_more) =
        yukpo_ia_session_store::fetch_messages_page(&state.pg, session_id, q.before, limit)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(ResponseJson(serde_json::json!({
        "session_id": session_id,
        "messages": messages,
        "has_more": has_more,
    })))
}

pub async fn get_yukpo_ia_preferences(
    State(state): State<Arc<AppState>>,
    axum::Extension(user): axum::Extension<AuthenticatedUser>,
) -> Result<ResponseJson<PreferencesResponse>, StatusCode> {
    let start = Instant::now();
    let enabled = yukpo_ia_session_store::user_long_term_memory_enabled(&state.pg, user.id)
        .await
        .map_err(|e| {
            error!("[YukpoIA sessions] prefs get: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let consent_at = yukpo_ia_session_store::user_long_term_memory_consent_at(&state.pg, user.id)
        .await
        .map_err(|e| {
            error!("[YukpoIA sessions] prefs get consent: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let active = yukpo_ia_session_store::user_long_term_memory_active(&state.pg, user.id)
        .await
        .map_err(|e| {
            error!("[YukpoIA sessions] prefs get active: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    state.yukpo_ia_metrics.record(
        "GET /ai/sessions/preferences",
        user.id,
        start.elapsed(),
        true,
    );
    Ok(ResponseJson(PreferencesResponse {
        long_term_memory_enabled: enabled,
        long_term_memory_consent_at: consent_at,
        long_term_memory_active: active,
    }))
}

pub async fn patch_yukpo_ia_preferences(
    State(state): State<Arc<AppState>>,
    axum::Extension(user): axum::Extension<AuthenticatedUser>,
    Json(body): Json<PreferencesPatchBody>,
) -> Result<ResponseJson<PreferencesResponse>, StatusCode> {
    let start = Instant::now();
    if let Err(e) = yukpo_ia_session_store::set_user_long_term_memory_enabled(
        &state.pg,
        user.id,
        body.long_term_memory_enabled,
        body.long_term_memory_consent_acknowledged,
    )
    .await
    {
        error!("[YukpoIA sessions] prefs patch: {}", e);
        state.yukpo_ia_metrics.record(
            "PATCH /ai/sessions/preferences",
            user.id,
            start.elapsed(),
            false,
        );
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }
    let consent_at = yukpo_ia_session_store::user_long_term_memory_consent_at(&state.pg, user.id)
        .await
        .map_err(|e| {
            error!("[YukpoIA sessions] prefs patch read consent: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let active = yukpo_ia_session_store::user_long_term_memory_active(&state.pg, user.id)
        .await
        .map_err(|e| {
            error!("[YukpoIA sessions] prefs patch read active: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    state.yukpo_ia_metrics.record(
        "PATCH /ai/sessions/preferences",
        user.id,
        start.elapsed(),
        true,
    );
    Ok(ResponseJson(PreferencesResponse {
        long_term_memory_enabled: body.long_term_memory_enabled,
        long_term_memory_consent_at: consent_at,
        long_term_memory_active: active,
    }))
}

pub async fn get_yukpo_ia_gdpr_export(
    State(state): State<Arc<AppState>>,
    axum::Extension(user): axum::Extension<AuthenticatedUser>,
) -> Result<ResponseJson<serde_json::Value>, StatusCode> {
    let start = Instant::now();
    let json = match yukpo_ia_session_store::gdpr_export_user_data_json(&state.pg, user.id).await {
        Ok(j) => j,
        Err(e) => {
            error!("[YukpoIA sessions] gdpr export: {}", e);
            state.yukpo_ia_metrics.record(
                "GET /ai/sessions/gdpr/export-my-data",
                user.id,
                start.elapsed(),
                false,
            );
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    state.yukpo_ia_metrics.record(
        "GET /ai/sessions/gdpr/export-my-data",
        user.id,
        start.elapsed(),
        true,
    );
    Ok(ResponseJson(json))
}

pub async fn post_yukpo_ia_gdpr_delete(
    State(state): State<Arc<AppState>>,
    axum::Extension(user): axum::Extension<AuthenticatedUser>,
    Json(body): Json<GdprDeleteBody>,
) -> Result<ResponseJson<serde_json::Value>, StatusCode> {
    if !body.confirm {
        return Err(StatusCode::BAD_REQUEST);
    }
    let start = Instant::now();
    let result = yukpo_ia_session_store::gdpr_delete_all_yukpo_ia_user_data(&state.pg, user.id)
        .await
        .map_err(|e| {
            error!("[YukpoIA sessions] gdpr delete: {}", e);
            state.yukpo_ia_metrics.record(
                "POST /ai/sessions/gdpr/delete-my-data",
                user.id,
                start.elapsed(),
                false,
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    state.yukpo_ia_metrics.record(
        "POST /ai/sessions/gdpr/delete-my-data",
        user.id,
        start.elapsed(),
        true,
    );
    Ok(ResponseJson(serde_json::json!({
        "ok": true,
        "deleted_sessions": result.deleted_sessions,
        "deleted_messages": result.deleted_messages,
        "deleted_memory_rows": result.deleted_memory_rows,
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
