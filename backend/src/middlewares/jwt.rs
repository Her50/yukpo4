use crate::utils::jwt_manager::decode_jwt;
use axum::body::Body;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use axum::{http::Request, middleware::Next, response::Response};
#[cfg(debug_assertions)]
use base64::Engine;
use serde_json::json;
use std::env;

/// ? Authenticated user structure
#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    pub id: i32,
    pub role: String,
}

/// Helper: construit une réponse JSON cohérente avec AppError pour que
/// le frontend puisse parser `response.json()` au lieu de voir
/// "Unknown error" quand le body est du plain text.
fn json_error(status: StatusCode, code: &str, message: &str) -> Response {
    let body = Json(json!({
        "error": message,
        "message": message,
        "code": code,
        "status": status.as_u16()
    }));
    (status, body).into_response()
}

/// ✅ 2026-05-21 — Extrait le JWT depuis le cookie `token` s'il existe.
/// Permet au frontend web d'utiliser un cookie httpOnly (fix XSS) tandis
/// que le mobile continue d'envoyer `Authorization: Bearer ...`.
fn extract_token_from_cookie(req: &Request<Body>) -> Option<String> {
    let cookie_header = req.headers().get("cookie")?.to_str().ok()?;
    for pair in cookie_header.split(';') {
        let pair = pair.trim();
        if let Some(value) = pair.strip_prefix("token=") {
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}

/// Middleware to check the JWT and add the authenticated user to the request extensions
pub async fn jwt_auth(mut req: Request<Body>, next: Next) -> Result<Response, Response> {
    eprintln!("[DEBUG] jwt_auth appel? pour: {}", req.uri());

    // ✅ 2026-05-21 — Lire JWT depuis (1) Authorization Bearer, (2) cookie httpOnly
    let bearer_token = req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer ").map(|s| s.to_string()));
    let cookie_token = extract_token_from_cookie(&req);
    let token_owned = bearer_token.or(cookie_token);

    let token = match token_owned {
        Some(t) => t,
        None => {
            eprintln!("[ERROR] JWT manquant (ni Authorization Bearer ni cookie token)");
            return Err(json_error(
                StatusCode::UNAUTHORIZED,
                "MISSING_AUTH_HEADER",
                "Vous n'êtes pas connecté. Reconnectez-vous pour continuer.",
            ));
        }
    };
    eprintln!("[DEBUG] Token extrait (longueur: {})", token.len());

    // ✅ SÉCURITÉ: Tokens de développement uniquement en mode debug
    #[cfg(debug_assertions)]
    {
        if token.ends_with(".dev_signature") {
            eprintln!("[DEBUG] Token de développement détecté (mode debug uniquement)");
            let parts: Vec<&str> = token.split('.').collect();
            if parts.len() == 3 {
                if let Ok(payload_str) =
                    base64::engine::general_purpose::STANDARD.decode(parts[1])
                {
                    if let Ok(payload) =
                        serde_json::from_slice::<serde_json::Value>(&payload_str)
                    {
                        let authenticated_user = AuthenticatedUser {
                            id: payload["sub"].as_str().unwrap_or("1").parse().unwrap_or(1),
                            role: payload["role"].as_str().unwrap_or("admin").to_string(),
                        };
                        req.extensions_mut().insert(authenticated_user.clone());
                        eprintln!(
                            "[DEBUG] Utilisateur dev authentifié: {:?}",
                            authenticated_user
                        );
                        return Ok(next.run(req).await);
                    }
                }
            }
        }
    }

    // ✅ SÉCURITÉ: JWT_SECRET obligatoire
    let secret = env::var("JWT_SECRET").map_err(|_| {
        eprintln!("[ERROR] JWT_SECRET manquant dans les variables d'environnement");
        json_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "MISSING_JWT_SECRET",
            "Configuration serveur incomplète",
        )
    })?;

    match decode_jwt(&token, &secret) {
        Ok(token_data) => {
            let authenticated_user = AuthenticatedUser {
                id: token_data.claims.sub,
                role: token_data.claims.role,
            };

            eprintln!(
                "[DEBUG] JWT valide pour utilisateur: {:?}",
                authenticated_user
            );
            req.extensions_mut().insert(authenticated_user.clone());
        }
        Err(e) => {
            eprintln!("[ERROR] JWT invalide: {:?}", e);
            return Err(json_error(
                StatusCode::UNAUTHORIZED,
                "INVALID_JWT",
                "Session expirée — reconnectez-vous pour continuer.",
            ));
        }
    }

    Ok(next.run(req).await)
}

pub fn extract_user_id_from_token(token: &str) -> Result<i32, String> {
    use crate::utils::jwt_manager::decode_jwt;
    let secret = std::env::var("JWT_SECRET").map_err(|_| "JWT_SECRET manquant".to_string())?;
    match decode_jwt(token, &secret) {
        Ok(data) => Ok(data.claims.sub),
        Err(e) => Err(format!("Erreur d?codage JWT: {e}")),
    }
}

/// Middleware optionnel qui essaie d'extraire le JWT mais ne bloque pas si absent
/// Utile pour les routes publiques qui peuvent être utilisées avec ou sans authentification
pub async fn optional_jwt_auth(mut req: Request<Body>, next: Next) -> Response {
    // ✅ 2026-05-21 — Lire JWT depuis Authorization Bearer OU cookie httpOnly
    let bearer_token = req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer ").map(|s| s.to_string()));
    let cookie_token = extract_token_from_cookie(&req);
    let token = match bearer_token.or(cookie_token) {
        Some(t) => t,
        None => return next.run(req).await, // Pas de token → on continue sans auth
    };

    // ✅ SÉCURITÉ: Tokens de développement uniquement en mode debug
    #[cfg(debug_assertions)]
    {
        if token.ends_with(".dev_signature") {
            let parts: Vec<&str> = token.split('.').collect();
            if parts.len() == 3 {
                if let Ok(payload_str) =
                    base64::engine::general_purpose::STANDARD.decode(parts[1])
                {
                    if let Ok(payload) =
                        serde_json::from_slice::<serde_json::Value>(&payload_str)
                    {
                        let authenticated_user = AuthenticatedUser {
                            id: payload["sub"].as_str().unwrap_or("1").parse().unwrap_or(1),
                            role: payload["role"].as_str().unwrap_or("admin").to_string(),
                        };
                        req.extensions_mut().insert(authenticated_user);
                        return next.run(req).await;
                    }
                }
            }
        }
    }

    // ✅ SÉCURITÉ: JWT_SECRET requis même pour optional_jwt_auth
    let secret = match env::var("JWT_SECRET") {
        Ok(s) => s,
        Err(_) => {
            log::warn!("[optional_jwt_auth] JWT_SECRET manquant - authentification ignorée");
            return next.run(req).await;
        }
    };

    if let Ok(token_data) = decode_jwt(&token, &secret) {
        let authenticated_user = AuthenticatedUser {
            id: token_data.claims.sub,
            role: token_data.claims.role,
        };
        req.extensions_mut().insert(authenticated_user);
    }
    // Token invalide → on continue sans auth (comportement optionnel)

    next.run(req).await
}
