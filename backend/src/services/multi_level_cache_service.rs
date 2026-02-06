// ✅ Service de cache multi-niveaux (L1: Mémoire, L2: Redis, L4: CDN)
// Optimisé pour services spécialisés avec stratégie de cache intelligente

use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};

use log::{debug, warn};
use serde::{de::DeserializeOwned, Serialize};

use crate::core::types::{AppError, AppResult};
use crate::services::cache_service::CacheService;

/// Cache L1: Mémoire (in-memory) - Ultra rapide, limité
struct L1Cache {
    data: Arc<RwLock<HashMap<String, (Vec<u8>, Instant)>>>,
    max_size: usize,
    default_ttl: Duration,
}

impl L1Cache {
    fn new(max_size: usize, default_ttl: Duration) -> Self {
        Self {
            data: Arc::new(RwLock::new(HashMap::new())),
            max_size,
            default_ttl,
        }
    }

    fn get<T>(&self, key: &str) -> Option<T>
    where
        T: DeserializeOwned,
    {
        let (value_bytes, inserted_at) = {
            let data = self.data.read().ok()?;
            let entry = data.get(key)?;
            (entry.0.clone(), entry.1)
        };

        // Vérifier expiration
        if inserted_at.elapsed() > self.default_ttl {
            let mut data = self.data.write().ok()?;
            data.remove(key);
            return None;
        }

        // Désérialiser
        bincode::deserialize(&value_bytes).ok()
    }

    fn set<T>(&self, key: &str, value: &T) -> AppResult<()>
    where
        T: Serialize,
    {
        let mut data = self
            .data
            .write()
            .map_err(|e| AppError::Internal(format!("L1 cache lock error: {}", e)))?;

        // Éviction LRU si nécessaire
        if data.len() >= self.max_size && !data.contains_key(key) {
            // Supprimer les entrées expirées d'abord
            let now = Instant::now();
            data.retain(|_, (_, inserted_at)| now.duration_since(*inserted_at) <= self.default_ttl);

            // Si toujours plein, supprimer la plus ancienne
            if data.len() >= self.max_size {
                let oldest_key = data
                    .iter()
                    .min_by_key(|(_, (_, inserted_at))| *inserted_at)
                    .map(|(k, _)| k.clone());
                if let Some(key_to_remove) = oldest_key {
                    data.remove(&key_to_remove);
                }
            }
        }

        let value_bytes = bincode::serialize(value)
            .map_err(|e| AppError::Internal(format!("L1 cache serialization error: {}", e)))?;
        data.insert(key.to_string(), (value_bytes, Instant::now()));

        Ok(())
    }

    fn invalidate(&self, key: &str) {
        if let Ok(mut data) = self.data.write() {
            data.remove(key);
        }
    }

    fn clear(&self) {
        if let Ok(mut data) = self.data.write() {
            data.clear();
        }
    }
}

/// Service de cache multi-niveaux
pub struct MultiLevelCacheService {
    l1_cache: L1Cache,
    l2_cache: CacheService, // Redis
    l1_enabled: bool,
    l2_enabled: bool,
}

impl MultiLevelCacheService {
    /// Crée un nouveau service de cache multi-niveaux
    pub fn new(redis_client: Option<redis::Client>, l1_max_size: usize, l1_ttl: Duration) -> Self {
        let l2_enabled = redis_client.is_some();
        Self {
            l1_cache: L1Cache::new(l1_max_size, l1_ttl),
            l2_cache: CacheService::new(redis_client),
            l1_enabled: true,
            l2_enabled,
        }
    }

