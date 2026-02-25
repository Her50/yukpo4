// ?? src/routes/auth_routes.rs

use axum::{
    routing::{options, post},
    Router,
};
use std::sync::Arc;

use crate::controllers::auth_controller::{
    bootstrap_super_admin, login_handler, oauth_login_handler, register_user,
};
use crate::middlewares::anti_bruteforce;
use crate::middlewares::cors::cors_preflight_handler;
use crate::state::AppState;
use axum::middleware;

pub fn auth_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/auth/login",
            post(login_handler)
                // ✅ SÉCURITÉ: Anti-brute-force avec State pour accéder à Redis
                .layer(middleware::from_fn_with_state(
                    state.clone(),
                    anti_bruteforce::anti_bruteforce,
                )),
        )
        .route("/auth/login", options(cors_preflight_handler))
        .route("/auth/register", post(register_user))
        .route("/auth/register", options(cors_preflight_handler))
        // ✅ CORRIGÉ 2026-02-25: Route OAuth manquante (causait 404 pour connexion Google/Facebook)
        .route("/auth/oauth", post(oauth_login_handler))
        .route("/auth/oauth", options(cors_preflight_handler))
        // ✅ TEMPORAIRE: Endpoint pour créer le super admin (sécurisé par token)
        .route("/auth/bootstrap-super-admin", post(bootstrap_super_admin))
        .layer(middleware::from_fn(
            crate::middlewares::monitoring::monitoring,
        ))
        .layer(middleware::from_fn(
            crate::middlewares::audit_log::audit_log,
        ))
        // ✅ SÉCURITÉ: Rate limiting avec State pour accéder à Redis
        .layer(middleware::from_fn_with_state(
            state.clone(),
            crate::middlewares::rate_limit,
        ))
        .layer(middleware::from_fn(
            crate::middlewares::hide_headers::hide_headers,
        ))
        .layer(middleware::from_fn(
            crate::middlewares::request_size_limit::request_size_limit,
        ))
        .with_state(state)
}
