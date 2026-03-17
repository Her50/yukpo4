// ✅ 2026-03-17: Service Stripe pour paiements internationaux
// Supporte: Visa, Mastercard, Amex, Apple Pay, Google Pay
// Utilise l'API REST Stripe directement via reqwest (pas de crate async-stripe)

use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;

/// Configuration Stripe (depuis variables d'environnement)
#[derive(Clone)]
pub struct StripeConfig {
    pub secret_key: String,
    pub publishable_key: String,
    pub webhook_secret: String,
    pub api_base: String,
}

impl StripeConfig {
    pub fn from_env() -> Option<Self> {
        let secret_key = std::env::var("STRIPE_SECRET_KEY").ok()?;
        let publishable_key =
            std::env::var("STRIPE_PUBLISHABLE_KEY").unwrap_or_else(|_| String::new());
        let webhook_secret =
            std::env::var("STRIPE_WEBHOOK_SECRET").unwrap_or_else(|_| String::new());
        Some(Self {
            secret_key,
            publishable_key,
            webhook_secret,
            api_base: "https://api.stripe.com/v1".to_string(),
        })
    }

    pub fn is_configured() -> bool {
        std::env::var("STRIPE_SECRET_KEY").is_ok()
    }
}

/// Devise supportée par Stripe
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StripeCurrency {
    USD,
    EUR,
    GBP,
    XAF,
    XOF,
    CAD,
    CHF,
    JPY,
    AUD,
    NGN,
}

impl StripeCurrency {
    pub fn as_str(&self) -> &str {
        match self {
            Self::USD => "usd",
            Self::EUR => "eur",
            Self::GBP => "gbp",
            Self::XAF => "xaf",
            Self::XOF => "xof",
            Self::CAD => "cad",
            Self::CHF => "chf",
            Self::JPY => "jpy",
            Self::AUD => "aud",
            Self::NGN => "ngn",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "usd" => Self::USD,
            "eur" => Self::EUR,
            "gbp" => Self::GBP,
            "xaf" => Self::XAF,
            "xof" => Self::XOF,
            "cad" => Self::CAD,
            "chf" => Self::CHF,
            "jpy" => Self::JPY,
            "aud" => Self::AUD,
            "ngn" => Self::NGN,
            _ => Self::XAF,
        }
    }

    /// Indique si la devise est "zero-decimal" (pas de centimes)
    pub fn is_zero_decimal(&self) -> bool {
        matches!(self, Self::JPY)
    }
}

/// Requête de création PaymentIntent
#[derive(Debug, Clone)]
pub struct StripePaymentRequest {
    pub amount_cents: i64,
    pub currency: StripeCurrency,
    pub payment_method_types: Vec<String>, // ["card", "apple_pay", "google_pay"]
    pub description: String,
    pub customer_email: Option<String>,
    pub customer_name: Option<String>,
    pub metadata: HashMap<String, String>,
}

/// Réponse PaymentIntent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StripePaymentResponse {
    pub payment_intent_id: String,
    pub client_secret: String,
    pub status: String,
    pub amount: i64,
    pub currency: String,
    pub publishable_key: String,
}

