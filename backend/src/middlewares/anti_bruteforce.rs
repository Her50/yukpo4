// src/middlewares/anti_bruteforce.rs
// Placeholder: In production, use Redis or in-memory store for real tracking.
use axum::{body::Body, http::Request, middleware::Next, response::Response};
use http::StatusCode;

pub async fn anti_bruteforce(req: Request<Body>, next: Next) -> Result<Response, StatusCode> {
    // TODO: Track IP/username attempts, block if too many in short time
    // For now, just pass through
    Ok(next.run(req).await)
}
