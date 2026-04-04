// E-commerce Connector Service — Yukpo
// Connecteurs Shopify Admin API, WooCommerce REST API, Jumia Seller API.
// Synchronisation produits → catalogue Yukpo.

use serde::{Deserialize, Serialize};
use serde_json::Value;

// ─── Struct produit normalisé ─────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct EcomProduct {
    pub external_id: String,
    pub title: String,
    pub description: Option<String>,
    pub price_fcfa: i64, // converti si nécessaire
    pub stock_quantity: i32,
    pub image_url: Option<String>,
    pub category: Option<String>,
    pub sku: Option<String>,
    pub is_active: bool,
}

// ─── Shopify Admin API 2024-01 ────────────────────────────────────────────────

pub async fn sync_shopify_products(
    shop_url: &str, // ex: "mon-shop.myshopify.com"
    access_token: &str,
    currency_rate: f64, // taux vers FCFA
) -> Result<Vec<EcomProduct>, String> {
    let client = reqwest::Client::new();
    let endpoint = format!(
        "https://{}/admin/api/2024-01/products.json?limit=250&status=active",
        shop_url.trim_end_matches('/')
    );

    let resp = client
        .get(&endpoint)
        .header("X-Shopify-Access-Token", access_token)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("[Shopify] Réseau: {}", e))?;

    if !resp.status().is_success() {
        let txt = resp.text().await.unwrap_or_default();
        return Err(format!("[Shopify] Erreur: {}", txt));
    }

    let data: Value = resp.json().await.map_err(|e| e.to_string())?;
    let products = data["products"].as_array().cloned().unwrap_or_default();

    let mut result = Vec::new();
    for p in &products {
        let variants = p["variants"].as_array().cloned().unwrap_or_default();
        let price_str = variants.first().and_then(|v| v["price"].as_str()).unwrap_or("0");
        let price: f64 = price_str.parse().unwrap_or(0.0);
        let stock: i32 =
            variants.first().and_then(|v| v["inventory_quantity"].as_i64()).unwrap_or(0) as i32;

        let image_url = p["image"]["src"].as_str().map(|s| s.to_string());

        result.push(EcomProduct {
            external_id: p["id"].as_i64().unwrap_or(0).to_string(),
            title: p["title"].as_str().unwrap_or("").to_string(),
            description: p["body_html"].as_str().map(|s| {
                // Nettoyer HTML basique
                s.replace("<br>", "\n")
                    .replace("</p>", "\n")
                    .replace(|c: char| c == '<', "")
                    .replace(|c: char| c == '>', "")
            }),
            price_fcfa: (price * currency_rate) as i64,
            stock_quantity: stock,
            image_url,
            category: p["product_type"].as_str().map(|s| s.to_string()),
            sku: variants.first().and_then(|v| v["sku"].as_str()).map(|s| s.to_string()),
            is_active: p["status"].as_str() == Some("active"),
        });
    }

    log::info!("[Shopify] {} produits synchronisés", result.len());
    Ok(result)
}

// ─── WooCommerce REST API v3 ──────────────────────────────────────────────────

pub async fn sync_woocommerce_products(
    site_url: &str,
    consumer_key: &str,
    consumer_secret: &str,
    currency_rate: f64,
) -> Result<Vec<EcomProduct>, String> {
    let client = reqwest::Client::new();
    let endpoint = format!(
        "{}/wp-json/wc/v3/products?per_page=100&status=publish",
        site_url.trim_end_matches('/')
    );

    let resp = client
        .get(&endpoint)
        .basic_auth(consumer_key, Some(consumer_secret))
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("[WooCommerce] Réseau: {}", e))?;

    if !resp.status().is_success() {
        let txt = resp.text().await.unwrap_or_default();
        return Err(format!("[WooCommerce] Erreur: {}", txt));
    }

    let products: Vec<Value> = resp.json().await.map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for p in &products {
        let price_str = p["price"].as_str().unwrap_or("0");
        let price: f64 = price_str.parse().unwrap_or(0.0);
        let stock: i32 = p["stock_quantity"].as_i64().unwrap_or(0) as i32;

        let image_url = p["images"]
            .as_array()
            .and_then(|arr| arr.first())
            .and_then(|img| img["src"].as_str())
            .map(|s| s.to_string());

        let category = p["categories"]
            .as_array()
            .and_then(|arr| arr.first())
            .and_then(|c| c["name"].as_str())
            .map(|s| s.to_string());

        result.push(EcomProduct {
            external_id: p["id"].as_i64().unwrap_or(0).to_string(),
            title: p["name"].as_str().unwrap_or("").to_string(),
            description: p["short_description"].as_str().map(|s| s.to_string()),
            price_fcfa: (price * currency_rate) as i64,
            stock_quantity: stock,
            image_url,
            category,
            sku: p["sku"].as_str().map(|s| s.to_string()),
            is_active: p["status"].as_str() == Some("publish"),
        });
    }

    log::info!("[WooCommerce] {} produits synchronisés", result.len());
    Ok(result)
}

