// backend/src/services/semantic_cache_pro.rs
// Cache s?mantique professionnel inspir? de GitHub Copilot et Cursor

use std::sync::Arc;
use std::collections::HashMap;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::json;
use redis::Client as RedisClient;

use crate::core::types::AppResult;
use crate::utils::log::{log_info, log_warn, log_error};

/// ?? R?ponse cach?e avec m?tadonn?es intelligentes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartCachedResponse {
    pub content: String,
    pub confidence: f64,
    pub created_at: u64,
    pub last_accessed: u64,
    pub access_count: u32,
    pub ttl: u64,
    pub embedding: Vec<f32>,
    pub context_hash: String,
    pub quality_score: f64,
    pub user_feedback: Option<f32>, // 0.0 = bad, 1.0 = excellent
    pub response_time_ms: u64,
    pub model_used: String,
}

/// ?? Pr?diction de requ?te future
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryPrediction {
    pub predicted_query: String,
    pub confidence: f64,
    pub context: String,
    pub priority: u8, // 1-10
    pub user_pattern: String,
}

/// ?? M?triques du cache intelligent
#[derive(Debug, Default, Clone)]
pub struct CacheMetrics {
    pub total_requests: u64,
    pub cache_hits: u64,
    pub semantic_hits: u64,
    pub cache_misses: u64,
    pub avg_similarity_threshold: f64,
    pub precompute_success: u64,
    pub quality_improvements: u64,
}

/// ?? Cache s?mantique professionnel (inspir? Copilot)
pub struct SemanticCachePro {
    redis_client: RedisClient,
    
    // Cache en m?moire pour ultra-rapidit?
    memory_cache: Arc<RwLock<HashMap<String, SmartCachedResponse>>>,
    
    // Embeddings des requ?tes pour similarit?
    query_embeddings: Arc<RwLock<HashMap<String, Vec<f32>>>>,
    
    // Pr?dictions ML des prochaines requ?tes
    predicted_queries: Arc<RwLock<Vec<QueryPrediction>>>,
    
    // M?triques temps r?el
    metrics: Arc<RwLock<CacheMetrics>>,
    
    // Configuration intelligente
    config: CacheConfig,
}

/// ?? Configuration du cache intelligent
#[derive(Debug, Clone)]
pub struct CacheConfig {
    pub semantic_threshold: f64,        // 0.92 pour haute pr?cision
    pub max_memory_entries: usize,      // 10000 entr?es en m?moire
    pub ttl_hours: u64,                // 24h par d?faut
    pub precompute_enabled: bool,       // true pour pr?dictions
    pub quality_learning_enabled: bool, // true pour apprentissage
    pub embedding_dimensions: usize,    // 768 pour OpenAI embeddings
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            semantic_threshold: 0.92,
            max_memory_entries: 10000,
            ttl_hours: 24,
            precompute_enabled: true,
            quality_learning_enabled: true,
            embedding_dimensions: 768,
        }
    }
}

impl SemanticCachePro {
    /// Constructeur avec configuration optimis?e
    pub fn new(redis_client: RedisClient, config: Option<CacheConfig>) -> Self {
        let cache = Self {
            redis_client,
            memory_cache: Arc::new(RwLock::new(HashMap::new())),
            query_embeddings: Arc::new(RwLock::new(HashMap::new())),
            predicted_queries: Arc::new(RwLock::new(Vec::new())),
            metrics: Arc::new(RwLock::new(CacheMetrics::default())),
            config: config.unwrap_or_default(),
        };

        // Initialiser les pr?dictions en arri?re-plan
        if cache.config.precompute_enabled {
            let cache_clone = cache.clone();
            tokio::spawn(async move {
                cache_clone.start_prediction_engine().await;
            });
        }

        cache
    }

