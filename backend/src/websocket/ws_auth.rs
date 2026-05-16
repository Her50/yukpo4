// src/websocket/ws_auth.rs
// ✅ 2026-05-16 — Authentification JWT pour handlers WebSocket.
//
// Problème résolu : les 7 handlers WS prenaient l'`user_id` (ou delivery_id /
// upload_id) directement depuis le PATH, sans aucune vérification d'identité.
// Conséquences :
//   - `/ws/notifications/{user_id}` → écoute des notifs de N'IMPORTE QUEL user
//   - `/ws/chat/.../{user_id}` → envoi de messages en se faisant passer pour
//     un autre user (spoofing complet)
//   - `/ws/upload-status/{upload_id}` → écoute des uploads d'un autre user
//
// Les browsers ne permettent pas d'envoyer `Authorization: Bearer ...` lors d'un
// handshake WebSocket. La convention est d'utiliser une **query string**
// `wss://api/ws/...?token=<JWT>`.
//
// Risque connu : le token apparaît dans les logs serveur (URL). On le masque
// côté audit_log (path normalisé sans query). Côté client, le frontend doit
// utiliser exclusivement HTTPS/WSS pour éviter la fuite réseau.
//
// Mode strict configurable via `WS_REQUIRE_AUTH=true`. Par défaut, on log un
// warning si le token manque mais on laisse passer (transition douce — le
// frontend doit être patché en parallèle pour ajouter `?token=...`).

