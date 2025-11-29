// src/middlewares/rate_limit.rs
// ✅ SÉCURITÉ: Rate limiting global avec Redis
use axum::body::Body;
use axum::extract::State;
use axum::{http::Request, middleware::Next, response::Response};
use http::{HeaderValue, StatusCode};
use log::warn;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::state::AppState;

/// Rate limiting global: 100 requêtes par minute par IP
const RATE_LIMIT_REQUESTS: u32 = 100;
const RATE_LIMIT_WINDOW_SECS: u64 = 60;

/// Extrait l'IP du client depuis les headers
fn extract_client_ip(req: &Request<Body>) -> String {
    // Vérifier les headers proxy (X-Forwarded-For, X-Real-IP)
    if let Some(forwarded_for) = req.headers().get("x-forwarded-for") {
        if let Ok(ip_str) = forwarded_for.to_str() {
            // Prendre la première IP (le client original)
            if let Some(first_ip) = ip_str.split(',').next() {
                return first_ip.trim().to_string();
            }
        }
    }

    if let Some(real_ip) = req.headers().get("x-real-ip") {
        if let Ok(ip_str) = real_ip.to_str() {
            return ip_str.to_string();
        }
    }

    // Fallback: utiliser l'adresse de connexion
    req.extensions()
        .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
        .map(|addr| addr.ip().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

pub async fn rate_limit(
    State(state): State<Arc<AppState>>,
    req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let client_ip = extract_client_ip(&req);
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let redis_key = format!("rate_limit:{}", client_ip);

    // Tenter d'utiliser Redis pour le rate limiting
    let mut redis_conn = match state.redis_client.get_async_connection().await {
        Ok(conn) => conn,
        Err(e) => {
            warn!("[rate_limit] Redis indisponible: {} - Rate limiting désactivé", e);
            // Si Redis est indisponible, autoriser la requête (fail-open)
            // En production, vous pourriez vouloir fail-closed
            return Ok(next.run(req).await);
        }
    };

    // Utiliser Redis pour compter les requêtes
    let current_count: u32 = match redis::cmd("GET")
        .arg(&redis_key)
        .query_async::<Option<u32>>(&mut redis_conn)
        .await
    {
        Ok(count) => count.unwrap_or(0),
        Err(_) => 0,
    };

    if current_count >= RATE_LIMIT_REQUESTS {
        warn!(
            "[rate_limit] Rate limit dépassé pour IP: {} ({} requêtes en {}s)",
            client_ip, current_count, RATE_LIMIT_WINDOW_SECS
        );

        let mut response = Response::new(Body::from(
            r#"{"error": "Rate limit exceeded", "message": "Trop de requêtes. Réessayez dans quelques instants."}"#,
        ));
        *response.status_mut() = StatusCode::TOO_MANY_REQUESTS;
        response.headers_mut().insert(
            "retry-after",
            HeaderValue::from_str(&RATE_LIMIT_WINDOW_SECS.to_string()).unwrap(),
        );
        return Ok(response);
    }

    // Incrémenter le compteur
    let _: () = redis::cmd("INCR")
        .arg(&redis_key)
        .query_async(&mut redis_conn)
        .await
        .unwrap_or(());

    // Définir l'expiration de la clé
    let _: () = redis::cmd("EXPIRE")
        .arg(&redis_key)
        .arg(RATE_LIMIT_WINDOW_SECS as i64)
        .query_async(&mut redis_conn)
        .await
        .unwrap_or(());

    Ok(next.run(req).await)
}
