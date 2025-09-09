use chrono::{Duration, Utc};
use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey, Algorithm, TokenData};
use serde::{Serialize, Deserialize};

use crate::core::types::AppError;

/// ? Claims enrichis : ce que contient ton JWT
#[derive(Debug, Serialize, Deserialize)]
pub struct UserClaims {
    pub sub: i32,             // ID utilisateur
    pub role: String,         // ex: "user", "admin"
    pub email: String,        // email de l?utilisateur
    pub tokens_balance: i64,  // solde
    pub iat: usize,           // ?mis ?
    pub exp: usize,           // expiration
}

impl UserClaims {
    pub fn new(user_id: i32, role: &str, email: &str, tokens_balance: i64, ttl_secs: i64) -> Self {
        let now = Utc::now();
        Self {
            sub: user_id,
            role: role.to_string(),
            email: email.to_string(),
            tokens_balance,
            iat: now.timestamp() as usize,
            exp: (now + Duration::seconds(ttl_secs)).timestamp() as usize,
        }
    }
}

/// ? G?n?re un JWT sign? avec claims enrichis
pub fn generate_jwt(
    user_id: i32,
    role: &str,
    email: &str,
    tokens_balance: i64,
    secret: &str,
) -> Result<String, AppError> {
    let claims = UserClaims::new(user_id, role, email, tokens_balance, 60 * 60 * 24); // 24h
    encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(format!("Erreur JWT encode : {}", e)))
}

/// ? D?code et v?rifie le JWT, retourne les claims
pub fn decode_jwt(token: &str, secret: &str) -> Result<TokenData<UserClaims>, AppError> {
    let validation = Validation::new(Algorithm::HS256);
    decode::<UserClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map_err(|e| AppError::Unauthorized(format!("JWT invalide : {}", e)))
}
