// src/middlewares/token_blacklist.rs
// ✅ 2026-05-16 — Blacklist JWT via Redis pour révocation côté serveur.
//
// Problème résolu : le JWT actuel a un TTL de 24 h (cf jwt_manager.rs).
// Sans blacklist, un logout côté client laisse le token utilisable jusqu'à exp.
// Si un token fuite (XSS, localStorage compromis), l'attaquant a 24 h d'accès.
//
// Solution :
//   - Sur logout, on push le `jti` (ou le SHA-256 du token entier si pas de jti)
//     dans Redis avec TTL = exp - now. Une fois expiré naturellement, Redis
//     l'évacue → pas de croissance illimitée.
//   - Ce middleware (à brancher en aval de jwt_auth) vérifie chaque request
//     authentifiée contre Redis. Si trouvé → 401.
//
// Coût : 1 GET Redis par requête authentifiée. Redis multiplexed,
// O(1), <1 ms typique. Acceptable.
//
// Fail-open si Redis indisponible (logué) — préférable à un down complet.

use axum::body::Body;
use axum::extract::State;
use axum::http::{HeaderMap, Request, StatusCode};
use axum::middleware::Next;
use axum::response::Response;
use sha2::{Digest, Sha256};
use std::sync::Arc;
use tokio::time::{timeout, Duration};

use crate::state::AppState;

const BLACKLIST_KEY_PREFIX: &str = "jwt:blacklist:";
/// Timeout court — fail-open si Redis muet, on ne veut pas pénaliser tout le trafic.
const REDIS_TIMEOUT: Duration = Duration::from_millis(500);

/// Hash stable d'un token (utilisé comme clé Redis).
/// On hash plutôt que stocker le JWT brut (defense in depth).
pub fn token_fingerprint(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Extrait le token depuis le header Authorization.
fn extract_bearer_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .map(|s| s.to_string())
}

/// Ajoute un token à la blacklist (à appeler depuis le handler /auth/logout).
/// `ttl_secs` doit être l'EXP restant du JWT (pour que Redis le purge naturellement).
pub async fn blacklist_token(
    state: &Arc<AppState>,
    token: &str,
    ttl_secs: i64,
) -> Result<(), String> {
    if ttl_secs <= 0 {
        return Ok(());
    }
    let key = format!("{}{}", BLACKLIST_KEY_PREFIX, token_fingerprint(token));
    let mut conn = match timeout(
        REDIS_TIMEOUT,
        state.redis_client.get_multiplexed_async_connection(),
    )
    .await
    {
        Ok(Ok(c)) => c,
        Ok(Err(e)) => return Err(format!("redis: {}", e)),
        Err(_) => return Err("redis timeout".to_string()),
    };
    let _: () = redis::cmd("SETEX")
        .arg(&key)
        .arg(ttl_secs)
        .arg("1")
        .query_async(&mut conn)
        .await
        .map_err(|e| format!("redis SETEX: {}", e))?;
    Ok(())
}

/// Vérifie si un token est blacklisté. Fail-open si Redis muet.
pub async fn is_blacklisted(state: &Arc<AppState>, token: &str) -> bool {
    let key = format!("{}{}", BLACKLIST_KEY_PREFIX, token_fingerprint(token));
    let mut conn = match timeout(
        REDIS_TIMEOUT,
        state.redis_client.get_multiplexed_async_connection(),
    )
    .await
    {
        Ok(Ok(c)) => c,
        Ok(Err(e)) => {
            log::warn!("[token_blacklist] redis indispo: {}", e);
            return false; // fail-open
        }
        Err(_) => {
            log::warn!("[token_blacklist] redis timeout");
            return false; // fail-open
        }
    };
    redis::cmd("EXISTS")
        .arg(&key)
        .query_async::<bool>(&mut conn)
        .await
        .unwrap_or(false)
}

/// Middleware : à brancher après jwt_auth. Refuse si token blacklisté.
pub async fn check_blacklist(
    State(state): State<Arc<AppState>>,
    req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    if let Some(token) = extract_bearer_token(req.headers()) {
        if is_blacklisted(&state, &token).await {
            log::warn!("[token_blacklist] token blacklisté refusé");
            return Err(StatusCode::UNAUTHORIZED);
        }
    }
    Ok(next.run(req).await)
}