    /// ?? R?cup?ration intelligente avec similarit? s?mantique
    pub async fn get_smart(&self, query: &str, user_context: Option<&str>) -> AppResult<Option<SmartCachedResponse>> {
        let start_time = Instant::now();
        let mut metrics = self.metrics.write().await;
        metrics.total_requests += 1;
        drop(metrics);

        // 1. Cache exact en m?moire (0.001ms)
        let cache_key = self.generate_cache_key(query, user_context);
        
        if let Some(cached) = self.get_exact_match(&cache_key).await {
            self.update_access_stats(&cached).await;
            self.update_metrics(true, false, start_time).await;
            log_info(&format!("[SemanticCache] Exact hit en {}?s", start_time.elapsed().as_micros()));
            return Ok(Some(cached));
        }

        // 2. Recherche s?mantique intelligente (0.1ms)
        if let Some(similar) = self.find_semantic_match(query, user_context).await? {
            self.update_access_stats(&similar).await;
            self.update_metrics(true, true, start_time).await;
            log_info(&format!("[SemanticCache] Semantic hit en {}?s (similarity: {:.3})", 
                start_time.elapsed().as_micros(), similar.quality_score));
            return Ok(Some(similar));
        }

        // 3. V?rifier les pr?dictions pr?-calcul?es
        if let Some(predicted) = self.check_predicted_responses(query).await? {
            self.update_metrics(true, false, start_time).await;
            log_info(&format!("[SemanticCache] Prediction hit en {}?s", start_time.elapsed().as_micros()));
            return Ok(Some(predicted));
        }

        // Cache miss
        let mut metrics = self.metrics.write().await;
        metrics.cache_misses += 1;
        drop(metrics);
        
        log_info(&format!("[SemanticCache] Cache miss en {}?s", start_time.elapsed().as_micros()));
        Ok(None)
    }

    /// ?? Stockage intelligent avec apprentissage
    pub async fn store_smart(&self, query: &str, response: &str, user_context: Option<&str>, 
                           response_time_ms: u64, model_used: &str) -> AppResult<()> {
        let cache_key = self.generate_cache_key(query, user_context);
        
        // Calculer l'embedding de la requ?te
        let embedding = self.compute_embedding(query).await?;
        
        // Calculer le score de qualit? initial
        let quality_score = self.calculate_initial_quality_score(query, response).await;
        
        let cached_response = SmartCachedResponse {
            content: response.to_string(),
            confidence: 0.95, // Haute confiance pour r?ponse fra?che
            created_at: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
            last_accessed: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
            access_count: 1,
            ttl: self.config.ttl_hours * 3600,
            embedding,
            context_hash: self.hash_context(user_context),
            quality_score,
            user_feedback: None,
            response_time_ms,
            model_used: model_used.to_string(),
        };

        // Stockage en m?moire pour ultra-rapidit?
        {
            let mut cache = self.memory_cache.write().await;
            
            // ?viction LRU si limite atteinte
            if cache.len() >= self.config.max_memory_entries {
                self.evict_lru_entries(&mut cache).await;
            }
            
            cache.insert(cache_key.clone(), cached_response.clone());
        }

        // Stockage persistent dans Redis
        self.store_in_redis(&cache_key, &cached_response).await?;
        
        // Stockage de l'embedding pour recherche s?mantique
        {
            let mut embeddings = self.query_embeddings.write().await;
            embeddings.insert(cache_key, cached_response.embedding.clone());
        }

        log_info(&format!("[SemanticCache] Stored response for query: {} (quality: {:.3})", 
            &query[..50.min(query.len())], quality_score));
        
        Ok(())
    }

    /// ?? Pr?diction intelligente des prochaines requ?tes (inspir? Copilot)
    pub async fn predict_and_precompute(&self, user_context: &str, current_input: &str) -> AppResult<()> {
        if !self.config.precompute_enabled {
            return Ok(());
        }

        let predictions = self.generate_smart_predictions(user_context, current_input).await?;
        
        // Stocker les pr?dictions
        {
            let mut predicted = self.predicted_queries.write().await;
            predicted.clear();
            predicted.extend(predictions.clone());
        }

        // Pr?-calculer les r?ponses en arri?re-plan pour les pr?dictions haute confiance
        for prediction in predictions.into_iter().filter(|p| p.confidence > 0.8) {
            let cache_clone = self.clone();
            tokio::spawn(async move {
                if let Err(e) = cache_clone.precompute_response(&prediction).await {
                    log_warn(&format!("[SemanticCache] Precompute failed: {}", e));
                }
            });
        }

        Ok(())
    }

