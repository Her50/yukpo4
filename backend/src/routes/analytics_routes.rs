// ✅ Phase 10 - Routes d'analytics pour prestataires

use axum::{
    extract::{Query, State},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

use crate::middlewares::jwt::{jwt_auth, AuthenticatedUser};
use crate::services::analytics_service::AnalyticsService;
use crate::state::AppState;
use axum::Extension;

pub fn analytics_routes(state: Arc<AppState>) -> axum::Router<Arc<AppState>> {
    axum::Router::new()
        .route(
            "/api/analytics/provider",
            axum::routing::get(get_provider_analytics).layer(axum::middleware::from_fn_with_state(
                state.clone(),
                jwt_auth,
            )),
        )
        .route(
            "/api/analytics/provider/deliveries",
            axum::routing::get(get_delivery_stats).layer(axum::middleware::from_fn_with_state(
                state.clone(),
                jwt_auth,
            )),
        )
        .route(
            "/api/analytics/provider/revenue",
            axum::routing::get(get_revenue_stats).layer(axum::middleware::from_fn_with_state(
                state.clone(),
                jwt_auth,
            )),
        )
        .route(
            "/api/analytics/provider/top-products",
            axum::routing::get(get_top_products).layer(axum::middleware::from_fn_with_state(
                state.clone(),
                jwt_auth,
            )),
        )
        .route(
            "/api/analytics/provider/top-zones",
            axum::routing::get(get_top_zones).layer(axum::middleware::from_fn_with_state(
                state.clone(),
                jwt_auth,
            )),
        )
        .route(
            "/api/analytics/provider/performance",
            axum::routing::get(get_performance_over_time).layer(
                axum::middleware::from_fn_with_state(state.clone(), jwt_auth),
            ),
        )
        .with_state(state)
}

#[derive(Debug, Deserialize)]
struct AnalyticsQuery {
    days: Option<i32>,
    limit: Option<i64>,
}

/// GET /api/analytics/provider - Récupère toutes les analytics pour le prestataire connecté
async fn get_provider_analytics(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(params): Query<AnalyticsQuery>,
) -> impl IntoResponse {
    let analytics_service = AnalyticsService::new(state.pg.clone());

    match analytics_service.get_provider_analytics(user.id, params.days).await {
        Ok(analytics) => Json(serde_json::json!({
            "success": true,
            "data": analytics
        }))
        .into_response(),
        Err(e) => {
            let error_response = serde_json::json!({
                "success": false,
                "error": format!("Erreur récupération analytics: {}", e)
            });
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(error_response),
            )
                .into_response()
        }
    }
}

/// GET /api/analytics/provider/deliveries - Statistiques de livraisons
async fn get_delivery_stats(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(params): Query<AnalyticsQuery>,
) -> impl IntoResponse {
    use crate::services::analytics_service::AnalyticsService;
    use chrono::{Duration, Utc};

    let days = params.days.unwrap_or(30);
    let period_start = Utc::now() - Duration::days(days as i64);
    let period_end = Utc::now();

    let analytics_service = AnalyticsService::new(state.pg.clone());

    match analytics_service.get_delivery_stats(user.id, period_start, period_end).await {
        Ok(stats) => Json(serde_json::json!({
            "success": true,
            "data": stats
        }))
        .into_response(),
        Err(e) => {
            let error_response = serde_json::json!({
                "success": false,
                "error": format!("Erreur récupération stats livraisons: {}", e)
            });
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(error_response),
            )
                .into_response()
        }
    }
}

/// GET /api/analytics/provider/revenue - Statistiques de revenus
async fn get_revenue_stats(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(params): Query<AnalyticsQuery>,
) -> impl IntoResponse {
    use crate::services::analytics_service::AnalyticsService;
    use chrono::{Duration, Utc};

    let days = params.days.unwrap_or(30);
    let period_start = Utc::now() - Duration::days(days as i64);
    let period_end = Utc::now();

    let analytics_service = AnalyticsService::new(state.pg.clone());

    match analytics_service.get_revenue_stats(user.id, period_start, period_end).await {
        Ok(stats) => Json(serde_json::json!({
            "success": true,
            "data": stats
        }))
        .into_response(),
        Err(e) => {
            let error_response = serde_json::json!({
                "success": false,
                "error": format!("Erreur récupération stats revenus: {}", e)
            });
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(error_response),
            )
                .into_response()
        }
    }
}

/// GET /api/analytics/provider/top-products - Top produits/services
async fn get_top_products(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(params): Query<AnalyticsQuery>,
) -> impl IntoResponse {
    use crate::services::analytics_service::AnalyticsService;
    use chrono::{Duration, Utc};

    let days = params.days.unwrap_or(30);
    let limit = params.limit.unwrap_or(10);
    let period_start = Utc::now() - Duration::days(days as i64);
    let period_end = Utc::now();

    let analytics_service = AnalyticsService::new(state.pg.clone());

    match analytics_service
        .get_top_products(user.id, period_start, period_end, limit)
        .await
    {
        Ok(products) => Json(serde_json::json!({
            "success": true,
            "data": products
        }))
        .into_response(),
        Err(e) => {
            let error_response = serde_json::json!({
                "success": false,
                "error": format!("Erreur récupération top produits: {}", e)
            });
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(error_response),
            )
                .into_response()
        }
    }
}

/// GET /api/analytics/provider/top-zones - Top zones de livraison
async fn get_top_zones(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(params): Query<AnalyticsQuery>,
) -> impl IntoResponse {
    use crate::services::analytics_service::AnalyticsService;
    use chrono::{Duration, Utc};

    let days = params.days.unwrap_or(30);
    let limit = params.limit.unwrap_or(10);
    let period_start = Utc::now() - Duration::days(days as i64);
    let period_end = Utc::now();

    let analytics_service = AnalyticsService::new(state.pg.clone());

    match analytics_service
        .get_top_delivery_zones(user.id, period_start, period_end, limit)
        .await
    {
        Ok(zones) => Json(serde_json::json!({
            "success": true,
            "data": zones
        }))
        .into_response(),
        Err(e) => {
            let error_response = serde_json::json!({
                "success": false,
                "error": format!("Erreur récupération top zones: {}", e)
            });
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(error_response),
            )
                .into_response()
        }
    }
}

/// GET /api/analytics/provider/performance - Performance sur le temps
async fn get_performance_over_time(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(params): Query<AnalyticsQuery>,
) -> impl IntoResponse {
    use crate::services::analytics_service::AnalyticsService;
    use chrono::{Duration, Utc};

    let days = params.days.unwrap_or(30);
    let period_start = Utc::now() - Duration::days(days as i64);
    let period_end = Utc::now();

    let analytics_service = AnalyticsService::new(state.pg.clone());

    match analytics_service
        .get_performance_over_time(user.id, period_start, period_end)
        .await
    {
        Ok(performance) => Json(serde_json::json!({
            "success": true,
            "data": performance
        }))
        .into_response(),
        Err(e) => {
            let error_response = serde_json::json!({
                "success": false,
                "error": format!("Erreur récupération performance: {}", e)
            });
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(error_response),
            )
                .into_response()
        }
    }
}
