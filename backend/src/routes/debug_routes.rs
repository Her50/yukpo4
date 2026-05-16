use crate::middlewares::jwt::{jwt_auth, AuthenticatedUser};
use crate::utils::role_helpers::ensure_admin_role_str;
use crate::{controllers::debug_controller, state::AppState};
use axum::extract::Request;
use axum::http::StatusCode;
use axum::middleware::{from_fn, Next};
use axum::response::Response;
use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

/// ✅ 2026-05-16 — Garde admin pour /api/debug/*
/// Avant : toutes les routes étaient publiques (fuite structure DB + endpoint
/// POST destructif `clean-combinations` ouvert à tous).
/// Après : jwt_auth + admin/super_admin obligatoire. En production, on peut
/// aussi limiter par IP via la variable DEBUG_ALLOWED_IPS (CSV).
async fn require_admin_or_ip_allowlist(req: Request, next: Next) -> Result<Response, StatusCode> {
    // 1) Si IP allowlist définie, vérifier d'abord (utile depuis monitoring interne)
    if let Ok(allowlist) = std::env::var("DEBUG_ALLOWED_IPS") {
        let client_ip = req
            .headers()
            .get("x-forwarded-for")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.split(',').next())
            .map(|s| s.trim().to_string())
            .or_else(|| {
                req.headers()
                    .get("x-real-ip")
                    .and_then(|v| v.to_str().ok())
                    .map(|s| s.to_string())
            })
            .unwrap_or_default();
        let allowed: Vec<&str> = allowlist.split(',').map(str::trim).collect();
        if allowed.iter().any(|ip| !ip.is_empty() && *ip == client_ip) {
            return Ok(next.run(req).await);
        }
    }

    // 2) Sinon, exiger admin/super_admin (jwt_auth est branché en amont)
    let user = req.extensions().get::<AuthenticatedUser>().cloned();
    match user {
        Some(u) if ensure_admin_role_str(&u.role).is_ok() => Ok(next.run(req).await),
        Some(_) => Err(StatusCode::FORBIDDEN),
        None => Err(StatusCode::UNAUTHORIZED),
    }
}

/// Routes de debug pour vérifier l'état de la base de données.
/// ✅ Toutes protégées par jwt_auth + admin/super_admin (ou IP allowlist).
pub fn debug_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/debug/tables", get(debug_controller::check_all_tables))
        .route(
            "/api/debug/autocomplete",
            get(debug_controller::check_autocomplete_tables),
        )
        .route(
            "/api/debug/clean-combinations",
            post(debug_controller::clean_invalid_combinations),
        )
        // Ordre des layers : du plus interne au plus externe.
        // jwt_auth s'exécute en PREMIER (pour peupler AuthenticatedUser),
        // puis require_admin_or_ip_allowlist vérifie le rôle.
        .layer(from_fn(require_admin_or_ip_allowlist))
        .layer(from_fn(jwt_auth))
        .with_state(state)
}
