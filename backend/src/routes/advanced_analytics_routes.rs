/**
 * Routes pour analytics avancés (heatmaps, A/B testing, cohort analysis)
 */
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use serde::Deserialize;
use std::sync::Arc;

use crate::services::advanced_analytics_service::AdvancedAnalyticsService;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct CohortQuery {
    pub start_date: String,
    pub end_date: String,
}

pub fn advanced_analytics_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // Analyse complète d'une vidéo
        .route("/api/analytics/video/{video_id}", get(analyze_video))
        // Analyse A/B test
        .route("/api/analytics/ab-test/{test_id}", get(analyze_ab_test))
        // Analyse cohortes
        .route("/api/analytics/cohorts", get(analyze_cohorts))
        .with_state(state)
}

/// GET /api/analytics/video/{video_id}
async fn analyze_video(
    State(state): State<Arc<AppState>>,
    Path(video_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match AdvancedAnalyticsService::analyze_video(&state.pg, &video_id).await {
        Ok(analytics) => Ok(Json(serde_json::json!({
            "success": true,
            "data": analytics
        }))),
        Err(e) => {
            log::error!("Erreur analyse vidéo: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// GET /api/analytics/ab-test/{test_id}
async fn analyze_ab_test(
    State(state): State<Arc<AppState>>,
    Path(test_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match AdvancedAnalyticsService::analyze_ab_test(&state.pg, &test_id).await {
        Ok(result) => Ok(Json(serde_json::json!({
            "success": true,
            "data": result
        }))),
        Err(e) => {
            log::error!("Erreur A/B test: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// GET /api/analytics/cohorts?start_date=...&end_date=...
async fn analyze_cohorts(
    State(state): State<Arc<AppState>>,
    Query(params): Query<CohortQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match AdvancedAnalyticsService::analyze_cohorts(&state.pg, &params.start_date, &params.end_date)
        .await
    {
        Ok(cohorts) => Ok(Json(serde_json::json!({
            "success": true,
            "data": cohorts
        }))),
        Err(e) => {
            log::error!("Erreur cohortes: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
