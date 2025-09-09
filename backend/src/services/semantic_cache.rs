// backend/src/services/semantic_cache.rs
// Service de cache s?mantique utilisant le microservice d'embedding et Pinecone

use std::sync::Arc;
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use serde_json::{json, Value};
use reqwest::Client;
use crate::core::types::AppResult;
use crate::utils::log::{log_info, log_warn};

/// Configuration du cache s?mantique
#[derive(Debug, Clone)]
pub struct SemanticCacheConfig {
    pub embedding_service_url: String,
    pub api_key: String,
    pub similarity_threshold: f64,
    pub cache_ttl_seconds: u64,
    pub max_cache_size: usize,
}

impl Default for SemanticCacheConfig {
    fn default() -> Self {
        let similarity_threshold = std::env::var("SEMANTIC_CACHE_THRESHOLD")
            .unwrap_or_else(|_| "0.70".to_string())
            .parse::<f64>()
            .unwrap_or(0.70);
            
        Self {
            embedding_service_url: "http://localhost:8000".to_string(),
            api_key: "yukpo_embedding_key_2024".to_string(),
            similarity_threshold, // Seuil configurable via variable d'environnement
            cache_ttl_seconds: 3600, // 1 heure
            max_cache_size: 1000,
        }
    }
}

/// R?ponse du microservice d'embedding
#[derive(Debug, serde::Deserialize)]
struct EmbeddingResponse {
    embedding: Vec<f32>,
    inference_time: f64,
}

/// R?sultat de recherche Pinecone
#[derive(Debug, serde::Deserialize)]
struct PineconeMatch {
    score: f64,
    metadata: HashMap<String, Value>,
}

/// R?ponse de recherche Pinecone
#[derive(Debug, serde::Deserialize)]
struct PineconeSearchResponse {
    results: Vec<PineconeMatch>,
}

/// Cache en m?moire pour les embeddings
#[derive(Debug, Clone)]
struct CachedEmbedding {
    embedding: Vec<f32>,
    timestamp: Instant,
    ttl: Duration,
}

impl CachedEmbedding {
    fn new(embedding: Vec<f32>, ttl_seconds: u64) -> Self {
        Self {
            embedding,
            timestamp: Instant::now(),
            ttl: Duration::from_secs(ttl_seconds),
        }
    }

    fn is_expired(&self) -> bool {
        self.timestamp.elapsed() > self.ttl
    }
}

/// Service de cache s?mantique
pub struct SemanticCache {
    config: SemanticCacheConfig,
    http_client: Client,
    embedding_cache: Arc<RwLock<HashMap<String, CachedEmbedding>>>,
}

