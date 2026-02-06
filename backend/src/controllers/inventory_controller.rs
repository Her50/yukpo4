use std::sync::Arc;

use axum::{
    extract::{Path, State},
    Extension, Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::{
    core::types::AppResult,
    middlewares::jwt::AuthenticatedUser,
    services::inventory_service::{StockSignal, INVENTORY_STALE_THRESHOLD_HOURS},
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct StockSyncPayload {
    pub stock_level: i32,
    pub source: Option<String>,
    pub note: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct StockStatusResponse {
    pub service_id: i32,
    pub product_index: i32,
    pub stock_level: Option<i32>,
    pub source: Option<String>,
    pub note: Option<String>,
    pub last_synced_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub stale: bool,
    pub threshold_hours: i64,
}

impl StockStatusResponse {
    fn from_signal(signal: StockSignal) -> Self {
        let stale = signal.is_stale(INVENTORY_STALE_THRESHOLD_HOURS);
        Self {
            service_id: signal.service_id,
            product_index: signal.product_index,
            stock_level: Some(signal.stock_level),
            source: signal.source,
            note: signal.note,
            last_synced_at: Some(signal.last_synced_at),
            expires_at: signal.expires_at,
            stale,
            threshold_hours: INVENTORY_STALE_THRESHOLD_HOURS,
        }
    }

    fn empty(service_id: i32, product_index: i32) -> Self {
        Self {
            service_id,
            product_index,
            stock_level: None,
            source: None,
            note: None,
            last_synced_at: None,
            expires_at: None,
            stale: true,
            threshold_hours: INVENTORY_STALE_THRESHOLD_HOURS,
        }
    }
}

pub async fn sync_stock(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path((service_id, product_index)): Path<(i32, i32)>,
    Json(payload): Json<StockSyncPayload>,
) -> AppResult<Json<StockStatusResponse>> {
    if payload.stock_level < 0 {
        return Err(crate::core::types::AppError::BadRequest(
            "Le stock doit être positif.".into(),
        ));
    }

    state.inventory.ensure_service_owner(user.id, service_id).await?;

    let signal = state
        .inventory
        .upsert_override(
            service_id,
            product_index,
            payload.stock_level,
            payload.source.clone(),
            payload.note.clone(),
            payload.expires_at,
        )
        .await?;

    Ok(Json(StockStatusResponse::from_signal(signal)))
}

pub async fn get_stock_status(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path((service_id, product_index)): Path<(i32, i32)>,
) -> AppResult<Json<StockStatusResponse>> {
    state.inventory.ensure_service_owner(user.id, service_id).await?;

    let signal = state.inventory.latest_signal(service_id, product_index).await?;

    if let Some(signal) = signal {
        return Ok(Json(StockStatusResponse::from_signal(signal)));
    }

    Ok(Json(StockStatusResponse::empty(service_id, product_index)))
}
