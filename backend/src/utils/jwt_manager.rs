use chrono::{Duration, Utc};
use jsonwebtoken::{
    decode, encode, Algorithm, DecodingKey, EncodingKey, Header, TokenData, Validation,
};
use serde::{Deserialize, Serialize};

use crate::core::types::AppError;

/// ? Claims enrichis : ce que contient ton JWT
#[derive(Debug, Serialize, Deserialize)]
pub struct UserClaims {
    pub sub: i32,                     // ID utilisateur
    pub role: String,                 // ex: "user", "admin", "partenaire"
    pub email: String,                // email de l?utilisateur
    pub name: Option<String>,         // ✅ NOUVEAU: nom de l'utilisateur
    pub tokens_balance: i64,          // solde
    pub partner_type: Option<String>, // ✅ NOUVEAU: Type de partenaire (pharmacie, hopital, etc.)
    pub iat: usize,                   // ?mis ?
    pub exp: usize,                   // expiration
}

impl UserClaims {
    pub fn new(
        user_id: i32,
        role: &str,
        email: &str,
        name: Option<String>,
        tokens_balance: i64,
        ttl_secs: i64,
        partner_type: Option<String>, // ✅ NOUVEAU: Type de partenaire
    ) -> Self {
        let now = Utc::now();
        Self {
            sub: user_id,
            role: role.to_string(),
            email: email.to_string(),
            name,
            tokens_balance,
            partner_type, // ✅ NOUVEAU
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
    name: Option<String>, // ✅ NOUVEAU: nom de l'utilisateur
    tokens_balance: i64,
    secret: &str,
    partner_type: Option<String>, // ✅ NOUVEAU: Type de partenaire
) -> Result<String, AppError> {
    // 2026-05-28 — TTL allongé à 30 jours.
    // Cible : parents Bourse du Livre qui ouvrent l'app ponctuellement
    // (rentrée scolaire, achats sporadiques). 24 h obligeait à ressaisir
    // PIN/password à chaque session ; usage habituel des apps grand
    // public mobile (WhatsApp, MoMo) = plusieurs semaines/mois. Le PIN
    // bcrypt + rate-limit 5 essais reste la barrière principale.
    let claims = UserClaims::new(
        user_id,
        role,
        email,
        name,
        tokens_balance,
        60 * 60 * 24 * 30,
        partner_type,
    );
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
