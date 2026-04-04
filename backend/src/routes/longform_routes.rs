// Routes Longform Content — Yukpo

use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use std::sync::Arc;

use crate::{
    controllers::longform_controller::{generate_longform, list_longform, save_longform},
    middlewares::jwt::jwt_auth,
    state::AppState,
};

pub fn longform_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/social-ai/longform/generate", post(generate_longform))
        .route("/api/social-ai/longform/{service_id}", get(list_longform))
        .route(
            "/api/social-ai/longform/{service_id}/save",
            post(save_longform),
        )
        .layer(middleware::from_fn_with_state(state.clone(), jwt_auth))
}
