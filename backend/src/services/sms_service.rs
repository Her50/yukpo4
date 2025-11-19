// ✅ Phase 10 - Service SMS avec intégration Twilio
// Support pour Twilio et autres providers SMS

use crate::core::types::{AppError, AppResult};
use serde::{Deserialize, Serialize};

/// Configuration du service SMS
#[derive(Debug, Clone)]
pub struct SmsConfig {
    pub enabled: bool,
    pub provider: String,
    pub twilio_account_sid: Option<String>,
    pub twilio_auth_token: Option<String>,
    pub twilio_from_number: Option<String>,
}

impl SmsConfig {
    pub fn from_env() -> Self {
        let enabled = std::env::var("SMS_ENABLED")
            .ok()
            .and_then(|v| v.parse::<bool>().ok())
            .unwrap_or(false);

        let provider = std::env::var("SMS_PROVIDER")
            .unwrap_or_else(|_| "twilio".to_string());

        let twilio_account_sid = std::env::var("TWILIO_ACCOUNT_SID").ok();
        let twilio_auth_token = std::env::var("TWILIO_AUTH_TOKEN").ok();
        let twilio_from_number = std::env::var("TWILIO_FROM_NUMBER").ok();

        Self {
            enabled,
            provider,
            twilio_account_sid,
            twilio_auth_token,
            twilio_from_number,
        }
    }

    pub fn is_twilio_configured(&self) -> bool {
        self.enabled
            && self.provider == "twilio"
            && self.twilio_account_sid.is_some()
            && self.twilio_auth_token.is_some()
            && self.twilio_from_number.is_some()
    }
}

/// Résultat de l'envoi SMS
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmsResult {
    pub success: bool,
    pub message_id: Option<String>,
    pub error: Option<String>,
}

pub struct SmsService {
    config: SmsConfig,
    client: reqwest::Client,
}

impl SmsService {
    pub fn new() -> Self {
        let config = SmsConfig::from_env();
        let client = reqwest::Client::new();

        Self { config, client }
    }

    /// Envoie un SMS via Twilio
    pub async fn send_sms(
        &self,
        to: &str,
        message: &str,
    ) -> AppResult<SmsResult> {
        if !self.config.enabled {
            log::debug!(
                "[SmsService] 📱 SMS désactivé. Message pour {}: {}",
                to,
                message
            );
            return Ok(SmsResult {
                success: false,
                message_id: None,
                error: Some("SMS désactivé".to_string()),
            });
        }

        match self.config.provider.as_str() {
            "twilio" => self.send_via_twilio(to, message).await,
            _ => {
                log::warn!(
                    "[SmsService] 📱 Provider SMS inconnu: {}",
                    self.config.provider
                );
                Ok(SmsResult {
                    success: false,
                    message_id: None,
                    error: Some(format!("Provider SMS inconnu: {}", self.config.provider)),
                })
            }
        }
    }

    /// Envoie un SMS via l'API Twilio
    async fn send_via_twilio(&self, to: &str, message: &str) -> AppResult<SmsResult> {
        if !self.config.is_twilio_configured() {
            log::warn!(
                "[SmsService] 📱 Twilio non configuré. Vérifiez TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER"
            );
            return Ok(SmsResult {
                success: false,
                message_id: None,
                error: Some("Twilio non configuré".to_string()),
            });
        }

        let account_sid = self.config.twilio_account_sid.as_ref().unwrap();
        let auth_token = self.config.twilio_auth_token.as_ref().unwrap();
        let from_number = self.config.twilio_from_number.as_ref().unwrap();

        // Nettoyer le numéro de téléphone (supprimer les espaces, +, etc.)
        let to_clean = to.replace(" ", "").replace("-", "").replace("+", "");

        let url = format!(
            "https://api.twilio.com/2010-04-01/Accounts/{}/Messages.json",
            account_sid
        );

        let params = [
            ("From", from_number.as_str()),
            ("To", &to_clean),
            ("Body", message),
        ];

        log::info!(
            "[SmsService] 📱 Envoi SMS Twilio à {} depuis {}",
            to_clean,
            from_number
        );

        let response = self
            .client
            .post(&url)
            .basic_auth(account_sid, Some(auth_token))
            .form(&params)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur requête Twilio: {}", e)))?;

        let status = response.status();

        if status.is_success() {
            let response_json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| AppError::Internal(format!("Erreur parsing réponse Twilio: {}", e)))?;

            let message_id = response_json
                .get("sid")
                .and_then(|s| s.as_str())
                .map(|s| s.to_string());

            log::info!(
                "[SmsService] ✅ SMS envoyé avec succès. Message ID: {:?}",
                message_id
            );

            Ok(SmsResult {
                success: true,
                message_id,
                error: None,
            })
        } else {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Erreur inconnue".to_string());

            log::error!(
                "[SmsService] ❌ Erreur envoi SMS Twilio (status {}): {}",
                status,
                error_text
            );

            Ok(SmsResult {
                success: false,
                message_id: None,
                error: Some(format!("Erreur Twilio ({}): {}", status, error_text)),
            })
        }
    }

    /// Vérifie si le service SMS est configuré et disponible
    pub fn is_available(&self) -> bool {
        self.config.enabled && self.config.is_twilio_configured()
    }
}

impl Default for SmsService {
    fn default() -> Self {
        Self::new()
    }
}


