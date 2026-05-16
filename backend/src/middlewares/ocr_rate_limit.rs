//! ✅ 2026-05-16 — Rate limit strict pour les endpoints OCR/LLM coûteux.
//!
//! Cible : `submit_programmes_scolaires_etablissement` (upload PDF/image,
//! extraction GPT-4o, ~5000 tokens × $0.005 = ~30 XAF/scan en coût brut).
//! Sans plafond, un attaquant peut épuiser le budget LLM en quelques minutes
//! (5 MB × 5 fichiers × bruteforce → des milliers d'USD/heure).
//!
//! Stratégie :
//!   - Si user authentifié → rate-limit par user_id (clé Redis)
//!   - Sinon (endpoint public) → rate-limit par IP (X-Forwarded-For)
//!
//! Plafonds par défaut (surchargables via env) :
//!   - 3 requêtes par heure
//!   - 10 requêtes par 24h
//!
//! Comportement Redis down : fail-open (warn + bypass). On préfère servir
//! quelques requêtes en plus que casser le flow utilisateur.

use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
use axum::{
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::Response,
};
use log::warn;
use std::sync::Arc;

fn limit_per_hour() -> i32 {
    std::env::var("OCR_RATE_LIMIT_PER_HOUR")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(3)
}

fn limit_per_day() -> i32 {
    std::env::var("OCR_RATE_LIMIT_PER_DAY")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(10)
}

fn extract_client_ip(req: &Request<Body>) -> Option<String> {
    req.headers()
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
}

/// Identifiant du rate-limit : `user:<id>` si authentifié, sinon `ip:<addr>`.
fn rate_limit_key(req: &Request<Body>) -> Option<String> {
    if let Some(u) = req.extensions().get::<AuthenticatedUser>() {
        return Some(format!("user:{}", u.id));
    }
    extract_client_ip(req).map(|ip| format!("ip:{}", ip))
}

pub async fn ocr_rate_limit(
    State(state): State<Arc<AppState>>,
    req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let path = req.uri().path().to_string();
    let Some(scope) = rate_limit_key(&req) else {
        warn!(
            "[OCR Rate Limit] Impossible d'identifier le client (ni user ni IP) sur {} — bypass",
            path
        );
        return Ok(next.run(req).await);
    };

    let hour_key = format!("rate_limit:ocr:{}:hour", scope);
    let day_key = format!("rate_limit:ocr:{}:day", scope);

    let conn_res = tokio::time::timeout(
        std::time::Duration::from_secs(2),
        state.redis_client.get_multiplexed_async_connection(),
    )
    .await
    .unwrap_or_else(|_| {
        Err(redis::RedisError::from(std::io::Error::new(
            std::io::ErrorKind::TimedOut,
            "Redis connection timeout (2s)",
        )))
    });

    match conn_res {
        Ok(mut conn) => {
            use redis::AsyncCommands;
            let hour_count: i32 =
                conn.get::<_, Option<i32>>(&hour_key).await.unwrap_or(None).unwrap_or(0);
            if hour_count >= limit_per_hour() {
                warn!(
                    "[OCR Rate Limit] Limite heure dépassée scope={} ({}/{}) path={}",
                    scope,
                    hour_count,
                    limit_per_hour(),
                    path
                );
                return Err(StatusCode::TOO_MANY_REQUESTS);
            }
            let day_count: i32 =
                conn.get::<_, Option<i32>>(&day_key).await.unwrap_or(None).unwrap_or(0);
            if day_count >= limit_per_day() {
                warn!(
                    "[OCR Rate Limit] Limite jour dépassée scope={} ({}/{}) path={}",
                    scope,
                    day_count,
                    limit_per_day(),
                    path
                );
                return Err(StatusCode::TOO_MANY_REQUESTS);
            }
            if let Err(e) = conn.incr::<_, _, i32>(&hour_key, 1).await {
                warn!("[OCR Rate Limit] incr hour err: {}", e);
            } else {
                let _: Result<(), _> = conn.expire(&hour_key, 3600).await;
            }
            if let Err(e) = conn.incr::<_, _, i32>(&day_key, 1).await {
                warn!("[OCR Rate Limit] incr day err: {}", e);
            } else {
                let _: Result<(), _> = conn.expire(&day_key, 86_400).await;
            }
        }
        Err(e) => {
            warn!(
                "[OCR Rate Limit] Redis indisponible, fail-open: {} (path={})",
                e, path
            );
        }
    }

    Ok(next.run(req).await)
}
