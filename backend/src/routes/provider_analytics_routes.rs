use axum::{
    extract::{Path, Query, State},
    response::Json,
    routing::get,
    Extension, Router,
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::{
    core::types::AppError, middlewares::jwt::AuthenticatedUser,
    services::provider_analytics_service::ProviderAnalyticsService, state::AppState,
};

pub fn provider_analytics_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/api/provider/{provider_id}/analytics/orders",
            get(get_order_stats),
        )
        .route(
            "/api/provider/{provider_id}/analytics/preparation-time",
            get(get_preparation_time_stats),
        )
        .route(
            "/api/provider/{provider_id}/analytics/rejections",
            get(get_rejection_stats),
        )
        .route(
            "/api/provider/{provider_id}/analytics/cancellations",
            get(get_cancellation_stats),
        )
        .route(
            "/api/provider/{provider_id}/analytics/product-performance",
            get(get_product_performance),
        )
        .route(
            "/api/provider/{provider_id}/analytics/dashboard",
            get(get_dashboard_analytics),
        )
        .with_state(state)
}

#[derive(Debug, Deserialize)]
struct AnalyticsQueryParams {
    period_start: Option<DateTime<Utc>>,
    period_end: Option<DateTime<Utc>>,
    service_id: Option<i32>,
}

/// GET /api/provider/{provider_id}/analytics/orders - Statistiques de commandes
async fn get_order_stats(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(provider_id): Path<i32>,
    Query(params): Query<AnalyticsQueryParams>,
) -> Result<Json<Value>, AppError> {
    // Vérifier que l'utilisateur est le prestataire
    if user.id != provider_id {
        return Err(AppError::Unauthorized(
            "Vous ne pouvez accéder qu'à vos propres analytics".to_string(),
        ));
    }

    let analytics_service = ProviderAnalyticsService::new(state.pg.clone());
    let stats = analytics_service
        .get_provider_analytics(provider_id, params.period_start, params.period_end)
        .await?;

    Ok(Json(json!({
        "order_stats": stats.order_stats
    })))
}

/// GET /api/provider/{provider_id}/analytics/preparation-time - Métriques délais préparation
async fn get_preparation_time_stats(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(provider_id): Path<i32>,
    Query(params): Query<AnalyticsQueryParams>,
) -> Result<Json<Value>, AppError> {
    if user.id != provider_id {
        return Err(AppError::Unauthorized(
            "Vous ne pouvez accéder qu'à vos propres analytics".to_string(),
        ));
    }

    let analytics_service = ProviderAnalyticsService::new(state.pg.clone());
    let stats = analytics_service
        .get_provider_analytics(provider_id, params.period_start, params.period_end)
        .await?;

    Ok(Json(json!({
        "preparation_time_stats": stats.preparation_time_stats
    })))
}

/// GET /api/provider/{provider_id}/analytics/rejections - Analyse produits rejetés
async fn get_rejection_stats(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(provider_id): Path<i32>,
    Query(params): Query<AnalyticsQueryParams>,
) -> Result<Json<Value>, AppError> {
    if user.id != provider_id {
        return Err(AppError::Unauthorized(
            "Vous ne pouvez accéder qu'à vos propres analytics".to_string(),
        ));
    }

    let analytics_service = ProviderAnalyticsService::new(state.pg.clone());
    let stats = analytics_service
        .get_provider_analytics(provider_id, params.period_start, params.period_end)
        .await?;

    Ok(Json(json!({
        "rejection_stats": stats.rejection_stats
    })))
}

/// GET /api/provider/{provider_id}/analytics/cancellations - Statistiques d'annulation
async fn get_cancellation_stats(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(provider_id): Path<i32>,
    Query(params): Query<AnalyticsQueryParams>,
) -> Result<Json<Value>, AppError> {
    if user.id != provider_id {
        return Err(AppError::Unauthorized(
            "Vous ne pouvez accéder qu'à vos propres analytics".to_string(),
        ));
    }

    let analytics_service = ProviderAnalyticsService::new(state.pg.clone());
    let stats = analytics_service
        .get_provider_analytics(provider_id, params.period_start, params.period_end)
        .await?;

    Ok(Json(json!({
        "cancellation_stats": stats.cancellation_stats
    })))
}

/// GET /api/provider/{provider_id}/analytics/product-performance - Performance par produit
async fn get_product_performance(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(provider_id): Path<i32>,
    Query(params): Query<AnalyticsQueryParams>,
) -> Result<Json<Value>, AppError> {
    if user.id != provider_id {
        return Err(AppError::Unauthorized(
            "Vous ne pouvez accéder qu'à vos propres analytics".to_string(),
        ));
    }

    let analytics_service = ProviderAnalyticsService::new(state.pg.clone());
    let product_stats = analytics_service
        .get_product_cancellation_stats(
            provider_id,
            params.service_id,
            params.period_start,
            params.period_end,
        )
        .await?;

    Ok(Json(json!({
        "product_performance": product_stats
    })))
}

/// GET /api/provider/{provider_id}/analytics/dashboard - Données complètes dashboard
async fn get_dashboard_analytics(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(provider_id): Path<i32>,
    Query(params): Query<AnalyticsQueryParams>,
) -> Result<Json<Value>, AppError> {
    if user.id != provider_id {
        return Err(AppError::Unauthorized(
            "Vous ne pouvez accéder qu'à vos propres analytics".to_string(),
        ));
    }

    let analytics_service = ProviderAnalyticsService::new(state.pg.clone());
    let analytics = analytics_service
        .get_provider_analytics(provider_id, params.period_start, params.period_end)
        .await?;

    Ok(Json(json!({
        "analytics": analytics
    })))
}
