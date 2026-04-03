// Service de publication réelle sur Instagram Business via Graph API v19.0
//
// Flux obligatoire Instagram Content Publishing API :
//   Étape 1 → POST /{ig-user-id}/media          (crée un media container)
//   Étape 2 → GET  /{container-id}?fields=status_code  (attend FINISHED)
//   Étape 3 → POST /{ig-user-id}/media_publish   (publie le container)
//
// Prérequis :
//   - Compte Instagram BUSINESS (pas personnel)
//   - Lié à une Page Facebook
//   - Scope instagram_content_publish approuvé (Meta App Review)
//   - L'image doit être accessible depuis une URL HTTPS publique

use reqwest::Client;
use serde::Deserialize;
use tokio::time::{sleep, Duration};

use crate::core::types::{AppError, AppResult};

const GRAPH_BASE: &str = "https://graph.facebook.com/v19.0";
const MAX_STATUS_RETRIES: u32 = 15;
const STATUS_POLL_SECS: u64 = 4;

// ─────────────────────────────────────────────────────────────────────────────
// Publication d'une image produit
// ─────────────────────────────────────────────────────────────────────────────

/// Publie une image sur Instagram Business en 3 étapes.
/// Retourne le media_id Instagram du post publié.
///
/// ig_user_id : récupérable via `get_ig_business_account_id()`
/// image_url  : URL HTTPS publique accessible par les serveurs Meta
pub async fn publish_product_image(
    http: &Client,
    ig_user_id: &str,
    access_token: &str,
    image_url: &str,
    caption: &str,
) -> AppResult<String> {
    // 1. Créer le container
    let container_id =
        create_media_container(http, ig_user_id, access_token, image_url, caption).await?;

    // 2. Attendre que le traitement soit terminé côté Meta
    wait_until_ready(http, &container_id, access_token).await?;

    // 3. Publier
    let media_id = publish_container(http, ig_user_id, &container_id, access_token).await?;

    Ok(media_id)
}

async fn create_media_container(
    http: &Client,
    ig_user_id: &str,
    access_token: &str,
    image_url: &str,
    caption: &str,
) -> AppResult<String> {
    #[derive(Deserialize)]
    struct Resp {
        id: String,
    }

    let resp: Resp = http
        .post(format!("{}/{}/media", GRAPH_BASE, ig_user_id))
        .form(&[
            ("image_url", image_url),
            ("caption", caption),
            ("access_token", access_token),
        ])
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("[IG container] réseau: {e}")))?
        .error_for_status()
        .map_err(|e| {
            AppError::Internal(format!(
                "[IG container] HTTP: {e}. Vérifiez que instagram_content_publish est approuvé \
                 et que le compte Instagram est de type Business."
            ))
        })?
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("[IG container] parse: {e}")))?;

    Ok(resp.id)
}

async fn wait_until_ready(http: &Client, container_id: &str, access_token: &str) -> AppResult<()> {
    #[derive(Deserialize)]
    struct StatusResp {
        status_code: Option<String>,
    }

    for attempt in 0..MAX_STATUS_RETRIES {
        sleep(Duration::from_secs(STATUS_POLL_SECS)).await;

        let resp: StatusResp = http
            .get(format!("{}/{}", GRAPH_BASE, container_id))
            .query(&[("fields", "status_code"), ("access_token", access_token)])
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("[IG status] réseau: {e}")))?
            .json()
            .await
            .unwrap_or(StatusResp { status_code: None });

        match resp.status_code.as_deref() {
            Some("FINISHED") => return Ok(()),
            Some("IN_PROGRESS") => continue,
            Some("ERROR") => {
                return Err(AppError::Internal(
                    "[IG container] Traitement Meta échoué (status ERROR). \
                     Vérifiez que l'URL image est publiquement accessible."
                        .into(),
                ))
            }
            Some("EXPIRED") => {
                return Err(AppError::Internal(
                    "[IG container] Container expiré avant publication.".into(),
                ))
            }
            other => {
                if attempt == MAX_STATUS_RETRIES - 1 {
                    return Err(AppError::Internal(format!(
                        "[IG container] Timeout après {} tentatives. Statut: {:?}",
                        MAX_STATUS_RETRIES, other
                    )));
                }
            }
        }
    }

    Err(AppError::Internal(
        "[IG container] Timeout de publication.".into(),
    ))
}

