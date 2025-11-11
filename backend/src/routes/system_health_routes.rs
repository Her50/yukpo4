use axum::{routing::get, Router};
use std::sync::Arc;

use crate::{
    controllers::system_health_controller::{mongo_health, pipeline_health},
    state::AppState,
};

pub fn system_health_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/internal/health/mongo", get(mongo_health))
        .route("/internal/health/pipeline", get(pipeline_health))
        .with_state(state)
}
