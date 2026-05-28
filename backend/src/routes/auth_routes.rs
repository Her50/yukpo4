// ?? src/routes/auth_routes.rs

use axum::{
    routing::{get, options, post},
    Router,
};
use std::sync::Arc;

use crate::controllers::auth_controller::{
    bootstrap_super_admin,
    login_handler,
    me_handler,
    oauth_login_handler,
    register_user,
    send_phone_verification_code,
    verify_phone_code, // ✅ NOUVEAUX
};
use crate::controllers::auth_phone_controller::{
    check_phone, login_phone, reclaim_phone, register_phone,
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
        .route(
            "/auth/register",
            post(register_user).layer(axum::extract::DefaultBodyLimit::max(20_000_000)), // 20MB — supporte 2 images docs + logo
        )
        .route("/auth/register", options(cors_preflight_handler))
        // ✅ 2026-05-28 — Auth simplifiée par téléphone + PIN 4 chiffres
        // (cible : parents qui scannent une liste scolaire — pas d'email,
        // pas de mot de passe complexe). cf. auth_phone_controller.rs.
        .route("/auth/phone/check", post(check_phone))
        .route("/auth/phone/check", options(cors_preflight_handler))
        .route(
            "/auth/phone/register",
            post(register_phone)
                .layer(middleware::from_fn_with_state(
                    state.clone(),
                    anti_bruteforce::anti_bruteforce,
                )),
        )
        .route("/auth/phone/register", options(cors_preflight_handler))
        .route(
            "/auth/phone/login",
            post(login_phone)
                .layer(middleware::from_fn_with_state(
                    state.clone(),
                    anti_bruteforce::anti_bruteforce,
                )),
        )
        .route("/auth/phone/login", options(cors_preflight_handler))
        // ✅ 2026-05-28 — Réclamation anti-squat : "ce numéro est le mien,
        // quelqu'un d'autre l'a pris". Crée un ticket admin sans alerter
        // le compte cible. Anti-spam : 3 / IP / 24 h (logique côté handler).
        .route(
            "/auth/phone/reclaim",
            post(reclaim_phone)
                .layer(middleware::from_fn_with_state(
                    state.clone(),
                    anti_bruteforce::anti_bruteforce,
                )),
        )
        .route("/auth/phone/reclaim", options(cors_preflight_handler))
        // ✅ NOUVEAUX: Endpoints vérification téléphone
        .route(
            "/auth/send-verification-sms",
            post(send_phone_verification_code),
        )
        .route(
            "/auth/send-verification-sms",
            options(cors_preflight_handler),
        )
        // ✅ ALIAS mobile (OtpVerificationScreen utilise ces endpoints)
        // ⚠️ SUPPRIMÉ: /auth/send-otp et /auth/verify-otp → dupliqués avec phone_verification_routes.rs
        .route("/auth/verify-phone", post(verify_phone_code))
        .route("/auth/verify-phone", options(cors_preflight_handler))
        // ✅ CORRIGÉ 2026-02-25: Route OAuth manquante (causait 404 pour connexion Google/Facebook)
        .route("/auth/oauth", post(oauth_login_handler))
        .route("/auth/oauth", options(cors_preflight_handler))
        // ✅ TEMPORAIRE: Endpoint pour créer le super admin (sécurisé par token)
        .route("/auth/bootstrap-super-admin", post(bootstrap_super_admin))
        // ✅ 2026-05-16: Logout — blacklist le JWT côté serveur (Redis)
        .route(
            "/auth/logout",
            post(crate::controllers::auth_logout_controller::logout_handler),
        )
        .route("/auth/logout", options(cors_preflight_handler))
        // ✅ 2026-05-21: GET /auth/me — récupère les infos user depuis le JWT.
        // Permet au frontend web de connaître l'utilisateur connecté sans
        // jamais accéder au JWT côté JS (le JWT est dans un cookie httpOnly).
        .route(
            "/auth/me",
            get(me_handler).layer(middleware::from_fn(crate::middlewares::jwt::jwt_auth)),
        )
        .route("/auth/me", options(cors_preflight_handler))
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
