// ?? src/services/translation_optimizer.rs
// Service d'optimisation des traductions avec cache et parall?lisation

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde_json::Value;
use crate::core::types::AppError;

/// Cache de traductions pour ?viter les appels API redondants
#[derive(Debug, Clone)]
pub struct TranslationCache {
    pub cache: Arc<RwLock<HashMap<String, String>>>,
    pub max_size: usize,
}

impl TranslationCache {
    pub fn new(max_size: usize) -> Self {
        Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
            max_size,
        }
    }

    /// R?cup?re une traduction du cache
    pub async fn get(&self, key: &str) -> Option<String> {
        let cache = self.cache.read().await;
        cache.get(key).cloned()
    }

    /// Ajoute une traduction au cache
    pub async fn set(&self, key: String, value: String) {
        let mut cache = self.cache.write().await;
        
        // Gestion de la taille du cache (LRU simple)
        if cache.len() >= self.max_size {
            // Supprimer le premier ?l?ment (le plus ancien)
            if let Some(first_key) = cache.keys().next().cloned() {
                cache.remove(&first_key);
            }
        }
        
        cache.insert(key, value);
    }

    /// G?n?re une cl? de cache pour une traduction
    pub fn generate_cache_key(text: &str, from_lang: &str, to_lang: &str) -> String {
        format!("{}:{}:{}", text, from_lang, to_lang)
    }
}

/// Optimiseur de traductions avec cache et parall?lisation
pub struct TranslationOptimizer {
    cache: TranslationCache,
    batch_size: usize,
}

impl TranslationOptimizer {
    pub fn new() -> Self {
        Self {
            cache: TranslationCache::new(1000), // Cache de 1000 traductions
            batch_size: 10, // Traductions par batch
        }
    }

    /// Traduit un texte en anglais avec cache
    pub async fn translate_to_en_cached(&self, text: &str, from_lang: &str) -> Result<String, AppError> {
        // V?rifier le cache d'abord
        let cache_key = TranslationCache::generate_cache_key(text, from_lang, "en");
        if let Some(cached_translation) = self.cache.get(&cache_key).await {
            return Ok(cached_translation);
        }

        // Si pas en cache, traduire et mettre en cache
        let translation = self.translate_to_en(text, from_lang).await?;
        self.cache.set(cache_key, translation.clone()).await;
        
        Ok(translation)
    }

    /// Traduit un texte en anglais (impl?mentation actuelle)
    pub async fn translate_to_en(&self, text: &str, from_lang: &str) -> Result<String, AppError> {
        // Utiliser l'impl?mentation existante
        let result = crate::services::creer_service::translate_to_en(text, from_lang).await;
        Ok(result)
    }

    /// Traduit plusieurs textes en parall?le
    pub async fn translate_batch(&self, texts: Vec<(String, String)>) -> Result<Vec<String>, AppError> {
        let mut tasks = Vec::new();
        let mut results = Vec::new();
        
        for (text, from_lang) in texts {
            let optimizer = self.clone();
            let task = tokio::spawn(async move {
                optimizer.translate_to_en_cached(&text, &from_lang).await
            });
            tasks.push(task);
        }
        
        for task in tasks {
            match task.await {
                Ok(Ok(translation)) => results.push(translation),
                Ok(Err(e)) => {
                    log::error!("[TRANSLATION] Erreur traduction: {}", e);
                    results.push(String::new()); // Fallback
                },
                Err(e) => {
                    log::error!("[TRANSLATION] Erreur task: {}", e);
                    results.push(String::new()); // Fallback
                }
            }
        }
        
        Ok(results)
    }

    /// Optimise les traductions pour un service complet
    pub async fn optimize_service_translations(&self, data_obj: &Value) -> Result<Value, AppError> {
        let mut optimized_data = data_obj.clone();
        let mut translation_tasks = Vec::new();

        // Collecter tous les textes ? traduire
        if let Some(obj) = optimized_data.as_object_mut() {
            for (key, value) in obj.iter_mut() {
                if let Some(value_obj) = value.as_object() {
                    if let Some(type_donnee) = value_obj.get("type_donnee").and_then(|v| v.as_str()) {
                        if type_donnee == "texte" {
                            if let Some(text_value) = value_obj.get("valeur").and_then(|v| v.as_str()) {
                                let detected_lang = crate::services::creer_service::detect_lang(text_value);
                                if detected_lang != "en" {
                                    let optimizer = self.clone();
                                    let text = text_value.to_string();
                                    let task = tokio::spawn(async move {
                                        optimizer.translate_to_en_cached(&text, &detected_lang).await
                                    });
                                    translation_tasks.push((key.clone(), task));
                                }
                            }
                        }
                    }
                }
            }
        }

        // Attendre et appliquer toutes les traductions
        for (key, task) in translation_tasks {
            match task.await {
                Ok(Ok(translation)) => {
                    if let Some(obj) = optimized_data.as_object_mut() {
                        if let Some(value) = obj.get_mut(&key) {
                            if let Some(value_obj) = value.as_object_mut() {
                                value_obj.insert("valeur_en".to_string(), Value::String(translation));
                            }
                        }
                    }
                },
                Ok(Err(e)) => log::warn!("[TranslationOptimizer] Erreur traduction pour {}: {:?}", key, e),
                Err(e) => log::warn!("[TranslationOptimizer] Erreur t?che pour {}: {:?}", key, e),
            }
        }

        Ok(optimized_data)
    }
}

impl Clone for TranslationOptimizer {
    fn clone(&self) -> Self {
        Self {
            cache: self.cache.clone(),
            batch_size: self.batch_size,
        }
    }
}

impl Default for TranslationOptimizer {
    fn default() -> Self {
        Self::new()
    }
} 
