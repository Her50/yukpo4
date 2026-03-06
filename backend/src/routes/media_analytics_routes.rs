// 📊 Routes pour analytics média (vidéo, images, etc.)
// Endpoints pour dashboard d'analyse des vidéos

use crate::controllers::media_analytics_controller;
use crate::state::AppState;
use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

/// Routes pour analytics média
pub fn media_analytics_routes() -> Router<Arc<AppState>> {
    Router::new()
        // Routes pour tracking d'engagement
        .route(
            "/media/{media_id}/track/view",
            post(media_analytics_controller::track_view),
        )
        .route(
            "/media/{media_id}/track/share",
            post(media_analytics_controller::track_share),
        )
        // Routes pour analytics de contenu
        .route(
            "/analytics/overview",
            get(media_analytics_controller::video_overview),
        )
        .route(
            "/analytics/content",
            get(media_analytics_controller::content_analytics),
        )
        .route(
            "/analytics/live",
            get(media_analytics_controller::live_analytics),
        )
        // Routes pour qualité et distribution
        .route(
            "/analytics/quality",
            get(media_analytics_controller::list_quality_scores),
        )
        .route(
            "/media/{media_id}/distribution/{target}",
            post(media_analytics_controller::update_distribution),
        )
}
