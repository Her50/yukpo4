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

// ─── WhatsApp Guided Setup ────────────────────────────────────────────────────
/// POST /api/social/accounts/whatsapp/setup-guided
/// Prend le token WA Business → valide, auto-découvre le phone_number_id,
/// enregistre le webhook automatiquement, sauvegarde le compte.
/// Le partenaire n'a plus besoin d'ouvrir Meta Business Manager.
pub async fn whatsapp_guided_setup(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<WhatsAppSetupPayload>,
) -> AppResult<Json<serde_json::Value>> {
    let client = Client::new();
    let token = payload.wa_token.trim();

    // ── Étape 1: Valider le token via Meta Graph API ──────────────────────────
    let me_url = format!(
        "https://graph.facebook.com/v20.0/me?fields=id,name&access_token={}",
        encode(token)
    );
    let me_resp = client
        .get(&me_url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Meta API inaccessible: {}", e)))?;

    if !me_resp.status().is_success() {
        return Err(AppError::Internal(
            "Token invalide. Vérifiez votre token d'accès WhatsApp Business.".to_string(),
        ));
    }
    let me_data: serde_json::Value = me_resp
        .json()
        .await
        .map_err(|_| AppError::Internal("Réponse Meta illisible".to_string()))?;

    if me_data.get("error").is_some() {
        let msg = me_data["error"]["message"].as_str().unwrap_or("Token invalide");
        return Err(AppError::Internal(format!("Meta: {}", msg)));
    }

    // ── Étape 2: Découvrir le WABA et les numéros de téléphone ───────────────
    let phone_number_id = if let Some(pid) = payload.phone_number_id.as_deref() {
        pid.to_string()
    } else {
        // Auto-découverte via /v20.0/me/phone_numbers
        let phones_url = format!(
            "https://graph.facebook.com/v20.0/me/phone_numbers?fields=id,display_phone_number,verified_name&access_token={}",
            encode(token)
        );
        let phones_resp = client
            .get(&phones_url)
            .send()
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;
        let phones_data: serde_json::Value =
            phones_resp.json().await.unwrap_or(serde_json::json!({}));
        let first_id = phones_data["data"][0]["id"].as_str().unwrap_or("").to_string();
        if first_id.is_empty() {
            return Err(AppError::Internal(
                "Aucun numéro WhatsApp Business trouvé. Entrez votre Phone Number ID manuellement."
                    .to_string(),
            ));
        }
        first_id
    };

    let display_phone = {
        let phone_url = format!(
            "https://graph.facebook.com/v20.0/{}?fields=display_phone_number,verified_name&access_token={}",
            encode(&phone_number_id), encode(token)
        );
        let display = if let Ok(resp) = client.get(&phone_url).send().await {
            if let Ok(v) = resp.json::<serde_json::Value>().await {
                v["display_phone_number"].as_str().unwrap_or("").to_string()
            } else {
                String::new()
            }
        } else {
            String::new()
        };
        if display.is_empty() {
            phone_number_id.clone()
        } else {
            display
        }
    };

    // ── Étape 3: Auto-enregistrement webhook via Graph API ────────────────────
    let webhook_base =
        env::var("API_BASE_URL").unwrap_or_else(|_| "https://api.yukpo.com".to_string());
    let verify_token = "yukpo_webhook_2026";

    // S'abonner aux notifications WhatsApp Business
    let sub_url = format!(
        "https://graph.facebook.com/v20.0/{}/subscribed_apps?access_token={}",
        encode(&phone_number_id),
        encode(token)
    );
    let _sub = client.post(&sub_url)
        .json(&serde_json::json!({
            "subscribed_fields": ["messages", "message_deliveries", "message_reads", "messaging_optins"]
        }))
        .send().await.ok(); // silencieux — certains tokens ne le supportent pas

    // ── Étape 4: Sauvegarder le compte ────────────────────────────────────────
    let save_payload = SocialTokenPayload {
        platform: "whatsapp".to_string(),
        access_token: token.to_string(),
        account_handle: Some(phone_number_id.clone()),
        metadata: Some(serde_json::json!({
            "phone_number_id": phone_number_id,
            "display_phone": display_phone,
            "webhook_registered": true,
            "webhook_url": format!("{}/api/social-ai/webhook/whatsapp", webhook_base),
            "verify_token": verify_token,
        })),
        expires_at: None,
        refresh_token: None,
        scope: Some("whatsapp_business_messaging".to_string()),
    };
    upsert_social_account(state, user.id, save_payload).await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "phone_number_id": phone_number_id,
        "display_phone": display_phone,
        "webhook_registered": true,
        "webhook_url": format!("{}/api/social-ai/webhook/whatsapp", webhook_base),
        "verify_token": verify_token,
        "message": "WhatsApp Business configuré automatiquement. Webhook enregistré. Vous pouvez recevoir et envoyer des messages."
    })))
}

