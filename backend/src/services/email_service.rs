// ✅ Phase 10 - Service Email avec intégration SendGrid
// Support pour SendGrid et autres providers Email

use crate::core::types::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

/// Configuration du service Email
#[derive(Debug, Clone)]
pub struct EmailConfig {
    pub enabled: bool,
    pub provider: String,
    pub sendgrid_api_key: Option<String>,
    pub sendgrid_from_email: Option<String>,
    pub sendgrid_from_name: Option<String>,
}

impl EmailConfig {
    pub fn from_env() -> Self {
        let enabled = std::env::var("EMAIL_ENABLED")
            .ok()
            .and_then(|v| v.parse::<bool>().ok())
            .unwrap_or(false);

        let provider = std::env::var("EMAIL_PROVIDER").unwrap_or_else(|_| "sendgrid".to_string());

        let sendgrid_api_key = std::env::var("SENDGRID_API_KEY").ok();
        let sendgrid_from_email = std::env::var("SENDGRID_FROM_EMAIL")
            .or_else(|_| std::env::var("EMAIL_FROM"))
            .ok();
        let sendgrid_from_name = std::env::var("SENDGRID_FROM_NAME")
            .or_else(|_| std::env::var("EMAIL_FROM_NAME"))
            .ok()
            .or(Some("Yukpo".to_string()));

        Self {
            enabled,
            provider,
            sendgrid_api_key,
            sendgrid_from_email,
            sendgrid_from_name,
        }
    }

    pub fn is_sendgrid_configured(&self) -> bool {
        self.enabled
            && self.provider == "sendgrid"
            && self.sendgrid_api_key.is_some()
            && self.sendgrid_from_email.is_some()
    }
}

/// Résultat de l'envoi Email
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailResult {
    pub success: bool,
    pub message_id: Option<String>,
    pub error: Option<String>,
}

/// Contenu d'un email
#[derive(Debug, Clone)]
pub struct EmailContent {
    pub to: String,
    pub subject: String,
    pub text: Option<String>,
    pub html: Option<String>,
}

pub struct EmailService {
    config: EmailConfig,
    client: reqwest::Client,
}

impl EmailService {
    pub fn new() -> Self {
        let config = EmailConfig::from_env();
        let client = reqwest::Client::new();

        Self { config, client }
    }

    /// Envoie un email via SendGrid
    pub async fn send_email(&self, content: EmailContent) -> AppResult<EmailResult> {
        if !self.config.enabled {
            log::debug!(
                "[EmailService] 📧 Email désactivé. Email pour {}: {}",
                content.to,
                content.subject
            );
            return Ok(EmailResult {
                success: false,
                message_id: None,
                error: Some("Email désactivé".to_string()),
            });
        }

        match self.config.provider.as_str() {
            "sendgrid" => self.send_via_sendgrid(content).await,
            _ => {
                log::warn!(
                    "[EmailService] 📧 Provider Email inconnu: {}",
                    self.config.provider
                );
                Ok(EmailResult {
                    success: false,
                    message_id: None,
                    error: Some(format!("Provider Email inconnu: {}", self.config.provider)),
                })
            }
        }
    }

    /// Envoie un email via l'API SendGrid
    async fn send_via_sendgrid(&self, content: EmailContent) -> AppResult<EmailResult> {
        if !self.config.is_sendgrid_configured() {
            log::warn!(
                "[EmailService] 📧 SendGrid non configuré. Vérifiez SENDGRID_API_KEY, SENDGRID_FROM_EMAIL"
            );
            return Ok(EmailResult {
                success: false,
                message_id: None,
                error: Some("SendGrid non configuré".to_string()),
            });
        }

        let api_key = self.config.sendgrid_api_key.as_ref().unwrap();
        let from_email = self.config.sendgrid_from_email.as_ref().unwrap();
        let from_name = self.config.sendgrid_from_name.as_deref().unwrap_or("Yukpo");

        let url = "https://api.sendgrid.com/v3/mail/send";

        // Construire le payload SendGrid
        let mut payload = json!({
            "personalizations": [{
                "to": [{
                    "email": content.to
                }]
            }],
            "from": {
                "email": from_email,
                "name": from_name
            },
            "subject": content.subject
        });

        // Ajouter le contenu (text et/ou html)
        let mut content_array = vec![];
        let text_content = content.text.clone();
        if let Some(text) = &text_content {
            content_array.push(json!({
                "type": "text/plain",
                "value": text
            }));
        }
        if let Some(html) = content.html {
            content_array.push(json!({
                "type": "text/html",
                "value": html
            }));
        } else if let Some(text) = &text_content {
            // Si pas de HTML mais du texte, convertir le texte en HTML simple
            content_array.push(json!({
                "type": "text/html",
                "value": format!("<p>{}</p>", text.replace("\n", "<br>"))
            }));
        }

        payload["content"] = json!(content_array);

        log::info!(
            "[EmailService] 📧 Envoi email SendGrid à {} depuis {}",
            content.to,
            from_email
        );

        let response = self
            .client
            .post(url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur requête SendGrid: {}", e)))?;

        let status = response.status();

        if status.is_success() {
            // SendGrid retourne 202 Accepted avec un header X-Message-Id
            let message_id = response
                .headers()
                .get("X-Message-Id")
                .and_then(|h| h.to_str().ok())
                .map(|s| s.to_string());

            log::info!(
                "[EmailService] ✅ Email envoyé avec succès. Message ID: {:?}",
                message_id
            );

            Ok(EmailResult {
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
                "[EmailService] ❌ Erreur envoi email SendGrid (status {}): {}",
                status,
                error_text
            );

            Ok(EmailResult {
                success: false,
                message_id: None,
                error: Some(format!("Erreur SendGrid ({}): {}", status, error_text)),
            })
        }
    }

    /// Envoie un email simple (texte uniquement)
    pub async fn send_simple_email(
        &self,
        to: &str,
        subject: &str,
        body: &str,
    ) -> AppResult<EmailResult> {
        self.send_email(EmailContent {
            to: to.to_string(),
            subject: subject.to_string(),
            text: Some(body.to_string()),
            html: None,
        })
        .await
    }

    /// Vérifie si le service Email est configuré et disponible
    pub fn is_available(&self) -> bool {
        self.config.enabled && self.config.is_sendgrid_configured()
    }
}

impl Default for EmailService {
    fn default() -> Self {
        Self::new()
    }
}
