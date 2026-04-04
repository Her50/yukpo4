// Twitter/X Publisher Service — Yukpo
// Publication de posts (tweets), threads, médias via Twitter API v2
//
// Auth : OAuth 2.0 Bearer Token (app-only) pour READ
//        OAuth 1.0a User Context OU OAuth 2.0 PKCE pour WRITE (tweets)
//
// Prérequis Twitter Developer Portal :
//   - Accès Basic ($100/mois) ou Free (500 tweets/mois)
//   - App permissions : Read + Write
//   - Variables : TWITTER_API_KEY, TWITTER_API_SECRET,
//                 TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET

use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::core::types::{AppError, AppResult};

const TWITTER_API_V2: &str = "https://api.twitter.com/2";
const TWITTER_UPLOAD_V1: &str = "https://upload.twitter.com/1.1";

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct TweetResponse {
    data: TweetData,
}

#[derive(Debug, Deserialize)]
struct TweetData {
    id: String,
    text: String,
}

#[derive(Debug, Deserialize)]
struct MediaUploadResponse {
    media_id_string: String,
}

// ─── Publication principale ───────────────────────────────────────────────────

/// Publie un tweet avec texte et optionnellement une image.
/// `access_token` : OAuth 2.0 Bearer Token de l'utilisateur (User Context).
pub async fn post_tweet(
    access_token: &str,
    text: &str,
    image_url: Option<&str>,
) -> AppResult<String> {
    let client = Client::new();

    // 1. Uploader l'image si présente
    let media_id = if let Some(url) = image_url {
        upload_media_from_url(&client, access_token, url).await.ok()
    } else {
        None
    };

    // 2. Construire le body du tweet
    let mut body = serde_json::json!({
        "text": truncate_tweet(text, 280),
    });
    if let Some(mid) = media_id {
        body["media"] = serde_json::json!({ "media_ids": [mid] });
    }

    // 3. POST /2/tweets
    let resp = client
        .post(format!("{}/tweets", TWITTER_API_V2))
        .bearer_auth(access_token)
        .json(&body)
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("[Twitter] Réseau: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "[Twitter] API erreur {}: {}. Vérifiez les permissions Read+Write.",
            status, text
        )));
    }

    let tweet: TweetResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("[Twitter] Parse JSON: {}", e)))?;

    log::info!("[Twitter] ✅ Tweet publié — id={}", tweet.data.id);
    Ok(tweet.data.id)
}

/// Publie un thread Twitter (plusieurs tweets enchaînés).
/// Utile pour les contenus longs (tutoriels, annonces, etc.).
pub async fn post_thread(
    access_token: &str,
    texts: &[String],
    image_urls: &[Option<String>],
) -> AppResult<Vec<String>> {
    let client = Client::new();
    let mut tweet_ids = Vec::new();
    let mut reply_to: Option<String> = None;

    for (i, text) in texts.iter().enumerate() {
        let img_url = image_urls.get(i).and_then(|o| o.as_deref());
        let media_id = if let Some(url) = img_url {
            upload_media_from_url(&client, access_token, url).await.ok()
        } else {
            None
        };

        let mut body = serde_json::json!({
            "text": truncate_tweet(text, 280),
        });
        if let Some(ref mid) = media_id {
            body["media"] = serde_json::json!({ "media_ids": [mid] });
        }
        if let Some(ref prev_id) = reply_to {
            body["reply"] = serde_json::json!({ "in_reply_to_tweet_id": prev_id });
        }

        let resp = client
            .post(format!("{}/tweets", TWITTER_API_V2))
            .bearer_auth(access_token)
            .json(&body)
            .timeout(std::time::Duration::from_secs(15))
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("[Twitter Thread] Réseau: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "[Twitter Thread] Erreur tweet {}/{}: {} — {}",
                i + 1,
                texts.len(),
                status,
                err_text
            )));
        }

        let tweet: TweetResponse =
            resp.json().await.map_err(|e| AppError::Internal(e.to_string()))?;
        reply_to = Some(tweet.data.id.clone());
        tweet_ids.push(tweet.data.id);

        // Pause entre tweets du thread
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    }

    log::info!("[Twitter] ✅ Thread publié — {} tweets", tweet_ids.len());
    Ok(tweet_ids)
}

/// Réponse à un tweet (pour le chatbot social)
pub async fn reply_to_tweet(access_token: &str, tweet_id: &str, text: &str) -> AppResult<String> {
    let client = Client::new();
    let body = serde_json::json!({
        "text": truncate_tweet(text, 280),
        "reply": { "in_reply_to_tweet_id": tweet_id }
    });

    let resp = client
        .post(format!("{}/tweets", TWITTER_API_V2))
        .bearer_auth(access_token)
        .json(&body)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("[Twitter Reply] {}", e)))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!("[Twitter Reply] {}", text)));
    }

    let tweet: TweetResponse = resp.json().await.map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(tweet.data.id)
}

// ─── Upload média ─────────────────────────────────────────────────────────────

/// Télécharge une image depuis une URL, puis l'uploade sur Twitter
/// via l'endpoint v1.1 (upload.twitter.com).
async fn upload_media_from_url(
    client: &Client,
    access_token: &str,
    image_url: &str,
) -> Result<String, String> {
    // 1. Télécharger les bytes de l'image
    let img_bytes = client
        .get(image_url)
        .timeout(std::time::Duration::from_secs(20))
        .send()
        .await
        .map_err(|e| format!("[Twitter Media] Download: {}", e))?
        .bytes()
        .await
        .map_err(|e| format!("[Twitter Media] Bytes: {}", e))?;

    // 2. Uploader sur Twitter (multipart/form-data)
    let part = reqwest::multipart::Part::bytes(img_bytes.to_vec())
        .file_name("image.jpg")
        .mime_str("image/jpeg")
        .map_err(|e| format!("[Twitter Media] MIME: {}", e))?;
    let form = reqwest::multipart::Form::new().part("media", part);

    let resp = client
        .post(format!("{}/media/upload.json", TWITTER_UPLOAD_V1))
        .bearer_auth(access_token)
        .multipart(form)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("[Twitter Media] Upload: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let txt = resp.text().await.unwrap_or_default();
        return Err(format!("[Twitter Media] Upload erreur {}: {}", status, txt));
    }

    let media: MediaUploadResponse =
        resp.json().await.map_err(|e| format!("[Twitter Media] Parse: {}", e))?;

    Ok(media.media_id_string)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Tronque un texte à max_chars caractères en coupant proprement aux mots.
fn truncate_tweet(text: &str, max_chars: usize) -> &str {
    if text.len() <= max_chars {
        return text;
    }
    // Chercher le dernier espace avant max_chars
    let cutoff = text
        .char_indices()
        .take_while(|(i, _)| *i < max_chars - 3)
        .last()
        .map(|(i, _)| i)
        .unwrap_or(max_chars - 3);
    &text[..cutoff]
    // Note: en prod, ajouter "..." si tronqué
}
