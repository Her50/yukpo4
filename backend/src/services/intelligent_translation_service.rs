// 🌍 Service de traduction intelligente pour les prompts IA
use crate::core::types::AppError;
use log::{info, warn};
use reqwest::Client;
use serde_json::{json, Value};
use std::collections::HashMap;

/// 🧠 Service de traduction intelligente pour l'IA
pub struct IntelligentTranslationService {
    #[allow(dead_code)]
    client: Client,
    #[allow(dead_code)]
    api_key: String,
    cache: HashMap<String, String>,
    supported_languages: Vec<String>,
}

impl IntelligentTranslationService {
    /// 🚀 Créer une nouvelle instance du service
    pub fn new() -> Result<Self, AppError> {
        let api_key = std::env::var("GOOGLE_TRANSLATE_API_KEY")
            .map_err(|_| AppError::Internal("GOOGLE_TRANSLATE_API_KEY not found".to_string()))?;

        if api_key.is_empty() {
            return Err(AppError::Internal(
                "GOOGLE_TRANSLATE_API_KEY is empty".to_string(),
            ));
        }

        Ok(Self {
            client: Client::new(),
            api_key,
            cache: HashMap::new(),
            supported_languages: vec![
                "fr".to_string(),
                "en".to_string(),
                "pt".to_string(),
                "ar".to_string(),
                "ff".to_string(),
            ],
        })
    }

    /// 🎯 Traduire un prompt IA dans la langue de l'utilisateur
    pub async fn translate_ai_prompt(
        &mut self,
        prompt: &str,
        user_language: &str,
        context: &str,
    ) -> Result<String, AppError> {
        // Si la langue est déjà l'anglais ou non supportée, retourner le prompt original
        if user_language == "en" || !self.supported_languages.contains(&user_language.to_string()) {
            info!("🌍 [IntelligentTranslation] Langue {} non supportée ou déjà en anglais, retour du prompt original", user_language);
            return Ok(prompt.to_string());
        }

        // Vérifier le cache
        let cache_key = format!("{}:{}:{}", prompt, user_language, context);
        if let Some(cached_translation) = self.cache.get(&cache_key) {
            info!("🌍 [IntelligentTranslation] Cache hit pour le prompt");
            return Ok(cached_translation.clone());
        }

        // Détecter la langue du prompt
        let detected_language = self.detect_language(prompt).await?;

        // Si le prompt est déjà dans la langue de l'utilisateur, pas de traduction nécessaire
        if detected_language == user_language {
            info!(
                "🌍 [IntelligentTranslation] Prompt déjà dans la langue de l'utilisateur: {}",
                user_language
            );
            return Ok(prompt.to_string());
        }

        // Traduire le prompt
        let translated_prompt =
            self.translate_text(prompt, &detected_language, user_language).await?;

        // Mettre en cache
        self.cache.insert(cache_key, translated_prompt.clone());

        info!(
            "🌍 [IntelligentTranslation] Prompt traduit: {} -> {} ({} -> {})",
            prompt.chars().take(50).collect::<String>(),
            translated_prompt.chars().take(50).collect::<String>(),
            detected_language,
            user_language
        );

        Ok(translated_prompt)
    }

    /// 🔍 Détecter la langue d'un texte
    async fn detect_language(&self, text: &str) -> Result<String, AppError> {
        // Utiliser l'API Google Translate pour la détection
        let url = format!(
            "https://translation.googleapis.com/language/translate/v2/detect?key={}",
            self.api_key
        );

        let params = json!({
            "q": text
        });

        let response = self
            .client
            .post(&url)
            .json(&params)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur détection langue: {}", e)))?;

        if !response.status().is_success() {
            return Err(AppError::Internal(
                "Erreur API détection langue".to_string(),
            ));
        }

        let result: Value = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur parsing détection: {}", e)))?;

        if let Some(detections) = result["data"]["detections"].as_array() {
            if let Some(first_detection) = detections.first() {
                if let Some(language) = first_detection[0]["language"].as_str() {
                    return Ok(language.to_string());
                }
            }
        }

        // Fallback: supposer que c'est de l'anglais
        warn!("🌍 [IntelligentTranslation] Impossible de détecter la langue, fallback vers 'en'");
        Ok("en".to_string())
    }

    /// 🌍 Traduire un texte
    async fn translate_text(
        &self,
        text: &str,
        source_lang: &str,
        target_lang: &str,
    ) -> Result<String, AppError> {
        let url = format!(
            "https://translation.googleapis.com/language/translate/v2?key={}",
            self.api_key
        );

        let params = json!({
            "q": text,
            "source": source_lang,
            "target": target_lang,
            "format": "text"
        });

        let response = self
            .client
            .post(&url)
            .json(&params)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur traduction: {}", e)))?;

        if !response.status().is_success() {
            return Err(AppError::Internal("Erreur API traduction".to_string()));
        }

        let result: Value = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur parsing traduction: {}", e)))?;

        if let Some(translations) = result["data"]["translations"].as_array() {
            if let Some(first_translation) = translations.first() {
                if let Some(translated_text) = first_translation["translatedText"].as_str() {
                    return Ok(translated_text.to_string());
                }
            }
        }

        Err(AppError::Internal(
            "Réponse de traduction invalide".to_string(),
        ))
    }

