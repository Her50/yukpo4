use axum::{http::Request, middleware::Next, response::Response};
use axum::http::StatusCode;
use axum::body::Body;
use std::env;
use crate::utils::jwt_manager::decode_jwt;
use base64::{engine::general_purpose, Engine as _};

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
            
            // Mode d?veloppement : accepter les tokens de dev
            if token.ends_with(".dev_signature") {
                eprintln!("[DEBUG] Token de d?veloppement d?tect?");
                let parts: Vec<&str> = token.split('.').collect();
                if parts.len() == 3 {
                    // D?coder le payload
                    if let Ok(payload_str) = general_purpose::STANDARD.decode(parts[1]) {
                        if let Ok(payload) = serde_json::from_slice::<serde_json::Value>(&payload_str) {
                            let authenticated_user = AuthenticatedUser {
                                id: payload["sub"].as_str().unwrap_or("1").parse().unwrap_or(1),
                                role: payload["role"].as_str().unwrap_or("admin").to_string(),
                            };
                            req.extensions_mut().insert(authenticated_user.clone());
                            eprintln!("[DEBUG] Utilisateur dev authentifi?: {:?}", authenticated_user);
                            return Ok(next.run(req).await);
                        }
                    }
                }
            }
            
            let secret = env::var("JWT_SECRET")
                .map_err(|_| {
                    eprintln!("[ERROR] JWT_SECRET manquant dans les variables d'environnement");
                    (StatusCode::INTERNAL_SERVER_ERROR, "Missing JWT_SECRET")
                })?;

            match decode_jwt(token, &secret) {
                Ok(token_data) => {
                    let authenticated_user = AuthenticatedUser {
                        id: token_data.claims.sub,
                        role: token_data.claims.role,
                    };

                    eprintln!("[DEBUG] JWT valide pour utilisateur: {:?}", authenticated_user);
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
