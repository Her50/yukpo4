// Longform Publisher Service — Yukpo
// Publication vers WordPress REST API, Mailchimp Campaigns, Ghost Admin API.
// Credentials stockés chiffrés dans longform_publish_targets.

use serde_json::{json, Value};

// ─── Structures ────────────────────────────────────────────────────────────────

pub struct PublishTarget {
    pub id: i32,
    pub platform: String, // "wordpress" | "mailchimp" | "ghost"
    pub site_url: Option<String>,
    pub api_key: Option<String>,
    pub username: Option<String>,
    pub list_id: Option<String>,   // Mailchimp audience ID
    pub author_id: Option<String>, // Ghost author ID
}

pub struct ArticlePayload {
    pub title: String,
    pub content: String, // HTML ou Markdown
    pub excerpt: Option<String>,
    pub tags: Vec<String>,
    pub featured_image_url: Option<String>,
    pub status: String,               // "draft" | "publish"
    pub subject_line: Option<String>, // Mailchimp
}

pub struct PublishResult {
    pub platform: String,
    pub external_id: String,
    pub url: Option<String>,
}

// ─── WordPress REST API v2 ────────────────────────────────────────────────────

pub async fn publish_to_wordpress(
    target: &PublishTarget,
    article: &ArticlePayload,
) -> Result<PublishResult, String> {
    let site_url = target.site_url.as_deref().ok_or("WordPress: site_url manquant")?;
    let username = target.username.as_deref().ok_or("WordPress: username manquant")?;
    let api_key = target
        .api_key
        .as_deref()
        .ok_or("WordPress: api_key (mot de passe applicatif) manquant")?;

    let client = reqwest::Client::new();

    // Corps du post WordPress
    let mut body = json!({
        "title": article.title,
        "content": article.content,
        "status": if article.status == "publish" { "publish" } else { "draft" },
        "tags": article.tags,
    });

    if let Some(excerpt) = &article.excerpt {
        body["excerpt"] = json!(excerpt);
    }
    if let Some(img_url) = &article.featured_image_url {
        // Upload l'image en tant que media WordPress puis attacher
        if let Ok(media_id) =
            upload_wordpress_media(&client, site_url, username, api_key, img_url).await
        {
            body["featured_media"] = json!(media_id);
        }
    }

    let endpoint = format!("{}/wp-json/wp/v2/posts", site_url.trim_end_matches('/'));

    let resp = client
        .post(&endpoint)
        .basic_auth(username, Some(api_key))
        .json(&body)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("[WordPress] Réseau: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let txt = resp.text().await.unwrap_or_default();
        return Err(format!("[WordPress] Erreur {}: {}", status, txt));
    }

    let data: Value = resp.json().await.map_err(|e| e.to_string())?;
    let post_id = data["id"].as_i64().unwrap_or(0).to_string();
    let link = data["link"].as_str().map(|s| s.to_string());

    log::info!("[WordPress] ✅ Article publié id={}", post_id);
    Ok(PublishResult {
        platform: "wordpress".to_string(),
        external_id: post_id,
        url: link,
    })
}

async fn upload_wordpress_media(
    client: &reqwest::Client,
    site_url: &str,
    username: &str,
    api_key: &str,
    image_url: &str,
) -> Result<i64, String> {
    // Télécharger l'image depuis l'URL
    let img_bytes = client
        .get(image_url)
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    let filename = format!("yukpo-{}.jpg", chrono::Utc::now().timestamp());
    let endpoint = format!("{}/wp-json/wp/v2/media", site_url.trim_end_matches('/'));

    let part = reqwest::multipart::Part::bytes(img_bytes.to_vec())
        .file_name(filename.clone())
        .mime_str("image/jpeg")
        .map_err(|e| e.to_string())?;
    let form = reqwest::multipart::Form::new().part("file", part);

    let resp = client
        .post(&endpoint)
        .basic_auth(username, Some(api_key))
        .multipart(form)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let data: Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(data["id"].as_i64().unwrap_or(0))
}

// ─── Mailchimp Campaigns API v3 ───────────────────────────────────────────────

