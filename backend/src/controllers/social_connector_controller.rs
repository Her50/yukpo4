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
        consume_oauth_state, create_oauth_state, discover_and_save_facebook_ecosystem,
        exchange_instagram_code, exchange_youtube_code, list_social_accounts,
        upsert_social_account, OAuthTokenSet, SocialAccountRecord, SocialTokenPayload,
    },
    state::AppState,
};

// ─── WhatsApp Business catalog authorize ────────────────────────────────────

/// Retourne l'URL d'accès au WhatsApp Business Manager pour configurer le catalog.
/// WhatsApp Business n'a pas d'OAuth individuel : on guide le partenaire vers
/// son Business Manager Meta, puis il colle son numéro/phone-number-id.
pub async fn whatsapp_business_info(
    Extension(_user): Extension<AuthenticatedUser>,
) -> AppResult<Json<serde_json::Value>> {
    Ok(Json(serde_json::json!({
        "setup_url": "https://business.facebook.com/wa/manage/phone-numbers/",
        "catalog_url": "https://business.facebook.com/commerce/catalogs/",
        "guide": "Connectez votre compte Facebook Business, puis revenez dans Yukpo pour entrer votre Phone Number ID.",
        "requires_meta_business": true,
    })))
}

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

    let http = Client::new();
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

    // Scopes complets : Pages + Instagram + commentaires + messagerie
    let scope = encode(
        "instagram_content_publish,instagram_basic,instagram_manage_comments,\
         pages_show_list,pages_manage_posts,pages_read_engagement,\
         pages_manage_metadata,pages_manage_comments,\
         pages_messaging,public_profile",
    );

    // extras=setup guide l'utilisateur vers la configuration Page/Instagram en 1 flux
    let extras = encode(r#"{"setup":{"channel":"IG_API_ONBOARDING"}}"#);

    let auth_url = format!(
        "https://www.facebook.com/v19.0/dialog/oauth?client_id={}&redirect_uri={}&scope={}&response_type=code&state={}&extras={}",
        encode(&app_id),
        encode(&redirect_uri),
        scope,
        encode(&state_key),
        extras,
    );

    Ok(Json(serde_json::json!({
        "authorization_url": auth_url,
        "info": "Cette connexion couvre Facebook ET Instagram. Aucun token à entrer manuellement.",
    })))
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

    let http = Client::new();
    let token_set =
        exchange_instagram_code(&http, &app_id, &app_secret, &redirect_uri, &code).await?;

    // Découverte automatique : Pages Facebook + Instagram liés + création de Page si besoin
    let ecosystem =
        crate::services::social_connector_service::discover_and_save_facebook_ecosystem(
            state.clone(),
            user_id,
            &token_set.access_token,
            None, // service_name : facultatif — on peut le passer si stocké en session
        )
        .await;

    match &ecosystem {
        Ok(r) => log::info!(
            "[FBE] Callback OK user={}: {} pages, {} Instagram, page_créée={}",
            user_id,
            r.pages_connected,
            r.instagram_connected,
            r.page_auto_created
        ),
        Err(e) => {
            // Fallback : sauvegarder au moins le token brut
            log::warn!("[FBE] Discover partiel ({}), fallback save user token", e);
            persist_token_set(state.clone(), user_id, "facebook", token_set).await?;
        }
    }

    Ok(Html(oauth_success_page("Facebook & Instagram")))
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
    // Redirige vers le deep link Yukpo pour retour automatique dans l'app mobile
    // yukpo://oauth/success?platform=facebook — l'app écoute via Linking.addEventListener
    format!(
        r#"<html>
<head>
  <meta charset='utf-8'>
  <meta name='viewport' content='width=device-width, initial-scale=1'>
  <title>Connexion réussie</title>
  <style>
    body{{font-family:-apple-system,Arial,sans-serif;padding:32px;text-align:center;background:#f0fdf4}}
    h2{{color:#16a34a;font-size:22px}}
    p{{color:#374151;margin:12px 0}}
    .btn{{display:inline-block;margin-top:20px;padding:12px 28px;background:#16a34a;color:#fff;border-radius:10px;text-decoration:none;font-weight:700}}
  </style>
</head>
<body>
  <h2>✅ {platform} connecté avec succès</h2>
  <p>Votre compte {platform} est maintenant lié à Yukpo.</p>
  <p>Vous pouvez retourner dans l'application.</p>
  <a href='yukpo://oauth/success?platform={platform_lower}' class='btn'>Retour dans Yukpo</a>
  <script>
    // Tenter deep link immédiatement
    window.location.href = 'yukpo://oauth/success?platform={platform_lower}';
    // Fermer si ouvert depuis JavaScript (navigation web)
    setTimeout(function(){{try{{window.close();}}catch(e){{}}}}, 1500);
  </script>
</body>
</html>"#,
        platform = platform,
        platform_lower = platform.to_lowercase()
    )
}

fn oauth_error_page(platform: &str, error: &str) -> String {
    format!(
        r#"<html>
<head>
  <meta charset='utf-8'>
  <meta name='viewport' content='width=device-width, initial-scale=1'>
  <title>Erreur connexion</title>
  <style>
    body{{font-family:-apple-system,Arial,sans-serif;padding:32px;text-align:center;background:#fef2f2}}
    h2{{color:#dc2626;font-size:22px}}
    p{{color:#374151;margin:12px 0}}
    .btn{{display:inline-block;margin-top:20px;padding:12px 28px;background:#dc2626;color:#fff;border-radius:10px;text-decoration:none;font-weight:700}}
    .error{{background:#fee2e2;padding:12px;border-radius:8px;font-size:13px;color:#7f1d1d;margin:16px 0}}
  </style>
</head>
<body>
  <h2>❌ Connexion {platform} échouée</h2>
  <div class='error'>{error}</div>
  <p>Retournez dans Yukpo et réessayez.</p>
  <a href='yukpo://oauth/error?platform={platform_lower}&error={error_enc}' class='btn'>Retour dans Yukpo</a>
  <script>
    window.location.href = 'yukpo://oauth/error?platform={platform_lower}';
    setTimeout(function(){{try{{window.close();}}catch(e){{}}}}, 2000);
  </script>
</body>
</html>"#,
        platform = platform,
        error = error,
        platform_lower = platform.to_lowercase(),
        error_enc = urlencoding::encode(error)
    )
}
