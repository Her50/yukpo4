// ✅ Service WhatsApp Business avec Twilio API
// Redirection automatique vers groupes spécifiques

use crate::core::types::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Configuration du service WhatsApp Business
#[derive(Debug, Clone)]
pub struct WhatsAppConfig {
    pub enabled: bool,
    pub provider: String,
    pub twilio_account_sid: Option<String>,
    pub twilio_auth_token: Option<String>,
    pub twilio_whatsapp_number: Option<String>,
    pub webhook_url: Option<String>,
    pub default_group_id: Option<String>,
}

impl WhatsAppConfig {
    pub fn from_env() -> Self {
        let enabled = std::env::var("WHATSAPP_ENABLED")
            .ok()
            .and_then(|v| v.parse::<bool>().ok())
            .unwrap_or(false);

        let provider = std::env::var("WHATSAPP_PROVIDER").unwrap_or_else(|_| "twilio".to_string());

        let twilio_account_sid = std::env::var("TWILIO_ACCOUNT_SID").ok();
        let twilio_auth_token = std::env::var("TWILIO_AUTH_TOKEN").ok();
        let twilio_whatsapp_number = std::env::var("TWILIO_WHATSAPP_NUMBER").ok();
        let webhook_url = std::env::var("WHATSAPP_WEBHOOK_URL").ok();
        let default_group_id = std::env::var("WHATSAPP_DEFAULT_GROUP_ID").ok();

        Self {
            enabled,
            provider,
            twilio_account_sid,
            twilio_auth_token,
            twilio_whatsapp_number,
            webhook_url,
            default_group_id,
        }
    }

    pub fn is_twilio_configured(&self) -> bool {
        self.enabled
            && self.provider == "twilio"
            && self.twilio_account_sid.is_some()
            && self.twilio_auth_token.is_some()
            && self.twilio_whatsapp_number.is_some()
    }
}

/// Types de messages WhatsApp
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WhatsAppMessageType {
    Text {
        body: String,
    },
    Image {
        url: String,
        caption: Option<String>,
    },
    Document {
        url: String,
        filename: String,
    },
    Location {
        latitude: f64,
        longitude: f64,
        name: String,
        address: String,
    },
    Template {
        name: String,
        language: String,
        components: Vec<serde_json::Value>,
    },
}

/// Message WhatsApp entrant/sortant
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhatsAppMessage {
    pub from: String,
    pub to: String,
    pub message_type: WhatsAppMessageType,
    pub timestamp: i64,
    pub message_id: String,
    pub metadata: Option<HashMap<String, String>>,
}

/// Résultat de l'envoi WhatsApp
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhatsAppResult {
    pub success: bool,
    pub message_id: Option<String>,
    pub error: Option<String>,
    pub group_redirected: Option<String>,
}

/// Configuration de groupe WhatsApp
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhatsAppGroup {
    pub group_id: String,
    pub group_name: String,
    pub description: String,
    pub keywords: Vec<String>,
    pub auto_add_keywords: bool,
    pub welcome_message: Option<String>,
}

/// Service de routing automatique vers les groupes
pub struct WhatsAppRoutingService {
    groups: HashMap<String, WhatsAppGroup>,
    default_group: String,
}

impl WhatsAppRoutingService {
    pub fn new() -> Self {
        let mut groups = HashMap::new();

        // Groupe principal pour l'application YUKPO
        groups.insert(
            "yukpo_main".to_string(),
            WhatsAppGroup {
                group_id: "yukpo_main".to_string(),
                group_name: "YUKPO - Support Client".to_string(),
                description: "Groupe principal pour le support client YUKPO".to_string(),
                keywords: vec![
                    "yukpo".to_string(),
                    "support".to_string(),
                    "aide".to_string(),
                    "application".to_string(),
                    "app".to_string(),
                    "problème".to_string(),
                ],
                auto_add_keywords: true,
                welcome_message: Some(
                    "Bienvenue sur le support YUKPO ! Comment pouvons-nous vous aider ?"
                        .to_string(),
                ),
            },
        );

        // Groupe pour les partenaires/livreurs
        groups.insert(
            "yukpo_partners".to_string(),
            WhatsAppGroup {
                group_id: "yukpo_partners".to_string(),
                group_name: "YUKPO - Partenaires & Livreurs".to_string(),
                description: "Groupe pour les partenaires et livreurs YUKPO".to_string(),
                keywords: vec![
                    "partenaire".to_string(),
                    "livreur".to_string(),
                    "livraison".to_string(),
                    "devenir".to_string(),
                    "collaboration".to_string(),
                    "course".to_string(),
                ],
                auto_add_keywords: true,
                welcome_message: Some("Bienvenue dans l'espace partenaires YUKPO !".to_string()),
            },
        );

        // Groupe technique
        groups.insert(
            "yukpo_tech".to_string(),
            WhatsAppGroup {
                group_id: "yukpo_tech".to_string(),
                group_name: "YUKPO - Support Technique".to_string(),
                description: "Groupe pour les problèmes techniques".to_string(),
                keywords: vec![
                    "bug".to_string(),
                    "erreur".to_string(),
                    "technique".to_string(),
                    "plantage".to_string(),
                    "problème technique".to_string(),
                    "développeur".to_string(),
                ],
                auto_add_keywords: true,
                welcome_message: Some("Bienvenue sur le support technique YUKPO !".to_string()),
            },
        );

        Self {
            groups,
            default_group: "yukpo_main".to_string(),
        }
    }

