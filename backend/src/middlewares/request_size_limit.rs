// src/middlewares/request_size_limit.rs
use axum::{body::Body, http::Request, middleware::Next, response::Response};
use http::StatusCode;

// ✅ CORRECTION: Limite augmentée à 1 GB pour permettre les payloads complexes avec sous_caracteristiques
const DEFAULT_MAX_SIZE: usize = 1_000_000_000; // 1 GB (augmenté de 500 MB)

pub async fn request_size_limit(req: Request<Body>, next: Next) -> Result<Response, StatusCode> {
    // Vérifier la taille du body si disponible
    if let Some(len) = req.headers().get("content-length") {
        if let Ok(len_str) = len.to_str() {
            if let Ok(len) = len_str.parse::<usize>() {
                if len > DEFAULT_MAX_SIZE {
                    log::warn!(
                        "[request_size_limit] ❌ Taille de requête dépassée: {} bytes ({} MB) > {} bytes ({} MB)",
                        len,
                        len / 1_000_000,
                        DEFAULT_MAX_SIZE,
                        DEFAULT_MAX_SIZE / 1_000_000
                    );
                    return Err(StatusCode::PAYLOAD_TOO_LARGE);
                }
                log::debug!(
                    "[request_size_limit] ✅ Taille requête acceptée: {} bytes ({} MB)",
                    len,
                    len / 1_000_000
                );
            }
        }
    }
    Ok(next.run(req).await)
}
