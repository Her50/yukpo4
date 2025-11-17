use std::sync::Arc;

use axum::{routing::get, Router};

use crate::{
    controllers::metrics_controller::{global_metrics, pipeline_metrics, preview_metrics},
    state::AppState,
};

pub fn metrics_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/internal/metrics/pipeline", get(pipeline_metrics))
        .route("/internal/metrics/preview", get(preview_metrics))
        .route("/metrics", get(global_metrics))
        .with_state(state)
}
