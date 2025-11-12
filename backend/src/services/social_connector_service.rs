use std::sync::Arc;

use chrono::{DateTime, Duration, Utc};
use log::{error, info};
use redis::AsyncCommands;
use reqwest::Client;
use serde::Deserialize;
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

    sqlx::query!(
        "INSERT INTO social_accounts (user_id, platform, account_handle, access_token, refresh_token, expires_at, scope, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         ON CONFLICT (user_id, platform)
         DO UPDATE SET access_token = EXCLUDED.access_token,
                       refresh_token = EXCLUDED.refresh_token,
                       expires_at = EXCLUDED.expires_at,
                       scope = EXCLUDED.scope,
                       metadata = EXCLUDED.metadata,
                       account_handle = EXCLUDED.account_handle,
                       updated_at = NOW()",
        user_id,
        payload.platform,
        payload.account_handle,
        payload.access_token,
        payload.refresh_token,
        payload.expires_at,
        payload.scope,
        metadata,
    )
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
    let rows = sqlx::query!(
        r#"SELECT id,
                  user_id,
                  platform,
                  account_handle,
                  expires_at       AS "expires_at: Option<DateTime<Utc>>",
                  scope            AS "scope: Option<String>",
                  metadata         AS "metadata: Option<serde_json::Value>",
                  created_at       AS "created_at: DateTime<Utc>",
                  updated_at       AS "updated_at: DateTime<Utc>"
          FROM social_accounts
          WHERE user_id = $1
          ORDER BY platform"#,
        user_id
    )
    .fetch_all(&state.pg)
    .await
    .map_err(AppError::from)?;

    let records = rows
        .into_iter()
        .map(|row| SocialAccountRecord {
            id: row.id,
            user_id: row.user_id,
            platform: row.platform,
            account_handle: row.account_handle,
            expires_at: row.expires_at.flatten(),
            scope: row.scope.flatten(),
            metadata: row
                .metadata
                .flatten()
                .unwrap_or_else(|| serde_json::Value::Object(Default::default())),
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
        .collect::<Vec<_>>();

    Ok(records)
}

#[derive(Debug, sqlx::FromRow, serde::Serialize)]
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
    let mut conn = redis
        .get_multiplexed_async_connection()
        .await
        .map_err(|e| AppError::Internal(format!("Redis connection error: {e}")))?;
    let state_id = format!("{}:{}", user_id, Uuid::new_v4());
    let key = format!("social_oauth:{}", &state_id);
    conn.set_ex::<_, _, ()>(key, user_id, 600)
        .await
        .map_err(|e| AppError::Internal(format!("Redis set_ex error: {e}")))?;
    Ok(state_id)
}

pub async fn consume_oauth_state(redis: &redis::Client, state: &str) -> AppResult<Option<i32>> {
    let mut conn = redis
        .get_multiplexed_async_connection()
        .await
        .map_err(|e| AppError::Internal(format!("Redis connection error: {e}")))?;
    let key = format!("social_oauth:{}", state);
    let user_id: Option<i32> = conn
        .get(&key)
        .await
        .map_err(|e| AppError::Internal(format!("Redis get error: {e}")))?;
    if user_id.is_some() {
        let _: () = conn
            .del(key)
            .await
            .map_err(|e| AppError::Internal(format!("Redis del error: {e}")))?;
    }
    Ok(user_id)
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
