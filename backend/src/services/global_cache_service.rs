// ✅ NOUVEAU 2025-12-01: Service de cache global pour toutes les fonctionnalités
// Extension de SearchCacheService pour être utilisable partout

use crate::core::types::AppResult;
use crate::services::cache_service::CacheService;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

/// Cache en mémoire L1 (ultra-rapide, <1ms)
struct MemoryCache {
    data: Arc<RwLock<HashMap<String, (Value, Instant)>>>,
    default_ttl: Duration,
}

impl MemoryCache {
    fn new(default_ttl: Duration) -> Self {
        Self {
            data: Arc::new(RwLock::new(HashMap::new())),
            default_ttl,
        }
    }

    async fn get(&self, key: &str) -> Option<Value> {
        let cache = self.data.read().await;
        if let Some((value, timestamp)) = cache.get(key) {
            if timestamp.elapsed() < self.default_ttl {
                return Some(value.clone());
            }
        }
        None
    }

    async fn set(&self, key: String, value: Value) {
        let mut cache = self.data.write().await;
        // Nettoyer les entrées expirées (max 20k entrées pour cache global)
        if cache.len() > 20_000 {
            cache.retain(|_, (_, ts)| ts.elapsed() < self.default_ttl);
        }
        cache.insert(key, (value, Instant::now()));
    }

    async fn invalidate(&self, pattern: &str) {
        let mut cache = self.data.write().await;
        cache.retain(|key, _| !key.contains(pattern));
    }
}

/// Service de cache global multi-niveaux pour toutes les fonctionnalités
pub struct GlobalCacheService {
    memory_cache: MemoryCache,
    redis_cache: Option<Arc<CacheService>>,
}

impl GlobalCacheService {
    pub fn new(redis_cache: Option<Arc<CacheService>>) -> Self {
        Self {
            memory_cache: MemoryCache::new(Duration::from_secs(300)), // 5 minutes L1
            redis_cache,
        }
    }

    /// Récupère une valeur depuis le cache (multi-niveaux)
    pub async fn get<T>(&self, key: &str) -> AppResult<Option<T>>
    where
        T: serde::de::DeserializeOwned,
    {
        // ✅ Niveau 1: Cache mémoire (ultra-rapide, <1ms)
        if let Some(cached) = self.memory_cache.get(key).await {
            if let Ok(value) = serde_json::from_value::<T>(cached.clone()) {
                log::debug!("[GlobalCache] ✅ Cache L1 hit: {}", key);
                return Ok(Some(value));
            }
        }

        // ✅ Niveau 2: Cache Redis (rapide, <5ms)
        if let Some(redis) = &self.redis_cache {
            if let Ok(Some(cached)) = redis.get::<T>(key).await {
                log::debug!("[GlobalCache] ✅ Cache L2 (Redis) hit: {}", key);
                // Mettre en cache L1 pour prochaine fois (si T implémente Serialize)
                // Note: On ne peut pas mettre en cache L1 si T n'implémente pas Serialize
                // mais ce n'est pas critique car le cache L2 fonctionne
                return Ok(Some(cached));
            }
        }

        log::debug!("[GlobalCache] ❌ Cache miss: {}", key);
        Ok(None)
    }

    /// Stocke une valeur dans tous les niveaux de cache
    pub async fn set<T>(&self, key: &str, value: &T, ttl: Duration) -> AppResult<()>
    where
        T: serde::Serialize,
    {
        // ✅ Niveau 1: Cache mémoire (TTL court: 5 min)
        if let Ok(value_json) = serde_json::to_value(value) {
            self.memory_cache.set(key.to_string(), value_json).await;
        }

        // ✅ Niveau 2: Cache Redis (TTL configurable)
        if let Some(redis) = &self.redis_cache {
            redis.set_with_ttl(key, value, ttl).await?;
        }

        log::debug!(
            "[GlobalCache] 💾 Valeur mise en cache: {} (TTL: {:?})",
            key,
            ttl
        );
        Ok(())
    }

    /// Invalide le cache pour un pattern donné
    pub async fn invalidate(&self, pattern: &str) {
        // Invalider cache mémoire
        self.memory_cache.invalidate(pattern).await;

        // Invalider cache Redis (si disponible)
        if let Some(redis) = &self.redis_cache {
            // Note: Pour invalidation Redis, on devrait utiliser SCAN + DEL
            // Pour l'instant, on invalide seulement la mémoire
            log::debug!(
                "[GlobalCache] ⚠️ Invalidation Redis par pattern non implémentée: {}",
                pattern
            );
        }
    }

    /// Génère une clé de cache pour une opération
    pub fn generate_key(prefix: &str, params: &[(&str, &dyn std::fmt::Display)]) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        prefix.hash(&mut hasher);
        for (key, value) in params {
            key.hash(&mut hasher);
            value.to_string().hash(&mut hasher);
        }

        format!("{}:{}", prefix, hasher.finish())
    }
}
