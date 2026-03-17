// ✅ 2026-03-17: Service PayPal pour paiements internationaux
// Utilise l'API REST PayPal Orders v2 directement via reqwest
// Supporte: PayPal Balance, cartes via PayPal, Pay Later

use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Clone)]
pub struct PayPalConfig {
    pub client_id: String,
    pub client_secret: String,
    pub api_base: String,
    pub return_url: String,
    pub cancel_url: String,
}

impl PayPalConfig {
    pub fn from_env() -> Option<Self> {
        let client_id = std::env::var("PAYPAL_CLIENT_ID").ok()?;
        let client_secret = std::env::var("PAYPAL_CLIENT_SECRET").ok()?;
        let is_sandbox =
            std::env::var("PAYPAL_SANDBOX").unwrap_or_else(|_| "true".to_string()) == "true";
        let api_base = if is_sandbox {
            "https://api-m.sandbox.paypal.com".to_string()
        } else {
            "https://api-m.paypal.com".to_string()
        };
        let return_url = std::env::var("PAYPAL_RETURN_URL")
            .unwrap_or_else(|_| "https://yukpo.cm/api/webhooks/paypal/return".to_string());
        let cancel_url = std::env::var("PAYPAL_CANCEL_URL")
            .unwrap_or_else(|_| "https://yukpo.cm/api/webhooks/paypal/cancel".to_string());

        Some(Self {
            client_id,
            client_secret,
            api_base,
            return_url,
            cancel_url,
        })
    }

