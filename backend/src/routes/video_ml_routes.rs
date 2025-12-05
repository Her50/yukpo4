/**
 * Routes pour recommandations ML et hashtags
 */
use crate::controllers::{
    duet_remix_controller::{create_duet, create_duet_multipart, get_duets},
    hashtag_controller::{get_videos_by_hashtag, search_hashtags},
    video_ml_controller::get_ml_recommendations,
    video_upload_controller::upload_video_with_qualities,
};
use crate::middlewares::jwt::optional_jwt_auth;
use crate::state::AppState;
use axum::{middleware, routing::get, Router};
use std::sync::Arc;

pub fn video_ml_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // ✅ Recommandations ML personnalisées
        .route(
            "/api/content/ml-recommendations",
            get(get_ml_recommendations).layer(middleware::from_fn(optional_jwt_auth)),
        )
        // ✅ Recherche hashtags (autocomplete, tendances)
        .route(
            "/api/hashtags/search",
            get(search_hashtags).layer(middleware::from_fn(optional_jwt_auth)),
        )
        // ✅ Vidéos par hashtag
        .route(
            "/api/hashtags/:hashtag/videos",
            get(get_videos_by_hashtag).layer(middleware::from_fn(optional_jwt_auth)),
        )
        // ✅ Duet/Remix (JSON)
        .route(
            "/api/duets",
            axum::routing::post(create_duet).layer(middleware::from_fn(optional_jwt_auth)),
        )
        // ✅ Duet/Remix (Multipart avec upload vidéo)
        .route(
            "/api/duets/upload",
            axum::routing::post(create_duet_multipart)
                .layer(middleware::from_fn(optional_jwt_auth)),
        )
        // ✅ Upload vidéo avec qualités
        .route(
            "/api/videos/upload",
            axum::routing::post(upload_video_with_qualities)
                .layer(middleware::from_fn(optional_jwt_auth)),
        )
        .route(
            "/api/duets",
            get(get_duets).layer(middleware::from_fn(optional_jwt_auth)),
        )
        .with_state(state)
}
