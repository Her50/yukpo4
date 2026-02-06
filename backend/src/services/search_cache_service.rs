// ✅ NOUVEAU 2025-01-XX: Service de cache multi-niveaux pour recherches
// Objectif: Cache hit rate >80%, temps de réponse <10ms pour recherches populaires

use crate::core::types::AppResult;
use crate::services::cache_service::CacheService;
use crate::services::native_search_service::SearchResult;
use lru::LruCache;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::num::NonZeroUsize;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;

/// Cache multi-niveaux pour recherches
pub struct SearchCacheService {
    /// Niveau 1: Cache mémoire LRU (10K entrées, <1ms)
    l1_memory_cache: Arc<RwLock<LruCache<String, CachedSearchResult>>>,

    /// Niveau 2: Cache Redis (100K entrées, <5ms)
    l2_redis_cache: Option<Arc<CacheService>>,

    /// Niveau 4: Cache pré-calculé pour top 1000 recherches populaires
    l4_popular_searches: Arc<RwLock<HashMap<String, Vec<SearchResult>>>>,

    /// Statistiques de cache
    stats: Arc<RwLock<CacheStats>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct CachedSearchResult {
    results: Vec<SearchResult>,
    cached_at: i64, // Timestamp en millisecondes depuis l'epoch
    access_count: u64,
}

#[derive(Default)]
struct CacheStats {
    l1_hits: u64,
    l1_misses: u64,
    l2_hits: u64,
    l2_misses: u64,
    l4_hits: u64,
    total_requests: u64,
}

impl SearchCacheService {
    /// Crée un nouveau service de cache
    pub fn new(redis_cache: Option<Arc<CacheService>>) -> Self {
        let l1_cache = LruCache::new(
            NonZeroUsize::new(10_000).unwrap(), // 10K entrées max
        );

        Self {
            l1_memory_cache: Arc::new(RwLock::new(l1_cache)),
            l2_redis_cache: redis_cache,
            l4_popular_searches: Arc::new(RwLock::new(HashMap::new())),
            stats: Arc::new(RwLock::new(CacheStats::default())),
        }
    }

    /// Récupère les résultats depuis le cache multi-niveaux
    pub async fn get_cached_results(
        &self,
        cache_key: &str,
        query: &str,
    ) -> AppResult<Option<Vec<SearchResult>>> {
        {
            let mut stats = self.stats.write().await;
            stats.total_requests += 1;
        }

        // Niveau 1: Cache mémoire (ultra-rapide, <1ms)
        {
            let mut cache = self.l1_memory_cache.write().await;
            if let Some(cached) = cache.get(cache_key) {
                {
                    let mut stats = self.stats.write().await;
                    stats.l1_hits += 1;
                }

                log::debug!("[SearchCache] ✅ L1 hit: {}", cache_key);
                return Ok(Some(cached.results.clone()));
            }
        }

        {
            let mut stats = self.stats.write().await;
            stats.l1_misses += 1;
        }

        // Niveau 2: Cache Redis (<5ms)
        if let Some(ref redis) = self.l2_redis_cache {
            match redis.get::<Vec<SearchResult>>(cache_key).await {
                Ok(Some(cached)) => {
                    // Promouvoir vers L1
                    self.l1_memory_cache.write().await.put(
                        cache_key.to_string(),
                        CachedSearchResult {
                            results: cached.clone(),
                            cached_at: SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap()
                                .as_millis() as i64,
                            access_count: 1,
                        },
                    );

                    {
                        let mut stats = self.stats.write().await;
                        stats.l2_hits += 1;
                    }

                    log::debug!("[SearchCache] ✅ L2 hit: {}", cache_key);
                    return Ok(Some(cached));
                }
                Ok(None) => {
                    let mut stats = self.stats.write().await;
                    stats.l2_misses += 1;
                }
                Err(e) => {
                    log::warn!("[SearchCache] ⚠️ Erreur L2: {}", e);
                }
            }
        }

        // Niveau 4: Cache pré-calculé pour recherches populaires
        {
            let popular = self.l4_popular_searches.read().await;
            if let Some(cached) = popular.get(query) {
                // Promouvoir vers L1 et L2
                self.l1_memory_cache.write().await.put(
                    cache_key.to_string(),
                    CachedSearchResult {
                        results: cached.clone(),
                        cached_at: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis()
                            as i64,
                        access_count: 1,
                    },
                );

                if let Some(ref redis) = self.l2_redis_cache {
                    let _ = redis
                        .set_with_ttl(
                            cache_key,
                            &cached,
                            Duration::from_secs(3600), // 1h pour recherches populaires
                        )
                        .await;
                }

                {
                    let mut stats = self.stats.write().await;
                    stats.l4_hits += 1;
                }

                log::debug!("[SearchCache] ✅ L4 hit: {}", query);
                return Ok(Some(cached.clone()));
            }
        }

        log::debug!("[SearchCache] ❌ Cache miss: {}", cache_key);
        Ok(None)
    }

