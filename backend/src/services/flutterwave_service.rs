/// Service Flutterwave — Couverture pan-africaine (30+ pays, mobile money + cartes)
///
/// Flutterwave couvre les zones que CinetPay/NotchPay ne peuvent pas atteindre:
/// - Afrique de l'Est: Kenya (M-Pesa), Tanzania, Uganda, Rwanda, Ethiopia
/// - Afrique australe: Ghana (Vodafone Cash), Zambia, Malawi, Mozambique
/// - Nigeria: bank transfer, USSD
///
/// API v3: https://developer.flutterwave.com/docs
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct FlutterwaveConfig {
    pub secret_key: String,
    pub public_key: String,
    pub encryption_key: String,
    pub webhook_hash: String,
    pub base_url: String,
}

impl FlutterwaveConfig {
    pub fn from_env() -> Self {
        Self {
            secret_key: std::env::var("FLUTTERWAVE_SECRET_KEY").unwrap_or_default(),
            public_key: std::env::var("FLUTTERWAVE_PUBLIC_KEY").unwrap_or_default(),
            encryption_key: std::env::var("FLUTTERWAVE_ENCRYPTION_KEY").unwrap_or_default(),
            webhook_hash: std::env::var("FLUTTERWAVE_WEBHOOK_HASH").unwrap_or_default(),
            base_url: std::env::var("FLUTTERWAVE_BASE_URL")
                .unwrap_or_else(|_| "https://api.flutterwave.com".to_string()),
        }
    }

    pub fn is_configured(&self) -> bool {
        !self.secret_key.is_empty() && !self.public_key.is_empty()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlutterwaveChargeRequest {
    pub tx_ref: String,
    pub amount: f64,
    pub currency: String,
    pub phone_number: Option<String>,
    pub email: String,
    pub network: Option<String>,
    pub country: Option<String>,
    pub customer_name: Option<String>,
    pub redirect_url: Option<String>,
    pub meta: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlutterwaveResponse {
    pub success: bool,
    pub tx_ref: String,
    pub flw_ref: Option<String>,
    pub payment_link: Option<String>,
    pub status: String,
    pub message: Option<String>,
}

pub struct FlutterwaveService {
    config: FlutterwaveConfig,
    client: Client,
}

/// Mappe un opérateur mobile + pays vers le code réseau Flutterwave
pub fn flutterwave_network(operator: &str, country: &str) -> Option<&'static str> {
    match (operator, country) {
        // Ghana
        ("mtn", "gh") => Some("MTN"),
        ("airtel_tigo", "gh") | ("airtel", "gh") | ("tigo", "gh") => Some("AIRTELTIGO"),
        ("vodafone", "gh") => Some("VODAFONE"),
        // Kenya
        ("mpesa", "ke") => Some("MPS"),
        // Uganda
        ("mtn", "ug") => Some("MTN"),
        ("airtel", "ug") => Some("AIRTEL"),
        // Rwanda
        ("mtn", "rw") => Some("MTN"),
        ("mpesa", "rw") => Some("MPS"),
        // Tanzania
        ("airtel", "tz") => Some("AIRTEL"),
        ("tigo", "tz") => Some("TIGO"),
        ("vodacom", "tz") | ("mpesa", "tz") => Some("VODACOM"),
        ("halotel", "tz") => Some("HALOPESA"),
        // Zambia
        ("mpesa", "zm") | ("mtn", "zm") => Some("MPS"),
        // Cameroun
        ("mtn", "cm") => Some("MTN"),
        ("orange", "cm") => Some("ORANGEMONEY"),
        // Côte d'Ivoire
        ("mtn", "ci") => Some("MTN"),
        ("orange", "ci") => Some("ORANGE"),
        ("moov", "ci") => Some("MOOV"),
        ("wave", "ci") => Some("WAVE"),
        // Sénégal
        ("orange", "sn") => Some("ORANGEMONEY"),
        ("wave", "sn") => Some("WAVE"),
        // Ethiopia
        ("amole", "et") => Some("AMOLEMONEY"),
        _ => None,
    }
}

/// Retourne le type de charge Flutterwave selon le pays
pub fn flutterwave_charge_type(country: &str) -> &'static str {
    match country {
        "gh" => "mobile_money_ghana",
        "ke" => "mpesa",
        "ug" => "mobile_money_uganda",
        "rw" => "mobile_money_rwanda",
        "tz" => "mobile_money_tanzania",
        "zm" => "mobile_money_zambia",
        "et" => "mobile_money_ethiopia",
        "cm" | "ga" | "cg" | "cf" | "td" | "gq" => "mobile_money_franco",
        "sn" | "ci" | "ml" | "bf" | "ne" | "tg" | "bj" | "gw" => "mobile_money_franco",
        "ng" => "ussd",
        _ => "mobile_money_franco",
    }
}

impl FlutterwaveService {
    pub fn new() -> Self {
        Self {
            config: FlutterwaveConfig::from_env(),
            client: Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .expect("Failed to create Flutterwave HTTP client"),
        }
    }

