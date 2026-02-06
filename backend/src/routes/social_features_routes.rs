/**
 * Routes pour fonctionnalités sociales avancées
 * Duet, Remix, Stitch, Réactions
 */
use axum::{middleware, routing::post, Router};
use std::sync::Arc;

use crate::controllers::social_features_controller::{
    add_reaction, create_duet, create_remix, create_stitch, get_duets, get_reactions,
};
use crate::middlewares::jwt::optional_jwt_auth;
use crate::state::AppState;

pub fn social_features_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // Duet
        .route(
            "/api/duets",
            post(create_duet).layer(middleware::from_fn(optional_jwt_auth)).get(get_duets),
        )
        // Remix
        .route(
            "/api/remixes",
            post(create_remix).layer(middleware::from_fn(optional_jwt_auth)),
        )
        // Stitch
        .route(
            "/api/stitches",
            post(create_stitch).layer(middleware::from_fn(optional_jwt_auth)),
        )
        // Réactions
        .route(
            "/api/videos/{video_id}/reactions",
            post(add_reaction)
                .layer(middleware::from_fn(optional_jwt_auth))
                .get(get_reactions),
        )
        .with_state(state)
}
