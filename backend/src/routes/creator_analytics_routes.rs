/**
 * Routes pour analytics créateurs
 */
use crate::controllers::creator_analytics_controller::{
    get_creator_analytics, get_video_analytics,
};
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;
use axum::{middleware, routing::get, Router};
use std::sync::Arc;

pub fn creator_analytics_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // ✅ Analytics d'un créateur
        .route(
            "/api/creators/:user_id/analytics",
            get(get_creator_analytics).layer(middleware::from_fn(jwt_auth)),
        )
        // ✅ Analytics d'une vidéo spécifique
        .route(
            "/api/videos/:video_id/analytics",
            get(get_video_analytics).layer(middleware::from_fn(jwt_auth)),
        )
        .with_state(state)
}
