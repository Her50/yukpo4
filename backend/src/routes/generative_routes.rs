// ✅ NOUVEAU Phase 3.1: Routes pour génération vidéo IA complète

use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

use crate::controllers::generative_video_controller::{
    cancel_generation, generate_video, get_generation_status,
};
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;

pub fn generative_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // ✅ NOUVEAU Phase 3.1: Routes pour génération vidéo IA
        .route("/api/generative/generate", post(generate_video))
        .route("/api/generative/status/{job_id}", get(get_generation_status))
        .route("/api/generative/cancel/{job_id}", post(cancel_generation))
        .layer(axum::middleware::from_fn(jwt_auth))
        .with_state(state)
}
