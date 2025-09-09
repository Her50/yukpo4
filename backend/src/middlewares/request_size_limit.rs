// src/middlewares/request_size_limit.rs
use axum::{body::Body, http::Request, middleware::Next, response::Response};
use http::StatusCode;

const DEFAULT_MAX_SIZE: usize = 500_000_000; // 500 MB (augment? de 200 MB)

pub async fn request_size_limit(
    req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    eprintln!("[DEBUG] request_size_limit appel?");
    // Only check for known-sized bodies (e.g., JSON, not streaming)
    if let Some(len) = req.headers().get("content-length") {
        if let Some(len) = len.to_str().ok().and_then(|s| s.parse::<usize>().ok()) {
            eprintln!("[DEBUG] Content-Length d?tect?: {} bytes (limite: {} bytes)", len, DEFAULT_MAX_SIZE);
            if len > DEFAULT_MAX_SIZE {
                eprintln!("[DEBUG] ? Taille d?pass?e: {} > {}", len, DEFAULT_MAX_SIZE);
                return Err(StatusCode::PAYLOAD_TOO_LARGE);
            }
            eprintln!("[DEBUG] ? Taille OK: {} <= {}", len, DEFAULT_MAX_SIZE);
        }
    } else {
        eprintln!("[DEBUG] Pas de Content-Length, passage au middleware suivant");
    }
    Ok(next.run(req).await)
}
