// LinkedIn Publisher Service — Yukpo
// Publication sur LinkedIn via Marketing API (OAuth 2.0, ugcPosts endpoint)
// Supporte : posts texte, posts avec image, articles natifs, reshares

use serde_json::json;

// ─── Types ────────────────────────────────────────────────────────────────────

pub struct LinkedInPost {
    pub text: String,
    pub image_url: Option<String>,
    pub title: Option<String>,       // Pour les articles natifs
    pub article_url: Option<String>, // URL cible pour les link posts
}

// ─── Publication post texte / image ──────────────────────────────────────────

/// Publie un post LinkedIn (texte seul ou avec image).
/// Retourne l'URN du post créé ("urn:li:share:XXXXXX").
pub async fn publish_post(
    access_token: &str,
    person_urn: &str, // "urn:li:person:XXXXXX" ou "urn:li:organization:XXXXXX"
    post: &LinkedInPost,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    // Étape 1 : upload image si présente
    let media_urn = if let Some(ref img_url) = post.image_url {
        Some(upload_image(&client, access_token, person_urn, img_url).await?)
    } else {
        None
    };

    // Étape 2 : créer le post ugcPost
    let mut share_media_category = "NONE";
    let mut specific_content = json!({
        "com.linkedin.ugc.ShareContent": {
            "shareCommentary": { "text": post.text },
            "shareMediaCategory": "NONE"
        }
    });

    if let Some(ref urn) = media_urn {
        share_media_category = "IMAGE";
        specific_content = json!({
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": { "text": post.text },
                "shareMediaCategory": "IMAGE",
                "media": [{
                    "status": "READY",
                    "media": urn
                }]
            }
        });
    } else if let Some(ref url) = post.article_url {
        share_media_category = "ARTICLE";
        specific_content = json!({
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": { "text": post.text },
                "shareMediaCategory": "ARTICLE",
                "media": [{
                    "status": "READY",
                    "originalUrl": url,
                    "title": { "text": post.title.as_deref().unwrap_or("") }
                }]
            }
        });
    }
    let _ = share_media_category; // utilisé via json macro seulement

    let body = json!({
        "author": person_urn,
        "lifecycleState": "PUBLISHED",
        "specificContent": specific_content,
        "visibility": {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
        }
    });

    let resp = client
        .post("https://api.linkedin.com/v2/ugcPosts")
        .bearer_auth(access_token)
        .header("X-Restli-Protocol-Version", "2.0.0")
        .json(&body)
        .timeout(std::time::Duration::from_secs(20))
        .send()
        .await
        .map_err(|e| format!("[LinkedIn] Réseau: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let txt = resp.text().await.unwrap_or_default();
        return Err(format!("[LinkedIn] Erreur {}: {}", status, txt));
    }

    // L'ID du post est dans le header "X-RestLi-Id"
    let post_id = resp
        .headers()
        .get("X-RestLi-Id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown")
        .to_string();

    log::info!("[LinkedIn] ✅ Post publié: {}", post_id);
    Ok(post_id)
}

// ─── Upload image ─────────────────────────────────────────────────────────────

async fn upload_image(
    client: &reqwest::Client,
    access_token: &str,
    person_urn: &str,
    image_url: &str,
) -> Result<String, String> {
    // Étape 1 : Register upload
    let register_body = json!({
        "registerUploadRequest": {
            "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
            "owner": person_urn,
            "serviceRelationships": [{
                "relationshipType": "OWNER",
                "identifier": "urn:li:userGeneratedContent"
            }]
        }
    });

    let register_resp = client
        .post("https://api.linkedin.com/v2/assets?action=registerUpload")
        .bearer_auth(access_token)
        .json(&register_body)
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("[LinkedIn] Register upload: {}", e))?;

    let register_data: serde_json::Value = register_resp
        .json()
        .await
        .map_err(|e| format!("[LinkedIn] Parse register: {}", e))?;

    let asset_urn = register_data["value"]["asset"]
        .as_str()
        .ok_or("[LinkedIn] Asset URN manquant")?
        .to_string();

    let upload_url = register_data["value"]["uploadMechanism"]
        ["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]["uploadUrl"]
        .as_str()
        .ok_or("[LinkedIn] Upload URL manquante")?
        .to_string();

    // Étape 2 : Télécharger l'image depuis l'URL externe
    let img_bytes = client
        .get(image_url)
        .timeout(std::time::Duration::from_secs(20))
        .send()
        .await
        .map_err(|e| format!("[LinkedIn] Téléchargement image: {}", e))?
        .bytes()
        .await
        .map_err(|e| format!("[LinkedIn] Lecture image: {}", e))?;

    // Étape 3 : Upload vers LinkedIn
    client
        .put(&upload_url)
        .bearer_auth(access_token)
        .header("Content-Type", "application/octet-stream")
        .body(img_bytes)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("[LinkedIn] Upload binaire: {}", e))?;

    Ok(asset_urn)
}

// ─── Reply à un commentaire ───────────────────────────────────────────────────

/// Répond à un commentaire LinkedIn (community manager)
pub async fn reply_to_comment(
    access_token: &str,
    post_urn: &str,
    comment_urn: &str,
    reply_text: &str,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    let body = json!({
        "actor": post_urn,  // URN de l'auteur (person ou organization)
        "message": { "text": reply_text },
        "parentComment": comment_urn
    });

    let resp = client
        .post(format!(
            "https://api.linkedin.com/v2/socialActions/{}/comments",
            urlencoding(post_urn)
        ))
        .bearer_auth(access_token)
        .header("X-Restli-Protocol-Version", "2.0.0")
        .json(&body)
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("[LinkedIn] Reply: {}", e))?;

    if !resp.status().is_success() {
        let txt = resp.text().await.unwrap_or_default();
        return Err(format!("[LinkedIn] Reply erreur: {}", txt));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(data["id"].as_str().unwrap_or("").to_string())
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn urlencoding(s: &str) -> String {
    s.replace(':', "%3A").replace('/', "%2F")
}
