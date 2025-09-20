// ?? src/routes/auth_routes.rs

use axum::{routing::{post, options}, Router};
use std::sync::Arc;

use crate::controllers::auth_controller::{login_handler, register_user};
use crate::middlewares::anti_bruteforce;
use crate::middlewares::cors::cors_preflight_handler;
use crate::state::AppState;
use axum::middleware;

pub fn auth_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/auth/login", post(login_handler).layer(middleware::from_fn(anti_bruteforce::anti_bruteforce)))
        .route("/auth/login", options(cors_preflight_handler))
        .route("/auth/register", post(register_user))
        .route("/auth/register", options(cors_preflight_handler))
        .layer(middleware::from_fn(crate::middlewares::monitoring::monitoring))
        .layer(middleware::from_fn(crate::middlewares::audit_log::audit_log))
        .layer(middleware::from_fn(crate::middlewares::rate_limit::rate_limit))
        .layer(middleware::from_fn(crate::middlewares::hide_headers::hide_headers))
        .layer(middleware::from_fn(crate::middlewares::request_size_limit::request_size_limit))
        .with_state(state)
}
