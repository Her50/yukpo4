// Routes pour recevoir les logs mobile
use crate::controllers::mobile_logs_controller;
use crate::state::AppState;
use axum::{routing::post, Router};
use std::sync::Arc;

pub fn mobile_logs_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/api/mobile-logs",
            post(mobile_logs_controller::receive_mobile_logs)
                .layer(axum::extract::DefaultBodyLimit::max(10_000_000)), // ✅ 10 MB - pour permettre l'envoi de logs volumineux
        )
        .with_state(state)
}

