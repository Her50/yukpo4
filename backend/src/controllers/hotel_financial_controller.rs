// ✅ NOUVEAU: Contrôleur financier pour les partenaires hôtel/meublé
// Date: 2026-03-17

use crate::core::types::AppError;
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::hotel_financial_service::HotelFinancialService;
use crate::state::AppState;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Json},
    Extension,
};
use chrono::NaiveDate;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

/// GET /api/hotel/financial/dashboard
/// Tableau de bord financier pour les partenaires
pub async fn get_financial_dashboard(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<FinancialQueryParams>,
) -> Result<impl IntoResponse, AppError> {
    let result = HotelFinancialService::get_financial_dashboard(
        &state.pg,
        user_id,
        params.property_id,
        params.start_date(),
        params.end_date(),
    )
    .await
    .map_err(|e| {
        log::error!("[get_financial_dashboard] Erreur: {}", e);
        e
    })?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": result
        })),
    ))
}

/// GET /api/hotel/financial/transactions
/// Historique des transactions
pub async fn get_transaction_history(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<TransactionQueryParams>,
) -> Result<impl IntoResponse, AppError> {
    let result = HotelFinancialService::get_transaction_history(
        &state.pg,
        user_id,
        params.property_id,
        params.start_date(),
        params.end_date(),
        params.limit,
        params.offset,
    )
    .await
    .map_err(|e| {
        log::error!("[get_transaction_history] Erreur: {}", e);
        e
    })?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": result,
            "total": result.len()
        })),
    ))
}

/// GET /api/hotel/financial/export
/// Export des données financières en CSV
pub async fn export_financial_data(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<FinancialQueryParams>,
) -> Result<impl IntoResponse, AppError> {
    let csv_data = HotelFinancialService::export_financial_data(
        &state.pg,
        user_id,
        params.property_id,
        params.start_date(),
        params.end_date(),
    )
    .await
    .map_err(|e| {
        log::error!("[export_financial_data] Erreur: {}", e);
        e
    })?;

    let filename = format!(
        "financial_export_{}.csv",
        chrono::Utc::now().format("%Y%m%d_%H%M%S")
    );

    let disposition = format!("attachment; filename=\"{}\"", filename);
    Ok((
        StatusCode::OK,
        [
            ("Content-Type".to_string(), "text/csv".to_string()),
            ("Content-Disposition".to_string(), disposition),
        ],
        csv_data,
    ))
}

/// GET /api/hotel/financial/summary
/// Résumé financier rapide (pour widgets)
pub async fn get_financial_summary(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<FinancialQueryParams>,
) -> Result<impl IntoResponse, AppError> {
    let dashboard = HotelFinancialService::get_financial_dashboard(
        &state.pg,
        user_id,
        params.property_id,
        params.start_date(),
        params.end_date(),
    )
    .await
    .map_err(|e| {
        log::error!("[get_financial_summary] Erreur: {}", e);
        e
    })?;

    let empty_summary = json!({});
    let summary = dashboard.get("summary").unwrap_or(&empty_summary);

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": summary
        })),
    ))
}

#[derive(Debug, Deserialize)]
pub struct FinancialQueryParams {
    pub property_id: Option<i32>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

impl FinancialQueryParams {
    pub fn start_date(&self) -> Option<NaiveDate> {
        self.start_date
            .as_ref()
            .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
    }

    pub fn end_date(&self) -> Option<NaiveDate> {
        self.end_date
            .as_ref()
            .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
    }
}

#[derive(Debug, Deserialize)]
pub struct TransactionQueryParams {
    pub property_id: Option<i32>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

impl TransactionQueryParams {
    pub fn start_date(&self) -> Option<NaiveDate> {
        self.start_date
            .as_ref()
            .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
    }

    pub fn end_date(&self) -> Option<NaiveDate> {
        self.end_date
            .as_ref()
            .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
    }
}
