//! ✅ Contrôleur Analytics Dashboard - Taxi & Covoiturage
//!
//! Dashboard complet avec métriques temps réel
//! Objectif: Business Intelligence 100%

use crate::core::types::AppResult;
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::taxi_analytics_service::TaxiAnalyticsService;
use crate::state::AppState;
use axum::{
    extract::{Extension, Query, State},
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use log::info;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct AnalyticsQuery {
    pub start_date: Option<chrono::NaiveDate>,
    pub end_date: Option<chrono::NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct DemandTrendsQuery {
    pub start_date: Option<chrono::NaiveDate>,
    pub end_date: Option<chrono::NaiveDate>,
    pub service_type: Option<String>, // "taxi" | "covoiturage" | "all"
}

/// ✅ GET /api/admin/taxi/analytics/overview
/// Vue d'ensemble analytics
pub async fn get_analytics_overview(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(query): Query<AnalyticsQuery>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_analytics_overview] User {} demande analytics overview",
        user_id
    );

    let analytics_service = TaxiAnalyticsService::new(Arc::new(state.pg.clone()));
    let overview = analytics_service.get_overview(query.start_date, query.end_date).await?;

    Ok(Json(json!({
        "success": true,
        "data": overview,
    })))
}

/// ✅ GET /api/admin/taxi/analytics/demand-trends
/// Tendances de demande par heure/jour
pub async fn get_demand_trends(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(query): Query<DemandTrendsQuery>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_demand_trends] User {} demande tendances demande",
        user_id
    );

    let today = Utc::now().date_naive();
    let start = query.start_date.unwrap_or(today - chrono::Duration::days(30));
    let end = query.end_date.unwrap_or(today);
    let service_type = query.service_type.as_deref();

    let analytics_service = TaxiAnalyticsService::new(Arc::new(state.pg.clone()));
    let trends = analytics_service.get_demand_trends(start, end, service_type).await?;

    Ok(Json(json!({
        "success": true,
        "data": trends,
    })))
}

/// ✅ GET /api/admin/taxi/analytics/revenue
/// Analytics revenus détaillés
pub async fn get_revenue_analytics(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(query): Query<AnalyticsQuery>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_revenue_analytics] User {} demande analytics revenus",
        user_id
    );

    let today = Utc::now().date_naive();
    let start = query.start_date.unwrap_or(today - chrono::Duration::days(30));
    let end = query.end_date.unwrap_or(today);

    let analytics_service = TaxiAnalyticsService::new(Arc::new(state.pg.clone()));
    let revenue = analytics_service.get_revenue_analytics(start, end).await?;

    Ok(Json(json!({
        "success": true,
        "data": revenue,
    })))
}

/// ✅ GET /api/admin/taxi/analytics/driver-performance
/// Performance conducteurs
pub async fn get_driver_performance(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(query): Query<AnalyticsQuery>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_driver_performance] User {} demande performance conducteurs",
        user_id
    );

    let today = Utc::now().date_naive();
    let start = query.start_date.unwrap_or(today - chrono::Duration::days(30));
    let end = query.end_date.unwrap_or(today);

    let analytics_service = TaxiAnalyticsService::new(Arc::new(state.pg.clone()));
    let perf = analytics_service.get_driver_performance(start, end).await?;

    Ok(Json(json!({
        "success": true,
        "data": perf,
    })))
}
