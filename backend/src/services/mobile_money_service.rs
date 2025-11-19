// ✅ Phase 10 - Service d'intégration Mobile Money (MTN Money et Orange Money)
// Support pour les APIs MTN Mobile Money et Orange Money avec webhooks

use crate::core::types::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;

/// Configuration du service Mobile Money
#[derive(Debug, Clone)]
pub struct MobileMoneyConfig {
    pub mtn_enabled: bool,
    pub orange_enabled: bool,
    pub mtn_api_key: Option<String>,
    pub mtn_api_secret: Option<String>,
    pub mtn_merchant_id: Option<String>,
    pub mtn_environment: String, // "sandbox" ou "production"
    pub orange_api_key: Option<String>,
    pub orange_api_secret: Option<String>,
    pub orange_merchant_id: Option<String>,
    pub orange_environment: String, // "sandbox" ou "production"
    pub webhook_secret: Option<String>, // Secret pour vérifier les webhooks
}

impl MobileMoneyConfig {
    pub fn from_env() -> Self {
        let mtn_enabled = std::env::var("MTN_MONEY_ENABLED")
            .ok()
            .and_then(|v| v.parse::<bool>().ok())
            .unwrap_or(false);

        let orange_enabled = std::env::var("ORANGE_MONEY_ENABLED")
            .ok()
            .and_then(|v| v.parse::<bool>().ok())
            .unwrap_or(false);

        Self {
            mtn_enabled,
            orange_enabled,
            mtn_api_key: std::env::var("MTN_MONEY_API_KEY").ok(),
            mtn_api_secret: std::env::var("MTN_MONEY_API_SECRET").ok(),
            mtn_merchant_id: std::env::var("MTN_MONEY_MERCHANT_ID").ok(),
            mtn_environment: std::env::var("MTN_MONEY_ENVIRONMENT")
                .unwrap_or_else(|_| "sandbox".to_string()),
            orange_api_key: std::env::var("ORANGE_MONEY_API_KEY").ok(),
            orange_api_secret: std::env::var("ORANGE_MONEY_API_SECRET").ok(),
            orange_merchant_id: std::env::var("ORANGE_MONEY_MERCHANT_ID").ok(),
            orange_environment: std::env::var("ORANGE_MONEY_ENVIRONMENT")
                .unwrap_or_else(|_| "sandbox".to_string()),
            webhook_secret: std::env::var("MOBILE_MONEY_WEBHOOK_SECRET").ok(),
        }
    }

    pub fn is_mtn_configured(&self) -> bool {
        self.mtn_enabled
            && self.mtn_api_key.is_some()
            && self.mtn_api_secret.is_some()
            && self.mtn_merchant_id.is_some()
    }

    pub fn is_orange_configured(&self) -> bool {
        self.orange_enabled
            && self.orange_api_key.is_some()
            && self.orange_api_secret.is_some()
            && self.orange_merchant_id.is_some()
    }
}

/// Type de provider Mobile Money
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MobileMoneyProvider {
    MTN,
    Orange,
}

/// Requête de paiement Mobile Money
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MobileMoneyPaymentRequest {
    pub provider: MobileMoneyProvider,
    pub phone_number: String, // Format: +237612345678
    pub amount: f64,          // Montant en FCFA
    pub currency: String,     // "XAF" ou "XOF"
    pub transaction_reference: String, // Référence unique de transaction
    pub description: Option<String>,
    pub callback_url: Option<String>, // URL de callback pour webhook
}

/// Réponse d'initiation de paiement
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MobileMoneyPaymentResponse {
    pub success: bool,
    pub transaction_id: Option<String>,
    pub provider_transaction_id: Option<String>,
    pub status: PaymentStatus,
    pub message: String,
    pub instructions: Option<String>, // Instructions pour l'utilisateur (USSD, etc.)
    pub error: Option<String>,
}

/// Statut du paiement
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PaymentStatus {
    Pending,
    Processing,
    Completed,
    Failed,
    Cancelled,
}

