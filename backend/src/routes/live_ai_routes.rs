use std::sync::Arc;

use axum::{
    routing::{get, post},
    Router,
};

use crate::{
    controllers::live_ai_controller::{
        generate_live_followup, generate_live_invites, generate_live_teaser, healthcheck,
    },
    state::AppState,
};

pub fn live_ai_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/live/ai/teaser", post(generate_live_teaser))
        .route("/api/live/ai/followup", post(generate_live_followup))
        .route("/api/live/ai/invites", post(generate_live_invites))
        .route("/api/live/ai/health", get(healthcheck))
        .with_state(state)
}