impl SemanticCache {
    /// Cr?e un nouveau service de cache s?mantique
    pub fn new(config: SemanticCacheConfig) -> Self {
        let http_client = Client::builder()
            .timeout(Duration::from_secs(60)) // Augment? de 30s ? 60s pour les embeddings
            .build()
            .expect("Impossible de cr?er le client HTTP");

        Self {
            config,
            http_client,
            embedding_cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Cr?e un service avec la configuration par d?faut
    pub fn new_default() -> Self {
        Self::new(SemanticCacheConfig::default())
    }

    /// R?cup?re un embedding depuis le microservice
    pub async fn get_embedding(&self, text: &str) -> AppResult<Vec<f32>> {
        // V?rifier le cache d'abord
        let cache_key = format!("embedding:{}", text);
        if let Some(cached) = self.get_cached_embedding(&cache_key).await {
            log_info(&format!("[SemanticCache] Cache hit pour embedding: {} chars", text.len()));
            return Ok(cached);
        }

        // Appel au microservice d'embedding
        log_info(&format!("[SemanticCache] Appel microservice embedding pour: {} chars", text.len()));
        
        let response = self.http_client
            .post(&format!("{}/embedding", self.config.embedding_service_url))
            .json(&json!({
                "value": text,
                "type_donnee": "texte"
            }))
            .send()
            .await
            .map_err(|e| format!("Erreur appel microservice embedding: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Microservice embedding erreur: {}", response.status()).into());
        }

        let embedding_response: EmbeddingResponse = response.json().await
            .map_err(|e| format!("Erreur parsing r?ponse embedding: {}", e))?;

        // Mettre en cache l'embedding
        self.cache_embedding(&cache_key, &embedding_response.embedding).await;

        log_info(&format!("[SemanticCache] Embedding g?n?r? en {}s", embedding_response.inference_time));
        Ok(embedding_response.embedding)
    }

    /// Recherche s?mantique dans Pinecone via le microservice
    pub async fn search_semantic_cache(&self, text: &str, intention: &str) -> Option<String> {
        let start_time = Instant::now();
        
        log_info(&format!("[SemanticCache] Recherche s?mantique pour: '{}' (intention: {})", text, intention));

        let response = match self.http_client
            .post(&format!("{}/search_embedding_pinecone", self.config.embedding_service_url))
            .header("x-api-key", &self.config.api_key)
            .json(&json!({
                "query": text,
                "type_donnee": "texte",
                "top_k": 1,
                "type_metier": "ia" // Filtrer pour les r?ponses IA
            }))
            .send()
            .await
        {
            Ok(resp) => resp,
            Err(e) => {
                log_warn(&format!("[SemanticCache] Erreur appel recherche Pinecone: {}", e));
                return None;
            }
        };

        if !response.status().is_success() {
            log_warn(&format!("[SemanticCache] Erreur HTTP recherche Pinecone: {}", response.status()));
            return None;
        }

        let search_response: PineconeSearchResponse = match response.json().await {
            Ok(resp) => resp,
            Err(e) => {
                log_warn(&format!("[SemanticCache] Erreur parsing r?ponse Pinecone: {}", e));
                return None;
            }
        };

        if search_response.results.is_empty() {
            log_info("[SemanticCache] Aucun r?sultat trouv? dans Pinecone");
            return None;
        }

        let best_match = &search_response.results[0];
        let similarity = best_match.score;

        log_info(&format!("[SemanticCache] Meilleur match: score={}, seuil={}", 
                         similarity, self.config.similarity_threshold));

        if similarity >= self.config.similarity_threshold {
            // R?cup?rer la r?ponse IA depuis les m?tadonn?es
            if let Some(ia_response) = best_match.metadata.get("ia_response") {
                if let Some(response_str) = ia_response.as_str() {
                    let search_time = start_time.elapsed();
                    log_info(&format!("[SemanticCache] ? Cache s?mantique hit en {:?} (similarit?: {})", 
                                     search_time, similarity));
                    return Some(response_str.to_string());
                }
            }
        }

        log_info(&format!("[SemanticCache] Aucun cache s?mantique trouv? (similarit?: {} < {})", 
                         similarity, self.config.similarity_threshold));
        None
    }

    /// Stocke une r?ponse dans le cache s?mantique
    pub async fn store_semantic_cache(&self, query: &str, intention: &str, response: &str) -> AppResult<()> {
        let start_time = std::time::Instant::now();
        
        // ?? ?QUILIBRE : Timeout ?quilibr? pour pr?cision vs vitesse
        let timeout = Duration::from_secs(2); // Augment? ? 2s pour la pr?cision
        
        match tokio::time::timeout(timeout, async {
            // Appel au microservice embedding avec timeout ?quilibr?
            let request = json!({
                "service_id": self.generate_service_id(query, intention),
                "value": query,
                "type_donnee": "texte",
                "active": true,
                "type_metier": intention,
                "langue": "fr",
                "ia_response": response
            });
            
            let response = self.http_client
                .post(&format!("{}/add_embedding_pinecone", self.config.embedding_service_url))
                .header("x-api-key", &self.config.api_key)
                .json(&request)
                .timeout(Duration::from_secs(1500)) // Timeout ?quilibr? (1.5s)
                .send()
                .await?;
            
            if response.status().is_success() {
                log::info!("[SemanticCache] ? Cache s?mantique stock? en {:?}", start_time.elapsed());
                Ok(())
            } else {
                Err(format!("Erreur stockage cache: {}", response.status()).into())
            }
        }).await {
            Ok(result) => result,
            Err(_) => {
                log::warn!("[SemanticCache] ? Timeout stockage cache s?mantique (2s) - ?quilibre pr?cision/vitesse");
                Ok(()) // Continue sans erreur en cas de timeout
            }
        }
    }

    /// G?n?re un ID unique pour le service
    fn generate_service_id(&self, text: &str, intention: &str) -> i32 {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        text.hash(&mut hasher);
        intention.hash(&mut hasher);
        
        (hasher.finish() % 1_000_000) as i32
    }

    /// R?cup?re un embedding du cache
    async fn get_cached_embedding(&self, cache_key: &str) -> Option<Vec<f32>> {
        let cache = self.embedding_cache.read().await;
        if let Some(cached) = cache.get(cache_key) {
            if !cached.is_expired() {
                return Some(cached.embedding.clone());
            }
        }
        None
    }

    /// Met en cache un embedding
    async fn cache_embedding(&self, cache_key: &str, embedding: &[f32]) {
        let cached = CachedEmbedding::new(embedding.to_vec(), self.config.cache_ttl_seconds);
        
        let mut cache = self.embedding_cache.write().await;
        cache.insert(cache_key.to_string(), cached);
        
        // Nettoyer le cache si trop volumineux
        if cache.len() > self.config.max_cache_size {
            cache.retain(|_, v| !v.is_expired());
        }
    }

    /// Obtient les statistiques du cache
    pub async fn get_stats(&self) -> Value {
        let cache = self.embedding_cache.read().await;
        let total_entries = cache.len();
        let expired_entries = cache.values().filter(|v| v.is_expired()).count();
        let valid_entries = total_entries - expired_entries;

        json!({
            "embedding_cache": {
                "total_entries": total_entries,
                "valid_entries": valid_entries,
                "expired_entries": expired_entries,
                "max_size": self.config.max_cache_size
            },
            "config": {
                "similarity_threshold": self.config.similarity_threshold,
                "cache_ttl_seconds": self.config.cache_ttl_seconds,
                "embedding_service_url": self.config.embedding_service_url
            }
        })
    }

    pub async fn get_semantic_cache(&self, query: &str, intention: &str) -> AppResult<Option<String>> {
        let start_time = std::time::Instant::now();
        
        // ?? ?QUILIBRE : Timeout ?quilibr? pour pr?cision vs vitesse
        let timeout = Duration::from_secs(2); // Augment? de 1s ? 2s pour la pr?cision
        
        match tokio::time::timeout(timeout, async {
            // Appel au microservice embedding avec timeout ?quilibr?
            let request = json!({
                "query": query,
                "type_donnee": "texte",
                "top_k": 3, // Augment? de 1 ? 3 pour plus de pr?cision
                "active": true,
                "type_metier": intention
            });
            
            let response = self.http_client
                .post(&format!("{}/search_embedding_pinecone", self.config.embedding_service_url))
                .header("x-api-key", &self.config.api_key)
                .json(&request)
                .timeout(Duration::from_secs(1500)) // Timeout ?quilibr? (1.5s)
                .send()
                .await?;
            
            if response.status().is_success() {
                let search_result: PineconeSearchResponse = response.json().await?;
                
                if let Some(best_match) = search_result.results.first() {
                    if best_match.score >= self.config.similarity_threshold {
                        if let Some(ia_response) = best_match.metadata.get("ia_response").and_then(|v| v.as_str()) {
                            // V?RIFICATION SUPPL?MENTAIRE : S'assurer que la r?ponse ne contient pas d'images
                            // si la requ?te actuelle contient des images
                            if query.contains("Images jointes:") && !ia_response.contains("origine_champs") {
                                log::warn!("[SemanticCache] Cache ignor? - requ?te avec images mais r?ponse sans origine_champs");
                                return Ok(None);
                            }
                            
                            log::info!("[SemanticCache] ? Cache s?mantique trouv? en {:?} (score: {:.3})", start_time.elapsed(), best_match.score);
                            return Ok(Some(ia_response.to_string()));
                        }
                    }
                }
            }
            
            Ok(None)
        }).await {
            Ok(result) => result,
            Err(_) => {
                log::warn!("[SemanticCache] ? Timeout recherche cache s?mantique (2s)");
                Ok(None)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_semantic_cache_creation() {
        let config = SemanticCacheConfig::default();
        let cache = SemanticCache::new(config);
        assert_eq!(cache.config.similarity_threshold, 0.95);
    }

    #[tokio::test]
    async fn test_service_id_generation() {
        let cache = SemanticCache::new_default();
        let id1 = cache.generate_service_id("test1", "creation_service");
        let id2 = cache.generate_service_id("test2", "creation_service");
        assert_ne!(id1, id2);
    }
} 