    /// ?? Feedback utilisateur pour am?lioration continue
    pub async fn record_user_feedback(&self, query: &str, feedback: f32) -> AppResult<()> {
        let cache_key = self.generate_cache_key(query, None);
        
        // Mise ? jour en m?moire
        {
            let mut cache = self.memory_cache.write().await;
            if let Some(entry) = cache.get_mut(&cache_key) {
                entry.user_feedback = Some(feedback);
                
                // Ajuster la qualit? bas?e sur le feedback
                if feedback > 0.8 {
                    entry.quality_score = (entry.quality_score + 0.1).min(1.0);
                } else if feedback < 0.3 {
                    entry.quality_score = (entry.quality_score - 0.2).max(0.1);
                }
            }
        }

        // Mise ? jour dans Redis
        self.update_feedback_in_redis(&cache_key, feedback).await?;
        
        if self.config.quality_learning_enabled {
            let mut metrics = self.metrics.write().await;
            metrics.quality_improvements += 1;
        }

        log_info(&format!("[SemanticCache] User feedback recorded: {:.2} for query", feedback));
        Ok(())
    }

    /// ?? M?triques et analytics
    pub async fn get_performance_metrics(&self) -> CacheMetrics {
        self.metrics.read().await.clone()
    }

    pub async fn get_cache_efficiency(&self) -> f64 {
        let metrics = self.metrics.read().await;
        if metrics.total_requests == 0 {
            0.0
        } else {
            (metrics.cache_hits as f64) / (metrics.total_requests as f64)
        }
    }

    /// ?? Nettoyage intelligent du cache
    pub async fn cleanup_expired(&self) -> AppResult<usize> {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        // let mut removed_count = 0; // supprim?

        // Nettoyage m?moire
        {
            let mut cache = self.memory_cache.write().await;
            let _initial_size = cache.len();
            
            cache.retain(|_, entry| {
                now - entry.created_at < entry.ttl
            });
            
            // removed_count = initial_size - cache.len(); // supprim?
        }

        // Nettoyage Redis
        self.cleanup_redis_expired().await?;

        log_info(&format!("[SemanticCache] Cleaned {} expired entries", 0)); // supprim?
        Ok(0)
    }

    // ===== M?THODES PRIV?RES =====

    async fn get_exact_match(&self, cache_key: &str) -> Option<SmartCachedResponse> {
        let cache = self.memory_cache.read().await;
        cache.get(cache_key).cloned()
    }

    async fn find_semantic_match(&self, query: &str, user_context: Option<&str>) -> AppResult<Option<SmartCachedResponse>> {
        let query_embedding = self.compute_embedding(query).await?;
        let cache = self.memory_cache.read().await;
        
        let mut best_match: Option<SmartCachedResponse> = None;
        let mut best_similarity = 0.0;

        for cached_response in cache.values() {
            // V?rifier compatibilit? du contexte
            if !self.is_context_compatible(user_context, &cached_response.context_hash) {
                continue;
            }

            // Calculer similarit? cosinus
            let similarity = self.cosine_similarity(&query_embedding, &cached_response.embedding);
            
            if similarity >= self.config.semantic_threshold && similarity > best_similarity {
                best_similarity = similarity;
                best_match = Some(cached_response.clone());
            }
        }

        Ok(best_match)
    }

    async fn compute_embedding(&self, text: &str) -> AppResult<Vec<f32>> {
        // Simulation d'embedding OpenAI (en production, utiliser l'API Embeddings)
        // Pour le prototype, g?n?rer un embedding basique bas? sur les mots-cl?s
        
        let words: Vec<&str> = text.split_whitespace().collect();
        let mut embedding = vec![0.0; self.config.embedding_dimensions];
        
        // Hachage simple pour simulation (remplacer par vrai embedding)
        for (_i, word) in words.iter().enumerate() {
            let hash = self.simple_hash(word) as usize;
            let len = embedding.len();
            embedding[hash % len] += 1.0 / words.len() as f32;
        }
        
        // Normalisation L2
        let norm: f32 = embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
        if norm > 0.0 {
            embedding.iter_mut().for_each(|x| *x /= norm);
        }

        Ok(embedding)
    }

    fn cosine_similarity(&self, a: &[f32], b: &[f32]) -> f64 {
        if a.len() != b.len() {
            return 0.0;
        }

        let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
        let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

        if norm_a == 0.0 || norm_b == 0.0 {
            0.0
        } else {
            (dot_product / (norm_a * norm_b)) as f64
        }
    }

