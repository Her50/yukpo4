use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::request::Parts,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::{
    config::feature_flags::KnownFlag,
    core::types::{AppError, AppResult},
    middlewares::jwt::AuthenticatedUser,
    models::global_promo_model::{
        BulkReviewGlobalPromoEntryRequest, CreateGlobalPromoEventRequest, GlobalPromoCatalogQuery,
        ReviewGlobalPromoEntryRequest, UpdateGlobalPromoEventRequest,
        UpsertGlobalPromoEntryRequest,
    },
    services::global_promo_service::GlobalPromoService,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct ListEventsQuery {
    #[serde(default)]
    pub include_archived: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SnapshotRegenerationPayload {
    #[serde(default)]
    pub highlighted: Option<bool>,
    #[serde(default)]
    pub priority_score: Option<i32>,
}

pub struct Authenticated(pub AuthenticatedUser);

impl<S> axum::extract::FromRequestParts<S> for Authenticated
where
    S: Send + Sync,
{
    type Rejection = AppError;

    fn from_request_parts(
        parts: &mut Parts,
        _state: &S,
    ) -> impl std::future::Future<Output = Result<Self, Self::Rejection>> + Send {
        std::future::ready(
            parts
                .extensions
                .get::<AuthenticatedUser>()
                .cloned()
                .map(Authenticated)
                .ok_or_else(|| AppError::Unauthorized("Authentification requise".into())),
        )
    }
}

fn ensure_admin_role(user: &AuthenticatedUser) -> AppResult<()> {
    if matches!(user.role.as_str(), "admin" | "super_admin") {
        Ok(())
    } else {
        Err(AppError::Forbidden(
            "Accès réservé aux administrateurs Global Promo.".into(),
        ))
    }
}

pub async fn create_global_promo_event(
    State(state): State<Arc<AppState>>,
    Authenticated(user): Authenticated,
    Json(payload): Json<CreateGlobalPromoEventRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let event = GlobalPromoService::create_event(&state.pg, payload, user.id).await?;
    Ok(Json(json!({ "success": true, "data": event })))
}

pub async fn update_global_promo_event(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<UpdateGlobalPromoEventRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let event = GlobalPromoService::update_event(&state.pg, event_id, payload).await?;
    Ok(Json(json!({ "success": true, "data": event })))
}

pub async fn list_global_promo_events(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListEventsQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let include_archived = query.include_archived.unwrap_or(false);
    let events = GlobalPromoService::list_events(&state.pg, include_archived).await?;
    Ok(Json(json!({ "success": true, "data": events })))
}

pub async fn get_global_promo_event(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let event = GlobalPromoService::get_event(&state.pg, event_id).await?;
    let entries = GlobalPromoService::list_entries_for_event(&state.pg, event_id).await?;
    Ok(Json(json!({
        "success": true,
        "data": {
            "event": event,
            "entries": entries
        }
    })))
}

pub async fn list_global_promo_entries(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let entries = GlobalPromoService::list_entries_for_event(&state.pg, event_id).await?;
    Ok(Json(json!({ "success": true, "data": entries })))
}

pub async fn upsert_global_promo_entry(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    Authenticated(user): Authenticated,
    Json(payload): Json<UpsertGlobalPromoEntryRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let entry = GlobalPromoService::upsert_entry(&state.pg, event_id, payload, user.id).await?;
    Ok(Json(json!({ "success": true, "data": entry })))
}

pub async fn regenerate_global_promo_snapshot(
    State(state): State<Arc<AppState>>,
    Path(entry_id): Path<Uuid>,
    Json(payload): Json<SnapshotRegenerationPayload>,
) -> AppResult<Json<serde_json::Value>> {
    GlobalPromoService::regenerate_snapshot_from_service(
        &state.pg,
        entry_id,
        payload.highlighted.unwrap_or(false),
        payload.priority_score.unwrap_or(0),
    )
    .await?;

    Ok(Json(json!({
        "success": true,
        "message": "Aperçu promotionnel régénéré"
    })))
}

pub async fn list_global_promo_catalog(
    State(state): State<Arc<AppState>>,
    Query(query): Query<GlobalPromoCatalogQuery>,
) -> AppResult<Json<serde_json::Value>> {
    if !state.feature_flags.is_enabled(KnownFlag::GlobalPromos) {
        return Ok(Json(json!({
            "success": false,
            "error": {
                "code": "feature_disabled",
                "message": "La fonctionnalité Global Promo est désactivée sur cet environnement."
            }
        })));
    }
    let catalog = GlobalPromoService::list_active_catalog(&state.pg, query).await?;
    Ok(Json(json!({ "success": true, "data": catalog })))
}

pub async fn list_my_global_promo_events(
    State(state): State<Arc<AppState>>,
    Authenticated(user): Authenticated,
) -> AppResult<Json<serde_json::Value>> {
    let events = GlobalPromoService::list_available_events(&state.pg).await?;
    let entries = GlobalPromoService::list_entries_for_user(&state.pg, user.id).await?;
    Ok(Json(json!({
        "success": true,
        "data": {
            "events": events,
            "entries": entries
        }
    })))
}

pub async fn list_my_global_promo_entries(
    State(state): State<Arc<AppState>>,
    Authenticated(user): Authenticated,
) -> AppResult<Json<serde_json::Value>> {
    let entries = GlobalPromoService::list_entries_for_user(&state.pg, user.id).await?;
    Ok(Json(json!({ "success": true, "data": entries })))
}

pub async fn submit_my_global_promo_entry(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    Authenticated(user): Authenticated,
    Json(payload): Json<UpsertGlobalPromoEntryRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let entry =
        GlobalPromoService::upsert_entry_for_owner(&state.pg, event_id, user.id, payload).await?;
    Ok(Json(json!({ "success": true, "data": entry })))
}

pub async fn review_global_promo_entry(
    State(state): State<Arc<AppState>>,
    Path(entry_id): Path<Uuid>,
    Authenticated(user): Authenticated,
    Json(payload): Json<ReviewGlobalPromoEntryRequest>,
) -> AppResult<Json<serde_json::Value>> {
    ensure_admin_role(&user)?;
    let entry = GlobalPromoService::review_entry(&state.pg, entry_id, user.id, payload).await?;
    Ok(Json(json!({ "success": true, "data": entry })))
}

pub async fn review_global_promo_entries_bulk(
    State(state): State<Arc<AppState>>,
    Authenticated(user): Authenticated,
    Json(payload): Json<BulkReviewGlobalPromoEntryRequest>,
) -> AppResult<Json<serde_json::Value>> {
    ensure_admin_role(&user)?;
    let entries = GlobalPromoService::review_entries_bulk(&state.pg, user.id, payload).await?;
    Ok(Json(json!({ "success": true, "data": entries })))
}
