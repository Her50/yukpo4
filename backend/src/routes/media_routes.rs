// ?? src/routes/media_routes.rs

use axum::{
    routing::{delete, post},
    Router,
};
use std::sync::Arc;

use crate::controllers::media_controller::{delete_media, upload_media};
use crate::state::AppState;

pub fn media_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/media/upload/{service_id}", post(upload_media))
        .route("/media/delete/{media_id}", delete(delete_media))
        // Les layers globaux CORS/TraceLayer sont appliqu?s dans lib.rs uniquement
        .with_state(state)
}
