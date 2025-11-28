use std::collections::HashMap;
use std::sync::Arc;

use chrono::{DateTime, Duration, Utc};
use log::{error, info};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::{
    core::types::{AppError, AppResult},
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct SocialTokenPayload {
    pub platform: String,
    pub account_handle: Option<String>,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub scope: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug)]
pub struct OAuthTokenSet {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub scope: Option<String>,
    pub metadata: Value,
}

pub async fn upsert_social_account(
    state: Arc<AppState>,
    user_id: i32,
    payload: SocialTokenPayload,
) -> AppResult<()> {
    let metadata = payload.metadata.unwrap_or_else(|| serde_json::json!({}));

    sqlx::query(
        "INSERT INTO social_accounts (user_id, platform, account_handle, access_token, refresh_token, expires_at, scope, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         ON CONFLICT (user_id, platform)
         DO UPDATE SET access_token = EXCLUDED.access_token,
                       refresh_token = EXCLUDED.refresh_token,
                       expires_at = EXCLUDED.expires_at,
                       scope = EXCLUDED.scope,
                       metadata = EXCLUDED.metadata,
                       account_handle = EXCLUDED.account_handle,
                       updated_at = NOW()"
    )
    .bind(user_id)
    .bind(&payload.platform)
    .bind(payload.account_handle.as_ref())
    .bind(&payload.access_token)
    .bind(payload.refresh_token.as_ref())
    .bind(payload.expires_at)
    .bind(payload.scope.as_ref())
    .bind(metadata)
    .execute(&state.pg)
    .await
    .map_err(|err| {
        error!("[SocialConnector] Upsert error: {err:?}");
        AppError::from(err)
    })?;

    info!(
        "[SocialConnector] Tokens enregistrés pour user={} plateforme={}",
        user_id, payload.platform
    );
    Ok(())
}

pub async fn list_social_accounts(
    state: Arc<AppState>,
    user_id: i32,
) -> AppResult<Vec<SocialAccountRecord>> {
    let rows: Vec<SocialAccountRecord> = sqlx::query_as(
        r#"SELECT id,
                  user_id,
                  platform,
                  account_handle,
                  expires_at,
                  scope,
                  metadata,
                  created_at,
                  updated_at
          FROM social_accounts
          WHERE user_id = $1
          ORDER BY platform"#
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(AppError::from)?;

    Ok(rows)
}

pub async fn list_accounts_for_platforms(
    state: Arc<AppState>,
    user_id: i32,
    platforms: &[String],
) -> AppResult<HashMap<String, SocialAccountRecord>> {
    if platforms.is_empty() {
        return Ok(HashMap::new());
    }

    let normalized: Vec<String> = platforms.iter().map(|p| p.to_lowercase()).collect();

    let rows: Vec<SocialAccountRecord> = sqlx::query_as(
        r#"
        SELECT id,
               user_id,
               platform,
               account_handle,
               expires_at,
               scope,
               metadata,
               created_at,
               updated_at
        FROM social_accounts
        WHERE user_id = $1
          AND lower(platform) = ANY($2)
        "#
    )
    .bind(user_id)
    .bind(&normalized)
    .fetch_all(&state.pg)
    .await
    .map_err(AppError::from)?;

    let mut map = HashMap::new();
    for row in rows {
        map.insert(row.platform.to_lowercase(), row);
    }

    Ok(map)
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct SocialAccountRecord {
    pub id: i32,
    pub user_id: i32,
    pub platform: String,
    pub account_handle: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub scope: Option<String>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub async fn create_oauth_state(redis: &redis::Client, user_id: i32) -> AppResult<String> {
    // ✅ CORRIGÉ: Utiliser le helper Redis avec retry automatique
    use crate::utils::redis_helper;
    
    let state_id = format!("{}:{}", user_id, Uuid::new_v4());
    let key = format!("social_oauth:{}", &state_id);
    
    redis_helper::set_with_retry(redis, &key, &user_id.to_string(), Some(600))
        .await
        .map_err(|e| AppError::Internal(format!("Redis set_ex error (après retry): {e}")))?;
    Ok(state_id)
}

pub async fn consume_oauth_state(redis: &redis::Client, state: &str) -> AppResult<Option<i32>> {
    // ✅ CORRIGÉ: Utiliser le helper Redis avec retry automatique
    use crate::utils::redis_helper;
    
    let key = format!("social_oauth:{}", state);
    
    // Récupérer la valeur avec retry
    let user_id_str = match redis_helper::get_with_retry(redis, &key).await {
        Ok(Some(val)) => val,
        Ok(None) => return Ok(None),
        Err(e) => return Err(AppError::Internal(format!("Redis get error (après retry): {e}"))),
    };
    
    // Parser user_id
    let user_id: i32 = user_id_str
        .parse()
        .map_err(|_| AppError::Internal("Invalid user_id format in Redis".to_string()))?;
    
    // Supprimer la clé après consommation
    let _ = redis_helper::del_with_retry(redis, &key).await;
    
    Ok(Some(user_id))
}

pub async fn exchange_youtube_code(
    client: &Client,
    client_id: &str,
    client_secret: &str,
    redirect_uri: &str,
    code: &str,
) -> AppResult<OAuthTokenSet> {
    let response = client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("code", code),
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("redirect_uri", redirect_uri),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await?
        .error_for_status()?;

    let payload: GoogleTokenResponse = response.json().await?;

    let expires_at = payload
        .expires_in
        .map(|seconds| Utc::now() + Duration::seconds(seconds as i64));

    let metadata = serde_json::json!({
        "token_type": payload.token_type,
        "scope": payload.scope,
    });

    Ok(OAuthTokenSet {
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
        expires_at,
        scope: payload.scope,
        metadata,
    })
}

pub async fn exchange_instagram_code(
    client: &Client,
    app_id: &str,
    app_secret: &str,
    redirect_uri: &str,
    code: &str,
) -> AppResult<OAuthTokenSet> {
    let short_resp: InstagramTokenResponse = client
        .get("https://graph.facebook.com/v18.0/oauth/access_token")
        .query(&[
            ("client_id", app_id),
            ("redirect_uri", redirect_uri),
            ("client_secret", app_secret),
            ("code", code),
        ])
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let long_resp: InstagramTokenResponse = client
        .get("https://graph.facebook.com/v18.0/oauth/access_token")
        .query(&[
            ("grant_type", "fb_exchange_token"),
            ("client_id", app_id),
            ("client_secret", app_secret),
            ("fb_exchange_token", short_resp.access_token.as_str()),
        ])
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let expires_at = long_resp
        .expires_in
        .map(|seconds| Utc::now() + Duration::seconds(seconds as i64));

    let metadata = serde_json::json!({
        "token_type": long_resp.token_type,
    });

    Ok(OAuthTokenSet {
        access_token: long_resp.access_token,
        refresh_token: None,
        expires_at,
        scope: None,
        metadata,
    })
}

#[derive(Debug, Deserialize)]
struct GoogleTokenResponse {
    access_token: String,
    expires_in: Option<i64>,
    refresh_token: Option<String>,
    scope: Option<String>,
    token_type: Option<String>,
}

#[derive(Debug, Deserialize)]
struct InstagramTokenResponse {
    access_token: String,
    token_type: Option<String>,
    expires_in: Option<i64>,
}
