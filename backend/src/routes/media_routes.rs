// ?? src/routes/media_routes.rs

use axum::{
    routing::{delete, get, post},
    Router,
};
use std::sync::Arc;

use crate::controllers::media_controller::{delete_media, serve_example_video, upload_media};
use crate::state::AppState;

pub fn media_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/media/upload/{service_id}", post(upload_media))
        .route("/media/delete/{media_id}", delete(delete_media))
        // ✅ PHASE 2: Endpoint pour servir la vidéo exemple (publique, pas d'auth)
        .route("/api/media/examples/video-creation-demo.mp4", get(serve_example_video))
        // Les layers globaux CORS/TraceLayer sont appliqués dans lib.rs uniquement
        .with_state(state)
}
