// src/middlewares/request_size_limit.rs
use axum::{body::Body, http::Request, middleware::Next, response::Response};
use http::StatusCode;

const DEFAULT_MAX_SIZE: usize = 500_000_000; // 500 MB (augment? de 200 MB)

pub async fn request_size_limit(req: Request<Body>, next: Next) -> Result<Response, StatusCode> {
    // Only check for known-sized bodies (e.g., JSON, not streaming)
    if let Some(len) = req.headers().get("content-length") {
        if let Some(len) = len.to_str().ok().and_then(|s| s.parse::<usize>().ok()) {
            if len > DEFAULT_MAX_SIZE {
                log::warn!("Taille de requête dépassée: {} > {} bytes", len, DEFAULT_MAX_SIZE);
                return Err(StatusCode::PAYLOAD_TOO_LARGE);
            }
        }
    }
    Ok(next.run(req).await)
}