    /// Détermine le groupe approprié basé sur le message
    pub fn route_to_group(&self, message: &str, user_phone: &str) -> Option<&WhatsAppGroup> {
        let message_lower = message.to_lowercase();

        // Chercher des correspondances de mots-clés
        for group in self.groups.values() {
            if group.auto_add_keywords {
                for keyword in &group.keywords {
                    if message_lower.contains(&keyword.to_lowercase()) {
                        log::info!(
                            "[WhatsAppRouting] 🎯 Message de {} routé vers {} (mot-clé: {})",
                            user_phone,
                            group.group_name,
                            keyword
                        );
                        return Some(group);
                    }
                }
            }
        }

        // Si aucune correspondance, retourner le groupe par défaut
        log::info!(
            "[WhatsAppRouting] 📱 Message de {} routé vers le groupe par défaut: {}",
            user_phone,
            self.groups.get(&self.default_group).unwrap().group_name
        );
        self.groups.get(&self.default_group)
    }

    /// Ajoute un nouveau groupe
    pub fn add_group(&mut self, group: WhatsAppGroup) {
        log::info!(
            "[WhatsAppRouting] ➕ Nouveau groupe ajouté: {}",
            group.group_name
        );
        self.groups.insert(group.group_id.clone(), group);
    }

    /// Obtient tous les groupes disponibles
    pub fn get_groups(&self) -> &HashMap<String, WhatsAppGroup> {
        &self.groups
    }
}

/// Service principal WhatsApp Business
pub struct WhatsAppService {
    config: WhatsAppConfig,
    client: reqwest::Client,
    routing_service: WhatsAppRoutingService,
}

impl WhatsAppService {
    pub fn new() -> Self {
        let config = WhatsAppConfig::from_env();
        let client = reqwest::Client::new();
        let routing_service = WhatsAppRoutingService::new();

        Self {
            config,
            client,
            routing_service,
        }
    }

    /// Envoie un message WhatsApp avec redirection automatique
    pub async fn send_message_with_routing(
        &self,
        to: &str,
        message: &str,
        _metadata: Option<HashMap<String, String>>,
    ) -> AppResult<WhatsAppResult> {
        if !self.config.enabled {
            log::debug!(
                "[WhatsAppService] 📱 WhatsApp désactivé. Message pour {}: {}",
                to,
                message
            );
            return Ok(WhatsAppResult {
                success: false,
                message_id: None,
                error: Some("WhatsApp désactivé".to_string()),
                group_redirected: None,
            });
        }

        // Déterminer le groupe approprié
        let target_group = self.routing_service.route_to_group(message, to);

        match self.config.provider.as_str() {
            "twilio" => {
                let mut result = self.send_via_twilio(to, message).await?;

                // Si routage vers un groupe, ajouter cette information
                if let Some(group) = target_group {
                    result.group_redirected = Some(group.group_id.clone());

                    // Envoyer un message de bienvenue si configuré
                    if let Some(welcome_msg) = &group.welcome_message {
                        let _ = self.send_via_twilio(to, welcome_msg).await;
                    }
                }

                Ok(result)
            }
            _ => {
                log::warn!(
                    "[WhatsAppService] 📱 Provider WhatsApp inconnu: {}",
                    self.config.provider
                );
                Ok(WhatsAppResult {
                    success: false,
                    message_id: None,
                    error: Some(format!(
                        "Provider WhatsApp inconnu: {}",
                        self.config.provider
                    )),
                    group_redirected: None,
                })
            }
        }
    }