pub async fn publish_to_mailchimp(
    target: &PublishTarget,
    article: &ArticlePayload,
) -> Result<PublishResult, String> {
    let api_key = target.api_key.as_deref().ok_or("Mailchimp: api_key manquant")?;
    let list_id = target.list_id.as_deref().ok_or("Mailchimp: list_id (audience ID) manquant")?;

    // Extraire le datacenter depuis la clé API (ex: "abc123-us6" → "us6")
    let dc = api_key.split('-').last().unwrap_or("us1");
    let base_url = format!("https://{}.api.mailchimp.com/3.0", dc);

    let client = reqwest::Client::new();
    let subject = article.subject_line.as_deref().unwrap_or(&article.title);

    // 1. Créer la campagne
    let campaign_body = json!({
        "type": "regular",
        "recipients": { "list_id": list_id },
        "settings": {
            "subject_line": subject,
            "title": article.title,
            "from_name": "Yukpo",
            "reply_to": "noreply@yukpo.com",
        }
    });

    let campaign_resp = client
        .post(format!("{}/campaigns", base_url))
        .basic_auth("anystring", Some(api_key))
        .json(&campaign_body)
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("[Mailchimp] Réseau: {}", e))?;

    if !campaign_resp.status().is_success() {
        let txt = campaign_resp.text().await.unwrap_or_default();
        return Err(format!("[Mailchimp] Création campagne: {}", txt));
    }

    let campaign_data: Value = campaign_resp.json().await.map_err(|e| e.to_string())?;
    let campaign_id = campaign_data["id"].as_str().unwrap_or("").to_string();

    // 2. Ajouter le contenu HTML
    let content_body = json!({ "html": article.content });
    let _ = client
        .put(format!("{}/campaigns/{}/content", base_url, campaign_id))
        .basic_auth("anystring", Some(api_key))
        .json(&content_body)
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await;

    // 3. Envoyer si status = publish, sinon laisser en draft
    let archive_url = if article.status == "publish" {
        let send_resp = client
            .post(format!(
                "{}/campaigns/{}/actions/send",
                base_url, campaign_id
            ))
            .basic_auth("anystring", Some(api_key))
            .timeout(std::time::Duration::from_secs(15))
            .send()
            .await;

        if let Ok(r) = send_resp {
            log::info!("[Mailchimp] ✅ Campagne envoyée: {}", campaign_id);
            let _ = r;
        }
        campaign_data["archive_url"].as_str().map(|s| s.to_string())
    } else {
        None
    };

    Ok(PublishResult {
        platform: "mailchimp".to_string(),
        external_id: campaign_id,
        url: archive_url,
    })
}

// ─── Ghost Admin API v3 ───────────────────────────────────────────────────────

pub async fn publish_to_ghost(
    target: &PublishTarget,
    article: &ArticlePayload,
) -> Result<PublishResult, String> {
    let site_url = target.site_url.as_deref().ok_or("Ghost: site_url manquant")?;
    let api_key = target.api_key.as_deref().ok_or("Ghost: api_key manquant")?;

    // Ghost Admin API key format: "id:secret"
    let (key_id, key_secret) = api_key
        .split_once(':')
        .ok_or("Ghost: api_key doit être au format 'id:secret'")?;

    // Générer JWT pour Ghost Admin API
    let token = generate_ghost_jwt(key_id, key_secret)?;

    let client = reqwest::Client::new();
    let endpoint = format!("{}/ghost/api/admin/posts/", site_url.trim_end_matches('/'));

    let mut post = json!({
        "title": article.title,
        "html": article.content,
        "status": if article.status == "publish" { "published" } else { "draft" },
        "tags": article.tags.iter().map(|t| json!({ "name": t })).collect::<Vec<_>>(),
    });

    if let Some(excerpt) = &article.excerpt {
        post["custom_excerpt"] = json!(excerpt);
    }
    if let Some(img_url) = &article.featured_image_url {
        post["feature_image"] = json!(img_url);
    }
    if let Some(author_id) = &target.author_id {
        post["authors"] = json!([{ "id": author_id }]);
    }

    let body = json!({ "posts": [post] });

    let resp = client
        .post(&endpoint)
        .header("Authorization", format!("Ghost {}", token))
        .json(&body)
        .timeout(std::time::Duration::from_secs(20))
        .send()
        .await
        .map_err(|e| format!("[Ghost] Réseau: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let txt = resp.text().await.unwrap_or_default();
        return Err(format!("[Ghost] Erreur {}: {}", status, txt));
    }

    let data: Value = resp.json().await.map_err(|e| e.to_string())?;
    let post_data = &data["posts"][0];
    let post_id = post_data["id"].as_str().unwrap_or("").to_string();
    let url = post_data["url"].as_str().map(|s| s.to_string());

    log::info!("[Ghost] ✅ Article publié id={}", post_id);
    Ok(PublishResult {
        platform: "ghost".to_string(),
        external_id: post_id,
        url,
    })
}

/// Génère un JWT signé avec HMAC-SHA256 pour Ghost Admin API.
fn generate_ghost_jwt(key_id: &str, key_secret: &str) -> Result<String, String> {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
    use hmac::{Hmac, Mac};
    use sha2::Sha256;

    let header = URL_SAFE_NO_PAD.encode(
        serde_json::to_string(&json!({ "alg": "HS256", "kid": key_id, "typ": "JWT" }))
            .unwrap()
            .as_bytes(),
    );

    let now = chrono::Utc::now().timestamp();
    let payload = URL_SAFE_NO_PAD.encode(
        serde_json::to_string(&json!({
            "iat": now,
            "exp": now + 300,
            "aud": "/admin/"
        }))
        .unwrap()
        .as_bytes(),
    );

    let signing_input = format!("{}.{}", header, payload);

    // Décoder la clé hex
    let key_bytes = (0..key_secret.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&key_secret[i..i + 2], 16))
        .collect::<Result<Vec<u8>, _>>()
        .map_err(|e| format!("Ghost JWT key decode: {}", e))?;

    let mut mac =
        Hmac::<Sha256>::new_from_slice(&key_bytes).map_err(|e| format!("Ghost JWT HMAC: {}", e))?;
    mac.update(signing_input.as_bytes());
    let signature = URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes());

    Ok(format!("{}.{}.{}", header, payload, signature))
}

use chrono;
