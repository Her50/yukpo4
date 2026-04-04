// Service de gestion des tokens Meta (Facebook + Instagram + WhatsApp Business)
//
// Responsabilités :
//   1. Valider si un token est encore utilisable (> 5 jours avant expiration)
//   2. Rafraîchir automatiquement un token long-lived (60 jours → renouveler à J-5)
//   3. Charger le token depuis la DB et le rafraîchir si besoin
//   4. Récupérer le page_access_token dédié depuis le user_token

use std::env;

use chrono::{DateTime, Duration, Utc};
use log::{info, warn};
use reqwest::Client;
use serde::Deserialize;
use sqlx::PgPool;

use crate::core::types::{AppError, AppResult};

const GRAPH_BASE: &str = "https://graph.facebook.com/v19.0";

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/// Retourne true si le token est encore utilisable.
/// On considère qu'un token est "expiré" s'il reste moins de 5 jours.
pub fn is_token_valid(expires_at: Option<DateTime<Utc>>) -> bool {
    match expires_at {
        Some(exp) => exp > Utc::now() + Duration::days(5),
        None => true, // token sans expiration explicite (rare, on fait confiance)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Refresh token Meta
// ─────────────────────────────────────────────────────────────────────────────

/// Échange un token court ou long contre un nouveau token long-lived (60 jours).
/// Appeler avant d'utiliser un token proche de l'expiration.
pub async fn refresh_meta_long_token(
    http: &Client,
    current_token: &str,
) -> AppResult<RefreshedToken> {
    let app_id = env::var("FACEBOOK_APP_ID")
        .map_err(|_| AppError::Internal("FACEBOOK_APP_ID manquant dans l'environnement".into()))?;
    let app_secret = env::var("FACEBOOK_APP_SECRET").map_err(|_| {
        AppError::Internal("FACEBOOK_APP_SECRET manquant dans l'environnement".into())
    })?;

    #[derive(Deserialize)]
    struct Resp {
        access_token: String,
        expires_in: Option<i64>,
        #[allow(dead_code)]
        token_type: Option<String>,
    }
    #[derive(Deserialize)]
    struct ErrWrapper {
        error: Option<MetaError>,
    }
    #[derive(Deserialize)]
    struct MetaError {
        message: String,
        code: Option<i32>,
    }

    let raw = http
        .get(format!("{}/oauth/access_token", GRAPH_BASE))
        .query(&[
            ("grant_type", "fb_exchange_token"),
            ("client_id", &app_id),
            ("client_secret", &app_secret),
            ("fb_exchange_token", current_token),
        ])
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("[MetaToken refresh] réseau: {e}")))?
        .error_for_status()
        .map_err(|e| AppError::Internal(format!("[MetaToken refresh] HTTP: {e}")))?
        .text()
        .await
        .map_err(|e| AppError::Internal(format!("[MetaToken refresh] text: {e}")))?;

    if let Ok(err_wrap) = serde_json::from_str::<ErrWrapper>(&raw) {
        if let Some(err) = err_wrap.error {
            return Err(AppError::Internal(format!(
                "[MetaToken refresh] Erreur Meta (code {:?}): {}",
                err.code, err.message
            )));
        }
    }

    let resp: Resp = serde_json::from_str(&raw)
        .map_err(|e| AppError::Internal(format!("[MetaToken refresh] parse: {e} — raw: {raw}")))?;

    let expires_at = resp.expires_in.map(|s| Utc::now() + Duration::seconds(s));

    info!("[MetaToken] Token rafraîchi. Expiration: {:?}", expires_at);

    Ok(RefreshedToken {
        access_token: resp.access_token,
        expires_at,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Chargement depuis la DB avec refresh auto
// ─────────────────────────────────────────────────────────────────────────────

/// Charge le token d'une plateforme pour un utilisateur.
/// Si le token expire bientôt (< 5 jours), il est rafraîchi automatiquement.
/// Retourne une erreur explicite si le compte n'est pas connecté.
pub async fn load_valid_token(
    pool: &PgPool,
    http: &Client,
    user_id: i32,
    platform: &str,
) -> AppResult<ValidToken> {
    let row = sqlx::query(
        r#"SELECT access_token, expires_at, metadata, account_handle
           FROM social_accounts
           WHERE user_id = $1 AND platform = $2"#,
    )
    .bind(user_id)
    .bind(platform)
    .fetch_optional(pool)
    .await
    .map_err(AppError::from)?;

    let row = row.ok_or_else(|| {
        AppError::BadRequest(format!(
            "Aucun compte {platform} connecté. \
             Connectez votre compte dans l'écran Diffusion → Plateformes."
        ))
    })?;

    use sqlx::Row;
    let access_token: String = row
        .try_get("access_token")
        .map_err(|e| AppError::Internal(format!("DB access_token: {e}")))?;
    let expires_at: Option<DateTime<Utc>> = row.try_get("expires_at").ok().flatten();
    let metadata: serde_json::Value =
        row.try_get("metadata").unwrap_or_else(|_| serde_json::json!({}));
    let account_handle: Option<String> = row.try_get("account_handle").ok().flatten();

    // Rafraîchir si token Meta proche de l'expiration
    if !is_token_valid(expires_at) && matches!(platform, "facebook" | "instagram") {
        warn!("[MetaToken] Token {platform} pour user={user_id} proche expiration — refresh auto");
        match refresh_meta_long_token(http, &access_token).await {
            Ok(refreshed) => {
                // Persister le nouveau token
                let _ = sqlx::query(
                    r#"UPDATE social_accounts
                       SET access_token = $1, expires_at = $2, updated_at = NOW()
                       WHERE user_id = $3 AND platform = $4"#,
                )
                .bind(&refreshed.access_token)
                .bind(refreshed.expires_at)
                .bind(user_id)
                .bind(platform)
                .execute(pool)
                .await;

                return Ok(ValidToken {
                    access_token: refreshed.access_token,
                    expires_at: refreshed.expires_at,
                    metadata,
                    account_handle,
                });
            }
            Err(e) => {
                warn!("[MetaToken] Refresh échoué pour user={user_id}: {e:?}. On tente avec l'ancien token.");
                // On continue avec l'ancien token — peut encore marcher
            }
        }
    }

    Ok(ValidToken {
        access_token,
        expires_at,
        metadata,
        account_handle,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraction données depuis le metadata JSON stocké en base
// ─────────────────────────────────────────────────────────────────────────────

/// Extrait le premier page_id depuis le metadata Facebook stocké.
/// Le metadata contient `{ "pages": [{ "id": "...", "name": "...", "access_token": "..." }] }`
pub fn extract_first_page_id(metadata: &serde_json::Value) -> Option<String> {
    metadata
        .get("pages")
        .and_then(|p| p.as_array())
        .and_then(|arr| arr.first())
        .and_then(|p| p.get("id"))
        .and_then(|id| id.as_str())
        .map(str::to_string)
}

/// Extrait le page_access_token d'une page depuis le metadata.
pub fn extract_page_access_token(metadata: &serde_json::Value, page_id: &str) -> Option<String> {
    metadata
        .get("pages")
        .and_then(|p| p.as_array())
        .and_then(|arr| {
            arr.iter().find(|p| {
                p.get("id").and_then(|id| id.as_str()).map(|id| id == page_id).unwrap_or(false)
            })
        })
        .and_then(|p| p.get("access_token"))
        .and_then(|t| t.as_str())
        .map(str::to_string)
}

/// Extrait le catalog_id depuis le metadata (si l'utilisateur l'a renseigné)
pub fn extract_catalog_id(metadata: &serde_json::Value) -> Option<String> {
    metadata.get("catalog_id").and_then(|v| v.as_str()).map(str::to_string)
}

// ─────────────────────────────────────────────────────────────────────────────
// Types publics
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug)]
pub struct RefreshedToken {
    pub access_token: String,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug)]
pub struct ValidToken {
    pub access_token: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub metadata: serde_json::Value,
    pub account_handle: Option<String>,
}