    /// Récupère une valeur depuis le cache (L1 puis L2)
    pub async fn get<T>(&self, key: &str) -> AppResult<Option<T>>
    where
        T: DeserializeOwned + Clone + Serialize + Send + 'static,
    {
        // ✅ L1: Vérifier cache mémoire d'abord
        if self.l1_enabled {
            if let Some(value) = self.l1_cache.get::<T>(key) {
                debug!("[MultiLevelCache] L1 hit: {}", key);
                return Ok(Some(value));
            }
        }

        // ✅ L2: Vérifier Redis
        if self.l2_enabled {
            match self.l2_cache.get::<T>(key).await {
                Ok(Some(value)) => {
                    debug!("[MultiLevelCache] L2 hit: {}", key);
                    // Promouvoir vers L1
                    if self.l1_enabled {
                        let _ = self.l1_cache.set(key, &value);
                    }
                    return Ok(Some(value));
                }
                Ok(None) => {}
                Err(e) => {
                    warn!("[MultiLevelCache] L2 error for {}: {}", key, e);
                }
            }
        }

        debug!("[MultiLevelCache] Cache miss: {}", key);
        Ok(None)
    }

    /// Stocke une valeur dans le cache (L1 et L2)
    pub async fn set<T>(&self, key: &str, value: &T, l2_ttl: Option<Duration>) -> AppResult<()>
    where
        T: Serialize + Send + 'static,
    {
        // ✅ L1: Stocker en mémoire
        if self.l1_enabled {
            if let Err(e) = self.l1_cache.set(key, value) {
                warn!("[MultiLevelCache] L1 set error for {}: {}", key, e);
            }
        }

        // ✅ L2: Stocker dans Redis
        if self.l2_enabled {
            if let Some(ttl) = l2_ttl {
                self.l2_cache.set_with_ttl(key, value, ttl).await?;
            } else {
                self.l2_cache.set(key, value).await?;
            }
        }

        Ok(())
    }

    /// Invalide le cache à tous les niveaux
    pub async fn invalidate(&self, key: &str) -> AppResult<()> {
        // L1
        if self.l1_enabled {
            self.l1_cache.invalidate(key);
        }

        // L2
        if self.l2_enabled {
            self.l2_cache.delete(key).await?;
        }

        Ok(())
    }

    /// Invalide plusieurs clés
    pub async fn invalidate_pattern(&self, pattern: &str) -> AppResult<()> {
        // L1: Parcourir toutes les clés (limité)
        if self.l1_enabled {
            let mut data = self
                .l1_cache
                .data
                .write()
                .map_err(|e| AppError::Internal(format!("L1 cache lock error: {}", e)))?;
            let keys_to_remove: Vec<String> =
                data.keys().filter(|k| k.contains(pattern)).cloned().collect();
            for key in keys_to_remove {
                data.remove(&key);
            }
        }

        // L2: Utiliser Redis SCAN (si disponible)
        if self.l2_enabled {
            // Note: Implémentation simplifiée - pourrait utiliser SCAN pour pattern matching
            warn!(
                "[MultiLevelCache] Pattern invalidation L2 not fully implemented for: {}",
                pattern
            );
        }

        Ok(())
    }

    /// Vide tout le cache
    pub async fn clear(&self) -> AppResult<()> {
        if self.l1_enabled {
            self.l1_cache.clear();
        }

        if self.l2_enabled {
            // Note: Clear Redis nécessite FLUSHDB - à utiliser avec précaution
            warn!("[MultiLevelCache] L2 clear not implemented (use with caution)");
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_multi_level_cache() {
        let cache = MultiLevelCacheService::new(
            None, // Pas de Redis pour les tests
            100,  // Max 100 entrées L1
            Duration::from_secs(60),
        );

        // Test set/get
        let test_value = "test_value".to_string();
        cache.set("test_key", &test_value, None).await.unwrap();
        let retrieved = cache.get::<String>("test_key").await.unwrap();
        assert_eq!(retrieved, Some(test_value));

        // Test invalidation
        cache.invalidate("test_key").await.unwrap();
        let retrieved = cache.get::<String>("test_key").await.unwrap();
        assert_eq!(retrieved, None);
    }
}