    /// Envoie un message via l'API Twilio WhatsApp
    async fn send_via_twilio(&self, to: &str, message: &str) -> AppResult<WhatsAppResult> {
        if !self.config.is_twilio_configured() {
            log::warn!(
                "[WhatsAppService] 📱 Twilio WhatsApp non configuré. Vérifiez TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER"
            );
            return Ok(WhatsAppResult {
                success: false,
                message_id: None,
                error: Some("Twilio WhatsApp non configuré".to_string()),
                group_redirected: None,
            });
        }

        let account_sid = self.config.twilio_account_sid.as_ref().unwrap();
        let auth_token = self.config.twilio_auth_token.as_ref().unwrap();
        let from_number = self.config.twilio_whatsapp_number.as_ref().unwrap();

        // Formater le numéro pour WhatsApp (whatsapp:+...)
        let to_whatsapp = if to.starts_with("whatsapp:+") {
            to.to_string()
        } else {
            format!(
                "whatsapp:+{}",
                to.replace(" ", "").replace("-", "").replace("+", "")
            )
        };

        let from_whatsapp = if from_number.starts_with("whatsapp:+") {
            from_number.to_string()
        } else {
            format!(
                "whatsapp:+{}",
                from_number.replace(" ", "").replace("-", "").replace("+", "")
            )
        };

        let url = format!(
            "https://api.twilio.com/2010-04-01/Accounts/{}/Messages.json",
            account_sid
        );

        let params = [
            ("From", from_whatsapp.as_str()),
            ("To", to_whatsapp.as_str()),
            ("Body", message),
        ];

        log::info!(
            "[WhatsAppService] 📱 Envoi WhatsApp Twilio à {} depuis {}",
            to_whatsapp,
            from_whatsapp
        );

        let response = self
            .client
            .post(&url)
            .basic_auth(account_sid, Some(auth_token))
            .form(&params)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur requête Twilio WhatsApp: {}", e)))?;

        let status = response.status();

        if status.is_success() {
            let response_json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| AppError::Internal(format!("Erreur parsing réponse Twilio: {}", e)))?;

            let message_id =
                response_json.get("sid").and_then(|s| s.as_str()).map(|s| s.to_string());

            log::info!(
                "[WhatsAppService] ✅ Message WhatsApp envoyé avec succès. Message ID: {:?}",
                message_id
            );

            Ok(WhatsAppResult {
                success: true,
                message_id,
                error: None,
                group_redirected: None,
            })
        } else {
            let error_text =
                response.text().await.unwrap_or_else(|_| "Erreur inconnue".to_string());

            log::error!(
                "[WhatsAppService] ❌ Erreur envoi WhatsApp Twilio (status {}): {}",
                status,
                error_text
            );

            Ok(WhatsAppResult {
                success: false,
                message_id: None,
                error: Some(format!(
                    "Erreur Twilio WhatsApp ({}): {}",
                    status, error_text
                )),
                group_redirected: None,
            })
        }
    }

    /// Traite un webhook WhatsApp entrant
    pub async fn process_webhook(
        &self,
        payload: serde_json::Value,
    ) -> AppResult<serde_json::Value> {
        log::info!("[WhatsAppService] 📥 Traitement webhook WhatsApp reçu");

        // Extraire les informations du message
        let from = payload.get("From").and_then(|v| v.as_str()).unwrap_or("");

        let body = payload.get("Body").and_then(|v| v.as_str()).unwrap_or("");

        let message_id = payload.get("MessageSid").and_then(|v| v.as_str()).unwrap_or("");

        log::info!(
            "[WhatsAppService] 📨 Message de {}: {} (ID: {})",
            from,
            body,
            message_id
        );

        // Router vers le groupe approprié et envoyer une réponse automatique
        let result = self.send_message_with_routing(from, body, None).await?;

        // Construire la réponse du webhook
        let webhook_response = serde_json::json!({
            "status": "processed",
            "message_id": message_id,
            "routing_result": {
                "success": result.success,
                "group_redirected": result.group_redirected,
                "error": result.error
            }
        });

        Ok(webhook_response)
    }

    /// Vérifie si le service WhatsApp est configuré et disponible
    pub fn is_available(&self) -> bool {
        self.config.enabled && self.config.is_twilio_configured()
    }

    /// Obtient le service de routing
    pub fn get_routing_service(&self) -> &WhatsAppRoutingService {
        &self.routing_service
    }
}

impl Default for WhatsAppService {
    fn default() -> Self {
        Self::new()
    }
}

/// Handler pour les webhooks WhatsApp
pub async fn whatsapp_webhook_handler(
    whatsapp_service: axum::extract::State<std::sync::Arc<WhatsAppService>>,
    axum::extract::Json(payload): axum::extract::Json<serde_json::Value>,
) -> AppResult<axum::response::Json<serde_json::Value>> {
    let result = whatsapp_service.process_webhook(payload).await?;
    Ok(axum::response::Json(result))
}
