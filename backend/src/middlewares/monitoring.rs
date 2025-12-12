// src/middlewares/monitoring.rs
use axum::body::Body;
use axum::{http::Request, middleware::Next, response::Response};
use log::{info, warn};
use std::time::Instant;

/// Seuil pour requêtes lentes (en millisecondes)
/// ✅ AUGMENTÉ: 2 secondes au lieu de 1 seconde pour réduire les warnings non critiques
const SLOW_REQUEST_THRESHOLD_MS: u64 = 2000;
/// Seuil pour requêtes très lentes (en millisecondes) - seulement celles-ci génèrent un warning
const VERY_SLOW_REQUEST_THRESHOLD_MS: u64 = 5000;

pub async fn monitoring(req: Request<Body>, next: Next) -> Response {
    let method = req.method().clone();
    let uri = req.uri().clone();
    let path = uri.path().to_string();
    let start = Instant::now();

    let response = next.run(req).await;
    let elapsed = start.elapsed();
    let elapsed_ms = elapsed.as_millis();
    let status = response.status();

    // Log normal pour toutes les requêtes (seulement si > 500ms pour réduire le bruit)
    if elapsed_ms >= 500 {
        info!(
            "[Monitoring] {} {} -> {} ({} ms)",
            method,
            path,
            status.as_u16(),
            elapsed_ms
        );
    }

    // Log info pour requêtes modérément lentes (1s-2s) - pas de warning
    if elapsed_ms >= 1000 && elapsed_ms < SLOW_REQUEST_THRESHOLD_MS as u128 {
        info!(
            "⏱️ [ModerateRequest] {} {} -> {} ({} ms) - Requête modérément lente",
            method,
            path,
            status.as_u16(),
            elapsed_ms
        );
    }

    // Log warning seulement pour requêtes vraiment lentes (2s-5s)
    if elapsed_ms >= SLOW_REQUEST_THRESHOLD_MS as u128 && elapsed_ms < VERY_SLOW_REQUEST_THRESHOLD_MS as u128 {
        warn!(
            "🐌 [SlowRequest] {} {} -> {} ({} ms) - Requête lente détectée",
            method,
            path,
            status.as_u16(),
            elapsed_ms
        );
    }

    // Log error pour requêtes très lentes (>5s)
    if elapsed_ms >= VERY_SLOW_REQUEST_THRESHOLD_MS as u128 {
        log::error!(
            "🚨 [VerySlowRequest] {} {} -> {} ({} ms) - Requête très lente, investigation nécessaire",
            method,
            path,
            status.as_u16(),
            elapsed_ms
        );
    }

    response
}