/// Webhook de confirmation de paiement
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MobileMoneyWebhook {
    pub provider: MobileMoneyProvider,
    pub transaction_id: String,
    pub provider_transaction_id: String,
    pub status: PaymentStatus,
    pub amount: f64,
    pub phone_number: String,
    pub timestamp: String,
    pub signature: Option<String>, // Signature pour vérification
}

pub struct MobileMoneyService {
    config: MobileMoneyConfig,
    client: reqwest::Client,
}

impl MobileMoneyService {
    pub fn new() -> Self {
        let config = MobileMoneyConfig::from_env();
        let client = reqwest::Client::new();

        Self { config, client }
    }

    /// Initie un paiement Mobile Money
    pub async fn initiate_payment(
        &self,
        request: MobileMoneyPaymentRequest,
    ) -> AppResult<MobileMoneyPaymentResponse> {
        match request.provider {
            MobileMoneyProvider::MTN => self.initiate_mtn_payment(request).await,
            MobileMoneyProvider::Orange => self.initiate_orange_payment(request).await,
        }
    }

    /// Initie un paiement MTN Mobile Money
    async fn initiate_mtn_payment(
        &self,
        request: MobileMoneyPaymentRequest,
    ) -> AppResult<MobileMoneyPaymentResponse> {
        if !self.config.is_mtn_configured() {
            log::warn!(
                "[MobileMoney] 📱 MTN Money non configuré. Vérifiez MTN_MONEY_API_KEY, MTN_MONEY_API_SECRET, MTN_MONEY_MERCHANT_ID"
            );
            return Ok(MobileMoneyPaymentResponse {
                success: false,
                transaction_id: None,
                provider_transaction_id: None,
                status: PaymentStatus::Failed,
                message: "MTN Money non configuré".to_string(),
                instructions: Some(format!(
                    "Composez *126# > Envoyer de l'argent > Marchand > Code: YUKPO > Montant: {} FCFA",
                    request.amount
                )),
                error: Some("MTN Money non configuré".to_string()),
            });
        }

        let api_key = self.config.mtn_api_key.as_ref().unwrap();
        let _api_secret = self.config.mtn_api_secret.as_ref().unwrap();
        let _merchant_id = self.config.mtn_merchant_id.as_ref().unwrap();

        // URL de l'API MTN (exemple - à adapter selon la vraie API)
        let base_url = if self.config.mtn_environment == "production" {
            "https://api.mtn.com/v1"
        } else {
            "https://sandbox.mtn.com/v1"
        };

        let url = format!("{}/collection/requesttopay", base_url);

        // Construire le payload selon l'API MTN
        let payload = json!({
            "amount": request.amount,
            "currency": request.currency,
            "externalId": request.transaction_reference,
            "payer": {
                "partyIdType": "MSISDN",
                "partyId": request.phone_number.replace("+", "")
            },
            "payerMessage": request.description.unwrap_or_else(|| "Paiement Yukpomnang".to_string()),
            "payeeNote": format!("Transaction {}", request.transaction_reference)
        });

        log::info!(
            "[MobileMoney] 📱 Initiation paiement MTN: {} FCFA vers {}",
            request.amount,
            request.phone_number
        );

        // TODO: Implémenter l'appel réel à l'API MTN
        // Pour l'instant, on simule une réponse
        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("X-Target-Environment", &self.config.mtn_environment)
            .header("X-Reference-Id", &request.transaction_reference)
            .json(&payload)
            .send()
            .await;

        match response {
            Ok(resp) => {
                if resp.status().is_success() {
                    let response_json: serde_json::Value = resp
                        .json()
                        .await
                        .map_err(|e| AppError::Internal(format!("Erreur parsing réponse MTN: {}", e)))?;

                    let provider_transaction_id = response_json
                        .get("transactionId")
                        .and_then(|t| t.as_str())
                        .map(|s| s.to_string());

                    log::info!(
                        "[MobileMoney] ✅ Paiement MTN initié. Transaction ID: {:?}",
                        provider_transaction_id
                    );

                    Ok(MobileMoneyPaymentResponse {
                        success: true,
                        transaction_id: Some(request.transaction_reference),
                        provider_transaction_id,
                        status: PaymentStatus::Pending,
                        message: "Paiement initié avec succès".to_string(),
                        instructions: Some(format!(
                            "Vérifiez votre téléphone et confirmez le paiement de {} FCFA",
                            request.amount
                        )),
                        error: None,
                    })
                } else {
                    let error_text = resp
                        .text()
                        .await
                        .unwrap_or_else(|_| "Erreur inconnue".to_string());

                    log::error!(
                        "[MobileMoney] ❌ Erreur API MTN: {}",
                        error_text
                    );

                    Ok(MobileMoneyPaymentResponse {
                        success: false,
                        transaction_id: Some(request.transaction_reference),
                        provider_transaction_id: None,
                        status: PaymentStatus::Failed,
                        message: "Erreur lors de l'initiation du paiement".to_string(),
                        instructions: None,
                        error: Some(error_text),
                    })
                }
            }
            Err(e) => {
                log::error!(
                    "[MobileMoney] ❌ Erreur requête MTN: {}",
                    e
                );

                // Fallback: instructions manuelles
                let transaction_ref = request.transaction_reference.clone();
                Ok(MobileMoneyPaymentResponse {
                    success: false,
                    transaction_id: Some(transaction_ref.clone()),
                    provider_transaction_id: None,
                    status: PaymentStatus::Pending,
                    message: "Mode manuel activé".to_string(),
                    instructions: Some(format!(
                        "Composez *126# > Envoyer de l'argent > Marchand > Code: YUKPO > Montant: {} FCFA\n\nRéférence: {}",
                        request.amount,
                        transaction_ref
                    )),
                    error: Some(format!("Erreur API: {}", e)),
                })
            }
        }
    }

