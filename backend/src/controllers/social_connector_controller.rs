use std::{env, sync::Arc};

use axum::{
    extract::{Json, Query, State},
    response::Html,
    Extension,
};
use reqwest::Client;
use serde::Deserialize;
use urlencoding::encode;

use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::AuthenticatedUser,
    services::social_connector_service::{
        consume_oauth_state, create_oauth_state, exchange_instagram_code, exchange_youtube_code,
        list_social_accounts, upsert_social_account, OAuthTokenSet, SocialAccountRecord,
        SocialTokenPayload,
    },
    state::AppState,
};

pub async fn connect_account(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<SocialTokenPayload>,
) -> AppResult<Json<serde_json::Value>> {
    upsert_social_account(state, user.id, payload).await?;
    Ok(Json(serde_json::json!({"success": true})))
}

pub async fn get_accounts(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<Vec<SocialAccountRecord>>> {
    let records = list_social_accounts(state, user.id).await?;
    Ok(Json(records))
}

pub async fn youtube_authorize(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<serde_json::Value>> {
    let client_id = env::var("YOUTUBE_CLIENT_ID")
        .map_err(|_| AppError::Internal("YOUTUBE_CLIENT_ID manquant".into()))?;
    let redirect_uri = env::var("YOUTUBE_REDIRECT_URI")
        .map_err(|_| AppError::Internal("YOUTUBE_REDIRECT_URI manquant".into()))?;

    let state_key = create_oauth_state(&state.redis_client, user.id).await?;
    let scope = encode(
        "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.force-ssl",
    );
    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id={}&redirect_uri={}&scope={}&access_type=offline&prompt=consent&state={}",
        encode(&client_id),
        encode(&redirect_uri),
        scope,
        encode(&state_key)
    );

    Ok(Json(serde_json::json!({ "authorization_url": auth_url })))
}

pub async fn youtube_callback(
    State(state): State<Arc<AppState>>,
    Query(params): Query<OAuthCallbackParams>,
) -> AppResult<Html<String>> {
    if let Some(error) = params.error {
        return Ok(Html(oauth_error_page("YouTube", &error)));
    }

    let Some(code) = params.code else {
        return Err(AppError::BadRequest("Code OAuth manquant".into()));
    };
    let Some(state_key) = params.state else {
        return Err(AppError::BadRequest("State OAuth manquant".into()));
    };

    let Some(user_id) = consume_oauth_state(&state.redis_client, &state_key).await? else {
        return Err(AppError::BadRequest("State invalide ou expiré".into()));
    };

    let client_id = env::var("YOUTUBE_CLIENT_ID")
        .map_err(|_| AppError::Internal("YOUTUBE_CLIENT_ID manquant".into()))?;
    let client_secret = env::var("YOUTUBE_CLIENT_SECRET")
        .map_err(|_| AppError::Internal("YOUTUBE_CLIENT_SECRET manquant".into()))?;
    let redirect_uri = env::var("YOUTUBE_REDIRECT_URI")
        .map_err(|_| AppError::Internal("YOUTUBE_REDIRECT_URI manquant".into()))?;

    let http = reqwest::Client::new();
    let token_set =
        exchange_youtube_code(&http, &client_id, &client_secret, &redirect_uri, &code).await?;

    persist_token_set(state, user_id, "youtube", token_set).await?;

    Ok(Html(oauth_success_page("YouTube")))
}

pub async fn instagram_authorize(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<serde_json::Value>> {
    let app_id = env::var("INSTAGRAM_APP_ID")
        .map_err(|_| AppError::Internal("INSTAGRAM_APP_ID manquant".into()))?;
    let redirect_uri = env::var("INSTAGRAM_REDIRECT_URI")
        .map_err(|_| AppError::Internal("INSTAGRAM_REDIRECT_URI manquant".into()))?;

    let state_key = create_oauth_state(&state.redis_client, user.id).await?;
    let scope = encode("instagram_content_publish,instagram_basic,pages_show_list");
    let auth_url = format!(
        "https://www.facebook.com/v18.0/dialog/oauth?client_id={}&redirect_uri={}&scope={}&response_type=code&state={}",
        encode(&app_id),
        encode(&redirect_uri),
        scope,
        encode(&state_key)
    );

    Ok(Json(serde_json::json!({ "authorization_url": auth_url })))
}

pub async fn instagram_callback(
    State(state): State<Arc<AppState>>,
    Query(params): Query<OAuthCallbackParams>,
) -> AppResult<Html<String>> {
    if let Some(error) = params.error {
        return Ok(Html(oauth_error_page("Instagram", &error)));
    }

    let Some(code) = params.code else {
        return Err(AppError::BadRequest("Code OAuth manquant".into()));
    };
    let Some(state_key) = params.state else {
        return Err(AppError::BadRequest("State OAuth manquant".into()));
    };

    let Some(user_id) = consume_oauth_state(&state.redis_client, &state_key).await? else {
        return Err(AppError::BadRequest("State invalide ou expiré".into()));
    };

    let app_id = env::var("INSTAGRAM_APP_ID")
        .map_err(|_| AppError::Internal("INSTAGRAM_APP_ID manquant".into()))?;
    let app_secret = env::var("INSTAGRAM_APP_SECRET")
        .map_err(|_| AppError::Internal("INSTAGRAM_APP_SECRET manquant".into()))?;
    let redirect_uri = env::var("INSTAGRAM_REDIRECT_URI")
        .map_err(|_| AppError::Internal("INSTAGRAM_REDIRECT_URI manquant".into()))?;

    let http = reqwest::Client::new();
    let token_set =
        exchange_instagram_code(&http, &app_id, &app_secret, &redirect_uri, &code).await?;

    persist_token_set(state, user_id, "instagram", token_set).await?;

    Ok(Html(oauth_success_page("Instagram")))
}

#[derive(Debug, Deserialize)]
pub struct OAuthCallbackParams {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
}

async fn persist_token_set(
    state: Arc<AppState>,
    user_id: i32,
    platform: &str,
    token_set: OAuthTokenSet,
) -> AppResult<()> {
    upsert_social_account(
        state,
        user_id,
        SocialTokenPayload {
            platform: platform.to_string(),
            account_handle: None,
            access_token: token_set.access_token,
            refresh_token: token_set.refresh_token,
            expires_at: token_set.expires_at,
            scope: token_set.scope,
            metadata: Some(token_set.metadata),
        },
    )
    .await
}

fn oauth_success_page(platform: &str) -> String {
    format!(
        "<html><head><meta charset='utf-8'><title>Succès</title></head><body style=\"font-family:Arial;padding:32px;text-align:center;\"><h2>Connexion {platform} réussie ✅</h2><p>Vous pouvez revenir dans Yukpomnang.</p><script>setTimeout(function(){{window.close();}},2000);</script></body></html>"
    )
}

fn oauth_error_page(platform: &str, error: &str) -> String {
    format!(
        "<html><head><meta charset='utf-8'><title>Erreur</title></head><body style=\"font-family:Arial;padding:32px;text-align:center;\"><h2>Connexion {platform} échouée ❌</h2><p>{}</p></body></html>",
        error
    )
}
