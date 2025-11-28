// src/middlewares/monitoring.rs
use axum::body::Body;
use axum::{http::Request, middleware::Next, response::Response};
use log::{info, warn};
use std::time::Instant;

/// Seuil pour requêtes lentes (en millisecondes)
const SLOW_REQUEST_THRESHOLD_MS: u64 = 1000;

pub async fn monitoring(req: Request<Body>, next: Next) -> Response {
    let method = req.method().clone();
    let uri = req.uri().clone();
    let path = uri.path().to_string();
    let start = Instant::now();

    let response = next.run(req).await;
    let elapsed = start.elapsed();
    let elapsed_ms = elapsed.as_millis();
    let status = response.status();

    // Log normal pour toutes les requêtes
    info!(
        "[Monitoring] {} {} -> {} ({} ms)",
        method,
        path,
        status.as_u16(),
        elapsed_ms
    );

    // Log warning pour requêtes lentes
    if elapsed_ms >= SLOW_REQUEST_THRESHOLD_MS as u128 {
        warn!(
            "🐌 [SlowRequest] {} {} -> {} ({} ms) - Requête lente détectée",
            method,
            path,
            status.as_u16(),
            elapsed_ms
        );
    }

    // Log error pour requêtes très lentes (>5s)
    if elapsed_ms >= 5000 {
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