    pub fn is_configured(&self) -> bool {
        self.config.is_configured()
    }

    /// Initier un paiement mobile money via Flutterwave
    pub async fn charge_mobile_money(
        &self,
        req: &FlutterwaveChargeRequest,
    ) -> Result<FlutterwaveResponse, String> {
        if !self.config.is_configured() {
            return Err("Flutterwave not configured".to_string());
        }

        let country = req.country.as_deref().unwrap_or("cm");
        let charge_type = flutterwave_charge_type(country);

        let mut payload = serde_json::json!({
            "tx_ref": req.tx_ref,
            "amount": req.amount,
            "currency": req.currency,
            "email": req.email,
            "fullname": req.customer_name.as_deref().unwrap_or("Client Yukpo"),
        });

        if let Some(phone) = &req.phone_number {
            payload["phone_number"] = serde_json::json!(phone);
        }
        if let Some(network) = &req.network {
            payload["network"] = serde_json::json!(network);
        }
        if let Some(redirect) = &req.redirect_url {
            payload["redirect_url"] = serde_json::json!(redirect);
        }
        if let Some(meta) = &req.meta {
            payload["meta"] = meta.clone();
        }

        let url = format!("{}/v3/charges?type={}", self.config.base_url, charge_type);

        log::info!(
            "[Flutterwave] Charge {} {} via {} for {}",
            req.amount,
            req.currency,
            charge_type,
            country
        );

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.config.secret_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Flutterwave network error: {}", e))?;

        let status_code = response.status();
        let resp_text = response
            .text()
            .await
            .map_err(|e| format!("Flutterwave read error: {}", e))?;

        log::info!(
            "[Flutterwave] Response {}: {}",
            status_code,
            &resp_text[..resp_text.len().min(500)]
        );

        let resp_json: serde_json::Value = serde_json::from_str(&resp_text)
            .map_err(|e| format!("Flutterwave parse error: {} - {}", e, &resp_text[..resp_text.len().min(200)]))?;

        let status = resp_json
            .get("status")
            .and_then(|s| s.as_str())
            .unwrap_or("error");

        if status != "success" {
            let message = resp_json
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("Unknown error");
            return Err(format!("Flutterwave error: {}", message));
        }

        let data = resp_json.get("data").cloned().unwrap_or(serde_json::json!({}));

        let flw_ref = data
            .get("flw_ref")
            .and_then(|r| r.as_str())
            .map(|s| s.to_string());

        let payment_link = data
            .get("link")
            .or_else(|| data.get("redirect"))
            .and_then(|l| l.as_str())
            .map(|s| s.to_string());

        let charge_status = data
            .get("status")
            .and_then(|s| s.as_str())
            .unwrap_or("pending")
            .to_string();

        Ok(FlutterwaveResponse {
            success: true,
            tx_ref: req.tx_ref.clone(),
            flw_ref,
            payment_link,
            status: charge_status,
            message: resp_json.get("message").and_then(|m| m.as_str()).map(|s| s.to_string()),
        })
    }

    /// Initier un paiement via Flutterwave Standard (page de paiement hébergée)
    /// Supporte tous les pays et méthodes automatiquement
    pub async fn create_payment_link(
        &self,
        req: &FlutterwaveChargeRequest,
    ) -> Result<FlutterwaveResponse, String> {
        if !self.config.is_configured() {
            return Err("Flutterwave not configured".to_string());
        }

        let mut payload = serde_json::json!({
            "tx_ref": req.tx_ref,
            "amount": req.amount,
            "currency": req.currency,
            "customer": {
                "email": req.email,
                "name": req.customer_name.as_deref().unwrap_or("Client Yukpo"),
                "phonenumber": req.phone_number.as_deref().unwrap_or("")
            },
            "customizations": {
                "title": "Yukpo",
                "description": "Recharge de tokens Yukpo"
            }
        });

        if let Some(redirect) = &req.redirect_url {
            payload["redirect_url"] = serde_json::json!(redirect);
        }
        if let Some(meta) = &req.meta {
            payload["meta"] = meta.clone();
        }

        let url = format!("{}/v3/payments", self.config.base_url);

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.config.secret_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Flutterwave network error: {}", e))?;

        let resp_json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Flutterwave parse error: {}", e))?;

        let status = resp_json
            .get("status")
            .and_then(|s| s.as_str())
            .unwrap_or("error");

        if status != "success" {
            let msg = resp_json.get("message").and_then(|m| m.as_str()).unwrap_or("Error");
            return Err(format!("Flutterwave: {}", msg));
        }

        let data = resp_json.get("data").cloned().unwrap_or(serde_json::json!({}));
        let link = data.get("link").and_then(|l| l.as_str()).map(|s| s.to_string());

        Ok(FlutterwaveResponse {
            success: true,
            tx_ref: req.tx_ref.clone(),
            flw_ref: None,
            payment_link: link,
            status: "pending".to_string(),
            message: Some("Payment link created".to_string()),
        })
    }