// ─── Jumia Seller Center API ──────────────────────────────────────────────────

pub async fn sync_jumia_products(
    seller_id: &str,
    api_key: &str,
    country_code: &str, // "NG" | "KE" | "GH" | "CM" | "CI" | "EG" | "MA" | "TN"
) -> Result<Vec<EcomProduct>, String> {
    let client = reqwest::Client::new();
    // Jumia Seller Center API endpoint varie par pays
    let base_url = match country_code.to_uppercase().as_str() {
        "NG" => "https://sellercenter.jumia.com.ng",
        "KE" => "https://sellercenter.jumia.co.ke",
        "GH" => "https://sellercenter.jumia.com.gh",
        "CM" => "https://sellercenter.jumia.com.cm",
        "CI" => "https://sellercenter.jumia.ci",
        "EG" => "https://sellercenter.jumia.com.eg",
        "MA" => "https://sellercenter.jumia.ma",
        "TN" => "https://sellercenter.jumia.com.tn",
        _ => "https://sellercenter.jumia.com",
    };

    // Jumia utilise une signature HMAC-SHA256 des paramètres
    let timestamp = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    let params = format!(
        "Action=GetProducts&Format=JSON&SellerId={}&Timestamp={}&Version=1.0",
        seller_id, timestamp
    );

    use hmac::{Hmac, Mac};
    use sha2::Sha256;
    let mut mac = Hmac::<Sha256>::new_from_slice(api_key.as_bytes()).map_err(|e| e.to_string())?;
    mac.update(params.as_bytes());
    let sig = hex::encode(mac.finalize().into_bytes());

    let url = format!("{}/index.php?{}&Signature={}", base_url, params, sig);

    let resp = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("[Jumia] Réseau: {}", e))?;

    if !resp.status().is_success() {
        let txt = resp.text().await.unwrap_or_default();
        return Err(format!("[Jumia] Erreur: {}", txt));
    }

    let data: Value = resp.json().await.map_err(|e| e.to_string())?;

    // Parse la réponse Jumia Seller Center
    let products = data["SuccessResponse"]["Body"]["Products"]["Product"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    let mut result = Vec::new();
    for p in &products {
        let price_str = p["Price"].as_str().unwrap_or("0");
        let price: f64 = price_str.parse().unwrap_or(0.0);
        let stock: i32 = p["Quantity"].as_str().unwrap_or("0").parse().unwrap_or(0);

        result.push(EcomProduct {
            external_id: p["SellerSku"].as_str().unwrap_or("").to_string(),
            title: p["Name"].as_str().unwrap_or("").to_string(),
            description: p["Description"].as_str().map(|s| s.to_string()),
            price_fcfa: price as i64, // Jumia affiche déjà en devise locale
            stock_quantity: stock,
            image_url: p["Images"]["Image"]
                .as_array()
                .and_then(|a| a.first())
                .and_then(|i| i.as_str())
                .map(|s| s.to_string()),
            category: p["PrimaryCategory"].as_str().map(|s| s.to_string()),
            sku: p["SellerSku"].as_str().map(|s| s.to_string()),
            is_active: p["Status"].as_str() == Some("active"),
        });
    }

    log::info!("[Jumia] {} produits synchronisés", result.len());
    Ok(result)
}

use chrono;
