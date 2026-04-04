// TrendPulse B2B Routes — Yukpo
// API publique monétisée par clé API (X-API-Key header)

use axum::{routing::get, Router};
use std::sync::Arc;

use crate::controllers::trendpulse_b2b_controller::{get_forecast, get_quota, get_trends};
use crate::state::AppState;

pub fn trendpulse_b2b_routes(state: Arc<AppState>) -> Router {
    Router::new()
        // Tendances actives pour une région (?category=food&limit=20)
        .route("/api/b2b/trends/{region}", get(get_trends))
        // Prévisions J+3/J+7/J+14 (plans Professional/Enterprise)
        .route("/api/b2b/trends/{region}/forecast", get(get_forecast))
        // Quota restant pour la clé API
        .route("/api/b2b/quota", get(get_quota))
        .with_state(state)
}