/// Événement webhook Stripe
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StripeWebhookEvent {
    pub id: String,
    #[serde(rename = "type")]
    pub event_type: String,
    pub data: StripeEventData,
    pub created: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StripeEventData {
    pub object: Value,
}

/// Service principal Stripe
pub struct StripePaymentService {
    client: Client,
    config: StripeConfig,
}

impl StripePaymentService {
    pub fn new() -> Result<Self, String> {
        let config = StripeConfig::from_env()
            .ok_or_else(|| "STRIPE_SECRET_KEY non configuré".to_string())?;
        Ok(Self {
            client: Client::new(),
            config,
        })
    }

    /// ✅ Crée un PaymentIntent Stripe
    /// Supporte: card (Visa/Mastercard/Amex), apple_pay, google_pay
    pub async fn create_payment_intent(
        &self,
        request: StripePaymentRequest,
    ) -> Result<StripePaymentResponse, String> {
        let mut params = vec![
            ("amount".to_string(), request.amount_cents.to_string()),
            (
                "currency".to_string(),
                request.currency.as_str().to_string(),
            ),
            ("description".to_string(), request.description.clone()),
            (
                "automatic_payment_methods[enabled]".to_string(),
                "true".to_string(),
            ),
        ];

        // Ajouter les métadonnées
        for (key, value) in &request.metadata {
            params.push((format!("metadata[{}]", key), value.clone()));
        }

        // Email client pour receipt
        if let Some(email) = &request.customer_email {
            params.push(("receipt_email".to_string(), email.clone()));
        }

        let response = self
            .client
            .post(&format!("{}/payment_intents", self.config.api_base))
            .basic_auth(&self.config.secret_key, Option::<&str>::None)
            .form(&params)
            .send()
            .await
            .map_err(|e| format!("Erreur réseau Stripe: {}", e))?;

        let status = response.status();
        let body: Value = response
            .json()
            .await
            .map_err(|e| format!("Erreur parsing réponse Stripe: {}", e))?;

        if !status.is_success() {
            let error_msg = body
                .get("error")
                .and_then(|e| e.get("message"))
                .and_then(|m| m.as_str())
                .unwrap_or("Erreur Stripe inconnue");
            log::error!("[Stripe] Erreur création PaymentIntent: {}", error_msg);
            return Err(format!("Stripe error: {}", error_msg));
        }

        let pi_id = body["id"].as_str().ok_or("Missing payment_intent id")?.to_string();
        let client_secret =
            body["client_secret"].as_str().ok_or("Missing client_secret")?.to_string();
        let pi_status = body["status"].as_str().unwrap_or("requires_payment_method").to_string();

        log::info!(
            "[Stripe] ✅ PaymentIntent créé: {} - {} {} - status={}",
            pi_id,
            request.amount_cents,
            request.currency.as_str(),
            pi_status
        );

        Ok(StripePaymentResponse {
            payment_intent_id: pi_id,
            client_secret,
            status: pi_status,
            amount: request.amount_cents,
            currency: request.currency.as_str().to_string(),
            publishable_key: self.config.publishable_key.clone(),
        })
    }

    /// ✅ Vérifie le statut d'un PaymentIntent
    pub async fn check_payment_status(&self, payment_intent_id: &str) -> Result<Value, String> {
        let response = self
            .client
            .get(&format!(
                "{}/payment_intents/{}",
                self.config.api_base, payment_intent_id
            ))
            .basic_auth(&self.config.secret_key, Option::<&str>::None)
            .send()
            .await
            .map_err(|e| format!("Erreur réseau Stripe: {}", e))?;

        let body: Value = response.json().await.map_err(|e| format!("Erreur parsing: {}", e))?;

        Ok(json!({
            "id": body["id"],
            "status": body["status"],
            "amount": body["amount"],
            "currency": body["currency"],
            "payment_method_types": body["payment_method_types"],
            "latest_charge": body["latest_charge"],
        }))
    }

    /// ✅ Crée un remboursement Stripe
    pub async fn create_refund(
        &self,
        payment_intent_id: &str,
        amount_cents: Option<i64>,
        reason: Option<&str>,
    ) -> Result<Value, String> {
        let mut params = vec![("payment_intent".to_string(), payment_intent_id.to_string())];

        if let Some(amount) = amount_cents {
            params.push(("amount".to_string(), amount.to_string()));
        }

        if let Some(r) = reason {
            params.push(("reason".to_string(), r.to_string()));
        }

        let response = self
            .client
            .post(&format!("{}/refunds", self.config.api_base))
            .basic_auth(&self.config.secret_key, Option::<&str>::None)
            .form(&params)
            .send()
            .await
            .map_err(|e| format!("Erreur réseau Stripe refund: {}", e))?;

        let status = response.status();
        let body: Value =
            response.json().await.map_err(|e| format!("Erreur parsing refund: {}", e))?;

        if !status.is_success() {
            let error_msg = body
                .get("error")
                .and_then(|e| e.get("message"))
                .and_then(|m| m.as_str())
                .unwrap_or("Erreur refund inconnue");
            return Err(format!("Stripe refund error: {}", error_msg));
        }

        log::info!(
            "[Stripe] ✅ Remboursement créé: {} pour PI {}",
            body["id"].as_str().unwrap_or("?"),
            payment_intent_id
        );

        Ok(body)
    }

    /// ✅ Vérifie la signature du webhook Stripe (HMAC-SHA256)
    pub fn verify_webhook_signature(
        &self,
        payload: &str,
        signature_header: &str,
    ) -> Result<StripeWebhookEvent, String> {
        use hmac::{Hmac, Mac};
        use sha2::Sha256;

        // Parser le header Stripe-Signature
        let mut timestamp = "";
        let mut signature = "";
        for part in signature_header.split(',') {
            let kv: Vec<&str> = part.trim().splitn(2, '=').collect();
            if kv.len() == 2 {
                match kv[0] {
                    "t" => timestamp = kv[1],
                    "v1" => signature = kv[1],
                    _ => {}
                }
            }
        }

        if timestamp.is_empty() || signature.is_empty() {
            return Err("Signature header invalide".to_string());
        }

        // Vérifier le timestamp (tolérance de 5 minutes)
        if let Ok(ts) = timestamp.parse::<i64>() {
            let now = chrono::Utc::now().timestamp();
            if (now - ts).abs() > 300 {
                return Err("Webhook timestamp expiré".to_string());
            }
        }

        // Construire le signed payload et vérifier HMAC
        let signed_payload = format!("{}.{}", timestamp, payload);
        type HmacSha256 = Hmac<Sha256>;
        let mut mac = HmacSha256::new_from_slice(self.config.webhook_secret.as_bytes())
            .map_err(|_| "Erreur HMAC init")?;
        mac.update(signed_payload.as_bytes());

        let expected_sig = hex::encode(mac.finalize().into_bytes());
        if expected_sig != signature {
            return Err("Signature webhook invalide".to_string());
        }

        // Parser l'événement
        serde_json::from_str(payload).map_err(|e| format!("Erreur parsing webhook event: {}", e))
    }

    /// ✅ Crée un Stripe Connect account pour un partenaire (pour les payouts)
    pub async fn create_connect_account(
        &self,
        email: &str,
        country: &str,
    ) -> Result<Value, String> {
        let params = vec![
            ("type", "express"),
            ("country", country),
            ("email", email),
            ("capabilities[transfers][requested]", "true"),
        ];

        let response = self
            .client
            .post(&format!("{}/accounts", self.config.api_base))
            .basic_auth(&self.config.secret_key, Option::<&str>::None)
            .form(&params)
            .send()
            .await
            .map_err(|e| format!("Erreur Stripe Connect: {}", e))?;

        let body: Value = response.json().await.map_err(|e| format!("Erreur parsing: {}", e))?;

        Ok(body)
    }

    /// ✅ Transfère des fonds à un compte Connect (payout partenaire)
    pub async fn create_transfer(
        &self,
        amount_cents: i64,
        currency: &str,
        destination_account: &str,
        description: &str,
    ) -> Result<Value, String> {
        let params = vec![
            ("amount".to_string(), amount_cents.to_string()),
            ("currency".to_string(), currency.to_string()),
            ("destination".to_string(), destination_account.to_string()),
            ("description".to_string(), description.to_string()),
        ];

        let response = self
            .client
            .post(&format!("{}/transfers", self.config.api_base))
            .basic_auth(&self.config.secret_key, Option::<&str>::None)
            .form(&params)
            .send()
            .await
            .map_err(|e| format!("Erreur Stripe Transfer: {}", e))?;

        let body: Value =
            response.json().await.map_err(|e| format!("Erreur parsing transfer: {}", e))?;

        log::info!(
            "[Stripe] ✅ Transfer {} cents {} vers {}",
            amount_cents,
            currency,
            destination_account
        );

        Ok(body)
    }
}
