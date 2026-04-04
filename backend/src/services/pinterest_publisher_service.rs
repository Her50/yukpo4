// Pinterest Publisher Service — Yukpo
// Publication de Pins via Pinterest API v5
// Forte démographie féminine, idéal mode/beauté/food/maison

use serde_json::json;

// ─── Créer un Pin ─────────────────────────────────────────────────────────────

/// Publie un Pin Pinterest avec image et lien produit.
/// Retourne l'ID du pin créé.
pub async fn create_pin(
    access_token: &str,
    board_id: &str,
    title: &str,
    description: &str,
    image_url: &str,
    link_url: Option<&str>,
    alt_text: Option<&str>,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    let mut media = json!({
        "source_type": "image_url",
        "url": image_url
    });

    if let Some(alt) = alt_text {
        media["alt_text"] = json!(alt);
    }

    let mut body = json!({
        "board_id": board_id,
        "title": title,
        "description": description,
        "media": media
    });

    if let Some(url) = link_url {
        body["link"] = json!(url);
    }

    let resp = client
        .post("https://api.pinterest.com/v5/pins")
        .bearer_auth(access_token)
        .json(&body)
        .timeout(std::time::Duration::from_secs(20))
        .send()
        .await
        .map_err(|e| format!("[Pinterest] Réseau: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let txt = resp.text().await.unwrap_or_default();
        return Err(format!("[Pinterest] Erreur {}: {}", status, txt));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let pin_id = data["id"].as_str().unwrap_or("").to_string();

    log::info!("[Pinterest] ✅ Pin créé: {}", pin_id);
    Ok(pin_id)
}

// ─── Créer un tableau (board) ─────────────────────────────────────────────────

/// Crée un nouveau tableau Pinterest pour un partenaire.
pub async fn create_board(
    access_token: &str,
    name: &str,
    description: Option<&str>,
    privacy: &str, // "PUBLIC" | "PROTECTED" | "SECRET"
) -> Result<String, String> {
    let client = reqwest::Client::new();

    let body = json!({
        "name": name,
        "description": description.unwrap_or(""),
        "privacy": privacy
    });

    let resp = client
        .post("https://api.pinterest.com/v5/boards")
        .bearer_auth(access_token)
        .json(&body)
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("[Pinterest] Board: {}", e))?;

    if !resp.status().is_success() {
        let txt = resp.text().await.unwrap_or_default();
        return Err(format!("[Pinterest] Board erreur: {}", txt));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(data["id"].as_str().unwrap_or("").to_string())
}

// ─── Lister les boards ────────────────────────────────────────────────────────

/// Récupère la liste des boards du compte Pinterest connecté.
pub async fn list_boards(access_token: &str) -> Result<Vec<serde_json::Value>, String> {
    let client = reqwest::Client::new();

    let resp = client
        .get("https://api.pinterest.com/v5/boards")
        .bearer_auth(access_token)
        .query(&[("page_size", "25")])
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("[Pinterest] List boards: {}", e))?;

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let boards = data["items"].as_array().cloned().unwrap_or_default();
    Ok(boards)
}

// ─── Analytics d'un Pin ───────────────────────────────────────────────────────

/// Récupère les impressions, clics et enregistrements d'un pin.
pub async fn get_pin_analytics(
    access_token: &str,
    pin_id: &str,
    start_date: &str, // "2024-01-01"
    end_date: &str,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();

    let resp = client
        .get(format!(
            "https://api.pinterest.com/v5/pins/{}/analytics",
            pin_id
        ))
        .bearer_auth(access_token)
        .query(&[
            ("start_date", start_date),
            ("end_date", end_date),
            ("metric_types", "IMPRESSION,OUTBOUND_CLICK,SAVE,PIN_CLICK"),
        ])
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("[Pinterest] Analytics: {}", e))?;

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}
