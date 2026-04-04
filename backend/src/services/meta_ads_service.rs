// Service Meta Ads — Marketing API Facebook/Instagram/WhatsApp
// Création campagnes, Dynamic Product Ads, budget automatique, reporting

use serde::{Deserialize, Serialize};
use sqlx::PgPool;

const META_API_BASE: &str = "https://graph.facebook.com/v19.0";

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdAccountInfo {
    pub ad_account_id: String, // act_XXXXXXXXXX
    pub access_token: String,
    pub currency: String,
    pub timezone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CampaignRequest {
    pub name: String,
    pub objective: CampaignObjective,
    pub status: String, // ACTIVE, PAUSED
    pub budget_daily_fcfa: Option<i64>,
    pub budget_total_fcfa: Option<i64>,
    pub start_time: Option<String>, // ISO8601
    pub end_time: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CampaignObjective {
    OutcomeTraffic,
    OutcomeSales,
    OutcomeAwareness,
    OutcomeLeads,
    OutcomeEngagement,
}

impl CampaignObjective {
    pub fn to_meta_str(&self) -> &'static str {
        match self {
            CampaignObjective::OutcomeTraffic => "OUTCOME_TRAFFIC",
            CampaignObjective::OutcomeSales => "OUTCOME_SALES",
            CampaignObjective::OutcomeAwareness => "OUTCOME_AWARENESS",
            CampaignObjective::OutcomeLeads => "OUTCOME_LEADS",
            CampaignObjective::OutcomeEngagement => "OUTCOME_ENGAGEMENT",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatedCampaign {
    pub external_campaign_id: String,
    pub adset_id: Option<String>,
    pub ad_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetingSpec {
    pub countries: Vec<String>, // ["CM", "SN", "CI", ...]
    pub age_min: u32,
    pub age_max: u32,
    pub genders: Option<Vec<u32>>,     // 1=male, 2=female
    pub interests: Vec<u64>,           // IDs intérêts Meta
    pub custom_audiences: Vec<String>, // IDs audiences personnalisées
    pub lookalike_audiences: Vec<String>,
    pub cities: Vec<String>,
    pub radius_km: Option<u32>,
}

impl Default for TargetingSpec {
    fn default() -> Self {
        Self {
            countries: vec!["CM".to_string()],
            age_min: 18,
            age_max: 55,
            genders: None,
            interests: vec![],
            custom_audiences: vec![],
            lookalike_audiences: vec![],
            cities: vec![],
            radius_km: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdPerformance {
    pub campaign_id: String,
    pub impressions: i64,
    pub clicks: i64,
    pub spend: f64, // en devise du compte
    pub spend_fcfa: i64,
    pub cpm: f64,
    pub cpc: f64,
    pub ctr: f64,
    pub conversions: i32,
    pub roas: f64,
}

// ─── Création de campagne ─────────────────────────────────────────────────────

/// Crée une campagne promotionnelle automatique pour un produit en promo
pub async fn create_promo_campaign(
    account: &AdAccountInfo,
    product_name: &str,
    product_image_url: Option<&str>,
    original_price: f64,
    promo_price: f64,
    product_yukpo_url: &str,
    budget_daily_fcfa: i64,
    targeting: &TargetingSpec,
    store_name: &str,
) -> Result<CreatedCampaign, String> {
    let client = reqwest::Client::new();
    let discount_pct = ((original_price - promo_price) / original_price * 100.0).round() as i32;

    // 1. Créer la campagne
    let campaign_id = create_campaign_api(
        &client,
        &account.ad_account_id,
        &account.access_token,
        &format!("Promo {} - {}%", product_name, discount_pct),
        "OUTCOME_SALES",
        budget_daily_fcfa,
    )
    .await?;

    // 2. Créer l'AdSet avec le ciblage
    let adset_id = create_adset_api(
        &client,
        &account.ad_account_id,
        &account.access_token,
        &campaign_id,
        &format!(
            "AdSet - {} - {}",
            product_name,
            targeting.countries.join(",")
        ),
        budget_daily_fcfa,
        targeting,
        "LINK_CLICKS",
    )
    .await?;

    // 3. Créer le créatif
    let headline = format!("🔥 -{discount_pct}% sur {product_name}");
    let body = format!(
        "Ne manquez pas cette offre! {product_name} à seulement {} FCFA au lieu de {} FCFA. Commandez maintenant sur Yukpo! 🛍️",
        promo_price as i64,
        original_price as i64,
    );
    let creative_id = create_ad_creative_api(
        &client,
        &account.ad_account_id,
        &account.access_token,
        &headline,
        &body,
        product_image_url,
        product_yukpo_url,
        "SHOP_NOW",
        store_name,
    )
    .await?;

    // 4. Créer l'Ad
    let ad_id = create_ad_api(
        &client,
        &account.ad_account_id,
        &account.access_token,
        &adset_id,
        &creative_id,
        &format!("Ad - {}", product_name),
    )
    .await?;

    log::info!(
        "[MetaAds] ✅ Campagne créée: campaign={}, adset={}, ad={}",
        campaign_id,
        adset_id,
        ad_id
    );

    Ok(CreatedCampaign {
        external_campaign_id: campaign_id,
        adset_id: Some(adset_id),
        ad_id: Some(ad_id),
    })
}

/// Crée une campagne Dynamic Product Ads (retargeting catalogue)
pub async fn create_dynamic_product_ads(
    account: &AdAccountInfo,
    catalog_id: &str,
    store_name: &str,
    budget_daily_fcfa: i64,
    targeting: &TargetingSpec,
) -> Result<CreatedCampaign, String> {
    let client = reqwest::Client::new();

    // Campagne catalogue avec objectif OUTCOME_SALES
    let campaign_id = create_campaign_api(
        &client,
        &account.ad_account_id,
        &account.access_token,
        &format!("DPA - Catalogue {} - Retargeting", store_name),
        "OUTCOME_SALES",
        budget_daily_fcfa,
    )
    .await?;

    // AdSet avec product catalog
    let adset_body = serde_json::json!({
        "name": format!("AdSet DPA - {}", store_name),
        "campaign_id": campaign_id,
        "daily_budget": budget_daily_fcfa * 100, // en centimes
        "billing_event": "IMPRESSIONS",
        "optimization_goal": "OFFSITE_CONVERSIONS",
        "targeting": build_targeting_json(targeting),
        "product_catalog_id": catalog_id,
        "promoted_object": {
            "product_catalog_id": catalog_id,
            "product_set_id": null
        },
        "status": "ACTIVE",
        "attribution_spec": [{"event_type": "CLICK_THROUGH", "window_days": 7}]
    });

    let adset_resp = client
        .post(format!(
            "{}/{}/adsets",
            META_API_BASE, account.ad_account_id
        ))
        .query(&[("access_token", &account.access_token)])
        .json(&adset_body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let adset_json: serde_json::Value = adset_resp.json().await.map_err(|e| e.to_string())?;
    let adset_id = adset_json["id"].as_str().ok_or("adset_id manquant")?.to_string();

    // Créatif DPA (template dynamique)
    let creative_body = serde_json::json!({
        "name": format!("Créatif DPA - {}", store_name),
        "object_story_spec": {
            "page_id": account.ad_account_id.trim_start_matches("act_"),
            "template_data": {
                "message": "{{product.name}} - {{product.current_price}} FCFA",
                "link": "https://yukpomnang.com?utm_source=dpa&utm_medium=meta_ads",
                "name": "{{product.name}}",
                "description": "Disponible sur Yukpo",
                "call_to_action": {
                    "type": "SHOP_NOW",
                    "value": {"link": "https://yukpomnang.com"}
                }
            }
        },
        "product_catalog_id": catalog_id
    });

    let creative_resp = client
        .post(format!(
            "{}/{}/adcreatives",
            META_API_BASE, account.ad_account_id
        ))
        .query(&[("access_token", &account.access_token)])
        .json(&creative_body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let creative_json: serde_json::Value = creative_resp.json().await.map_err(|e| e.to_string())?;
    let creative_id = creative_json["id"].as_str().ok_or("creative_id manquant")?.to_string();

    let ad_id = create_ad_api(
        &client,
        &account.ad_account_id,
        &account.access_token,
        &adset_id,
        &creative_id,
        &format!("Ad DPA - {}", store_name),
    )
    .await?;

    log::info!(
        "[MetaAds] ✅ DPA créées: campaign={}, catalog={}",
        campaign_id,
        catalog_id
    );

    Ok(CreatedCampaign {
        external_campaign_id: campaign_id,
        adset_id: Some(adset_id),
        ad_id: Some(ad_id),
    })
}

/// Crée une campagne Click-to-WhatsApp
pub async fn create_click_to_whatsapp_campaign(
    account: &AdAccountInfo,
    whatsapp_phone: &str,
    headline: &str,
    body_text: &str,
    image_url: Option<&str>,
    budget_daily_fcfa: i64,
    targeting: &TargetingSpec,
    store_name: &str,
) -> Result<CreatedCampaign, String> {
    let client = reqwest::Client::new();

    let campaign_id = create_campaign_api(
        &client,
        &account.ad_account_id,
        &account.access_token,
        &format!("WhatsApp CTA - {}", store_name),
        "OUTCOME_TRAFFIC",
        budget_daily_fcfa,
    )
    .await?;

    let adset_id = create_adset_api(
        &client,
        &account.ad_account_id,
        &account.access_token,
        &campaign_id,
        &format!("AdSet WhatsApp - {}", store_name),
        budget_daily_fcfa,
        targeting,
        "LINK_CLICKS",
    )
    .await?;

    let whatsapp_url = format!(
        "https://wa.me/{}?text=Bonjour%2C+je+viens+de+voir+votre+pub+Yukpo+et+je+veux+en+savoir+plus+!",
        whatsapp_phone.replace("+", "").replace(" ", "")
    );

    let creative_id = create_ad_creative_api(
        &client,
        &account.ad_account_id,
        &account.access_token,
        headline,
        body_text,
        image_url,
        &whatsapp_url,
        "WHATSAPP_MESSAGE",
        store_name,
    )
    .await?;

    let ad_id = create_ad_api(
        &client,
        &account.ad_account_id,
        &account.access_token,
        &adset_id,
        &creative_id,
        &format!("Ad WhatsApp CTA - {}", store_name),
    )
    .await?;

    Ok(CreatedCampaign {
        external_campaign_id: campaign_id,
        adset_id: Some(adset_id),
        ad_id: Some(ad_id),
    })
}

// ─── Reporting ────────────────────────────────────────────────────────────────

/// Récupère les performances d'une campagne depuis Meta Insights API
pub async fn fetch_campaign_insights(
    campaign_id: &str,
    access_token: &str,
    date_preset: &str, // today, last_7d, last_30d, last_month
) -> Result<AdPerformance, String> {
    let client = reqwest::Client::new();

    let resp = client
        .get(format!("{}/{}/insights", META_API_BASE, campaign_id))
        .query(&[
            ("access_token", access_token),
            ("date_preset", date_preset),
            (
                "fields",
                "impressions,clicks,spend,cpm,cpc,ctr,actions,action_values",
            ),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Meta Insights API error: {}", text));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let data = &json["data"][0];

    let impressions = data["impressions"].as_str().and_then(|s| s.parse::<i64>().ok()).unwrap_or(0);
    let clicks = data["clicks"].as_str().and_then(|s| s.parse::<i64>().ok()).unwrap_or(0);
    let spend_str = data["spend"].as_str().unwrap_or("0");
    let spend: f64 = spend_str.parse().unwrap_or(0.0);
    let cpm: f64 = data["cpm"].as_str().and_then(|s| s.parse().ok()).unwrap_or(0.0);
    let cpc: f64 = data["cpc"].as_str().and_then(|s| s.parse().ok()).unwrap_or(0.0);
    let ctr: f64 = data["ctr"].as_str().and_then(|s| s.parse().ok()).unwrap_or(0.0);

    // Conversions (actions de type purchase)
    let conversions = data["actions"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter(|a| a["action_type"].as_str() == Some("purchase"))
                .map(|a| a["value"].as_str().and_then(|v| v.parse::<i32>().ok()).unwrap_or(0))
                .sum::<i32>()
        })
        .unwrap_or(0);

    // Valeur des conversions pour ROAS
    let conversion_value: f64 = data["action_values"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter(|a| a["action_type"].as_str() == Some("purchase"))
                .map(|a| a["value"].as_str().and_then(|v| v.parse::<f64>().ok()).unwrap_or(0.0))
                .sum()
        })
        .unwrap_or(0.0);

    let roas = if spend > 0.0 {
        conversion_value / spend
    } else {
        0.0
    };

    // Estimation XAF (1 EUR ≈ 656 FCFA, 1 USD ≈ 600 FCFA)
    let spend_fcfa = (spend * 600.0) as i64;

    Ok(AdPerformance {
        campaign_id: campaign_id.to_string(),
        impressions,
        clicks,
        spend,
        spend_fcfa,
        cpm,
        cpc,
        ctr,
        conversions,
        roas,
    })
}

/// Pause ou relance une campagne
pub async fn update_campaign_status(
    campaign_id: &str,
    access_token: &str,
    status: &str, // ACTIVE, PAUSED, DELETED
) -> Result<(), String> {
    let client = reqwest::Client::new();

    let resp = client
        .post(format!("{}/{}", META_API_BASE, campaign_id))
        .query(&[("access_token", access_token)])
        .json(&serde_json::json!({"status": status}))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Meta API update status error: {}", text));
    }

    log::info!("[MetaAds] Campaign {} → {}", campaign_id, status);
    Ok(())
}

/// Met à jour le budget journalier d'un AdSet
pub async fn update_adset_budget(
    adset_id: &str,
    access_token: &str,
    new_daily_budget_fcfa: i64,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let budget_cents = new_daily_budget_fcfa * 100;

    let resp = client
        .post(format!("{}/{}", META_API_BASE, adset_id))
        .query(&[("access_token", access_token)])
        .json(&serde_json::json!({"daily_budget": budget_cents}))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Meta update budget error: {}", text));
    }

    log::info!(
        "[MetaAds] AdSet {} budget → {} FCFA/jour",
        adset_id,
        new_daily_budget_fcfa
    );
    Ok(())
}

/// Charge les comptes publicitaires actifs depuis la BDD
pub async fn load_ad_account(pg: &PgPool, user_id: i32, service_id: i32) -> Option<AdAccountInfo> {
    sqlx::query(
        r#"SELECT ad_account_id, access_token, currency, timezone
           FROM meta_ad_accounts
           WHERE user_id = $1 AND service_id = $2
             AND account_status = 1
           LIMIT 1"#,
    )
    .bind(user_id)
    .bind(service_id)
    .fetch_optional(pg)
    .await
    .ok()
    .flatten()
    .map(|r: sqlx::postgres::PgRow| {
        use sqlx::Row;
        AdAccountInfo {
            ad_account_id: r.get("ad_account_id"),
            access_token: r.get("access_token"),
            currency: r.get("currency"),
            timezone: r.get("timezone"),
        }
    })
}

// ─── Helpers privés ───────────────────────────────────────────────────────────

async fn create_campaign_api(
    client: &reqwest::Client,
    ad_account_id: &str,
    access_token: &str,
    name: &str,
    objective: &str,
    budget_daily_fcfa: i64,
) -> Result<String, String> {
    let body = serde_json::json!({
        "name": name,
        "objective": objective,
        "status": "ACTIVE",
        "special_ad_categories": [],
        "daily_budget": budget_daily_fcfa * 100 // en centimes USD → à ajuster selon devise
    });

    let resp = client
        .post(format!("{}/{}/campaigns", META_API_BASE, ad_account_id))
        .query(&[("access_token", access_token)])
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Meta create campaign error: {}", text));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    json["id"]
        .as_str()
        .ok_or("campaign id manquant".to_string())
        .map(|s| s.to_string())
}

async fn create_adset_api(
    client: &reqwest::Client,
    ad_account_id: &str,
    access_token: &str,
    campaign_id: &str,
    name: &str,
    budget_daily_fcfa: i64,
    targeting: &TargetingSpec,
    optimization_goal: &str,
) -> Result<String, String> {
    let body = serde_json::json!({
        "name": name,
        "campaign_id": campaign_id,
        "daily_budget": budget_daily_fcfa * 100,
        "billing_event": "IMPRESSIONS",
        "optimization_goal": optimization_goal,
        "targeting": build_targeting_json(targeting),
        "status": "ACTIVE"
    });

    let resp = client
        .post(format!("{}/{}/adsets", META_API_BASE, ad_account_id))
        .query(&[("access_token", access_token)])
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Meta create adset error: {}", text));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    json["id"]
        .as_str()
        .ok_or("adset id manquant".to_string())
        .map(|s| s.to_string())
}

async fn create_ad_creative_api(
    client: &reqwest::Client,
    ad_account_id: &str,
    access_token: &str,
    headline: &str,
    body: &str,
    image_url: Option<&str>,
    link: &str,
    cta_type: &str,
    _page_name: &str,
) -> Result<String, String> {
    let mut link_data = serde_json::json!({
        "message": body,
        "link": link,
        "name": headline,
        "call_to_action": {
            "type": cta_type,
            "value": {"link": link}
        }
    });

    if let Some(img) = image_url {
        link_data["picture"] = serde_json::json!(img);
    }

    let body_req = serde_json::json!({
        "name": format!("Créatif - {}", headline),
        "object_story_spec": {
            "page_id": ad_account_id.trim_start_matches("act_"),
            "link_data": link_data
        }
    });

    let resp = client
        .post(format!("{}/{}/adcreatives", META_API_BASE, ad_account_id))
        .query(&[("access_token", access_token)])
        .json(&body_req)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Meta create creative error: {}", text));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    json["id"]
        .as_str()
        .ok_or("creative id manquant".to_string())
        .map(|s| s.to_string())
}

async fn create_ad_api(
    _client: &reqwest::Client,
    ad_account_id: &str,
    access_token: &str,
    adset_id: &str,
    creative_id: &str,
    name: &str,
) -> Result<String, String> {
    let body = serde_json::json!({
        "name": name,
        "adset_id": adset_id,
        "creative": {"creative_id": creative_id},
        "status": "ACTIVE"
    });

    let resp = reqwest::Client::new()
        .post(format!("{}/{}/ads", META_API_BASE, ad_account_id))
        .query(&[("access_token", access_token)])
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Meta create ad error: {}", text));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    json["id"].as_str().ok_or("ad id manquant".to_string()).map(|s| s.to_string())
}

fn build_targeting_json(targeting: &TargetingSpec) -> serde_json::Value {
    let mut t = serde_json::json!({
        "age_min": targeting.age_min,
        "age_max": targeting.age_max,
        "geo_locations": {
            "countries": targeting.countries
        }
    });

    if let Some(genders) = &targeting.genders {
        t["genders"] = serde_json::json!(genders);
    }

    if !targeting.interests.is_empty() {
        let interests: Vec<serde_json::Value> = targeting
            .interests
            .iter()
            .map(|id| serde_json::json!({"id": id.to_string()}))
            .collect();
        t["flexible_spec"] = serde_json::json!([{"interests": interests}]);
    }

    if !targeting.custom_audiences.is_empty() {
        let audiences: Vec<serde_json::Value> = targeting
            .custom_audiences
            .iter()
            .map(|id| serde_json::json!({"id": id}))
            .collect();
        t["custom_audiences"] = serde_json::json!(audiences);
    }

    if !targeting.cities.is_empty() {
        t["geo_locations"]["cities"] = serde_json::json!(targeting
            .cities
            .iter()
            .map(|c| serde_json::json!({"key": c}))
            .collect::<Vec<_>>());
    }

    t
}
