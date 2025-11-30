// ✅ src/routes/video_routes.rs

use axum::{
    routing::get,
    Router,
};
use std::sync::Arc;

use crate::controllers::product_video_controller::get_my_videos;
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;

pub fn video_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // ✅ NOUVEAU: Route pour récupérer les vidéos de l'utilisateur
        .route("/api/videos/my-videos", get(get_my_videos))
        .layer(axum::middleware::from_fn(jwt_auth))
        .with_state(state)
}