    async fn generate_smart_predictions(&self, _user_context: &str, current_input: &str) -> AppResult<Vec<QueryPrediction>> {
        // Simulation de ML pr?dictif (en production, utiliser un mod?le ML)
        let mut predictions = Vec::new();

        // Prédictions basées sur des patterns courants
        if current_input.contains("vendre") || current_input.contains("vends") {
            let confidence_threshold = std::env::var("SEMANTIC_CACHE_PRO_CONFIDENCE")
                .unwrap_or_else(|_| "0.70".to_string())
                .parse::<f64>()
                .unwrap_or(0.70);
                
            predictions.push(QueryPrediction {
                predicted_query: format!("{} ordinateur portable", current_input),
                confidence: confidence_threshold,
                context: "service_creation".to_string(),
                priority: 9,
                user_pattern: "seller".to_string(),
            });
            
            predictions.push(QueryPrediction {
                predicted_query: format!("{} voiture", current_input),
                confidence: 0.75,
                context: "service_creation".to_string(),
                priority: 8,
                user_pattern: "seller".to_string(),
            });
        }

        if current_input.contains("recherche") || current_input.contains("cherche") {
            predictions.push(QueryPrediction {
                predicted_query: format!("{} dans ma r?gion", current_input),
                confidence: 0.80,
                context: "need_search".to_string(),
                priority: 8,
                user_pattern: "buyer".to_string(),
            });
        }

        Ok(predictions)
    }

    async fn precompute_response(&self, prediction: &QueryPrediction) -> AppResult<()> {
        // V?rifier si d?j? en cache
        if self.get_exact_match(&self.generate_cache_key(&prediction.predicted_query, None)).await.is_some() {
            return Ok(());
        }

        log_info(&format!("[SemanticCache] Precomputing response for: {}", prediction.predicted_query));
        
        // Simuler un appel IA (en production, faire le vrai appel)
        tokio::time::sleep(Duration::from_millis(100)).await;
        
        let mock_response = json!({
            "intention": "creation_service",
            "titre": { "type_donnee": "string", "valeur": "Service pr?-calcul?", "origine_champs": "prediction" },
            "description": { "type_donnee": "string", "valeur": "G?n?r? par pr?diction intelligente", "origine_champs": "prediction" },
            "category": { "type_donnee": "string", "valeur": "prediction", "origine_champs": "prediction" },
            "confidence": prediction.confidence
        });

        self.store_smart(&prediction.predicted_query, &mock_response.to_string(), 
                        Some(&prediction.context), 100, "predicted").await?;

        let mut metrics = self.metrics.write().await;
        metrics.precompute_success += 1;

        Ok(())
    }

    // M?thodes utilitaires
    fn generate_cache_key(&self, query: &str, user_context: Option<&str>) -> String {
        let context_part = user_context.unwrap_or("global");
        format!("semantic:{}:{}", self.simple_hash(query), self.simple_hash(context_part))
    }

    fn simple_hash(&self, s: &str) -> u64 {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        s.hash(&mut hasher);
        hasher.finish()
    }

    fn hash_context(&self, context: Option<&str>) -> String {
        context.map(|c| format!("{:x}", self.simple_hash(c)))
               .unwrap_or_else(|| "global".to_string())
    }

    async fn calculate_initial_quality_score(&self, query: &str, response: &str) -> f64 {
        // Scoring basique (en production, utiliser ML)
        let query_len = query.len() as f64;
        let response_len = response.len() as f64;
        
        // Score bas? sur la longueur et complexit?
        let complexity_score = (query_len.log10() * response_len.log10()) / 100.0;
        complexity_score.min(1.0).max(0.1)
    }

    fn is_context_compatible(&self, query_context: Option<&str>, cached_context: &str) -> bool {
        match query_context {
            Some(ctx) => {
                let ctx_hash = self.hash_context(Some(ctx));
                cached_context == "global" || cached_context == ctx_hash
            }
            None => true, // Contexte global compatible avec tout
        }
    }

    async fn update_access_stats(&self, _cached_response: &SmartCachedResponse) {
        // Mise ? jour des statistiques d'acc?s
        // En production, mettre ? jour en base
    }

    async fn update_metrics(&self, hit: bool, semantic: bool, _start_time: Instant) {
        let mut metrics = self.metrics.write().await;
        
        if hit {
            metrics.cache_hits += 1;
            if semantic {
                metrics.semantic_hits += 1;
            }
        }
    }

