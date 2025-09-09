// src/middlewares/monitoring.rs
// Placeholder for monitoring middleware (metrics, tracing, etc.)
use axum::{http::Request, middleware::Next, response::Response};
use axum::body::Body;

pub async fn monitoring(req: Request<Body>, next: Next) -> Response {
    eprintln!("[DEBUG] monitoring appel?");
    next.run(req).await
}
