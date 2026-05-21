// src/controllers/auth_logout_controller.rs
// ✅ 2026-05-16 — Endpoint /auth/logout : ajoute le JWT à la blacklist Redis.
// ✅ 2026-05-21 — Étendu : lit aussi le token depuis le cookie httpOnly +
//                clear le cookie côté navigateur (fix XSS web).
//
// Bénéfices :
//   - Vol de token (XSS, partage de device) limité à la fenêtre entre logout
//     et l'attaque. Pour le web, le token est en cookie httpOnly donc invisible
//     à JS — XSS ne peut plus voler le JWT directement.
//   - Compte compromis détecté → admin peut invalider tous les tokens actifs
//     en bumpant un compteur global (todo : token version), mais déjà bénéfice
//     immédiat sur les sessions volontairement closes.

use axum::extract::State;
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::IntoResponse;
use axum::Json;
use serde_json::json;
use std::sync::Arc;

use crate::controllers::auth_controller::build_jwt_cookie;
use crate::middlewares::token_blacklist;
use crate::state::AppState;
use crate::utils::jwt_manager::decode_jwt;

/// Extrait le token depuis le header Authorization OU le cookie `token`.
fn extract_token(headers: &HeaderMap) -> Option<String> {
    if let Some(bearer) = headers
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
    {
        if !bearer.is_empty() {
            return Some(bearer.to_string());
        }
    }
    let cookie_header = headers.get("cookie")?.to_str().ok()?;
    for pair in cookie_header.split(';') {
        let pair = pair.trim();
        if let Some(value) = pair.strip_prefix("token=") {
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}

pub async fn logout_handler(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let token = extract_token(&headers).ok_or((
        StatusCode::UNAUTHORIZED,
        Json(json!({"error": "missing_token", "message": "Aucun token fourni"})),
    ))?;

    // Calculer le TTL restant pour Redis (purge auto à exp)
    let secret = std::env::var("JWT_SECRET").unwrap_or_default();
    let ttl_secs: i64 = match decode_jwt(&token, &secret) {
        Ok(data) => {
            let now = chrono::Utc::now().timestamp();
            (data.claims.exp as i64).saturating_sub(now).max(0)
        }
        // Token invalide ou expiré : pas la peine de blacklister
        Err(_) => 0,
    };

    if ttl_secs > 0 {
        if let Err(e) = token_blacklist::blacklist_token(&state, &token, ttl_secs).await {
            log::warn!("[logout] échec blacklist (non-bloquant) : {}", e);
        }
    }

    // ✅ 2026-05-21 — Clear le cookie httpOnly côté navigateur web.
    // Sur mobile RN (qui ignore les cookies), ce header est juste ignoré.
    let mut resp_headers = HeaderMap::new();
    let clear_cookie = build_jwt_cookie("", 0);
    if let Ok(hv) = HeaderValue::from_str(&clear_cookie) {
        resp_headers.insert(axum::http::header::SET_COOKIE, hv);
    }

    Ok((
        resp_headers,
        Json(json!({ "success": true, "message": "Déconnecté" })),
    ))
}
