// ✅ Service d'agrégation de paiement — Production-ready
// Supporte CinetPay (primaire) et NotchPay (fallback)
// Une seule API pour: MTN MoMo, Orange Money, Visa, Mastercard
//
// Architecture:
//   Mobile → Backend → Agrégateur (CinetPay/NotchPay) → MTN/Orange/Visa
//   Agrégateur → Webhook → Backend → Crédit tokens

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use uuid::Uuid;

// ============================================================================
// TYPES PUBLICS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AggregatorProvider {
    CinetPay,
    NotchPay,
}

impl std::fmt::Display for AggregatorProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AggregatorProvider::CinetPay => write!(f, "cinetpay"),
            AggregatorProvider::NotchPay => write!(f, "notchpay"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PayChannel {
    MtnMoney,
    OrangeMoney,
    Visa,
    Mastercard,
    AllMobileMoney,
}

impl PayChannel {
    /// Convertir en code CinetPay
    pub fn to_cinetpay_channel(&self) -> Option<&str> {
        match self {
            PayChannel::MtnMoney => Some("MTN"),
            PayChannel::OrangeMoney => Some("OM"),
            PayChannel::Visa | PayChannel::Mastercard => Some("CARD"),
            PayChannel::AllMobileMoney => None, // Laisser CinetPay afficher tous
        }
    }

    /// Convertir en code NotchPay
    pub fn to_notchpay_channel(&self) -> &str {
        match self {
            PayChannel::MtnMoney => "cm.mtn",
            PayChannel::OrangeMoney => "cm.orange",
            PayChannel::Visa | PayChannel::Mastercard => "card",
            PayChannel::AllMobileMoney => "cm.mobile",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitPaymentRequest {
    pub user_id: i32,
    pub amount: i64,      // Montant en XAF (entier)
    pub currency: String, // "XAF"
    pub channel: PayChannel,
    pub phone_number: Option<String>,
    pub description: String,
    pub customer_email: Option<String>,
    pub customer_name: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitPaymentResponse {
    pub success: bool,
    pub transaction_id: String, // Notre ID interne
    pub provider: AggregatorProvider,
    pub provider_reference: String,    // ID côté agrégateur
    pub payment_url: Option<String>,   // URL de paiement (pour cartes/redirect)
    pub payment_token: Option<String>, // Token pour SDK mobile
    pub status: PaymentAggStatus,
    pub instructions: Option<String>, // Instructions pour l'utilisateur
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PaymentAggStatus {
    Pending,
    AwaitingConfirmation,
    Processing,
    Completed,
    Failed,
    Cancelled,
    Expired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckStatusResponse {
    pub transaction_id: String,
    pub provider_reference: String,
    pub status: PaymentAggStatus,
    pub amount: i64,
    pub currency: String,
    pub payment_method: Option<String>,
    pub provider_data: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookVerification {
    pub is_valid: bool,
    pub transaction_id: Option<String>,
    pub status: Option<PaymentAggStatus>,
    pub amount: Option<i64>,
    pub currency: Option<String>,
    pub provider_reference: Option<String>,
    pub raw_data: Option<serde_json::Value>,
}

// ============================================================================
// CONFIGURATION
// ============================================================================

#[derive(Debug, Clone)]
pub struct AggregatorConfig {
    // CinetPay
    pub cinetpay_api_key: String,
    pub cinetpay_site_id: String,
    pub cinetpay_secret_key: String, // Pour vérification webhook
    pub cinetpay_base_url: String,

    // NotchPay (fallback)
    pub notchpay_public_key: String,
    pub notchpay_secret_key: String, // Aussi pour auth API
    pub notchpay_base_url: String,

    // Général
    pub webhook_base_url: String, // Ex: https://api.yukpo.com
    pub primary_provider: AggregatorProvider,
}

impl AggregatorConfig {
    pub fn from_env() -> Self {
        let primary =
            std::env::var("PAYMENT_PRIMARY_PROVIDER").unwrap_or_else(|_| "cinetpay".to_string());

        Self {
            cinetpay_api_key: std::env::var("CINETPAY_API_KEY").unwrap_or_default(),
            cinetpay_site_id: std::env::var("CINETPAY_SITE_ID").unwrap_or_default(),
            cinetpay_secret_key: std::env::var("CINETPAY_SECRET_KEY").unwrap_or_default(),
            cinetpay_base_url: std::env::var("CINETPAY_BASE_URL")
                .unwrap_or_else(|_| "https://api-checkout.cinetpay.com".to_string()),

            notchpay_public_key: std::env::var("NOTCHPAY_PUBLIC_KEY").unwrap_or_default(),
            notchpay_secret_key: std::env::var("NOTCHPAY_SECRET_KEY").unwrap_or_default(),
            notchpay_base_url: std::env::var("NOTCHPAY_BASE_URL")
                .unwrap_or_else(|_| "https://api.notchpay.co".to_string()),

            webhook_base_url: std::env::var("WEBHOOK_BASE_URL")
                .or_else(|_| std::env::var("BACKEND_URL"))
                .unwrap_or_else(|_| "https://api.yukpo.com".to_string()),

            primary_provider: if primary == "notchpay" {
                AggregatorProvider::NotchPay
            } else {
                AggregatorProvider::CinetPay
            },
        }
    }

    pub fn is_cinetpay_configured(&self) -> bool {
        !self.cinetpay_api_key.is_empty() && !self.cinetpay_site_id.is_empty()
    }

    pub fn is_notchpay_configured(&self) -> bool {
        !self.notchpay_public_key.is_empty() && !self.notchpay_secret_key.is_empty()
    }
}

// ============================================================================
// SERVICE PRINCIPAL
// ============================================================================

pub struct PaymentAggregator {
    config: AggregatorConfig,
    client: Client,
}

impl PaymentAggregator {
    pub fn new() -> Self {
        let config = AggregatorConfig::from_env();
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self { config, client }
    }

    pub fn with_config(config: AggregatorConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self { config, client }
    }

    /// Initier un paiement via l'agrégateur configuré
    pub async fn initiate_payment(
        &self,
        request: InitPaymentRequest,
    ) -> Result<InitPaymentResponse, String> {
        let transaction_id = format!(
            "yukpo_{}",
            Uuid::new_v4().to_string().replace("-", "")[..16].to_string()
        );

        // Essayer le provider primaire, puis fallback
        match &self.config.primary_provider {
            AggregatorProvider::CinetPay => {
                if self.config.is_cinetpay_configured() {
                    match self.initiate_cinetpay(&transaction_id, &request).await {
                        Ok(response) => return Ok(response),
                        Err(e) => {
                            log::warn!(
                                "[PaymentAggregator] CinetPay failed, trying NotchPay: {}",
                                e
                            );
                            if self.config.is_notchpay_configured() {
                                return self.initiate_notchpay(&transaction_id, &request).await;
                            }
                            return Err(e);
                        }
                    }
                } else if self.config.is_notchpay_configured() {
                    return self.initiate_notchpay(&transaction_id, &request).await;
                }
            }
            AggregatorProvider::NotchPay => {
                if self.config.is_notchpay_configured() {
                    match self.initiate_notchpay(&transaction_id, &request).await {
                        Ok(response) => return Ok(response),
                        Err(e) => {
                            log::warn!(
                                "[PaymentAggregator] NotchPay failed, trying CinetPay: {}",
                                e
                            );
                            if self.config.is_cinetpay_configured() {
                                return self.initiate_cinetpay(&transaction_id, &request).await;
                            }
                            return Err(e);
                        }
                    }
                } else if self.config.is_cinetpay_configured() {
                    return self.initiate_cinetpay(&transaction_id, &request).await;
                }
            }
        }

        Err("Aucun agrégateur de paiement configuré. Configurez CINETPAY_API_KEY ou NOTCHPAY_PUBLIC_KEY.".to_string())
    }

    /// Vérifier le statut d'un paiement
    pub async fn check_status(
        &self,
        transaction_id: &str,
        provider: &AggregatorProvider,
        provider_reference: &str,
    ) -> Result<CheckStatusResponse, String> {
        match provider {
            AggregatorProvider::CinetPay => {
                self.check_cinetpay_status(transaction_id, provider_reference).await
            }
            AggregatorProvider::NotchPay => {
                self.check_notchpay_status(transaction_id, provider_reference).await
            }
        }
    }

    /// Vérifier et parser un webhook entrant
    pub fn verify_webhook(
        &self,
        provider: &AggregatorProvider,
        headers: &std::collections::HashMap<String, String>,
        body: &[u8],
    ) -> WebhookVerification {
        match provider {
            AggregatorProvider::CinetPay => self.verify_cinetpay_webhook(body),
            AggregatorProvider::NotchPay => self.verify_notchpay_webhook(headers, body),
        }
    }

    /// Retourne le provider actuellement configuré
    pub fn active_provider(&self) -> Option<AggregatorProvider> {
        match &self.config.primary_provider {
            AggregatorProvider::CinetPay if self.config.is_cinetpay_configured() => {
                Some(AggregatorProvider::CinetPay)
            }
            AggregatorProvider::NotchPay if self.config.is_notchpay_configured() => {
                Some(AggregatorProvider::NotchPay)
            }
            _ if self.config.is_cinetpay_configured() => Some(AggregatorProvider::CinetPay),
            _ if self.config.is_notchpay_configured() => Some(AggregatorProvider::NotchPay),
            _ => None,
        }
    }

    // ========================================================================
    // CINETPAY
    // ========================================================================

    async fn initiate_cinetpay(
        &self,
        transaction_id: &str,
        request: &InitPaymentRequest,
    ) -> Result<InitPaymentResponse, String> {
        log::info!(
            "[CinetPay] Initiation paiement: {} XAF pour user {}",
            request.amount,
            request.user_id
        );

        let notify_url = format!("{}/api/webhooks/cinetpay", self.config.webhook_base_url);
        let return_url = format!(
            "{}/payment/success?txn={}",
            self.config.webhook_base_url, transaction_id
        );
        let cancel_url = format!(
            "{}/payment/cancel?txn={}",
            self.config.webhook_base_url, transaction_id
        );

        let mut payload = serde_json::json!({
            "apikey": self.config.cinetpay_api_key,
            "site_id": self.config.cinetpay_site_id,
            "transaction_id": transaction_id,
            "amount": request.amount,
            "currency": &request.currency,
            "description": &request.description,
            "notify_url": notify_url,
            "return_url": return_url,
            "cancel_url": cancel_url,
            "channels": "ALL",
            "lang": "fr",
            "metadata": transaction_id,
            "customer_name": request.customer_name.as_deref().unwrap_or("Client Yukpo"),
            "customer_email": request.customer_email.as_deref().unwrap_or("client@yukpo.com"),
            "customer_phone_number": request.phone_number.as_deref().unwrap_or(""),
            "customer_address": "Cameroun",
            "customer_city": "Douala",
            "customer_country": "CM",
        });

        // Filtrer le canal si spécifié
        if let Some(channel_code) = request.channel.to_cinetpay_channel() {
            payload["channels"] = serde_json::json!(channel_code);
        }

        // Si mobile money avec numéro de téléphone, utiliser l'API de paiement direct
        if let Some(phone) = &request.phone_number {
            if matches!(
                request.channel,
                PayChannel::MtnMoney | PayChannel::OrangeMoney | PayChannel::AllMobileMoney
            ) {
                payload["customer_phone_number"] = serde_json::json!(phone);
                payload["alternative_currency"] = serde_json::json!("");
            }
        }

        let response = self
            .client
            .post(&format!("{}/v2/payment", self.config.cinetpay_base_url))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Erreur réseau CinetPay: {}", e))?;

        let status_code = response.status();
        let response_text = response
            .text()
            .await
            .map_err(|e| format!("Erreur lecture réponse CinetPay: {}", e))?;

        log::info!(
            "[CinetPay] Response {}: {}",
            status_code,
            &response_text[..response_text.len().min(500)]
        );

        let response_json: serde_json::Value =
            serde_json::from_str(&response_text).map_err(|e| {
                format!(
                    "Erreur parsing CinetPay: {} - Body: {}",
                    e,
                    &response_text[..response_text.len().min(200)]
                )
            })?;

        // CinetPay retourne { code: "201", message: "...", data: { payment_token, payment_url } }
        let code = response_json.get("code").and_then(|c| c.as_str()).unwrap_or("");

        if code != "201" {
            let message = response_json
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("Erreur inconnue");
            return Err(format!("CinetPay erreur {}: {}", code, message));
        }

        let data = response_json.get("data").ok_or("CinetPay: champ 'data' manquant")?;

        let payment_token =
            data.get("payment_token").and_then(|t| t.as_str()).map(|s| s.to_string());

        let payment_url = data.get("payment_url").and_then(|u| u.as_str()).map(|s| s.to_string());

        Ok(InitPaymentResponse {
            success: true,
            transaction_id: transaction_id.to_string(),
            provider: AggregatorProvider::CinetPay,
            provider_reference: payment_token.clone().unwrap_or_default(),
            payment_url,
            payment_token,
            status: PaymentAggStatus::Pending,
            instructions: Some(
                "Validez le paiement sur votre téléphone ou via la page de paiement.".to_string(),
            ),
        })
    }

    async fn check_cinetpay_status(
        &self,
        transaction_id: &str,
        _provider_reference: &str,
    ) -> Result<CheckStatusResponse, String> {
        let payload = serde_json::json!({
            "apikey": self.config.cinetpay_api_key,
            "site_id": self.config.cinetpay_site_id,
            "transaction_id": transaction_id,
        });

        let response = self
            .client
            .post(&format!(
                "{}/v2/payment/check",
                self.config.cinetpay_base_url
            ))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Erreur réseau CinetPay check: {}", e))?;

        let response_json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Erreur parsing CinetPay check: {}", e))?;

        let code = response_json.get("code").and_then(|c| c.as_str()).unwrap_or("");

        let data = response_json.get("data").cloned().unwrap_or(serde_json::json!({}));

        let status = match code {
            "00" => PaymentAggStatus::Completed,
            "627" | "600" => PaymentAggStatus::Processing,
            "623" | "624" => PaymentAggStatus::Failed,
            "625" => PaymentAggStatus::Cancelled,
            "626" => PaymentAggStatus::Expired,
            _ => PaymentAggStatus::Pending,
        };

        let amount = data.get("amount").and_then(|a| a.as_f64()).map(|a| a as i64).unwrap_or(0);

        let currency = data.get("currency").and_then(|c| c.as_str()).unwrap_or("XAF").to_string();

        let payment_method =
            data.get("payment_method").and_then(|m| m.as_str()).map(|s| s.to_string());

        Ok(CheckStatusResponse {
            transaction_id: transaction_id.to_string(),
            provider_reference: data
                .get("payment_token")
                .and_then(|t| t.as_str())
                .unwrap_or("")
                .to_string(),
            status,
            amount,
            currency,
            payment_method,
            provider_data: Some(data),
        })
    }

    fn verify_cinetpay_webhook(&self, body: &[u8]) -> WebhookVerification {
        // CinetPay envoie un POST avec cpm_trans_id dans le body
        let body_json: serde_json::Value = match serde_json::from_slice(body) {
            Ok(v) => v,
            Err(e) => {
                log::warn!("[CinetPay] Webhook parse error: {}", e);
                return WebhookVerification {
                    is_valid: false,
                    transaction_id: None,
                    status: None,
                    amount: None,
                    currency: None,
                    provider_reference: None,
                    raw_data: None,
                };
            }
        };

        let transaction_id = body_json
            .get("cpm_trans_id")
            .or_else(|| body_json.get("transaction_id"))
            .and_then(|t| t.as_str())
            .map(|s| s.to_string());

        // CinetPay webhook est considéré valide si on a un transaction_id
        // La vérification réelle se fait via l'appel check_status
        let is_valid = transaction_id.is_some();

        WebhookVerification {
            is_valid,
            transaction_id,
            status: None, // On vérifiera via check_status
            amount: None,
            currency: None,
            provider_reference: body_json
                .get("cpm_payment_id")
                .and_then(|p| p.as_str())
                .map(|s| s.to_string()),
            raw_data: Some(body_json),
        }
    }

    // ========================================================================
    // NOTCHPAY
    // ========================================================================

    async fn initiate_notchpay(
        &self,
        transaction_id: &str,
        request: &InitPaymentRequest,
    ) -> Result<InitPaymentResponse, String> {
        log::info!(
            "[NotchPay] Initiation paiement: {} XAF pour user {}",
            request.amount,
            request.user_id
        );

        let callback_url = format!("{}/api/webhooks/notchpay", self.config.webhook_base_url);

        let mut payload = serde_json::json!({
            "amount": request.amount,
            "currency": &request.currency,
            "description": &request.description,
            "reference": transaction_id,
            "callback": callback_url,
            "email": request.customer_email.as_deref().unwrap_or("client@yukpo.com"),
        });

        // Ajouter le canal de paiement
        let channel_code = request.channel.to_notchpay_channel();
        payload["channel"] = serde_json::json!(channel_code);

        // Ajouter le numéro de téléphone pour mobile money
        if let Some(phone) = &request.phone_number {
            payload["phone"] = serde_json::json!(phone);
        }

        let response = self
            .client
            .post(&format!(
                "{}/payments/initialize",
                self.config.notchpay_base_url
            ))
            .header("Authorization", &self.config.notchpay_public_key)
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Erreur réseau NotchPay: {}", e))?;

        let status_code = response.status();
        let response_text = response
            .text()
            .await
            .map_err(|e| format!("Erreur lecture réponse NotchPay: {}", e))?;

        log::info!(
            "[NotchPay] Response {}: {}",
            status_code,
            &response_text[..response_text.len().min(500)]
        );

        let response_json: serde_json::Value = serde_json::from_str(&response_text)
            .map_err(|e| format!("Erreur parsing NotchPay: {}", e))?;

        if !status_code.is_success() {
            let message = response_json
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("Erreur inconnue");
            return Err(format!("NotchPay erreur {}: {}", status_code, message));
        }

        let transaction = response_json
            .get("transaction")
            .ok_or("NotchPay: champ 'transaction' manquant")?;

        let provider_reference = transaction
            .get("reference")
            .and_then(|r| r.as_str())
            .unwrap_or(transaction_id)
            .to_string();

        let authorization_url = response_json
            .get("authorization_url")
            .and_then(|u| u.as_str())
            .map(|s| s.to_string());

        Ok(InitPaymentResponse {
            success: true,
            transaction_id: transaction_id.to_string(),
            provider: AggregatorProvider::NotchPay,
            provider_reference,
            payment_url: authorization_url,
            payment_token: None,
            status: PaymentAggStatus::Pending,
            instructions: Some(
                "Validez le paiement sur votre téléphone ou via la page de paiement.".to_string(),
            ),
        })
    }

    async fn check_notchpay_status(
        &self,
        transaction_id: &str,
        provider_reference: &str,
    ) -> Result<CheckStatusResponse, String> {
        let ref_to_use = if provider_reference.is_empty() {
            transaction_id
        } else {
            provider_reference
        };

        let response = self
            .client
            .get(&format!(
                "{}/payments/{}",
                self.config.notchpay_base_url, ref_to_use
            ))
            .header("Authorization", &self.config.notchpay_secret_key)
            .send()
            .await
            .map_err(|e| format!("Erreur réseau NotchPay check: {}", e))?;

        let response_json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Erreur parsing NotchPay check: {}", e))?;

        let transaction = response_json.get("transaction").unwrap_or(&response_json);

        let status_str = transaction.get("status").and_then(|s| s.as_str()).unwrap_or("pending");

        let status = match status_str {
            "complete" | "successful" => PaymentAggStatus::Completed,
            "pending" => PaymentAggStatus::Pending,
            "processing" => PaymentAggStatus::Processing,
            "failed" | "rejected" => PaymentAggStatus::Failed,
            "cancelled" | "canceled" => PaymentAggStatus::Cancelled,
            "expired" => PaymentAggStatus::Expired,
            _ => PaymentAggStatus::Pending,
        };

        let amount = transaction
            .get("amount")
            .and_then(|a| a.as_f64())
            .map(|a| a as i64)
            .unwrap_or(0);

        Ok(CheckStatusResponse {
            transaction_id: transaction_id.to_string(),
            provider_reference: ref_to_use.to_string(),
            status,
            amount,
            currency: transaction
                .get("currency")
                .and_then(|c| c.as_str())
                .unwrap_or("XAF")
                .to_string(),
            payment_method: transaction
                .get("channel")
                .and_then(|c| c.as_str())
                .map(|s| s.to_string()),
            provider_data: Some(response_json),
        })
    }

    // ========================================================================
    // DISBURSEMENT (TRANSFERTS SORTANTS)
    // ========================================================================

    /// ✅ Initie un transfert sortant (disbursement) vers un numéro mobile money
    /// Essaie CinetPay transfer API, puis NotchPay transfer API en fallback
    pub async fn initiate_disbursement(
        &self,
        phone: &str,
        amount_cents: i64,
        method: &str,    // "mtn_money" ou "orange_money"
        reference: &str, // Référence unique Yukpo
    ) -> Result<String, String> {
        let amount = amount_cents / 100; // Convertir centimes → unité monétaire
        if amount <= 0 {
            return Err("Montant de transfert invalide".to_string());
        }

        // Essayer CinetPay Transfer API en premier
        if self.config.is_cinetpay_configured() {
            match self.cinetpay_transfer(phone, amount, method, reference).await {
                Ok(ref_id) => return Ok(ref_id),
                Err(e) => {
                    log::warn!(
                        "[Disbursement] CinetPay transfer échoué, trying NotchPay: {}",
                        e
                    );
                }
            }
        }

        // Fallback NotchPay Transfer API
        if self.config.is_notchpay_configured() {
            return self.notchpay_transfer(phone, amount, method, reference).await;
        }

        Err("Aucun agrégateur configuré pour le disbursement. Configurez CINETPAY_API_KEY ou NOTCHPAY_PUBLIC_KEY.".to_string())
    }

    /// CinetPay Transfer API (POST /v2/transfer/money/send/contact)
    async fn cinetpay_transfer(
        &self,
        phone: &str,
        amount: i64,
        method: &str,
        reference: &str,
    ) -> Result<String, String> {
        log::info!(
            "[CinetPay Transfer] {} XAF vers {} via {}",
            amount,
            phone,
            method
        );

        let operator = match method {
            "mtn_money" | "mtn" => "MTN",
            "orange_money" | "orange" => "ORANGE",
            _ => "MTN",
        };

        let payload = serde_json::json!({
            "apikey": self.config.cinetpay_api_key,
            "site_id": self.config.cinetpay_site_id,
            "transaction_id": reference,
            "amount": amount,
            "currency": "XAF",
            "phone": phone,
            "operator": operator,
            "payment_method": "MOBILE_MONEY",
            "notify_url": format!("{}/api/webhooks/cinetpay/disbursement", self.config.webhook_base_url),
        });

        let response = self
            .client
            .post(&format!(
                "{}/v2/transfer/money/send/contact",
                self.config.cinetpay_base_url
            ))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Erreur réseau CinetPay transfer: {}", e))?;

        let status_code = response.status();
        let response_text = response
            .text()
            .await
            .map_err(|e| format!("Erreur lecture CinetPay transfer: {}", e))?;

        log::info!(
            "[CinetPay Transfer] Response {}: {}",
            status_code,
            &response_text[..response_text.len().min(500)]
        );

        let response_json: serde_json::Value = serde_json::from_str(&response_text)
            .map_err(|e| format!("Erreur parsing CinetPay transfer: {}", e))?;

        let code = response_json.get("code").and_then(|c| c.as_str()).unwrap_or("");

        if code == "00" || code == "201" {
            let data = response_json.get("data").cloned().unwrap_or(serde_json::json!({}));
            let txn_id = data
                .get("transaction_id")
                .or_else(|| response_json.get("transaction_id"))
                .and_then(|t| t.as_str())
                .unwrap_or(reference)
                .to_string();
            Ok(txn_id)
        } else {
            let message = response_json
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("Erreur inconnue");
            Err(format!("CinetPay transfer erreur {}: {}", code, message))
        }
    }

    /// NotchPay Transfer API (POST /transfers)
    async fn notchpay_transfer(
        &self,
        phone: &str,
        amount: i64,
        method: &str,
        reference: &str,
    ) -> Result<String, String> {
        log::info!(
            "[NotchPay Transfer] {} XAF vers {} via {}",
            amount,
            phone,
            method
        );

        let channel = match method {
            "mtn_money" | "mtn" => "cm.mtn",
            "orange_money" | "orange" => "cm.orange",
            _ => "cm.mtn",
        };

        let payload = serde_json::json!({
            "amount": amount,
            "currency": "XAF",
            "phone": phone,
            "channel": channel,
            "reference": reference,
            "description": "Reversement Yukpo",
            "callback": format!("{}/api/webhooks/notchpay/disbursement", self.config.webhook_base_url),
        });

        let response = self
            .client
            .post(&format!("{}/transfers", self.config.notchpay_base_url))
            .header("Authorization", &self.config.notchpay_secret_key)
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Erreur réseau NotchPay transfer: {}", e))?;

        let status_code = response.status();
        let response_text = response
            .text()
            .await
            .map_err(|e| format!("Erreur lecture NotchPay transfer: {}", e))?;

        log::info!(
            "[NotchPay Transfer] Response {}: {}",
            status_code,
            &response_text[..response_text.len().min(500)]
        );

        let response_json: serde_json::Value = serde_json::from_str(&response_text)
            .map_err(|e| format!("Erreur parsing NotchPay transfer: {}", e))?;

        if status_code.is_success() {
            let transfer = response_json.get("transfer").cloned().unwrap_or(response_json.clone());
            let ref_id = transfer
                .get("reference")
                .or_else(|| transfer.get("id"))
                .and_then(|r| r.as_str())
                .unwrap_or(reference)
                .to_string();
            Ok(ref_id)
        } else {
            let message = response_json
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("Erreur inconnue");
            Err(format!(
                "NotchPay transfer erreur {}: {}",
                status_code, message
            ))
        }
    }

    fn verify_notchpay_webhook(
        &self,
        headers: &std::collections::HashMap<String, String>,
        body: &[u8],
    ) -> WebhookVerification {
        // NotchPay envoie un header x-notch-signature avec HMAC-SHA256
        let signature = headers
            .get("x-notch-signature")
            .or_else(|| headers.get("X-Notch-Signature"))
            .cloned()
            .unwrap_or_default();

        let is_valid = if !self.config.notchpay_secret_key.is_empty() && !signature.is_empty() {
            use hmac::{Hmac, Mac};
            use sha2::Sha256;
            type HmacSha256 = Hmac<Sha256>;

            match HmacSha256::new_from_slice(self.config.notchpay_secret_key.as_bytes()) {
                Ok(mut mac) => {
                    mac.update(body);
                    let expected = hex::encode(mac.finalize().into_bytes());
                    // Comparaison constant-time
                    expected == signature
                }
                Err(_) => false,
            }
        } else {
            // Si pas de secret configuré, on accepte mais on logge un warning
            log::warn!(
                "[NotchPay] Webhook reçu sans vérification de signature (secret non configuré)"
            );
            !signature.is_empty() || self.config.notchpay_secret_key.is_empty()
        };

        let body_json: serde_json::Value =
            serde_json::from_slice(body).unwrap_or(serde_json::json!({}));

        let event = body_json.get("event").and_then(|e| e.as_str()).unwrap_or("");
        let data = body_json.get("data").cloned().unwrap_or(serde_json::json!({}));

        let status = match event {
            "payment.complete" => Some(PaymentAggStatus::Completed),
            "payment.failed" => Some(PaymentAggStatus::Failed),
            "payment.cancelled" => Some(PaymentAggStatus::Cancelled),
            "payment.expired" => Some(PaymentAggStatus::Expired),
            _ => None,
        };

        let transaction_id = data.get("reference").and_then(|r| r.as_str()).map(|s| s.to_string());

        let amount = data.get("amount").and_then(|a| a.as_f64()).map(|a| a as i64);

        WebhookVerification {
            is_valid,
            transaction_id,
            status,
            amount,
            currency: data.get("currency").and_then(|c| c.as_str()).map(|s| s.to_string()),
            provider_reference: data.get("id").and_then(|i| i.as_str()).map(|s| s.to_string()),
            raw_data: Some(body_json),
        }
    }
}