    /// Vérifier le statut d'une transaction
    pub async fn verify_transaction(&self, tx_id: &str) -> Result<FlutterwaveResponse, String> {
        if !self.config.is_configured() {
            return Err("Flutterwave not configured".to_string());
        }

        let url = format!("{}/v3/transactions/{}/verify", self.config.base_url, tx_id);

        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.config.secret_key))
            .send()
            .await
            .map_err(|e| format!("Flutterwave verify error: {}", e))?;

        let resp_json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Flutterwave parse error: {}", e))?;

        let data = resp_json.get("data").cloned().unwrap_or(serde_json::json!({}));

        let status = data
            .get("status")
            .and_then(|s| s.as_str())
            .unwrap_or("unknown")
            .to_string();

        let flw_ref = data.get("flw_ref").and_then(|r| r.as_str()).map(|s| s.to_string());
        let tx_ref = data
            .get("tx_ref")
            .and_then(|r| r.as_str())
            .unwrap_or(tx_id)
            .to_string();

        Ok(FlutterwaveResponse {
            success: status == "successful",
            tx_ref,
            flw_ref,
            payment_link: None,
            status,
            message: resp_json.get("message").and_then(|m| m.as_str()).map(|s| s.to_string()),
        })
    }

    /// Vérifier un webhook Flutterwave (hash de vérification)
    pub fn verify_webhook(&self, secret_hash_header: Option<&str>) -> bool {
        if self.config.webhook_hash.is_empty() {
            log::warn!("[Flutterwave] No webhook hash configured, accepting all webhooks");
            return true;
        }
        match secret_hash_header {
            Some(hash) => hash == self.config.webhook_hash,
            None => false,
        }
    }

    /// Initier un remboursement
    pub async fn refund(&self, flw_ref: &str, amount: Option<f64>) -> Result<String, String> {
        if !self.config.is_configured() {
            return Err("Flutterwave not configured".to_string());
        }

        let mut payload = serde_json::json!({});
        if let Some(amt) = amount {
            payload["amount"] = serde_json::json!(amt);
        }

        let url = format!("{}/v3/transactions/{}/refund", self.config.base_url, flw_ref);

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.config.secret_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Flutterwave refund error: {}", e))?;

        let resp_json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Flutterwave refund parse error: {}", e))?;

        let status = resp_json.get("status").and_then(|s| s.as_str()).unwrap_or("error");

        if status == "success" {
            Ok("Refund initiated".to_string())
        } else {
            let msg = resp_json.get("message").and_then(|m| m.as_str()).unwrap_or("Refund failed");
            Err(format!("Flutterwave refund: {}", msg))
        }
    }

    /// Initier un transfert (payout) vers un wallet mobile money
    pub async fn payout(
        &self,
        phone: &str,
        amount: f64,
        currency: &str,
        country: &str,
        network: &str,
        reference: &str,
    ) -> Result<String, String> {
        if !self.config.is_configured() {
            return Err("Flutterwave not configured".to_string());
        }

        let payload = serde_json::json!({
            "account_bank": network,
            "account_number": phone,
            "amount": amount,
            "currency": currency,
            "beneficiary_name": "Prestataire Yukpo",
            "reference": reference,
            "debit_currency": currency,
            "meta": [{
                "sender": "Yukpo Platform",
                "sender_country": country.to_uppercase()
            }]
        });

        let url = format!("{}/v3/transfers", self.config.base_url);

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.config.secret_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Flutterwave payout error: {}", e))?;

        let resp_json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Flutterwave payout parse error: {}", e))?;

        let status = resp_json.get("status").and_then(|s| s.as_str()).unwrap_or("error");

        if status == "success" {
            let data = resp_json.get("data").cloned().unwrap_or(serde_json::json!({}));
            let id = data.get("id").and_then(|i| i.as_i64()).unwrap_or(0);
            Ok(format!("Payout initiated, ID: {}", id))
        } else {
            let msg = resp_json.get("message").and_then(|m| m.as_str()).unwrap_or("Payout failed");
            Err(format!("Flutterwave payout: {}", msg))
        }
    }
}
