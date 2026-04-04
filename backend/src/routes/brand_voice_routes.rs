// Routes Brand Voice — Yukpo

use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use std::sync::Arc;

use crate::{
    controllers::brand_voice_controller::{generate_post_with_voice, get_brand_voice, train},
    middlewares::jwt::jwt_auth,
    state::AppState,
};

pub fn brand_voice_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/social-ai/brand-voice/{service_id}/train", post(train))
        .route(
            "/api/social-ai/brand-voice/{service_id}",
            get(get_brand_voice),
        )
        .route(
            "/api/social-ai/brand-voice/{service_id}/generate",
            post(generate_post_with_voice),
        )
        .layer(middleware::from_fn_with_state(state.clone(), jwt_auth))
}
