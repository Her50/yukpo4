use std::sync::Arc;

use axum::{routing::get, Router};

use crate::{controllers::metrics_controller::pipeline_metrics, state::AppState};

pub fn metrics_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/internal/metrics/pipeline", get(pipeline_metrics))
        .with_state(state)
}

