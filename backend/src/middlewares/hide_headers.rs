// src/middlewares/hide_headers.rs
use axum::{body::Body, http::Request, middleware::Next, response::Response};
use http::header::{self, HeaderName};

pub async fn hide_headers(req: Request<Body>, next: Next) -> Response {
    eprintln!("[DEBUG] hide_headers appel?");
    let mut res = next.run(req).await;
    res.headers_mut().remove(header::SERVER);
    if let Ok(x_powered_by) = HeaderName::try_from("x-powered-by") {
        res.headers_mut().remove(x_powered_by);
    }
    res
}
