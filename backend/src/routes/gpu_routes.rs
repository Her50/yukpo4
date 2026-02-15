// ✅ NOUVEAU 2026-02-14: Routes API REST pour gestion GPU GCP

use axum::routing::{get, post};
use axum::Router;
use std::sync::Arc;

use crate::controllers::gpu_controller::{
    check_gpu_budget, check_gpu_scale, get_gpu_metrics, get_gpu_status, scale_gpu_instances,
};
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;
use axum::middleware;

pub fn gpu_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // Routes publiques (sans authentification) - métriques et statut
        .route("/api/gpu/metrics", get(get_gpu_metrics))
        .route("/api/gpu/status", get(get_gpu_status))
        // Routes protégées (avec authentification JWT) - gestion
        .route("/api/gpu/scale", post(scale_gpu_instances))
        .route("/api/gpu/check-scale", post(check_gpu_scale))
        .route("/api/gpu/check-budget", post(check_gpu_budget))
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state)
}
