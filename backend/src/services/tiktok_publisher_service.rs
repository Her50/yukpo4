// TikTok Publisher Service — Yukpo
// Publication de vidéos TikTok via TikTok for Business API / Creator API
//
// Auth : OAuth 2.0 PKCE — TikTok Login Kit
// Permissions : video.publish, video.upload
//
// Prérequis TikTok Developers (developers.tiktok.com) :
//   - App approuvée avec permissions video.publish
//   - Variables : TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET
//   - Access token par utilisateur (durée 24h, refresh 30j)
//
// IMPORTANT : TikTok interdit la publication programmée via API sans revue.
// Yukpo doit soumettre une demande d'accès Content Posting API.

use reqwest::Client;
use serde::Deserialize;

use crate::core::types::{AppError, AppResult};

const TIKTOK_API_BASE: &str = "https://open.tiktokapis.com/v2";

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct TikTokApiResponse<T> {
    data: Option<T>,
    error: Option<TikTokError>,
}

#[derive(Debug, Deserialize)]
struct TikTokError {
    code: String,
    message: String,
}

#[derive(Debug, Deserialize)]
struct InitUploadData {
    publish_id: String,
    #[allow(dead_code)]
    upload_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PublishStatusData {
    status: String, // PROCESSING_UPLOAD | PUBLISH_COMPLETE | FAILED
    fail_reason: Option<String>,
    published_id: Option<String>,
}

// ─── Publication vidéo ────────────────────────────────────────────────────────

/// Publie une vidéo sur TikTok depuis une URL accessible publiquement.
/// Retourne le `published_id` TikTok.
pub async fn publish_video(
    http: &Client,
    access_token: &str,
    video_url: &str,
    caption: &str,
) -> AppResult<String> {
    // 1. Initialiser l'upload (URL pull)
    let publish_id = init_video_upload(http, access_token, video_url, caption).await?;

    // 2. Attendre la confirmation de publication (polling max 30s)
    let published_id = wait_for_publish(http, access_token, &publish_id).await?;

    log::info!("[TikTok] ✅ Vidéo publiée — published_id={}", published_id);
    Ok(published_id)
}

/// Publie une vidéo courte (Short/Reel) — même flow mais avec hashtags
pub async fn publish_short(
    http: &Client,
    access_token: &str,
    video_url: &str,
    caption: &str,
    hashtags: &[String],
) -> AppResult<String> {
    let hashtag_str = hashtags
        .iter()
        .map(|h| format!("#{}", h.trim_start_matches('#')))
        .collect::<Vec<_>>()
        .join(" ");
    let full_caption = if hashtag_str.is_empty() {
        caption.to_string()
    } else {
        format!("{}\n\n{}", caption, hashtag_str)
    };

    publish_video(http, access_token, video_url, &full_caption).await
}

// ─── Étapes d'upload TikTok ───────────────────────────────────────────────────

/// Étape 1 : Initialise l'upload via "URL pull"
/// TikTok télécharge lui-même la vidéo depuis notre URL.
async fn init_video_upload(
    http: &Client,
    access_token: &str,
    video_url: &str,
    caption: &str,
) -> AppResult<String> {
    let caption_truncated = if caption.len() > 2200 {
        &caption[..2200]
    } else {
        caption
    };

    let body = serde_json::json!({
        "post_info": {
            "title": caption_truncated,
            "privacy_level": "PUBLIC_TO_EVERYONE",
            "disable_duet": false,
            "disable_comment": false,
            "disable_stitch": false,
            "video_cover_timestamp_ms": 1000
        },
        "source_info": {
            "source": "PULL_FROM_URL",
            "video_url": video_url
        }
    });

    let resp = http
        .post(format!("{}/post/publish/video/init/", TIKTOK_API_BASE))
        .bearer_auth(access_token)
        .header("Content-Type", "application/json; charset=UTF-8")
        .json(&body)
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("[TikTok Init] Réseau: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let txt = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "[TikTok Init] HTTP {}: {}",
            status, txt
        )));
    }

    let data: TikTokApiResponse<InitUploadData> = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("[TikTok Init] Parse: {}", e)))?;

    if let Some(err) = data.error {
        if err.code != "ok" {
            return Err(AppError::Internal(format!(
                "[TikTok Init] API Error {}: {}",
                err.code, err.message
            )));
        }
    }

    let publish_id = data
        .data
        .ok_or_else(|| AppError::Internal("[TikTok Init] publish_id manquant".into()))?
        .publish_id;

    Ok(publish_id)
}

/// Étape 2 : Polling du statut jusqu'à PUBLISH_COMPLETE ou FAILED
async fn wait_for_publish(
    http: &Client,
    access_token: &str,
    publish_id: &str,
) -> AppResult<String> {
    let body = serde_json::json!({ "publish_id": publish_id });

    for attempt in 0..12 {
        tokio::time::sleep(std::time::Duration::from_secs(5)).await;

        let resp = http
            .post(format!("{}/post/publish/status/fetch/", TIKTOK_API_BASE))
            .bearer_auth(access_token)
            .json(&body)
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await;

        match resp {
            Ok(r) if r.status().is_success() => {
                if let Ok(data) = r.json::<TikTokApiResponse<PublishStatusData>>().await {
                    if let Some(status_data) = data.data {
                        match status_data.status.as_str() {
                            "PUBLISH_COMPLETE" => {
                                return Ok(status_data
                                    .published_id
                                    .unwrap_or_else(|| publish_id.to_string()));
                            }
                            "FAILED" => {
                                return Err(AppError::Internal(format!(
                                    "[TikTok Publish] Échec publication: {}",
                                    status_data
                                        .fail_reason
                                        .unwrap_or_else(|| "raison inconnue".to_string())
                                )));
                            }
                            _ => {
                                log::debug!(
                                    "[TikTok Publish] Tentative {}/12 — statut: {}",
                                    attempt + 1,
                                    status_data.status
                                );
                            }
                        }
                    }
                }
            }
            _ => {}
        }
    }

    // Timeout après ~60s : retourner le publish_id comme ID provisoire
    log::warn!(
        "[TikTok Publish] Timeout polling — publish_id={}",
        publish_id
    );
    Ok(publish_id.to_string())
}

// ─── Commentaires (chatbot) ───────────────────────────────────────────────────

/// Répond à un commentaire TikTok (pour le chatbot community manager)
pub async fn reply_to_comment(
    http: &Client,
    access_token: &str,
    video_id: &str,
    comment_id: &str,
    text: &str,
) -> AppResult<String> {
    let body = serde_json::json!({
        "video_id": video_id,
        "text": text,
        "comment_id": comment_id
    });

    let resp = http
        .post(format!("{}/comment/publish/", TIKTOK_API_BASE))
        .bearer_auth(access_token)
        .json(&body)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("[TikTok Comment] {}", e)))?;

    if !resp.status().is_success() {
        let txt = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!("[TikTok Comment] {}", txt)));
    }

    let data: serde_json::Value = resp.json().await.unwrap_or_default();
    let comment_id_resp = data["data"]["comment_id"].as_str().unwrap_or("").to_string();

    Ok(comment_id_resp)
}