    /// Initie un paiement Orange Money
    async fn initiate_orange_payment(
        &self,
        request: MobileMoneyPaymentRequest,
    ) -> AppResult<MobileMoneyPaymentResponse> {
        if !self.config.is_orange_configured() {
            log::warn!(
                "[MobileMoney] 🍊 Orange Money non configuré. Vérifiez ORANGE_MONEY_API_KEY, ORANGE_MONEY_API_SECRET, ORANGE_MONEY_MERCHANT_ID"
            );
            return Ok(MobileMoneyPaymentResponse {
                success: false,
                transaction_id: None,
                provider_transaction_id: None,
                status: PaymentStatus::Failed,
                message: "Orange Money non configuré".to_string(),
                instructions: Some(format!(
                    "Composez #144*4*4*{}*{}# et suivez les instructions",
                    request.amount,
                    request.phone_number
                )),
                error: Some("Orange Money non configuré".to_string()),
            });
        }

        let api_key = self.config.orange_api_key.as_ref().unwrap();
        let _api_secret = self.config.orange_api_secret.as_ref().unwrap();
        let merchant_id = self.config.orange_merchant_id.as_ref().unwrap();

        // URL de l'API Orange Money (exemple - à adapter selon la vraie API)
        let base_url = if self.config.orange_environment == "production" {
            "https://api.orange.com/orange-money-webpay"
        } else {
            "https://api.orange.com/orange-money-webpay/dev"
        };

        let url = format!("{}/v1/webpayment", base_url);

        // Construire le payload selon l'API Orange Money
        let payload = json!({
            "merchant_key": merchant_id,
            "currency": request.currency,
            "order_id": request.transaction_reference,
            "amount": request.amount,
            "return_url": request.callback_url,
            "cancel_url": request.callback_url,
            "notif_url": request.callback_url,
            "lang": "fr",
            "reference": request.transaction_reference
        });

        log::info!(
            "[MobileMoney] 🍊 Initiation paiement Orange Money: {} FCFA vers {}",
            request.amount,
            request.phone_number
        );

        // TODO: Implémenter l'appel réel à l'API Orange Money
        // Pour l'instant, on simule une réponse
        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await;

        match response {
            Ok(resp) => {
                if resp.status().is_success() {
                    let response_json: serde_json::Value = resp
                        .json()
                        .await
                        .map_err(|e| AppError::Internal(format!("Erreur parsing réponse Orange: {}", e)))?;

                    let provider_transaction_id = response_json
                        .get("pay_token")
                        .and_then(|t| t.as_str())
                        .map(|s| s.to_string());

                    let payment_url = response_json
                        .get("payment_url")
                        .and_then(|u| u.as_str())
                        .map(|s| s.to_string());

                    log::info!(
                        "[MobileMoney] ✅ Paiement Orange Money initié. Transaction ID: {:?}",
                        provider_transaction_id
                    );

                    Ok(MobileMoneyPaymentResponse {
                        success: true,
                        transaction_id: Some(request.transaction_reference),
                        provider_transaction_id,
                        status: PaymentStatus::Pending,
                        message: "Paiement initié avec succès".to_string(),
                        instructions: payment_url.map(|url| format!(
                            "Visitez {} pour compléter le paiement de {} FCFA",
                            url,
                            request.amount
                        )),
                        error: None,
                    })
                } else {
                    let error_text = resp
                        .text()
                        .await
                        .unwrap_or_else(|_| "Erreur inconnue".to_string());

                    log::error!(
                        "[MobileMoney] ❌ Erreur API Orange Money: {}",
                        error_text
                    );

                    Ok(MobileMoneyPaymentResponse {
                        success: false,
                        transaction_id: Some(request.transaction_reference),
                        provider_transaction_id: None,
                        status: PaymentStatus::Failed,
                        message: "Erreur lors de l'initiation du paiement".to_string(),
                        instructions: None,
                        error: Some(error_text),
                    })
                }
            }
            Err(e) => {
                log::error!(
                    "[MobileMoney] ❌ Erreur requête Orange Money: {}",
                    e
                );

                // Fallback: instructions manuelles
                let transaction_ref = request.transaction_reference.clone();
                Ok(MobileMoneyPaymentResponse {
                    success: false,
                    transaction_id: Some(transaction_ref.clone()),
                    provider_transaction_id: None,
                    status: PaymentStatus::Pending,
                    message: "Mode manuel activé".to_string(),
                    instructions: Some(format!(
                        "Composez #144*4*4*{}*{}# et suivez les instructions\n\nRéférence: {}",
                        request.amount,
                        request.phone_number,
                        transaction_ref
                    )),
                    error: Some(format!("Erreur API: {}", e)),
                })
            }
        }
    }