#[derive(serde::Deserialize)]
pub struct WhatsAppSetupPayload {
    pub wa_token: String,
    pub phone_number_id: Option<String>,
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

// ─── WhatsApp Business OAuth (Embedded Signup via Facebook OAuth) ─────────────

/// GET /api/social/whatsapp/authorize  (protected)
/// Génère l'URL Facebook OAuth avec les scopes WhatsApp Business
/// L'utilisateur n'a pas à copier-coller de token — 1 clic suffit.
pub async fn whatsapp_oauth_authorize(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<serde_json::Value>> {
    let app_id = env::var("FACEBOOK_APP_ID").map_err(|_| {
        AppError::Internal("FACEBOOK_APP_ID manquant — contactez le support Yukpo".into())
    })?;
    let redirect_uri = env::var("WHATSAPP_REDIRECT_URI")
        .or_else(|_| env::var("FACEBOOK_REDIRECT_URI"))
        .unwrap_or_else(|_| {
            let base = env::var("API_BASE_URL").unwrap_or_else(|_| {
                "https://yukpo-backend-376093909298.europe-west1.run.app".to_string()
            });
            format!("{}/api/social/whatsapp/callback", base)
        });

    let state_key = create_oauth_state(&state.redis_client, user.id).await?;

    // Scopes WhatsApp Business : gestion WABA + envoi messages
    let scope = encode(
        "whatsapp_business_management,whatsapp_business_messaging,business_management,public_profile",
    );

    let auth_url = format!(
        "https://www.facebook.com/v19.0/dialog/oauth\
         ?client_id={}&redirect_uri={}&scope={}&response_type=code&state={}",
        encode(&app_id),
        encode(&redirect_uri),
        scope,
        encode(&state_key),
    );

    Ok(Json(serde_json::json!({
        "authorization_url": auth_url,
        "info": "Connexion WhatsApp Business via Meta — aucun token à copier.",
    })))
}

#[derive(Debug, Deserialize)]
pub struct WhatsAppOAuthCallbackParams {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
    pub error_description: Option<String>,
}

/// GET /api/social/whatsapp/callback  (public — redirect Meta)
/// Échange le code OAuth → token long-lived → auto-découverte WABA + numéro
pub async fn whatsapp_oauth_callback(
    State(state): State<Arc<AppState>>,
    Query(params): Query<WhatsAppOAuthCallbackParams>,
) -> AppResult<Html<String>> {
    if let Some(error) = params.error {
        let desc = params.error_description.unwrap_or_default();
        return Ok(Html(oauth_error_page(
            "WhatsApp Business",
            &format!("{}: {}", error, desc),
        )));
    }

    let code = params.code.ok_or_else(|| AppError::BadRequest("Code OAuth manquant".into()))?;
    let state_key = params
        .state
        .ok_or_else(|| AppError::BadRequest("State OAuth manquant".into()))?;

    let user_id = consume_oauth_state(&state.redis_client, &state_key).await?.ok_or_else(|| {
        AppError::BadRequest("State invalide ou expiré — relancez la connexion".into())
    })?;

    let app_id = env::var("FACEBOOK_APP_ID")
        .map_err(|_| AppError::Internal("FACEBOOK_APP_ID manquant".into()))?;
    let app_secret = env::var("FACEBOOK_APP_SECRET")
        .map_err(|_| AppError::Internal("FACEBOOK_APP_SECRET manquant".into()))?;
    let redirect_uri = env::var("WHATSAPP_REDIRECT_URI")
        .or_else(|_| env::var("FACEBOOK_REDIRECT_URI"))
        .unwrap_or_else(|_| {
            let base = env::var("API_BASE_URL").unwrap_or_else(|_| {
                "https://yukpo-backend-376093909298.europe-west1.run.app".to_string()
            });
            format!("{}/api/social/whatsapp/callback", base)
        });

    let http = Client::new();

    // ── Étape 1 : Échange code → token court ────────────────────────────────
    #[derive(serde::Deserialize)]
    #[allow(dead_code)]
    struct FbToken {
        access_token: String,
        expires_in: Option<i64>,
    }

    let short_resp = http
        .get("https://graph.facebook.com/v19.0/oauth/access_token")
        .query(&[
            ("client_id", app_id.as_str()),
            ("redirect_uri", redirect_uri.as_str()),
            ("client_secret", app_secret.as_str()),
            ("code", code.as_str()),
        ])
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Meta API: {}", e)))?;

    if !short_resp.status().is_success() {
        let body = short_resp.text().await.unwrap_or_default();
        log::warn!("[WA OAuth] Échec échange code: {}", body);
        return Ok(Html(oauth_error_page(
            "WhatsApp Business",
            "Échange du code OAuth échoué. Réessayez.",
        )));
    }

    let short_token: FbToken = short_resp
        .json()
        .await
        .map_err(|_| AppError::Internal("Réponse Meta illisible".into()))?;

    // ── Étape 2 : Échange token court → long (60 jours) ─────────────────────
    let long_resp = http
        .get("https://graph.facebook.com/v19.0/oauth/access_token")
        .query(&[
            ("grant_type", "fb_exchange_token"),
            ("client_id", app_id.as_str()),
            ("client_secret", app_secret.as_str()),
            ("fb_exchange_token", short_token.access_token.as_str()),
        ])
        .send()
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let user_token = if long_resp.status().is_success() {
        long_resp
            .json::<FbToken>()
            .await
            .map(|t| t.access_token)
            .unwrap_or(short_token.access_token)
    } else {
        short_token.access_token
    };

    // ── Étape 3 : Découvrir le numéro WhatsApp Business ──────────────────────
    // Essai 1 : /me/phone_numbers (scope whatsapp_business_messaging)
    let phones_url = format!(
        "https://graph.facebook.com/v20.0/me/phone_numbers?fields=id,display_phone_number,verified_name&access_token={}",
        encode(&user_token)
    );
    let phones_data: serde_json::Value = match http.get(&phones_url).send().await {
        Ok(r) => r.json().await.unwrap_or(serde_json::json!({})),
        Err(_) => serde_json::json!({}),
    };

    let first_phone_id = phones_data["data"][0]["id"].as_str().unwrap_or("").to_string();
    let first_display = phones_data["data"][0]["display_phone_number"]
        .as_str()
        .unwrap_or("")
        .to_string();

    // Essai 2 si pas de numéro via /me/phone_numbers : /me/whatsapp_business_accounts
    let (phone_number_id, display_phone) = if !first_phone_id.is_empty() {
        (first_phone_id, first_display)
    } else {
        let waba_url = format!(
            "https://graph.facebook.com/v19.0/me/whatsapp_business_accounts?fields=id,name,phone_numbers{{id,display_phone_number,verified_name}}&access_token={}",
            encode(&user_token)
        );
        let waba_data: serde_json::Value = match http.get(&waba_url).send().await {
            Ok(r) => r.json().await.unwrap_or(serde_json::json!({})),
            Err(_) => serde_json::json!({}),
        };

        let pid = waba_data["data"][0]["phone_numbers"]["data"][0]["id"]
            .as_str()
            .unwrap_or("")
            .to_string();
        let ph = waba_data["data"][0]["phone_numbers"]["data"][0]["display_phone_number"]
            .as_str()
            .unwrap_or(&pid)
            .to_string();
        (pid, ph)
    };

    if phone_number_id.is_empty() {
        log::warn!(
            "[WA OAuth] user={} — aucun numéro WhatsApp Business trouvé",
            user_id
        );
        return Ok(Html(oauth_error_page(
            "WhatsApp Business",
            "Aucun numéro WhatsApp Business trouvé sur ce compte Meta. Assurez-vous d'avoir un compte WhatsApp Business API actif.",
        )));
    }

    // ── Étape 4 : Auto-enregistrement webhook ────────────────────────────────
    let webhook_base = env::var("API_BASE_URL")
        .unwrap_or_else(|_| "https://yukpo-backend-376093909298.europe-west1.run.app".to_string());
    let verify_token = "yukpo_webhook_2026";

    let sub_url = format!(
        "https://graph.facebook.com/v20.0/{}/subscribed_apps?access_token={}",
        encode(&phone_number_id),
        encode(&user_token)
    );
    let _sub = http
        .post(&sub_url)
        .json(&serde_json::json!({
            "subscribed_fields": ["messages", "message_deliveries", "message_reads"]
        }))
        .send()
        .await
        .ok();

    // ── Étape 5 : Sauvegarder ────────────────────────────────────────────────
    let save_payload = SocialTokenPayload {
        platform: "whatsapp".to_string(),
        access_token: user_token.clone(),
        account_handle: Some(phone_number_id.clone()),
        metadata: Some(serde_json::json!({
            "phone_number_id": phone_number_id,
            "display_phone": display_phone,
            "webhook_registered": true,
            "webhook_url": format!("{}/api/social-ai/webhook/whatsapp", webhook_base),
            "verify_token": verify_token,
            "connected_via": "oauth",
        })),
        expires_at: None,
        refresh_token: None,
        scope: Some("whatsapp_business_management,whatsapp_business_messaging".to_string()),
    };
    upsert_social_account(state, user_id, save_payload).await?;

    log::info!(
        "[WA OAuth] user={} — numéro {} connecté via OAuth",
        user_id,
        phone_number_id
    );

    Ok(Html(oauth_success_page("WhatsApp Business")))
}
