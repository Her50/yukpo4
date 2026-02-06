// src/middlewares/anti_bruteforce.rs
// ✅ SÉCURITÉ: Protection anti-brute-force pour /auth/login
use axum::body::Body;
use axum::extract::State;
use axum::{http::Request, middleware::Next, response::Response};
use http::{HeaderValue, StatusCode};
use log::{error, warn};
use std::sync::Arc;

use crate::state::AppState;

/// Nombre maximum de tentatives de login échouées avant blocage
const MAX_FAILED_ATTEMPTS: u32 = 5;
/// Durée du blocage en secondes (15 minutes)
const BLOCK_DURATION_SECS: u64 = 900;
/// Fenêtre de temps pour compter les tentatives (5 minutes)
const ATTEMPT_WINDOW_SECS: u64 = 300;

/// Extrait l'IP du client depuis les headers
fn extract_client_ip(req: &Request<Body>) -> String {
    if let Some(forwarded_for) = req.headers().get("x-forwarded-for") {
        if let Ok(ip_str) = forwarded_for.to_str() {
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

    req.extensions()
        .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
        .map(|addr| addr.ip().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

pub async fn anti_bruteforce(
    State(state): State<Arc<AppState>>,
    req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let client_ip = extract_client_ip(&req);

    // Vérifier si l'IP est bloquée
    let block_key = format!("bruteforce:blocked:{}", client_ip);

    let mut redis_conn = match state.redis_client.get_multiplexed_async_connection().await {
        Ok(conn) => conn,
        Err(e) => {
            warn!(
                "[anti_bruteforce] Redis indisponible: {} - Protection désactivée",
                e
            );
            // Fail-open si Redis est indisponible
            return Ok(next.run(req).await);
        }
    };

    // Vérifier si l'IP est bloquée
    let is_blocked: bool =
        match redis::cmd("EXISTS").arg(&block_key).query_async(&mut redis_conn).await {
            Ok(exists) => exists,
            Err(_) => false,
        };

    if is_blocked {
        error!(
            "[anti_bruteforce] Tentative de connexion depuis IP bloquée: {}",
            client_ip
        );

        let mut response = Response::new(Body::from(
            r#"{"error": "Too many failed attempts", "message": "Trop de tentatives de connexion échouées. Réessayez dans 15 minutes."}"#,
        ));
        *response.status_mut() = StatusCode::TOO_MANY_REQUESTS;
        response.headers_mut().insert(
            "retry-after",
            HeaderValue::from_str(&BLOCK_DURATION_SECS.to_string()).unwrap(),
        );
        return Ok(response);
    }

    // Utiliser uniquement l'IP pour le tracking (plus simple et efficace)
    // L'email sera vérifié dans le contrôleur après authentification
    let attempt_key = format!("bruteforce:attempts:{}", client_ip);

    // Compter les tentatives récentes
    let attempt_count: u32 = match redis::cmd("GET")
        .arg(&attempt_key)
        .query_async::<Option<u32>>(&mut redis_conn)
        .await
    {
        Ok(count) => count.unwrap_or(0),
        Err(_) => 0,
    };

    if attempt_count >= MAX_FAILED_ATTEMPTS {
        // Bloquer l'IP
        let _: () = redis::cmd("SETEX")
            .arg(&block_key)
            .arg(BLOCK_DURATION_SECS as i64)
            .arg("1")
            .query_async(&mut redis_conn)
            .await
            .unwrap_or(());

        error!(
            "[anti_bruteforce] IP bloquée après {} tentatives: {}",
            attempt_count, client_ip
        );

        let mut response = Response::new(Body::from(
            r#"{"error": "Too many failed attempts", "message": "Trop de tentatives de connexion échouées. Réessayez dans 15 minutes."}"#,
        ));
        *response.status_mut() = StatusCode::TOO_MANY_REQUESTS;
        response.headers_mut().insert(
            "retry-after",
            HeaderValue::from_str(&BLOCK_DURATION_SECS.to_string()).unwrap(),
        );
        return Ok(response);
    }

    // Exécuter la requête
    let response = next.run(req).await;

    // Si la réponse est un échec d'authentification (401), incrémenter le compteur
    if response.status() == StatusCode::UNAUTHORIZED {
        let _: () = redis::cmd("INCR")
            .arg(&attempt_key)
            .query_async(&mut redis_conn)
            .await
            .unwrap_or(());

        let _: () = redis::cmd("EXPIRE")
            .arg(&attempt_key)
            .arg(ATTEMPT_WINDOW_SECS as i64)
            .query_async(&mut redis_conn)
            .await
            .unwrap_or(());

        warn!(
            "[anti_bruteforce] Tentative échouée pour IP: {} ({}/{})",
            client_ip,
            attempt_count + 1,
            MAX_FAILED_ATTEMPTS
        );
    } else if response.status().is_success() {
        // En cas de succès, réinitialiser le compteur
        let _: () = redis::cmd("DEL")
            .arg(&attempt_key)
            .query_async(&mut redis_conn)
            .await
            .unwrap_or(());
    }

    Ok(response)
}