    /// 🎯 Traduire un objet JSON complet (pour les réponses IA)
    pub async fn translate_ai_response(
        &mut self,
        response: &Value,
        user_language: &str,
    ) -> Result<Value, AppError> {
        if user_language == "en" {
            return Ok(response.clone());
        }

        let mut translated_response = response.clone();

        // Traduire les champs de texte
        self.translate_json_object(&mut translated_response, user_language).await?;

        Ok(translated_response)
    }

    /// 🔄 Traduire récursivement un objet JSON (version simplifiée)
    async fn translate_json_object(
        &mut self,
        obj: &mut Value,
        user_language: &str,
    ) -> Result<(), AppError> {
        // Version simplifiée sans récursion pour éviter les problèmes de compilation
        match obj {
            Value::String(text) => {
                if self.should_translate_text(text) {
                    let translated = self.translate_text(text, "en", user_language).await?;
                    *obj = Value::String(translated);
                }
            }
            Value::Array(arr) => {
                for item in arr.iter_mut() {
                    if let Value::String(text) = item {
                        if self.should_translate_text(text) {
                            let translated = self.translate_text(text, "en", user_language).await?;
                            *item = Value::String(translated);
                        }
                    }
                }
            }
            Value::Object(map) => {
                for (key, value) in map.iter_mut() {
                    if !self.is_technical_key(key) {
                        if let Value::String(text) = value {
                            if self.should_translate_text(text) {
                                let translated =
                                    self.translate_text(text, "en", user_language).await?;
                                *value = Value::String(translated);
                            }
                        }
                    }
                }
            }
            _ => {} // Pas de traduction pour les autres types
        }
        Ok(())
    }

    /// 🔍 Déterminer si un texte doit être traduit
    fn should_translate_text(&self, text: &str) -> bool {
        // Ne pas traduire les textes trop courts
        if text.len() < 3 {
            return false;
        }

        // Ne pas traduire les URLs, emails, etc.
        if text.contains("http") || text.contains("@") || text.contains("www.") {
            return false;
        }

        // Ne pas traduire les codes, IDs, etc.
        if text.chars().all(|c| c.is_alphanumeric() || c.is_whitespace()) && text.len() < 10 {
            return false;
        }

        true
    }

    /// 🔧 Déterminer si une clé est technique (ne pas traduire)
    fn is_technical_key(&self, key: &str) -> bool {
        let technical_keys = [
            "id",
            "url",
            "email",
            "phone",
            "gps",
            "coordinates",
            "latitude",
            "longitude",
            "price",
            "amount",
            "quantity",
            "count",
            "number",
            "date",
            "time",
            "timestamp",
            "status",
            "type",
            "category",
            "tags",
            "metadata",
            "config",
            "settings",
            "created_at",
            "updated_at",
            "user_id",
            "service_id",
            "token",
            "api_key",
        ];

        technical_keys.contains(&key.to_lowercase().as_str())
    }

    /// 🧹 Nettoyer le cache (appeler périodiquement)
    pub fn cleanup_cache(&mut self) {
        if self.cache.len() > 1000 {
            // Garder seulement les 500 entrées les plus récentes
            let mut entries: Vec<_> = self.cache.drain().collect();
            entries.sort_by(|a, b| a.0.cmp(&b.0));
            entries.truncate(500);
            self.cache = entries.into_iter().collect();

            info!(
                "🌍 [IntelligentTranslation] Cache nettoyé, {} entrées conservées",
                self.cache.len()
            );
        }
    }

    /// 📊 Obtenir les statistiques du service
    pub fn get_stats(&self) -> Value {
        json!({
            "cache_size": self.cache.len(),
            "supported_languages": self.supported_languages,
            "api_configured": !self.api_key.is_empty()
        })
    }
}

impl Default for IntelligentTranslationService {
    fn default() -> Self {
        Self::new().unwrap_or_else(|_| {
            warn!("🌍 [IntelligentTranslation] Impossible de créer le service, utilisation d'une instance vide");
            Self {
                client: Client::new(),
                api_key: String::new(),
                cache: HashMap::new(),
                supported_languages: vec!["en".to_string()],
            }
        })
    }
}

/// 🎯 Fonction utilitaire pour traduire un prompt IA
pub async fn translate_ai_prompt_for_user(
    prompt: &str,
    user_language: &str,
    context: &str,
) -> Result<String, AppError> {
    let mut service = IntelligentTranslationService::new()?;
    service.translate_ai_prompt(prompt, user_language, context).await
}

/// 🎯 Fonction utilitaire pour traduire une réponse IA
pub async fn translate_ai_response_for_user(
    response: &Value,
    user_language: &str,
) -> Result<Value, AppError> {
    let mut service = IntelligentTranslationService::new()?;
    service.translate_ai_response(response, user_language).await
}
