use axum::http::{HeaderMap, StatusCode};
use base64::Engine as _;
use jsonwebtoken::{decode, Algorithm, DecodingKey, TokenData, Validation};
use serde::Deserialize;

#[derive(Debug, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub role: String,
    pub exp: usize,
}

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: String,
    pub role: String,
}

/// Extrait et valide le token d'authentification depuis les headers
pub fn extract_auth_user(headers: &HeaderMap) -> Result<AuthUser, (StatusCode, String)> {
    let auth_header = headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .ok_or((
            StatusCode::UNAUTHORIZED,
            "Missing Authorization header".to_string(),
        ))?;

    let token = auth_header.strip_prefix("Bearer ").ok_or((
        StatusCode::UNAUTHORIZED,
        "Invalid Authorization header".to_string(),
    ))?;

    // ✅ SÉCURITÉ: Tokens de développement uniquement en mode debug
    #[cfg(debug_assertions)]
    {
        if token.ends_with(".dev_signature") {
            let parts: Vec<&str> = token.split('.').collect();
            if parts.len() == 3 {
                if let Ok(payload_str) = base64::engine::general_purpose::STANDARD.decode(parts[1])
                {
                    if let Ok(payload) = serde_json::from_slice::<serde_json::Value>(&payload_str) {
                        return Ok(AuthUser {
                            user_id: payload["sub"].as_str().unwrap_or("dev-user-id").to_string(),
                            role: payload["role"].as_str().unwrap_or("admin").to_string(),
                        });
                    }
                }
            }
        }

        if token == "dev_token_pinecone" {
            return Ok(AuthUser {
                user_id: "dev-user-1".to_string(),
                role: "admin".to_string(),
            });
        }
    }

    // ✅ SÉCURITÉ: JWT_SECRET obligatoire en production
    let secret = std::env::var("JWT_SECRET").map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "JWT_SECRET manquant - Configuration invalide".to_string(),
        )
    })?;
    let token_data: TokenData<Claims> = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )
    .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid token".to_string()))?;

    Ok(AuthUser {
        user_id: token_data.claims.sub,
        role: token_data.claims.role,
    })
}

pub fn require_role(user: &AuthUser, allowed_roles: &[&str]) -> Result<(), (StatusCode, String)> {
    if allowed_roles.contains(&user.role.as_str()) {
        Ok(())
    } else {
        Err((
            StatusCode::FORBIDDEN,
            "Insufficient permissions".to_string(),
        ))
    }
}