    pub fn is_configured() -> bool {
        std::env::var("PAYPAL_CLIENT_ID").is_ok() && std::env::var("PAYPAL_CLIENT_SECRET").is_ok()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PayPalCurrency {
    USD,
    EUR,
    GBP,
    CAD,
    CHF,
    AUD,
    JPY,
    XAF,
    XOF,
}

impl PayPalCurrency {
    pub fn as_str(&self) -> &str {
        match self {
            Self::USD => "USD",
            Self::EUR => "EUR",
            Self::GBP => "GBP",
            Self::CAD => "CAD",
            Self::CHF => "CHF",
            Self::AUD => "AUD",
            Self::JPY => "JPY",
            Self::XAF => "XAF",
            Self::XOF => "XOF",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_uppercase().as_str() {
            "USD" => Self::USD,
            "EUR" => Self::EUR,
            "GBP" => Self::GBP,
            "CAD" => Self::CAD,
            "CHF" => Self::CHF,
            "AUD" => Self::AUD,
            "JPY" => Self::JPY,
            "XAF" => Self::XAF,
            "XOF" => Self::XOF,
            _ => Self::USD,
        }
    }
}

#[derive(Debug, Clone)]
pub struct PayPalOrderRequest {
    pub amount: f64,
    pub currency: PayPalCurrency,
    pub description: String,
    pub reference_id: String,
    pub payer_email: Option<String>,
    pub custom_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PayPalOrderResponse {
    pub order_id: String,
    pub status: String,
    pub approval_url: Option<String>,
    pub capture_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PayPalCaptureResponse {
    pub order_id: String,
    pub status: String,
    pub capture_id: Option<String>,
    pub amount: Option<f64>,
    pub currency: Option<String>,
    pub payer_email: Option<String>,
    pub payer_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PayPalWebhookEvent {
    pub id: String,
    pub event_type: String,
    pub resource: Value,
    pub create_time: String,
}

pub struct PayPalPaymentService {
    client: Client,
    config: PayPalConfig,
}

impl PayPalPaymentService {
    pub fn new() -> Result<Self, String> {
        let config = PayPalConfig::from_env()
            .ok_or_else(|| "PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET non configurés".to_string())?;
        Ok(Self {
            client: Client::new(),
            config,
        })
    }

    /// Obtient un access token OAuth2 (client_credentials grant)
    async fn get_access_token(&self) -> Result<String, String> {
        let response = self
            .client
            .post(&format!("{}/v1/oauth2/token", self.config.api_base))
            .basic_auth(&self.config.client_id, Some(&self.config.client_secret))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body("grant_type=client_credentials")
            .send()
            .await
            .map_err(|e| format!("Erreur réseau PayPal OAuth: {}", e))?;

        let status = response.status();
        let body: Value = response
            .json()
            .await
            .map_err(|e| format!("Erreur parsing PayPal OAuth: {}", e))?;

        if !status.is_success() {
            let error_msg = body["error_description"].as_str().unwrap_or("Erreur OAuth inconnue");
            return Err(format!("PayPal OAuth error: {}", error_msg));
        }

        body["access_token"]
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| "Missing access_token dans la réponse PayPal".to_string())
    }

    /// Crée un Order PayPal (Orders v2 API)
    pub async fn create_order(
        &self,
        request: PayPalOrderRequest,
    ) -> Result<PayPalOrderResponse, String> {
        let access_token = self.get_access_token().await?;

        let amount_str = format!("{:.2}", request.amount);

        let mut purchase_unit = json!({
            "reference_id": request.reference_id,
            "description": request.description,
            "amount": {
                "currency_code": request.currency.as_str(),
                "value": amount_str
            }
        });

        if let Some(custom_id) = &request.custom_id {
            purchase_unit["custom_id"] = json!(custom_id);
        }

        let mut order_body = json!({
            "intent": "CAPTURE",
            "purchase_units": [purchase_unit],
            "application_context": {
                "return_url": self.config.return_url,
                "cancel_url": self.config.cancel_url,
                "brand_name": "YukPo",
                "landing_page": "NO_PREFERENCE",
                "user_action": "PAY_NOW",
                "shipping_preference": "NO_SHIPPING"
            }
        });

        if let Some(email) = &request.payer_email {
            order_body["payer"] = json!({
                "email_address": email
            });
        }

        let response = self
            .client
            .post(&format!("{}/v2/checkout/orders", self.config.api_base))
            .bearer_auth(&access_token)
            .header("Content-Type", "application/json")
            .json(&order_body)
            .send()
            .await
            .map_err(|e| format!("Erreur réseau PayPal Create Order: {}", e))?;

        let status = response.status();
        let body: Value = response
            .json()
            .await
            .map_err(|e| format!("Erreur parsing PayPal Order: {}", e))?;

        if !status.is_success() {
            let error_msg = body["message"]
                .as_str()
                .or_else(|| {
                    body["details"]
                        .as_array()
                        .and_then(|d| d.first())
                        .and_then(|d| d["description"].as_str())
                })
                .unwrap_or("Erreur PayPal inconnue");
            log::error!("[PayPal] Erreur création Order: {}", error_msg);
            return Err(format!("PayPal error: {}", error_msg));
        }

        let order_id = body["id"].as_str().ok_or("Missing order id")?.to_string();
        let order_status = body["status"].as_str().unwrap_or("CREATED").to_string();

        let approval_url = body["links"]
            .as_array()
            .and_then(|links| links.iter().find(|l| l["rel"].as_str() == Some("approve")))
            .and_then(|l| l["href"].as_str())
            .map(|s| s.to_string());

        log::info!(
            "[PayPal] Order créé: {} - status={} - approval_url={:?}",
            order_id,
            order_status,
            approval_url
        );

        Ok(PayPalOrderResponse {
            order_id,
            status: order_status,
            approval_url,
            capture_url: None,
        })
    }

    /// Capture un Order PayPal approuvé par le client
    pub async fn capture_order(&self, order_id: &str) -> Result<PayPalCaptureResponse, String> {
        let access_token = self.get_access_token().await?;

        let response = self
            .client
            .post(&format!(
                "{}/v2/checkout/orders/{}/capture",
                self.config.api_base, order_id
            ))
            .bearer_auth(&access_token)
            .header("Content-Type", "application/json")
            .send()
            .await
            .map_err(|e| format!("Erreur réseau PayPal Capture: {}", e))?;

        let status = response.status();
        let body: Value = response
            .json()
            .await
            .map_err(|e| format!("Erreur parsing PayPal Capture: {}", e))?;

        if !status.is_success() {
            let error_msg = body["message"].as_str().unwrap_or("Erreur capture inconnue");
            log::error!("[PayPal] Erreur capture Order {}: {}", order_id, error_msg);
            return Err(format!("PayPal capture error: {}", error_msg));
        }

        let capture_status = body["status"].as_str().unwrap_or("UNKNOWN").to_string();

        let capture = body["purchase_units"]
            .as_array()
            .and_then(|pu| pu.first())
            .and_then(|pu| pu["payments"]["captures"].as_array())
            .and_then(|caps| caps.first());

        let capture_id = capture.and_then(|c| c["id"].as_str()).map(|s| s.to_string());
        let amount = capture
            .and_then(|c| c["amount"]["value"].as_str())
            .and_then(|v| v.parse::<f64>().ok());
        let currency = capture
            .and_then(|c| c["amount"]["currency_code"].as_str())
            .map(|s| s.to_string());

        let payer_email = body["payer"]["email_address"].as_str().map(|s| s.to_string());
        let payer_id = body["payer"]["payer_id"].as_str().map(|s| s.to_string());

        log::info!(
            "[PayPal] Order {} capturé: status={}, capture_id={:?}, amount={:?}",
            order_id,
            capture_status,
            capture_id,
            amount
        );

        Ok(PayPalCaptureResponse {
            order_id: order_id.to_string(),
            status: capture_status,
            capture_id,
            amount,
            currency,
            payer_email,
            payer_id,
        })
    }

    /// Vérifie le statut d'un Order
    pub async fn get_order_status(&self, order_id: &str) -> Result<Value, String> {
        let access_token = self.get_access_token().await?;

        let response = self
            .client
            .get(&format!(
                "{}/v2/checkout/orders/{}",
                self.config.api_base, order_id
            ))
            .bearer_auth(&access_token)
            .send()
            .await
            .map_err(|e| format!("Erreur réseau PayPal Get Order: {}", e))?;

        let body: Value = response.json().await.map_err(|e| format!("Erreur parsing: {}", e))?;

        Ok(json!({
            "id": body["id"],
            "status": body["status"],
            "purchase_units": body["purchase_units"],
            "payer": body["payer"],
            "create_time": body["create_time"],
            "update_time": body["update_time"],
        }))
    }

    /// Crée un remboursement PayPal
    pub async fn create_refund(
        &self,
        capture_id: &str,
        amount: Option<f64>,
        currency: Option<&str>,
        note: Option<&str>,
    ) -> Result<Value, String> {
        let access_token = self.get_access_token().await?;

        let mut refund_body = json!({});

        if let Some(amt) = amount {
            refund_body["amount"] = json!({
                "value": format!("{:.2}", amt),
                "currency_code": currency.unwrap_or("USD")
            });
        }

        if let Some(n) = note {
            refund_body["note_to_payer"] = json!(n);
        }

        let response = self
            .client
            .post(&format!(
                "{}/v2/payments/captures/{}/refund",
                self.config.api_base, capture_id
            ))
            .bearer_auth(&access_token)
            .header("Content-Type", "application/json")
            .json(&refund_body)
            .send()
            .await
            .map_err(|e| format!("Erreur réseau PayPal Refund: {}", e))?;

        let status = response.status();
        let body: Value =
            response.json().await.map_err(|e| format!("Erreur parsing refund: {}", e))?;

        if !status.is_success() {
            let error_msg = body["message"].as_str().unwrap_or("Erreur refund inconnue");
            return Err(format!("PayPal refund error: {}", error_msg));
        }

        log::info!(
            "[PayPal] Remboursement créé: {} pour capture {}",
            body["id"].as_str().unwrap_or("?"),
            capture_id
        );

        Ok(body)
    }

    /// Vérifie la signature d'un webhook PayPal
    pub async fn verify_webhook_signature(
        &self,
        webhook_id: &str,
        transmission_id: &str,
        transmission_time: &str,
        cert_url: &str,
        auth_algo: &str,
        transmission_sig: &str,
        webhook_event: &Value,
    ) -> Result<bool, String> {
        let access_token = self.get_access_token().await?;

        let verify_body = json!({
            "auth_algo": auth_algo,
            "cert_url": cert_url,
            "transmission_id": transmission_id,
            "transmission_sig": transmission_sig,
            "transmission_time": transmission_time,
            "webhook_id": webhook_id,
            "webhook_event": webhook_event
        });

        let response = self
            .client
            .post(&format!(
                "{}/v1/notifications/verify-webhook-signature",
                self.config.api_base
            ))
            .bearer_auth(&access_token)
            .header("Content-Type", "application/json")
            .json(&verify_body)
            .send()
            .await
            .map_err(|e| format!("Erreur réseau PayPal verify webhook: {}", e))?;

        let body: Value = response.json().await.map_err(|e| format!("Erreur parsing: {}", e))?;

        let verification_status = body["verification_status"].as_str().unwrap_or("FAILURE");

        Ok(verification_status == "SUCCESS")
    }

    /// Crée un Payout PayPal (pour reverser aux partenaires)
    pub async fn create_payout(
        &self,
        recipient_email: &str,
        amount: f64,
        currency: &str,
        note: &str,
        sender_batch_id: &str,
    ) -> Result<Value, String> {
        let access_token = self.get_access_token().await?;

        let payout_body = json!({
            "sender_batch_header": {
                "sender_batch_id": sender_batch_id,
                "email_subject": "YukPo - Reversement partenaire",
                "email_message": note
            },
            "items": [{
                "recipient_type": "EMAIL",
                "amount": {
                    "value": format!("{:.2}", amount),
                    "currency": currency
                },
                "receiver": recipient_email,
                "note": note,
                "sender_item_id": format!("payout_{}", chrono::Utc::now().timestamp())
            }]
        });

        let response = self
            .client
            .post(&format!("{}/v1/payments/payouts", self.config.api_base))
            .bearer_auth(&access_token)
            .header("Content-Type", "application/json")
            .json(&payout_body)
            .send()
            .await
            .map_err(|e| format!("Erreur réseau PayPal Payout: {}", e))?;

        let status = response.status();
        let body: Value =
            response.json().await.map_err(|e| format!("Erreur parsing payout: {}", e))?;

        if !status.is_success() {
            let error_msg = body["message"].as_str().unwrap_or("Erreur payout inconnue");
            return Err(format!("PayPal payout error: {}", error_msg));
        }

        log::info!(
            "[PayPal] Payout créé vers {} : {} {}",
            recipient_email,
            amount,
            currency
        );

        Ok(body)
    }
}
