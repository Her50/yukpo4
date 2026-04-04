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
          ORDER BY platform"#,
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
        "#,
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
        Err(e) => {
            return Err(AppError::Internal(format!(
                "Redis get error (après retry): {e}"
            )))
        }
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

    let expires_at =
        payload.expires_in.map(|seconds| Utc::now() + Duration::seconds(seconds as i64));

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

/// Après le callback OAuth Facebook, découvre automatiquement :
/// 1. Les Pages de l'utilisateur + leurs Page Access Tokens
/// 2. Les comptes Instagram Business liés à chaque Page
/// 3. Crée une Page basique si l'utilisateur n'en a pas (si service_name fourni)
/// Tout est sauvegardé en base — aucune action supplémentaire de l'utilisateur.
pub async fn discover_and_save_facebook_ecosystem(
    state: Arc<AppState>,
    user_id: i32,
    user_access_token: &str,
    service_name: Option<&str>,
) -> AppResult<FacebookEcosystemResult> {
    let http = Client::new();
    let mut result = FacebookEcosystemResult {
        pages_connected: 0,
        instagram_connected: 0,
        page_auto_created: false,
        page_names: vec![],
    };

    // 1. Récupérer les Pages de l'utilisateur
    let pages_resp = http
        .get("https://graph.facebook.com/v19.0/me/accounts")
        .query(&[
            ("access_token", user_access_token),
            (
                "fields",
                "id,name,access_token,instagram_business_account{id,name,username}",
            ),
        ])
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Facebook Pages API: {e}")))?;

    let pages_json: serde_json::Value = pages_resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Pages JSON parse: {e}")))?;

    let pages = pages_json["data"].as_array().cloned().unwrap_or_default();

    // 2. Si aucune Page et service_name fourni → créer une Page automatiquement
    if pages.is_empty() {
        if let Some(name) = service_name {
            info!(
                "[FBE] Aucune Page trouvée pour user={} — création automatique '{}'",
                user_id, name
            );
            let create_resp = http
                .post("https://graph.facebook.com/v19.0/me/accounts")
                .form(&[
                    ("name", name),
                    ("category", "2256"), // Shopping & Retail
                    ("access_token", user_access_token),
                ])
                .send()
                .await;

            if let Ok(r) = create_resp {
                if let Ok(v) = r.json::<serde_json::Value>().await {
                    if let Some(page_id) = v["id"].as_str() {
                        info!("[FBE] Page créée automatiquement id={}", page_id);
                        result.page_auto_created = true;
                        result.page_names.push(name.to_string());
                        // Sauvegarder la nouvelle Page avec le user_token (fallback)
                        upsert_social_account(
                            state.clone(),
                            user_id,
                            SocialTokenPayload {
                                platform: "facebook".to_string(),
                                account_handle: Some(name.to_string()),
                                access_token: user_access_token.to_string(),
                                refresh_token: None,
                                expires_at: Some(Utc::now() + Duration::days(60)),
                                scope: Some("pages_manage_posts,pages_manage_comments".to_string()),
                                metadata: Some(serde_json::json!({
                                    "page_id": page_id,
                                    "page_name": name,
                                    "auto_created": true,
                                })),
                            },
                        )
                        .await
                        .ok();
                        result.pages_connected = 1;
                        return Ok(result);
                    }
                }
            }
        }
        // Sauvegarder au moins le user token
        upsert_social_account(
            state.clone(),
            user_id,
            SocialTokenPayload {
                platform: "facebook".to_string(),
                account_handle: None,
                access_token: user_access_token.to_string(),
                refresh_token: None,
                expires_at: Some(Utc::now() + Duration::days(60)),
                scope: Some("pages_show_list,instagram_basic".to_string()),
                metadata: None,
            },
        )
        .await
        .ok();
        return Ok(result);
    }

    // 3. Parcourir chaque Page
    for page in &pages {
        let page_id = page["id"].as_str().unwrap_or_default();
        let page_name = page["name"].as_str().unwrap_or("Ma Page");
        let page_token = page["access_token"].as_str().unwrap_or(user_access_token);

        if page_id.is_empty() {
            continue;
        }

        // Sauvegarde Page Facebook avec son propre token
        upsert_social_account(
            state.clone(),
            user_id,
            SocialTokenPayload {
                platform: "facebook".to_string(),
                account_handle: Some(page_name.to_string()),
                access_token: page_token.to_string(),
                refresh_token: None,
                expires_at: None, // Page tokens n'expirent pas
                scope: Some(
                    "pages_manage_posts,pages_read_engagement,pages_manage_comments".to_string(),
                ),
                metadata: Some(serde_json::json!({
                    "page_id": page_id,
                    "page_name": page_name,
                    "user_token": user_access_token,
                })),
            },
        )
        .await
        .ok();

        result.pages_connected += 1;
        result.page_names.push(page_name.to_string());

        // 4. Instagram Business Account lié à cette Page ?
        let ig = &page["instagram_business_account"];
        let ig_id = ig["id"].as_str().unwrap_or_default();
        if !ig_id.is_empty() {
            let ig_username =
                ig["username"].as_str().or_else(|| ig["name"].as_str()).unwrap_or(page_name);

            upsert_social_account(
                state.clone(),
                user_id,
                SocialTokenPayload {
                    platform: "instagram".to_string(),
                    account_handle: Some(ig_username.to_string()),
                    access_token: page_token.to_string(), // Page token = Instagram token
                    refresh_token: None,
                    expires_at: None,
                    scope: Some(
                        "instagram_content_publish,instagram_manage_comments,instagram_basic"
                            .to_string(),
                    ),
                    metadata: Some(serde_json::json!({
                        "instagram_account_id": ig_id,
                        "instagram_username": ig_username,
                        "linked_page_id": page_id,
                    })),
                },
            )
            .await
            .ok();

            result.instagram_connected += 1;
        }
    }

    info!(
        "[FBE] Ecosystem découvert pour user={}: {} pages, {} Instagram",
        user_id, result.pages_connected, result.instagram_connected
    );

    Ok(result)
}

#[derive(Debug, Default)]
pub struct FacebookEcosystemResult {
    pub pages_connected: i32,
    pub instagram_connected: i32,
    pub page_auto_created: bool,
    pub page_names: Vec<String>,
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