    /// Vérifie le statut d'un paiement
    pub async fn check_payment_status(
        &self,
        _provider: MobileMoneyProvider,
        _transaction_id: &str,
    ) -> AppResult<PaymentStatus> {
        // TODO: Implémenter la vérification du statut via API
        // Pour l'instant, retourner Pending
        Ok(PaymentStatus::Pending)
    }

    /// Traite un webhook de confirmation de paiement
    pub async fn process_webhook(
        &self,
        webhook: MobileMoneyWebhook,
    ) -> AppResult<bool> {
        // TODO: Vérifier la signature du webhook
        // TODO: Mettre à jour le statut du paiement en base de données

        log::info!(
            "[MobileMoney] 📥 Webhook reçu: {:?} - Transaction: {} - Statut: {:?}",
            webhook.provider,
            webhook.transaction_id,
            webhook.status
        );

        Ok(true)
    }

    /// Vérifie si un provider est configuré et disponible
    pub fn is_provider_available(&self, provider: &MobileMoneyProvider) -> bool {
        match provider {
            MobileMoneyProvider::MTN => self.config.is_mtn_configured(),
            MobileMoneyProvider::Orange => self.config.is_orange_configured(),
        }
    }
}

impl Default for MobileMoneyService {
    fn default() -> Self {
        Self::new()
    }
}

