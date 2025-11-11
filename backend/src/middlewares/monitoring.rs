// src/middlewares/monitoring.rs
use axum::body::Body;
use axum::{http::Request, middleware::Next, response::Response};
use log::info;
use std::time::Instant;

pub async fn monitoring(req: Request<Body>, next: Next) -> Response {
    let method = req.method().clone();
    let uri = req.uri().clone();
    let start = Instant::now();

    let response = next.run(req).await;
    let elapsed = start.elapsed();
    let status = response.status();

    info!(
        "[Monitoring] {} {} -> {} ({} ms)",
        method,
        uri.path(),
        status.as_u16(),
        elapsed.as_millis()
    );

    response
}
