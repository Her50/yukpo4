// src/middlewares/audit_log.rs
// Placeholder for audit logging middleware
use axum::{body::Body, http::Request, middleware::Next, response::Response};

pub async fn audit_log(req: Request<Body>, next: Next) -> Response {
    eprintln!("[DEBUG] audit_log appel?");
    next.run(req).await
}