async fn publish_container(
    http: &Client,
    ig_user_id: &str,
    container_id: &str,
    access_token: &str,
) -> AppResult<String> {
    #[derive(Deserialize)]
    struct Resp {
        id: String,
    }

    let resp: Resp = http
        .post(format!("{}/{}/media_publish", GRAPH_BASE, ig_user_id))
        .form(&[
            ("creation_id", container_id),
            ("access_token", access_token),
        ])
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("[IG publish] réseau: {e}")))?
        .error_for_status()
        .map_err(|e| AppError::Internal(format!("[IG publish] HTTP: {e}")))?
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("[IG publish] parse: {e}")))?;

    Ok(resp.id)
}

// ─────────────────────────────────────────────────────────────────────────────
// Récupération de l'IG Business Account ID
// ─────────────────────────────────────────────────────────────────────────────

/// Récupère l'id du compte Instagram Business lié à une Page Facebook.
/// Nécessite le page_access_token (pas le user token).
pub async fn get_ig_business_account_id(
    http: &Client,
    page_id: &str,
    page_access_token: &str,
) -> AppResult<Option<String>> {
    #[derive(Deserialize)]
    struct IgAccount {
        id: String,
    }
    #[derive(Deserialize)]
    struct PageResp {
        instagram_business_account: Option<IgAccount>,
    }

    let resp: PageResp = http
        .get(format!("{}/{}", GRAPH_BASE, page_id))
        .query(&[
            ("fields", "instagram_business_account"),
            ("access_token", page_access_token),
        ])
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("[IG account_id] réseau: {e}")))?
        .error_for_status()
        .map_err(|e| AppError::Internal(format!("[IG account_id] HTTP: {e}")))?
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("[IG account_id] parse: {e}")))?;

    Ok(resp.instagram_business_account.map(|a| a.id))
}

// ─────────────────────────────────────────────────────────────────────────────
// Carousel (optionnel — multi-images produit)
// ─────────────────────────────────────────────────────────────────────────────

/// Publie un carousel Instagram (plusieurs images pour un même produit).
/// Utile pour montrer plusieurs angles d'un produit.
pub async fn publish_carousel(
    http: &Client,
    ig_user_id: &str,
    access_token: &str,
    image_urls: &[&str],
    caption: &str,
) -> AppResult<String> {
    if image_urls.is_empty() {
        return Err(AppError::BadRequest("Au moins une image requise".into()));
    }
    if image_urls.len() == 1 {
        return publish_product_image(http, ig_user_id, access_token, image_urls[0], caption).await;
    }

    // Créer les containers individuels (sans légende — la légende est sur le carousel)
    let mut child_ids = Vec::with_capacity(image_urls.len());
    for url in image_urls.iter().take(10) {
        // Max 10 images par carousel Meta
        #[derive(Deserialize)]
        struct Resp {
            id: String,
        }
        let resp: Resp = http
            .post(format!("{}/{}/media", GRAPH_BASE, ig_user_id))
            .form(&[
                ("image_url", *url),
                ("is_carousel_item", "true"),
                ("access_token", access_token),
            ])
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("[IG carousel item] réseau: {e}")))?
            .error_for_status()
            .map_err(|e| AppError::Internal(format!("[IG carousel item] HTTP: {e}")))?
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("[IG carousel item] parse: {e}")))?;
        child_ids.push(resp.id);
    }

    // Créer le container carousel
    #[derive(Deserialize)]
    struct CarouselResp {
        id: String,
    }
    let children_str = child_ids.join(",");
    let carousel: CarouselResp = http
        .post(format!("{}/{}/media", GRAPH_BASE, ig_user_id))
        .form(&[
            ("media_type", "CAROUSEL"),
            ("children", &children_str),
            ("caption", caption),
            ("access_token", access_token),
        ])
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("[IG carousel] réseau: {e}")))?
        .error_for_status()
        .map_err(|e| AppError::Internal(format!("[IG carousel] HTTP: {e}")))?
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("[IG carousel] parse: {e}")))?;

    wait_until_ready(http, &carousel.id, access_token).await?;
    publish_container(http, ig_user_id, &carousel.id, access_token).await
}
