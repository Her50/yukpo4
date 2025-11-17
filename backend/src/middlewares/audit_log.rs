// src/middlewares/audit_log.rs
// Placeholder for audit logging middleware
use axum::{body::Body, http::Request, middleware::Next, response::Response};

pub async fn audit_log(req: Request<Body>, next: Next) -> Response {
    next.run(req).await
}
