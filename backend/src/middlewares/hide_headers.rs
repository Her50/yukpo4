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
    res.headers_mut()
        .insert(HeaderName::from_static("x-frame-options"), x_frame_options);

    // Strict-Transport-Security (HSTS) - uniquement en HTTPS
    if is_https {
        let hsts = HeaderValue::from_static("max-age=31536000; includeSubDomains");
        res.headers_mut()
            .insert(HeaderName::from_static("strict-transport-security"), hsts);
    }

    // X-XSS-Protection (pour les anciens navigateurs)
    let x_xss_protection = HeaderValue::from_static("1; mode=block");
    res.headers_mut().insert(
        HeaderName::from_static("x-xss-protection"),
        x_xss_protection,
    );

    // Referrer-Policy pour limiter les fuites d'informations
    let referrer_policy = HeaderValue::from_static("strict-origin-when-cross-origin");
    res.headers_mut()
        .insert(HeaderName::from_static("referrer-policy"), referrer_policy);

    // Permissions-Policy (anciennement Feature-Policy)
    let permissions_policy = HeaderValue::from_static(
        "geolocation=(self), microphone=(), camera=(self), payment=(), usb=(), magnetometer=(), gyroscope=()"
    );
    res.headers_mut().insert(
        HeaderName::from_static("permissions-policy"),
        permissions_policy,
    );

    // ✅ 2026-05-16 — Content-Security-Policy strict.
    // Mitigation principale du risque XSS qui pourrait voler le JWT en
    // localStorage. Sans CSP, un payload XSS exfiltre vers n'importe quel
    // domaine ; avec CSP `connect-src 'self' …` strict, l'exfiltration
    // est bloquée par le navigateur même si le payload exécute.
    //
    // Surcharge possible via env CSP_HEADER (pour ajouter des CDN au besoin).
    // Par défaut on autorise images self/data/https (medias Wasabi/Cloudfront)
    // et connect-src self + ws (WebSocket) + https pour APIs externes.
    let csp_default = "default-src 'self'; \
        script-src 'self' 'unsafe-inline'; \
        style-src 'self' 'unsafe-inline'; \
        img-src 'self' data: blob: https:; \
        font-src 'self' data: https:; \
        connect-src 'self' https: wss:; \
        media-src 'self' blob: https:; \
        object-src 'none'; \
        frame-ancestors 'none'; \
        base-uri 'self'; \
        form-action 'self'";
    let csp = std::env::var("CSP_HEADER").unwrap_or_else(|_| csp_default.to_string());
    if let Ok(v) = HeaderValue::from_str(&csp) {
        res.headers_mut().insert(HeaderName::from_static("content-security-policy"), v);
    }

    // Cross-Origin Opener Policy + Resource Policy : isole l'app des popups/embeds
    res.headers_mut().insert(
        HeaderName::from_static("cross-origin-opener-policy"),
        HeaderValue::from_static("same-origin"),
    );
    res.headers_mut().insert(
        HeaderName::from_static("cross-origin-resource-policy"),
        HeaderValue::from_static("same-site"),
    );

    res
}
