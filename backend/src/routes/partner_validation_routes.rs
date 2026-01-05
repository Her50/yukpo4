use axum::{routing::{get, post}, Router};
use std::sync::Arc;

use crate::{
    controllers::partner_validation_controller::{list_pending_partners, validate_partner},
    middlewares::jwt::jwt_auth,
    state::AppState,
};
use axum::middleware;

pub fn partner_validation_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/api/admin/partners/pending",
            get(list_pending_partners),
        )
        .route(
            "/api/admin/partners/{user_id}/validate",
            post(validate_partner),
        )
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state)
}

