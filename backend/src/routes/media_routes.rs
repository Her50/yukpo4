// ?? src/routes/media_routes.rs

use axum::{
    routing::{delete, get, post},
    Router,
};
use std::sync::Arc;

use crate::controllers::{
    ia_controller::{generate_distribution_plan, generate_video_brief, generate_video_style},
    media_controller::{delete_media, serve_example_video, upload_media},
};
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;

pub fn media_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/media/upload/{service_id}", post(upload_media))
        .route("/media/delete/{media_id}", delete(delete_media))
        // ✅ PHASE 2: Endpoint pour servir la vidéo exemple (publique, pas d'auth)
        .route("/api/media/examples/video-creation-demo.mp4", get(serve_example_video))
        // ✅ NOUVEAU 2025-11-28: Routes pour génération vidéo IA (protégées par JWT)
        .route("/api/media/generate-video-brief", post(generate_video_brief))
        .route("/api/media/generate-video-style", post(generate_video_style))
        .route("/api/media/generate-distribution-plan", post(generate_distribution_plan))
        .layer(axum::middleware::from_fn(jwt_auth))
        // Les layers globaux CORS/TraceLayer sont appliqués dans lib.rs uniquement
        .with_state(state)
}
