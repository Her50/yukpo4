// src/controllers/auth_logout_controller.rs
// ✅ 2026-05-16 — Endpoint /auth/logout : ajoute le JWT à la blacklist Redis.
//
// Le frontend doit appeler ce endpoint avant de supprimer le token de
// localStorage. Sans ce call, le token reste utilisable jusqu'à exp (24 h).
//
// Bénéfices :
//   - Vol de token (XSS, partage de device) limité à la fenêtre entre logout
//     et l'attaque (≈ instantané si le user clique logout dès qu'il finit).
//   - Compte compromis détecté → admin peut invalider tous les tokens actifs
//     en bumpant un compteur global (todo : token version), mais déjà bénéfice
//     immédiat sur les sessions volontairement closes.

use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::Json;
use serde_json::json;
use std::sync::Arc;

use crate::middlewares::token_blacklist;
use crate::state::AppState;
use crate::utils::jwt_manager::decode_jwt;

pub async fn logout_handler(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let token = headers
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .ok_or((
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": "missing_bearer", "message": "Aucun token fourni"})),
        ))?;

    // Calculer le TTL restant pour Redis (purge auto à exp)
    let secret = std::env::var("JWT_SECRET").unwrap_or_default();
    let ttl_secs: i64 = match decode_jwt(token, &secret) {
        Ok(data) => {
            let now = chrono::Utc::now().timestamp();
            (data.claims.exp as i64).saturating_sub(now).max(0)
        }
        // Token invalide ou expiré : pas la peine de blacklister
        Err(_) => 0,
    };

    if ttl_secs > 0 {
        if let Err(e) = token_blacklist::blacklist_token(&state, token, ttl_secs).await {
            log::warn!("[logout] échec blacklist (non-bloquant) : {}", e);
        }
    }

    Ok(Json(json!({
        "success": true,
        "message": "Déconnecté"
    })))
}
