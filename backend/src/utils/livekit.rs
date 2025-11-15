use chrono::{Duration, Utc};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde::Serialize;

use crate::core::types::AppError;

const DEFAULT_SERVER_TOKEN_TTL_SECS: i64 = 60;

#[derive(Debug, Serialize)]
struct LiveKitServerClaims<'a> {
    iss: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    sub: Option<&'a str>,
    exp: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    nbf: Option<usize>,
    video: LiveKitServerVideoGrant,
}

#[derive(Debug, Serialize)]
struct LiveKitServerVideoGrant {
    #[serde(rename = "roomAdmin")]
    room_admin: bool,
    #[serde(rename = "roomCreate")]
    room_create: bool,
    #[serde(rename = "roomList")]
    room_list: bool,
    #[serde(rename = "roomJoin")]
    room_join: bool,
    #[serde(rename = "ingressAdmin")]
    ingress_admin: bool,
}

impl Default for LiveKitServerVideoGrant {
    fn default() -> Self {
        Self {
            room_admin: true,
            room_create: true,
            room_list: true,
            room_join: true,
            ingress_admin: true,
        }
    }
}

pub fn generate_server_access_token(api_key: &str, api_secret: &str) -> Result<String, AppError> {
    generate_server_access_token_with_ttl(api_key, api_secret, DEFAULT_SERVER_TOKEN_TTL_SECS)
}

pub fn generate_server_access_token_with_ttl(
    api_key: &str,
    api_secret: &str,
    ttl_seconds: i64,
) -> Result<String, AppError> {
    let now = Utc::now();
    let exp_ts = (now + Duration::seconds(ttl_seconds)).timestamp() as usize;
    let nbf_ts = now.timestamp().max(0) as usize;

    let claims = LiveKitServerClaims {
        iss: api_key,
        sub: Some("yukpo-backend"),
        exp: exp_ts,
        nbf: Some(nbf_ts),
        video: LiveKitServerVideoGrant::default(),
    };

    let token = encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(api_secret.as_bytes()),
    )?;

    Ok(token)
}