use axum::http::{StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use std::sync::Arc;
use tokio::time::{timeout, Duration};

use crate::middlewares::jwt::AuthenticatedUser;
use crate::middlewares::token_blacklist;
use crate::state::AppState;
use crate::utils::jwt_manager::decode_jwt;

/// Plafond de connexions WS simultanées par utilisateur (anti-DoS distribué).
/// Au-delà, on refuse l'upgrade.
/// Configurable via env `WS_MAX_CONN_PER_USER` (défaut 10).
fn max_conn_per_user() -> u32 {
    std::env::var("WS_MAX_CONN_PER_USER")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(10)
}

/// TTL court des compteurs Redis. Sert de fenêtre glissante :
/// "max N nouvelles connexions WS / TTL / user". L'objectif est de bloquer un
/// flood d'upgrades, pas de compter les sessions actives (trop complexe à
/// tracer sans guard Rust côté handler).
const WS_COUNTER_TTL_SECS: i64 = 60;
const WS_REDIS_TIMEOUT: Duration = Duration::from_millis(300);
const WS_COUNTER_KEY_PREFIX: &str = "ws:conn:";

/// Incrémente le compteur de connexions WS d'un user. Retourne `Err` si le
/// plafond est atteint (`StatusCode::TOO_MANY_REQUESTS`).
/// Fail-open si Redis muet — préférable à un blocage total.
pub async fn acquire_ws_slot(state: &Arc<AppState>, user_id: i32) -> Result<(), StatusCode> {
    let max = max_conn_per_user();
    let key = format!("{}{}", WS_COUNTER_KEY_PREFIX, user_id);
    let mut conn = match timeout(
        WS_REDIS_TIMEOUT,
        state.redis_client.get_multiplexed_async_connection(),
    )
    .await
    {
        Ok(Ok(c)) => c,
        _ => {
            log::warn!("[ws_auth] redis indispo — slot WS accordé (fail-open)");
            return Ok(());
        }
    };

    // INCR + EXPIRE atomique : on INCR puis EXPIRE (le premier INCR retourne 1
    // donc on set le TTL à ce moment-là ; sinon on rafraîchit).
    let count: i64 = redis::cmd("INCR").arg(&key).query_async(&mut conn).await.unwrap_or(1);
    let _: () = redis::cmd("EXPIRE")
        .arg(&key)
        .arg(WS_COUNTER_TTL_SECS)
        .query_async(&mut conn)
        .await
        .unwrap_or(());

    if count > max as i64 {
        // Décrémente pour ne pas pénaliser une fois le rate-limit atteint
        let _: i64 = redis::cmd("DECR").arg(&key).query_async(&mut conn).await.unwrap_or(0);
        log::warn!(
            "[ws_auth] user {} a dépassé le plafond ({} > {}) connexions WS",
            user_id,
            count,
            max
        );
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }
    Ok(())
}

/// Libère un slot WS (à appeler en `Drop` ou à la fin du handler).
pub async fn release_ws_slot(state: &Arc<AppState>, user_id: i32) {
    let key = format!("{}{}", WS_COUNTER_KEY_PREFIX, user_id);
    let mut conn = match timeout(
        WS_REDIS_TIMEOUT,
        state.redis_client.get_multiplexed_async_connection(),
    )
    .await
    {
        Ok(Ok(c)) => c,
        _ => return,
    };
    let _: i64 = redis::cmd("DECR").arg(&key).query_async(&mut conn).await.unwrap_or(0);
}

// WsSlotGuard intentionnellement omis : avec TTL court (60s), le compteur
// s'auto-évacue. Pour comptage précis des sessions actives, il faudrait un
// guard tenu par chaque handler — refactor lourd, à faire si nécessaire.

/// Résultat de l'authentification WS.
#[derive(Debug, Clone)]
pub struct WsAuth {
    pub user_id: i32,
    pub role: String,
    pub raw_token: String,
}

impl WsAuth {
    pub fn as_authenticated(&self) -> AuthenticatedUser {
        AuthenticatedUser {
            id: self.user_id,
            role: self.role.clone(),
        }
    }
}

/// Extrait `token` depuis la query string.
fn extract_token_from_query(uri: &Uri) -> Option<String> {
    let query = uri.query()?;
    for pair in query.split('&') {
        let mut kv = pair.splitn(2, '=');
        if let (Some(k), Some(v)) = (kv.next(), kv.next()) {
            if k == "token" || k == "access_token" || k == "jwt" {
                return Some(v.to_string());
            }
        }
    }
    None
}

/// Valide un token JWT pour WebSocket. Retourne `Err(StatusCode)` si :
///   - token absent et mode strict actif
///   - JWT_SECRET indisponible
///   - token invalide / expiré
///   - token blacklisté (logout côté serveur)
///
/// En mode non-strict (défaut), retourne `Ok(None)` si token absent — le
/// caller doit alors décider quoi faire (typiquement fail-close pour les
/// handlers privés, fail-open avec warning pour ceux en transition).
pub async fn authenticate_ws(
    state: &Arc<AppState>,
    uri: &Uri,
) -> Result<Option<WsAuth>, StatusCode> {
    let token = match extract_token_from_query(uri) {
        Some(t) => t,
        None => {
            if std::env::var("WS_REQUIRE_AUTH").as_deref() == Ok("true") {
                log::warn!("[ws_auth] handshake refusé : token absent (mode strict)");
                return Err(StatusCode::UNAUTHORIZED);
            }
            log::warn!(
                "[ws_auth] WARN handshake sans token sur {} — set WS_REQUIRE_AUTH=true pour bloquer",
                uri.path()
            );
            return Ok(None);
        }
    };

    let secret = std::env::var("JWT_SECRET").map_err(|_| {
        log::error!("[ws_auth] JWT_SECRET manquant");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let claims = decode_jwt(&token, &secret).map_err(|e| {
        log::warn!("[ws_auth] JWT invalide : {:?}", e);
        StatusCode::UNAUTHORIZED
    })?;

    // Check blacklist (logout côté serveur). Fail-open si Redis muet.
    if token_blacklist::is_blacklisted(state, &token).await {
        log::warn!(
            "[ws_auth] token blacklisté refusé pour user {}",
            claims.claims.sub
        );
        return Err(StatusCode::UNAUTHORIZED);
    }

    // ✅ 2026-05-16 — Rate-limit upgrades WS par user (anti-DoS distribué).
    // Fenêtre glissante 60s × `WS_MAX_CONN_PER_USER` (défaut 10). Fail-open
    // si Redis muet.
    acquire_ws_slot(state, claims.claims.sub).await?;

    Ok(Some(WsAuth {
        user_id: claims.claims.sub,
        role: claims.claims.role,
        raw_token: token,
    }))
}

/// Helper : authentifie + vérifie que l'user_id du path == user du token.
/// Empêche le spoofing : `/ws/notifications/42?token=<jwt_user_5>` → refusé.
pub async fn authenticate_ws_and_match_user(
    state: &Arc<AppState>,
    uri: &Uri,
    expected_user_id: i32,
) -> Result<WsAuth, StatusCode> {
    let auth = authenticate_ws(state, uri).await?;
    let Some(auth) = auth else {
        // Mode non-strict : on accepte mais on a déjà loggé un warning.
        // En production, mettre WS_REQUIRE_AUTH=true pour fermer cette porte.
        return Ok(WsAuth {
            user_id: expected_user_id,
            role: "user".to_string(),
            raw_token: String::new(),
        });
    };
    if auth.user_id != expected_user_id {
        log::warn!(
            "[ws_auth] mismatch user : token={} path={} — spoofing tentative",
            auth.user_id,
            expected_user_id
        );
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(auth)
}

/// Helper de réponse uniformisé pour rejet pré-upgrade.
pub fn reject_upgrade(status: StatusCode, reason: &str) -> Response {
    (
        status,
        axum::Json(serde_json::json!({
            "error": "ws_auth_failed",
            "message": reason,
            "status": status.as_u16()
        })),
    )
        .into_response()
}

// Re-export pour les modules WS qui veulent du low-level
pub use authenticate_ws as authenticate;
