use crate::config::cloud_architecture::CORSConfig;
use axum::{extract::Request, http::HeaderValue, middleware::Next, response::Response};
use log::warn;
use std::env;

/// ✅ SÉCURITÉ: Charge les origines autorisées depuis les variables d'environnement
/// Format: ALLOWED_ORIGINS=https://domain1.com,https://domain2.com
fn get_allowed_origins() -> Vec<String> {
    let mut origins = Vec::new();

    // Lire depuis la variable d'environnement
    if let Ok(env_origins) = env::var("ALLOWED_ORIGINS") {
        origins
            .extend(env_origins.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()));
    }

    // ✅ SÉCURITÉ: En développement, ajouter localhost uniquement
    #[cfg(debug_assertions)]
    {
        origins.push("http://localhost:3000".to_string());
        origins.push("http://localhost:5173".to_string());
        origins.push("http://localhost:8080".to_string());
        origins.push("http://127.0.0.1:3000".to_string());
        origins.push("http://127.0.0.1:5173".to_string());
        origins.push("capacitor://localhost".to_string());
        origins.push("ionic://localhost".to_string());
    }

    // Si aucune origine n'est définie, utiliser une liste minimale par défaut
    if origins.is_empty() {
        warn!("[CORS] Aucune origine configurée - Utilisation de la liste par défaut minimale");
        origins = vec![
            "https://yukpomnang.com".to_string(),
            "https://yukpomnang.onrender.com".to_string(),
        ];
    }

    origins
}

pub async fn cors_middleware(request: Request, next: Next) -> Response {
    // Extraire l'origin avant de consommer la request
    let origin = request.headers().get("origin").cloned();

    let mut response = next.run(request).await;

    // ✅ SÉCURITÉ: Charger les origines autorisées depuis l'environnement
    let allowed_origins = get_allowed_origins();

    let config = CORSConfig {
        allowed_origins: allowed_origins.clone(),
        allowed_methods: vec![
            "GET".to_string(),
            "POST".to_string(),
            "PUT".to_string(),
            "DELETE".to_string(),
            "OPTIONS".to_string(),
            "PATCH".to_string(),
        ],
        allowed_headers: vec![
            "Content-Type".to_string(),
            "Authorization".to_string(),
            "X-Requested-With".to_string(),
            "Accept".to_string(),
            "Origin".to_string(),
            "Access-Control-Request-Method".to_string(),
            "Access-Control-Request-Headers".to_string(),
            "Cache-Control".to_string(),
            "Pragma".to_string(),
        ],
        allow_credentials: true,
    };

    // ✅ SÉCURITÉ: Vérification stricte de l'origine
    if let Some(origin) = origin {
        let origin_str = origin.to_str().unwrap_or("");

        // Vérifier si l'origin est dans la liste autorisée
        if config.allowed_origins.contains(&origin_str.to_string()) {
            response.headers_mut().insert("access-control-allow-origin", origin.clone());
            response.headers_mut().insert(
                "access-control-allow-credentials",
                HeaderValue::from_static("true"),
            );
        } else {
            // ✅ SÉCURITÉ: Origin non autorisé - ne pas utiliser wildcard avec credentials
            // Loguer l'origine rejetée pour monitoring
            warn!(
                "[CORS] Origine non autorisée rejetée: {} (origines autorisées: {})",
                origin_str,
                config.allowed_origins.join(", ")
            );

            // Ne pas autoriser cette origine
            // Ne pas mettre de header Access-Control-Allow-Origin = * avec credentials
            // Laisser la réponse sans header CORS = requête bloquée par le navigateur
        }
    } else {
        // ✅ SÉCURITÉ: Pour les applications mobiles sans origin header
        // Utiliser la première origine autorisée par défaut (ou ne rien mettre)
        if let Some(default_origin) = config.allowed_origins.first() {
            if let Ok(header_value) = HeaderValue::from_str(default_origin) {
                response.headers_mut().insert("access-control-allow-origin", header_value);
                response.headers_mut().insert(
                    "access-control-allow-credentials",
                    HeaderValue::from_static("true"),
                );
            }
        }
    }

    response.headers_mut().insert(
        "access-control-allow-methods",
        HeaderValue::from_static("GET, POST, PUT, DELETE, OPTIONS, PATCH"),
    );

    response.headers_mut().insert(
        "access-control-allow-headers",
        HeaderValue::from_static("Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers, Cache-Control, Pragma"),
    );

    response
        .headers_mut()
        .insert("access-control-max-age", HeaderValue::from_static("86400"));

    response
}

/// ✅ SÉCURITÉ: Handler preflight CORS sécurisé
pub async fn cors_preflight_handler(req: Request<axum::body::Body>) -> Response {
    let mut response = Response::new(axum::body::Body::empty());

    // Charger les origines autorisées
    let allowed_origins = get_allowed_origins();

    // Vérifier l'origine de la requête preflight
    let origin = req.headers().get("origin");
    if let Some(origin) = origin {
        if let Ok(origin_str) = origin.to_str() {
            if allowed_origins.contains(&origin_str.to_string()) {
                response.headers_mut().insert("access-control-allow-origin", origin.clone());
                response.headers_mut().insert(
                    "access-control-allow-credentials",
                    HeaderValue::from_static("true"),
                );
            } else {
                // ✅ SÉCURITÉ: Origin non autorisée - rejeter la requête preflight
                warn!(
                    "[CORS] Preflight rejeté pour origine non autorisée: {}",
                    origin_str
                );
                *response.status_mut() = axum::http::StatusCode::FORBIDDEN;
                return response;
            }
        }
    } else {
        // Pas d'origine dans preflight - utiliser la première autorisée
        if let Some(default_origin) = allowed_origins.first() {
            if let Ok(header_value) = HeaderValue::from_str(default_origin) {
                response.headers_mut().insert("access-control-allow-origin", header_value);
            }
        }
    }

    response.headers_mut().insert(
        "access-control-allow-methods",
        HeaderValue::from_static("GET, POST, PUT, DELETE, OPTIONS, PATCH"),
    );

    response.headers_mut().insert(
        "access-control-allow-headers",
        HeaderValue::from_static("Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers, Cache-Control, Pragma, X-CSRF-Token"),
    );

    response
        .headers_mut()
        .insert("access-control-max-age", HeaderValue::from_static("86400"));

    *response.status_mut() = axum::http::StatusCode::OK;

    response
}
