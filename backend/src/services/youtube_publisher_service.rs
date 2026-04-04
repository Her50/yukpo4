// YouTube Publisher Service — Yukpo
// Upload de vidéos, Shorts, gestion de playlists via YouTube Data API v3
//
// Auth : OAuth 2.0 (déjà configuré dans social_connector_controller.rs)
// Scopes requis : youtube.upload, youtube.force-ssl
//
// Variables : YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REDIRECT_URI
// Access Token utilisateur stocké dans social_accounts (platform = 'youtube')

use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::core::types::{AppError, AppResult};

const YT_API_BASE: &str = "https://www.googleapis.com/youtube/v3";
const YT_UPLOAD_BASE: &str = "https://www.googleapis.com/upload/youtube/v3";

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct VideoInsertResponse {
    id: String,
    snippet: Option<VideoSnippet>,
    status: Option<VideoStatus>,
}

#[derive(Debug, Deserialize)]
struct VideoSnippet {
    title: Option<String>,
    #[serde(rename = "channelId")]
    channel_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct VideoStatus {
    #[serde(rename = "uploadStatus")]
    upload_status: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PlaylistInsertResponse {
    id: String,
}

// ─── Upload vidéo ─────────────────────────────────────────────────────────────

/// Upload une vidéo YouTube depuis une URL publique.
/// Retourne le YouTube video_id (ex: "dQw4w9WgXcQ").
pub async fn upload_video(
    access_token: &str,
    video_url: &str,
    title: &str,
    description: &str,
) -> AppResult<String> {
    let client = Client::new();

    // 1. Télécharger la vidéo
    let video_bytes = client
        .get(video_url)
        .timeout(std::time::Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("[YouTube Upload] Download: {}", e)))?
        .bytes()
        .await
        .map_err(|e| AppError::Internal(format!("[YouTube Upload] Bytes: {}", e)))?;

    let video_size = video_bytes.len();

    // 2. Metadata de la vidéo
    let metadata = serde_json::json!({
        "snippet": {
            "title": truncate(title, 100),
            "description": truncate(description, 5000),
            "tags": extract_hashtags_as_tags(description),
            "categoryId": "22",  // 22 = People & Blogs (adapté commerce)
            "defaultLanguage": "fr",
        },
        "status": {
            "privacyStatus": "public",
            "selfDeclaredMadeForKids": false,
        }
    });

    // 3. Initier l'upload resumable
    let upload_url = init_resumable_upload(&client, access_token, &metadata, video_size).await?;

    // 4. Envoyer le contenu vidéo
    let video_id = send_video_bytes(&client, &upload_url, video_bytes.to_vec()).await?;

    log::info!("[YouTube] ✅ Vidéo uploadée — video_id={}", video_id);
    Ok(video_id)
}

/// Upload un YouTube Short (vidéo verticale < 60s).
/// Identique à upload_video mais avec le tag #Shorts dans le titre.
pub async fn upload_short(
    access_token: &str,
    video_url: &str,
    title: &str,
    description: &str,
) -> AppResult<String> {
    let shorts_title = if title.contains("#Shorts") {
        title.to_string()
    } else {
        format!("{} #Shorts", truncate(title, 95))
    };
    upload_video(access_token, video_url, &shorts_title, description).await
}

// ─── Upload resumable ─────────────────────────────────────────────────────────

/// Initie un upload resumable YouTube — retourne l'URL d'upload.
async fn init_resumable_upload(
    client: &Client,
    access_token: &str,
    metadata: &serde_json::Value,
    content_length: usize,
) -> AppResult<String> {
    let resp = client
        .post(format!(
            "{}/videos?uploadType=resumable&part=snippet,status",
            YT_UPLOAD_BASE
        ))
        .bearer_auth(access_token)
        .header("X-Upload-Content-Type", "video/*")
        .header("X-Upload-Content-Length", content_length.to_string())
        .header("Content-Type", "application/json; charset=UTF-8")
        .json(metadata)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("[YouTube Init] {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let txt = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "[YouTube Init] HTTP {}: {}. Vérifiez youtube.upload scope.",
            status, txt
        )));
    }

    // L'URL d'upload est dans le header Location
    let upload_url = resp
        .headers()
        .get("Location")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::Internal("[YouTube Init] Header Location manquant".into()))?
        .to_string();

    Ok(upload_url)
}

