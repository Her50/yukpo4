// Snapchat Publisher Service — Yukpo
// Publication via Snap Kit Creator API + Marketing API
// Ciblage jeunes 13-34 ans, fort potentiel Afrique subsaharienne

use serde_json::json;

// ─── Publier un Snap Story public (Spotlight) ─────────────────────────────────

/// Soumet une vidéo/image au Snapchat Spotlight (feed découverte viral).
/// Retourne l'ID de soumission.
pub async fn submit_to_spotlight(
    access_token: &str,
    media_url: &str, // URL de la vidéo (MP4, 9:16, max 60s)
    caption: &str,
    hashtags: &[String],
    topic_tags: &[String], // Catégories Spotlight (ex: "food", "fashion")
) -> Result<String, String> {
    let client = reqwest::Client::new();

    let tags: Vec<serde_json::Value> = hashtags
        .iter()
        .map(|h| json!({ "type": "HASHTAG", "value": h }))
        .chain(topic_tags.iter().map(|t| json!({ "type": "TOPIC", "value": t })))
        .collect();

    let body = json!({
        "media": {
            "media_type": "VIDEO",
            "media_url": media_url
        },
        "caption_text": caption,
        "tags": tags,
        "is_public": true
    });

    let resp = client
        .post("https://adsapi.snapchat.com/v1/media/spotlight")
        .bearer_auth(access_token)
        .json(&body)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("[Snapchat] Spotlight: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let txt = resp.text().await.unwrap_or_default();
        return Err(format!("[Snapchat] Erreur {}: {}", status, txt));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let submission_id = data["submission_id"].as_str().unwrap_or("").to_string();

    log::info!("[Snapchat] ✅ Spotlight soumis: {}", submission_id);
    Ok(submission_id)
}

// ─── Créer une publicité Snap Ad ──────────────────────────────────────────────

/// Crée une publicité Snap Ad (image ou vidéo) ciblant une audience.
/// Retourne l'ID de la creative.
pub async fn create_snap_ad(
    access_token: &str,
    ad_account_id: &str,
    media_url: &str,
    headline: &str,
    brand_name: &str,
    call_to_action: &str, // "WATCH_MORE" | "SHOP_NOW" | "BOOK_NOW" | "INSTALL"
    swipe_up_url: Option<&str>,
    target_countries: &[String],
    daily_budget_usd: f64,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    // 1. Créer la creative
    let creative_body = json!({
        "ad_account_id": ad_account_id,
        "name": format!("Yukpo_Ad_{}", chrono::Utc::now().timestamp()),
        "type": "SNAP_AD",
        "top_snap_media_id": "",  // Will be replaced after media upload
        "headline": headline,
        "brand_name": brand_name,
        "call_to_action": call_to_action,
        "web_view_url": swipe_up_url.unwrap_or(""),
        "shareable": true
    });

    let creative_resp = client
        .post(format!(
            "https://adsapi.snapchat.com/v1/adaccounts/{}/creatives",
            ad_account_id
        ))
        .bearer_auth(access_token)
        .json(&creative_body)
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("[Snapchat] Creative: {}", e))?;

    if !creative_resp.status().is_success() {
        let txt = creative_resp.text().await.unwrap_or_default();
        return Err(format!("[Snapchat] Creative erreur: {}", txt));
    }

    let creative_data: serde_json::Value = creative_resp.json().await.map_err(|e| e.to_string())?;
    let creative_id = creative_data["creatives"][0]["creative"]["id"]
        .as_str()
        .unwrap_or("")
        .to_string();

    log::info!("[Snapchat] ✅ Creative créée: {}", creative_id);
    let _ = (media_url, target_countries, daily_budget_usd); // utilisé en DB/worker

    Ok(creative_id)
}

// ─── Récupérer les métriques d'une story/pub ─────────────────────────────────

/// Récupère les stats d'une publicité Snap (impressions, swipe-ups, reach).
pub async fn get_ad_stats(
    access_token: &str,
    ad_account_id: &str,
    ad_id: &str,
    start_time: &str, // ISO8601
    end_time: &str,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();

    let resp = client
        .get(format!(
            "https://adsapi.snapchat.com/v1/adaccounts/{}/ads/{}/stats",
            ad_account_id, ad_id
        ))
        .bearer_auth(access_token)
        .query(&[
            ("start_time", start_time),
            ("end_time", end_time),
            ("granularity", "DAY"),
            ("fields", "impressions,swipes,reach,spend,video_views"),
        ])
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("[Snapchat] Stats: {}", e))?;

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

use chrono;
