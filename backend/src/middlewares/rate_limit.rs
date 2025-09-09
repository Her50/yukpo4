// src/middlewares/rate_limit.rs
// Placeholder for global or per-route rate limiting
use axum::{http::Request, middleware::Next, response::Response};
use axum::body::Body;
use http::StatusCode;

pub async fn rate_limit(req: Request<Body>, next: Next) -> Result<Response, StatusCode> {
    eprintln!("[DEBUG] rate_limit appel?");
    // TODO: Implement real rate limiting (e.g., tower_http::limit, Redis, etc.)
    Ok(next.run(req).await)
}