/// Envoie les bytes vidéo vers l'URL d'upload resumable.
async fn send_video_bytes(
    client: &Client,
    upload_url: &str,
    video_bytes: Vec<u8>,
) -> AppResult<String> {
    let content_length = video_bytes.len();

    let resp = client
        .put(upload_url)
        .header("Content-Type", "video/*")
        .header("Content-Length", content_length)
        .body(video_bytes)
        .timeout(std::time::Duration::from_secs(300)) // 5 min max
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("[YouTube Send] Réseau: {}", e)))?;

    if !resp.status().is_success() && resp.status().as_u16() != 201 {
        let status = resp.status();
        let txt = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "[YouTube Send] HTTP {}: {}",
            status, txt
        )));
    }

    let video: VideoInsertResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("[YouTube Send] Parse: {}", e)))?;

    Ok(video.id)
}

// ─── Gestion Playlists ────────────────────────────────────────────────────────

/// Crée une playlist YouTube.
pub async fn create_playlist(
    client: &Client,
    access_token: &str,
    title: &str,
    description: &str,
) -> AppResult<String> {
    let body = serde_json::json!({
        "snippet": {
            "title": truncate(title, 150),
            "description": truncate(description, 5000),
            "defaultLanguage": "fr"
        },
        "status": { "privacyStatus": "public" }
    });

    let resp = client
        .post(format!("{}/playlists?part=snippet,status", YT_API_BASE))
        .bearer_auth(access_token)
        .json(&body)
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("[YouTube Playlist] {}", e)))?;

    if !resp.status().is_success() {
        let txt = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!("[YouTube Playlist] {}", txt)));
    }

    let playlist: PlaylistInsertResponse =
        resp.json().await.map_err(|e| AppError::Internal(e.to_string()))?;

    Ok(playlist.id)
}

/// Ajoute une vidéo à une playlist existante.
pub async fn add_video_to_playlist(
    client: &Client,
    access_token: &str,
    playlist_id: &str,
    video_id: &str,
) -> AppResult<()> {
    let body = serde_json::json!({
        "snippet": {
            "playlistId": playlist_id,
            "resourceId": {
                "kind": "youtube#video",
                "videoId": video_id
            }
        }
    });

    let resp = client
        .post(format!("{}/playlistItems?part=snippet", YT_API_BASE))
        .bearer_auth(access_token)
        .json(&body)
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("[YouTube PlaylistItem] {}", e)))?;

    if !resp.status().is_success() {
        let txt = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "[YouTube PlaylistItem] {}",
            txt
        )));
    }

    Ok(())
}

// ─── Commentaires (chatbot) ───────────────────────────────────────────────────

/// Répond à un commentaire YouTube (community manager automatique)
pub async fn reply_to_comment(
    client: &Client,
    access_token: &str,
    parent_comment_id: &str,
    text: &str,
) -> AppResult<String> {
    let body = serde_json::json!({
        "snippet": {
            "parentId": parent_comment_id,
            "textOriginal": text
        }
    });

    let resp = client
        .post(format!("{}/comments?part=snippet", YT_API_BASE))
        .bearer_auth(access_token)
        .json(&body)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("[YouTube Comment] {}", e)))?;

    if !resp.status().is_success() {
        let txt = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!("[YouTube Comment] {}", txt)));
    }

    let data: serde_json::Value = resp.json().await.unwrap_or_default();
    Ok(data["id"].as_str().unwrap_or("").to_string())
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn truncate(text: &str, max: usize) -> &str {
    if text.len() <= max {
        text
    } else {
        &text[..max]
    }
}

/// Extrait les hashtags d'un texte pour les utiliser comme tags YouTube
fn extract_hashtags_as_tags(text: &str) -> Vec<String> {
    text.split_whitespace()
        .filter(|w| w.starts_with('#') && w.len() > 1)
        .map(|w| w.trim_start_matches('#').to_string())
        .take(15) // YouTube max 15 tags
        .collect()
}
