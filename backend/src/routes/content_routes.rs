use crate::{
    controllers::content_engagement_controller::{
        get_content_analytics, get_content_engagement, toggle_content_engagement,
    },
    middlewares::jwt::{jwt_auth, optional_jwt_auth},
    state::AppState,
};
use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use std::sync::Arc;

pub fn content_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/api/content/analytics",
            get(get_content_analytics).layer(middleware::from_fn(optional_jwt_auth)),
        )
        .route(
            "/api/content/engagement",
            get(get_content_engagement).layer(middleware::from_fn(optional_jwt_auth)),
        )
        .route(
            "/api/content/{content_id}/engagement",
            post(toggle_content_engagement).layer(middleware::from_fn(jwt_auth)),
        )
        .with_state(state)
}
