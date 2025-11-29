// src/middlewares/hide_headers.rs
// ✅ SÉCURITÉ: Masquer les headers sensibles et ajouter les headers de sécurité
use axum::{body::Body, http::Request, middleware::Next, response::Response};
use http::header::{self, HeaderName, HeaderValue};

pub async fn hide_headers(req: Request<Body>, next: Next) -> Response {
    // Extraire le schéma avant de consommer req
    let is_https = req.uri().scheme_str() == Some("https");
    
    let mut res = next.run(req).await;
    
    // Masquer les headers qui révèlent des informations sur le serveur
    res.headers_mut().remove(header::SERVER);
    if let Ok(x_powered_by) = HeaderName::try_from("x-powered-by") {
        res.headers_mut().remove(x_powered_by);
    }
    
    // ✅ SÉCURITÉ: Ajouter les headers de sécurité recommandés par OWASP
    let x_content_type_options = HeaderValue::from_static("nosniff");
    res.headers_mut().insert(
        HeaderName::from_static("x-content-type-options"),
        x_content_type_options,
    );
    
    let x_frame_options = HeaderValue::from_static("DENY");
    res.headers_mut().insert(
        HeaderName::from_static("x-frame-options"),
        x_frame_options,
    );
    
    // Strict-Transport-Security (HSTS) - uniquement en HTTPS
    if is_https {
        let hsts = HeaderValue::from_static("max-age=31536000; includeSubDomains");
        res.headers_mut().insert(
            HeaderName::from_static("strict-transport-security"),
            hsts,
        );
    }
    
    // X-XSS-Protection (pour les anciens navigateurs)
    let x_xss_protection = HeaderValue::from_static("1; mode=block");
    res.headers_mut().insert(
        HeaderName::from_static("x-xss-protection"),
        x_xss_protection,
    );
    
    // Referrer-Policy pour limiter les fuites d'informations
    let referrer_policy = HeaderValue::from_static("strict-origin-when-cross-origin");
    res.headers_mut().insert(
        HeaderName::from_static("referrer-policy"),
        referrer_policy,
    );
    
    // Permissions-Policy (anciennement Feature-Policy)
    let permissions_policy = HeaderValue::from_static(
        "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()"
    );
    res.headers_mut().insert(
        HeaderName::from_static("permissions-policy"),
        permissions_policy,
    );
    
    res
}