    /// Met en cache les résultats avec TTL adaptatif
    pub async fn cache_results(
        &self,
        cache_key: &str,
        results: Vec<SearchResult>,
        ttl: Duration,
        is_popular: bool,
    ) -> AppResult<()> {
        let cached = CachedSearchResult {
            results: results.clone(),
            cached_at: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64,
            access_count: 0,
        };

        // L1: Toujours mettre en cache mémoire
        self.l1_memory_cache.write().await.put(cache_key.to_string(), cached.clone());

        // L2: Mettre en cache Redis avec TTL adaptatif
        if let Some(ref redis) = self.l2_redis_cache {
            let adaptive_ttl = if is_popular {
                Duration::from_secs(3600) // 1h pour recherches populaires
            } else {
                ttl
            };

            if let Err(e) = redis.set_with_ttl(cache_key, &results, adaptive_ttl).await {
                log::warn!("[SearchCache] ⚠️ Erreur mise en cache L2: {}", e);
            }
        }

        // L4: Si recherche populaire, mettre dans cache pré-calculé
        if is_popular {
            let mut popular = self.l4_popular_searches.write().await;
            // Limiter à 1000 recherches populaires
            if popular.len() >= 1000 {
                // Supprimer la moins récente
                let oldest_key = popular.keys().next().cloned();
                if let Some(key) = oldest_key {
                    popular.remove(&key);
                }
            }
            popular.insert(cache_key.to_string(), results);
        }

        Ok(())
    }

    /// Génère une clé de cache à partir des paramètres de recherche
    pub fn generate_cache_key(
        &self,
        query: &str,
        category_filter: Option<&str>,
        location_filter: Option<&str>,
        gps_zone: Option<&str>,
        search_radius_km: Option<i32>,
        specialized_type: Option<&str>,
    ) -> String {
        let mut hasher = DefaultHasher::new();
        query.hash(&mut hasher);
        category_filter.hash(&mut hasher);
        location_filter.hash(&mut hasher);
        gps_zone.hash(&mut hasher);
        search_radius_km.hash(&mut hasher);
        specialized_type.hash(&mut hasher);

        format!("search:{}", hasher.finish())
    }

    /// Récupère les statistiques de cache
    pub async fn get_stats(&self) -> CacheStatsSnapshot {
        let stats = self.stats.read().await;
        let total = stats.total_requests.max(1);

        CacheStatsSnapshot {
            total_requests: stats.total_requests,
            l1_hit_rate: stats.l1_hits as f64 / total as f64,
            l2_hit_rate: stats.l2_hits as f64 / total as f64,
            l4_hit_rate: stats.l4_hits as f64 / total as f64,
            overall_hit_rate: (stats.l1_hits + stats.l2_hits + stats.l4_hits) as f64 / total as f64,
            l1_size: self.l1_memory_cache.read().await.len(),
            l4_size: self.l4_popular_searches.read().await.len(),
        }
    }

    /// Marque une recherche comme populaire (à appeler après X recherches identiques)
    pub async fn mark_as_popular(&self, query: &str, results: Vec<SearchResult>) {
        let mut popular = self.l4_popular_searches.write().await;

        // Limiter à 1000 recherches populaires
        if popular.len() >= 1000 {
            let oldest_key = popular.keys().next().cloned();
            if let Some(key) = oldest_key {
                popular.remove(&key);
            }
        }

        popular.insert(query.to_string(), results);
        log::info!(
            "[SearchCache] 📌 Recherche marquée comme populaire: '{}'",
            query
        );
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStatsSnapshot {
    pub total_requests: u64,
    pub l1_hit_rate: f64,
    pub l2_hit_rate: f64,
    pub l4_hit_rate: f64,
    pub overall_hit_rate: f64,
    pub l1_size: usize,
    pub l4_size: usize,
}
