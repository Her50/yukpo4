// ?? src/routes/auth_routes.rs

use axum::{
    routing::{options, post},
    Router,
};
use std::sync::Arc;

use crate::controllers::auth_controller::{
    bootstrap_super_admin, login_handler, oauth_login_handler, register_user,
};
use axum::response::Json;
use serde_json::json;

// Endpoint de test sans dépendance DB
pub async fn test_handler() -> Result<Json<serde_json::Value>, axum::http::StatusCode> {
    Ok(Json(json!({
        "status": "ok",
        "message": "Backend fonctionne sans DB",
        "timestamp": chrono::Utc::now().to_rfc3339()
    })))
}
use crate::middlewares::anti_bruteforce;
use crate::middlewares::cors::cors_preflight_handler;
use crate::state::AppState;
use axum::middleware;

pub fn auth_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // ✅ TEMPORAIRE: Endpoint de test sans dépendance DB
        .route("/auth/test", post(test_handler))
        .route("/auth/test", options(cors_preflight_handler))
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
