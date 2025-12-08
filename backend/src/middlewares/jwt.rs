use crate::utils::jwt_manager::decode_jwt;
use axum::body::Body;
use axum::http::StatusCode;
use axum::{http::Request, middleware::Next, response::Response};
use base64::Engine as _;
use std::env;

/// ? Authenticated user structure
#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    pub id: i32,
    pub role: String,
}

/// Middleware to check the JWT and add the authenticated user to the request extensions
pub async fn jwt_auth(
    mut req: Request<Body>,
    next: Next,
) -> Result<Response, (StatusCode, &'static str)> {
    eprintln!("[DEBUG] jwt_auth appel? pour: {}", req.uri());

    let auth_header = req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok());

    if let Some(auth_header) = auth_header {
        eprintln!("[DEBUG] Authorization header trouv?: {}", auth_header);

        if let Some(token) = auth_header.strip_prefix("Bearer ") {
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
                (StatusCode::INTERNAL_SERVER_ERROR, "Missing JWT_SECRET")
            })?;

            match decode_jwt(token, &secret) {
                Ok(token_data) => {
                    let authenticated_user = AuthenticatedUser {
                        id: token_data.claims.sub,
                        role: token_data.claims.role,
                    };

                    eprintln!(
                        "[DEBUG] JWT valide pour utilisateur: {:?}",
                        authenticated_user
                    );
                    // Add the authenticated user to the request extensions
                    req.extensions_mut().insert(authenticated_user.clone());
                }
                Err(e) => {
                    eprintln!("[ERROR] JWT invalide: {:?}", e);
                    return Err((StatusCode::UNAUTHORIZED, "Invalid JWT"));
                }
            }
        } else {
            eprintln!("[ERROR] Header Authorization invalide (pas de 'Bearer ')");
            return Err((StatusCode::UNAUTHORIZED, "Invalid Authorization header"));
        }
    } else {
        eprintln!("[ERROR] Header Authorization manquant");
        return Err((StatusCode::UNAUTHORIZED, "Missing Authorization header"));
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
    let auth_header = req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok());

    if let Some(auth_header) = auth_header {
        if let Some(token) = auth_header.strip_prefix("Bearer ") {
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
                    // Si JWT_SECRET manquant, continuer sans authentification (comportement optionnel)
                    // Mais loguer l'erreur pour alerter
                    log::warn!(
                        "[optional_jwt_auth] JWT_SECRET manquant - authentification ignorée"
                    );
                    return next.run(req).await;
                }
            };

            match decode_jwt(token, &secret) {
                Ok(token_data) => {
                    let authenticated_user = AuthenticatedUser {
                        id: token_data.claims.sub,
                        role: token_data.claims.role,
                    };
                    req.extensions_mut().insert(authenticated_user);
                }
                Err(_) => {
                    // Token invalide, continuer sans authentification
                }
            }
        }
        // Header invalide ou absent, continuer sans authentification
    }

    next.run(req).await
}
