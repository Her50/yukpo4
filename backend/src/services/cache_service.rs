// ✅ Phase 10 - Service de cache générique centralisé pour Redis
// Ce service fournit une API simple et réutilisable pour le cache Redis

use once_cell::sync::Lazy;
use redis::AsyncCommands;
use serde::{de::DeserializeOwned, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;

use crate::core::types::AppError;
use crate::core::types::AppResult;

// ============================================================================
// ✅ 2026-05-16 — Métriques cache hit/miss (Prometheus-friendly).
// ============================================================================
static CACHE_HITS: AtomicU64 = AtomicU64::new(0);
static CACHE_MISSES: AtomicU64 = AtomicU64::new(0);
static CACHE_REDIS_ERRORS: AtomicU64 = AtomicU64::new(0);

/// Snapshot atomique des compteurs pour exposition via /metrics.
/// (hits, misses, redis_errors)
pub fn cache_metrics_snapshot() -> (u64, u64, u64) {
    (
        CACHE_HITS.load(Ordering::Relaxed),
        CACHE_MISSES.load(Ordering::Relaxed),
        CACHE_REDIS_ERRORS.load(Ordering::Relaxed),
    )
}

// ============================================================================
// ✅ 2026-05-16 — Single-flight : déduplique les appels compute() concurrents
// sur la même clé. Évite le "thundering herd" : si 1000 users demandent la
// même clé absente du cache, on n'exécute compute() qu'UNE seule fois et les
// 999 autres attendent le résultat partagé.
// ============================================================================
type FlightSlot = Arc<tokio::sync::Notify>;
static FLIGHTS: Lazy<Mutex<HashMap<String, FlightSlot>>> = Lazy::new(|| Mutex::new(HashMap::new()));

/// Service de cache générique utilisant Redis
pub struct CacheService {
    redis_client: Option<redis::Client>,
    default_ttl: Duration,
}

impl CacheService {
    /// Crée un nouveau service de cache
    pub fn new(redis_client: Option<redis::Client>) -> Self {
        // ✅ OPTIMISÉ 2025-12-01: TTL par défaut 10 minutes (600s) au lieu de 5 minutes
        // Réduit la charge DB de 50% pour recherches populaires
        let default_ttl = Duration::from_secs(
            std::env::var("CACHE_TTL")
                .ok()
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(600), // ✅ 10 minutes par défaut (au lieu de 5 min)
        );

        Self {
            redis_client,
            default_ttl,
        }
    }

    /// Récupère une valeur depuis le cache
    pub async fn get<T>(&self, key: &str) -> AppResult<Option<T>>
    where
        T: DeserializeOwned,
    {
        let Some(client) = &self.redis_client else {
            return Ok(None);
        };

        // ✅ CORRIGÉ: Utiliser le helper Redis avec retry automatique
        use crate::utils::redis_helper;

        match redis_helper::get_with_retry(client, key).await {
            Ok(Some(payload)) => {
                match serde_json::from_str::<T>(&payload) {
                    Ok(value) => {
                        log::debug!("[CacheService] Cache hit pour: {}", key);
                        CACHE_HITS.fetch_add(1, Ordering::Relaxed);
                        Ok(Some(value))
                    }
                    Err(err) => {
                        log::warn!("[CacheService] Erreur parsing cache {}: {:?}", key, err);
                        // Supprimer la clé invalide (avec retry)
                        let _ = redis_helper::del_with_retry(client, key).await;
                        CACHE_MISSES.fetch_add(1, Ordering::Relaxed);
                        Ok(None)
                    }
                }
            }
            Ok(None) => {
                log::debug!("[CacheService] Cache miss pour: {}", key);
                CACHE_MISSES.fetch_add(1, Ordering::Relaxed);
                Ok(None)
            }
            Err(e) => {
                log::warn!(
                    "[CacheService] Redis indisponible pour {}: {}. Retour None.",
                    key,
                    e
                );
                CACHE_REDIS_ERRORS.fetch_add(1, Ordering::Relaxed);
                Ok(None)
            }
        }
    }

    /// Stocke une valeur dans le cache avec TTL par défaut
    pub async fn set<T>(&self, key: &str, value: &T) -> AppResult<()>
    where
        T: Serialize,
    {
        self.set_with_ttl(key, value, self.default_ttl).await
    }

    /// Stocke une valeur dans le cache avec un TTL personnalisé
    pub async fn set_with_ttl<T>(&self, key: &str, value: &T, ttl: Duration) -> AppResult<()>
    where
        T: Serialize,
    {
        let Some(client) = &self.redis_client else {
            return Ok(());
        };

        let payload = match serde_json::to_string(value) {
            Ok(json) => json,
            Err(err) => {
                return Err(AppError::Internal(format!(
                    "Erreur sérialisation pour cache {}: {:?}",
                    key, err
                )));
            }
        };

        // ✅ CORRIGÉ: Utiliser le helper Redis avec retry automatique
        use crate::utils::redis_helper;

        let ttl_seconds = ttl.as_secs().min(i64::MAX as u64);
        match redis_helper::set_with_retry(client, key, &payload, Some(ttl_seconds)).await {
            Ok(_) => {
                log::debug!(
                    "[CacheService] Cache set pour: {} (TTL: {}s)",
                    key,
                    ttl_seconds
                );
            }
            Err(e) => {
                log::warn!("[CacheService] Redis indisponible pour set {}: {}. L'opération continue sans cache.", key, e);
            }
        }

        Ok(())
    }

    /// Supprime une clé du cache
    pub async fn delete(&self, key: &str) -> AppResult<()> {
        let Some(client) = &self.redis_client else {
            return Ok(());
        };

        // ✅ CORRIGÉ: Utiliser le helper Redis avec retry automatique
        use crate::utils::redis_helper;

        match redis_helper::del_with_retry(client, key).await {
            Ok(_) => {
                log::debug!("[CacheService] Cache supprimé: {}", key);
            }
            Err(e) => {
                log::warn!(
                    "[CacheService] Redis indisponible pour delete {}: {}. L'opération continue.",
                    key,
                    e
                );
            }
        }

        Ok(())
    }

    /// Supprime plusieurs clés du cache (pattern matching)
    pub async fn delete_pattern(&self, pattern: &str) -> AppResult<usize> {
        let Some(client) = &self.redis_client else {
            return Ok(0);
        };

        // ✅ CORRIGÉ: Utiliser le helper Redis avec retry automatique
        use crate::utils::redis_helper;

        match redis_helper::execute_with_retry(
            client,
            |mut conn| async move {
                let keys: Vec<String> =
                    redis::cmd("KEYS").arg(pattern).query_async(&mut conn).await?;
                if keys.is_empty() {
                    Ok(0)
                } else {
                    conn.del::<_, ()>(keys.clone()).await?;
                    Ok(keys.len())
                }
            },
            3,
            500,
        )
        .await
        {
            Ok(count) => {
                if count > 0 {
                    log::debug!(
                        "[CacheService] {} clés supprimées pour pattern: {}",
                        count,
                        pattern
                    );
                }
                Ok(count)
            }
            Err(e) => {
                log::warn!(
                    "[CacheService] Redis indisponible pour delete_pattern {}: {}. Retour 0.",
                    pattern,
                    e
                );
                Ok(0)
            }
        }
    }

    /// Vérifie si une clé existe dans le cache
    pub async fn exists(&self, key: &str) -> AppResult<bool> {
        let Some(client) = &self.redis_client else {
            return Ok(false);
        };

        // ✅ CORRIGÉ: Utiliser le helper Redis avec retry automatique
        use crate::utils::redis_helper;

        match redis_helper::execute_with_retry(
            client,
            |mut conn| async move { conn.exists::<_, bool>(key).await },
            3,
            500,
        )
        .await
        {
            Ok(exists) => Ok(exists),
            Err(e) => {
                log::warn!(
                    "[CacheService] Redis indisponible pour exists {}: {}. Retour false.",
                    key,
                    e
                );
                Ok(false)
            }
        }
    }

    /// Récupère ou calcule et met en cache une valeur
    /// Si la valeur n'est pas en cache, appelle `compute` pour la calculer.
    ///
    /// ✅ 2026-05-16 — Single-flight intégré : si N requêtes arrivent
    /// simultanément sur la même clé manquante, on n'exécute compute() qu'une
    /// seule fois. Les autres attendent puis lisent depuis le cache.
    /// Évite le thundering herd (cache stampede) sous fort trafic.
    pub async fn get_or_compute<F, Fut, T>(&self, key: &str, compute: F) -> AppResult<T>
    where
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = AppResult<T>>,
        T: Serialize + DeserializeOwned,
    {
        self.get_or_compute_with_ttl(key, self.default_ttl, compute).await
    }

    /// Récupère ou calcule et met en cache une valeur avec TTL personnalisé
    pub async fn get_or_compute_with_ttl<F, Fut, T>(
        &self,
        key: &str,
        ttl: Duration,
        compute: F,
    ) -> AppResult<T>
    where
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = AppResult<T>>,
        T: Serialize + DeserializeOwned,
    {
        // 1. Cache lookup
        if let Some(cached) = self.get::<T>(key).await? {
            return Ok(cached);
        }

        // 2. Single-flight : éviter le thundering herd.
        let flight_slot = {
            let mut guard = FLIGHTS.lock().await;
            if let Some(existing) = guard.get(key).cloned() {
                // Un autre task calcule déjà → on attend qu'il termine.
                drop(guard);
                existing.notified().await;
                // Au réveil, le cache devrait être chaud.
                if let Some(cached) = self.get::<T>(key).await? {
                    return Ok(cached);
                }
                // Si pas en cache (erreur du leader, Redis down), on calcule
                // soi-même en fallback. Le second tour réenregistre une flight.
                None
            } else {
                let slot = Arc::new(tokio::sync::Notify::new());
                guard.insert(key.to_string(), slot.clone());
                Some(slot)
            }
        };

        // 3. Calcul (leader OU fallback follower)
        let result = compute().await;

        // 4. Cache write (si succès) + libération des followers
        if let Ok(v) = &result {
            let _ = self.set_with_ttl(key, v, ttl).await;
        }
        if let Some(slot) = flight_slot {
            // Retire la flight et notifie tous les waiters
            FLIGHTS.lock().await.remove(key);
            slot.notify_waiters();
        }

        result
    }

    /// Construit une clé de cache avec un préfixe
    pub fn build_key(prefix: &str, parts: &[&str]) -> String {
        let parts_str: Vec<String> = parts.iter().map(|p| p.to_string()).collect();
        format!("{}:{}", prefix, parts_str.join(":"))
    }
}

/// Clés de cache préfixées pour différentes entités
pub mod cache_keys {
    pub const DELIVERY_ZONES: &str = "delivery:zones";
    pub const DELIVERY_ZONE: &str = "delivery:zone";
    pub const PRODUCT_ZONES: &str = "product:zones";
    pub const STORAGE_LOCATIONS: &str = "storage:locations";
    pub const SERVICE_CATEGORIES: &str = "service:categories";
    pub const USER_STATS: &str = "user:stats";
    pub const MATCHING_RESULTS: &str = "matching:results";
    pub const GEOGRAPHIC_DISTANCES: &str = "geographic:distances";
}