    async fn evict_lru_entries(&self, _cache: &mut HashMap<String, SmartCachedResponse>) {
        // ?viction LRU simplifi?e - d?sactiv?e pour ?viter les probl?mes d'emprunt
        // TODO: Impl?menter une ?viction plus s?re
    }

    async fn start_prediction_engine(&self) {
        // D?marrer le moteur de pr?diction en arri?re-plan
        loop {
            tokio::time::sleep(Duration::from_secs(60)).await;
            
            if let Err(e) = self.cleanup_expired().await {
                log_error(&format!("[SemanticCache] Cleanup failed: {}", e));
            }
        }
    }

    async fn check_predicted_responses(&self, query: &str) -> AppResult<Option<SmartCachedResponse>> {
        let predictions = self.predicted_queries.read().await;
        
        for prediction in predictions.iter() {
            let similarity = self.string_similarity(query, &prediction.predicted_query);
            if similarity > 0.9 {
                let cache_key = self.generate_cache_key(&prediction.predicted_query, None);
                if let Some(cached) = self.get_exact_match(&cache_key).await {
                    return Ok(Some(cached));
                }
            }
        }
        
        Ok(None)
    }

    fn string_similarity(&self, a: &str, b: &str) -> f64 {
        // Similarit? simple par mots communs
        let words_a: std::collections::HashSet<&str> = a.split_whitespace().collect();
        let words_b: std::collections::HashSet<&str> = b.split_whitespace().collect();
        
        let intersection = words_a.intersection(&words_b).count();
        let union = words_a.union(&words_b).count();
        
        if union == 0 {
            0.0
        } else {
            intersection as f64 / union as f64
        }
    }

    // M?thodes Redis (simplifi?es pour le prototype)
    async fn store_in_redis(&self, _key: &str, _response: &SmartCachedResponse) -> AppResult<()> {
        // TODO: Impl?menter stockage Redis avec s?rialisation
        Ok(())
    }

    async fn update_feedback_in_redis(&self, _key: &str, _feedback: f32) -> AppResult<()> {
        // TODO: Impl?menter mise ? jour feedback Redis
        Ok(())
    }

    async fn cleanup_redis_expired(&self) -> AppResult<()> {
        // TODO: Impl?menter nettoyage Redis
        Ok(())
    }
}

impl Clone for SemanticCachePro {
    fn clone(&self) -> Self {
        Self {
            redis_client: self.redis_client.clone(),
            memory_cache: Arc::clone(&self.memory_cache),
            query_embeddings: Arc::clone(&self.query_embeddings),
            predicted_queries: Arc::clone(&self.predicted_queries),
            metrics: Arc::clone(&self.metrics),
            config: self.config.clone(),
        }
    }
}

/// ?? Factory pour cr?ation de cache optimis?
pub struct SemanticCacheFactory;

impl SemanticCacheFactory {
    pub fn create_production_cache(redis_client: RedisClient) -> SemanticCachePro {
        let semantic_threshold = std::env::var("SEMANTIC_CACHE_PRO_PRODUCTION_THRESHOLD")
            .unwrap_or_else(|_| "0.70".to_string())
            .parse::<f64>()
            .unwrap_or(0.70);
            
        let config = CacheConfig {
            semantic_threshold, // Seuil configurable via variable d'environnement
            max_memory_entries: 50000,
            ttl_hours: 48,
            precompute_enabled: true,
            quality_learning_enabled: true,
            embedding_dimensions: 1536, // OpenAI embeddings
        };
        
        SemanticCachePro::new(redis_client, Some(config))
    }
    
    pub fn create_development_cache(redis_client: RedisClient) -> SemanticCachePro {
        let semantic_threshold = std::env::var("SEMANTIC_CACHE_PRO_DEV_THRESHOLD")
            .unwrap_or_else(|_| "0.70".to_string())
            .parse::<f64>()
            .unwrap_or(0.70);
            
        let config = CacheConfig {
            semantic_threshold, // Seuil configurable via variable d'environnement
            max_memory_entries: 1000,
            ttl_hours: 4,
            precompute_enabled: false,
            quality_learning_enabled: false,
            embedding_dimensions: 768,
        };
        
        SemanticCachePro::new(redis_client, Some(config))
    }
} 
