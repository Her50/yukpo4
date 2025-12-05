use std::sync::Arc;

use axum::{routing::get, Router};

use crate::{
    controllers::metrics_controller::{global_metrics, pipeline_metrics, preview_metrics},
    controllers::prometheus_metrics_controller::prometheus_metrics_handler,
    state::AppState,
};

pub fn metrics_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/internal/metrics/pipeline", get(pipeline_metrics))
        .route("/internal/metrics/preview", get(preview_metrics))
        .route("/metrics", get(global_metrics)) // Métriques JSON format
        // ✅ Phase 3: Endpoint Prometheus standard (format Prometheus)
        .route("/metrics/prometheus", get(prometheus_metrics_handler))
        .with_state(state)
}
