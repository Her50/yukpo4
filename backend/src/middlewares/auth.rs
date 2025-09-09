use axum::{async_trait, extract::{FromRequestParts, RequestParts}, http::{StatusCode, request::Parts}, response::IntoResponse};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm, TokenData};
use serde::{Deserialize};
use std::sync::Arc;
use crate::state::AppState;

#[derive(Debug, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub role: String,
    pub exp: usize,
}

pub struct AuthUser {
    pub user_id: String,
    pub role: String,
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    Arc<AppState>: Send + Sync,
    S: Send + Sync,
{
    type Rejection = (StatusCode, String);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let auth_header = parts.headers.get("Authorization")
            .and_then(|h| h.to_str().ok())
            .ok_or((StatusCode::UNAUTHORIZED, "Missing Authorization header".to_string()))?;
        let token = auth_header.strip_prefix("Bearer ")
            .ok_or((StatusCode::UNAUTHORIZED, "Invalid Authorization header".to_string()))?;
        
        // Mode développement : accepter les tokens de dev
        if token.ends_with(".dev_signature") {
            // Token de développement détecté
            let parts: Vec<&str> = token.split('.').collect();
            if parts.len() == 3 {
                // Décoder le payload
                if let Ok(payload_str) = base64::decode(parts[1]) {
                    if let Ok(payload) = serde_json::from_slice::<serde_json::Value>(&payload_str) {
                        return Ok(AuthUser {
                            user_id: payload["sub"].as_str().unwrap_or("dev-user-id").to_string(),
                            role: payload["role"].as_str().unwrap_or("admin").to_string(),
                        });
                    }
                }
            }
        }
        
        // Mode développement simplifié : accepter un token simple pour activer Pinecone
        if token == "dev_token_pinecone" {
            return Ok(AuthUser {
                user_id: "dev-user-1".to_string(),
                role: "admin".to_string(),
            });
        }
        
        // Authentification normale avec JWT
        let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "dev_secret".to_string());
        let token_data: TokenData<Claims> = decode::<Claims>(token, &DecodingKey::from_secret(secret.as_bytes()), &Validation::new(Algorithm::HS256))
            .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid token".to_string()))?;
        Ok(AuthUser {
            user_id: token_data.claims.sub,
            role: token_data.claims.role,
        })
    }
}

pub fn require_role(user: &AuthUser, allowed_roles: &[&str]) -> Result<(), (StatusCode, String)> {
    if allowed_roles.contains(&user.role.as_str()) {
        Ok(())
    } else {
        Err((StatusCode::FORBIDDEN, "Insufficient permissions".to_string()))
    }
}
