// ✅ NOUVEAU 2026-01-02: Service de cache pour les données de service volumineuses
// Cache le JSONB des services pour éviter les lectures répétées de gros JSONB
// Invalide automatiquement le cache lors des mises à jour

use crate::core::types::AppResult;
use crate::services::cache_service::CacheService;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CachedServiceData {
    pub data: Value,
    pub data_size: i64,
    pub cached_at: i64,
}

/// Service de cache pour les données de service
pub struct ServiceDataCache {
    cache_service: Arc<CacheService>,
    /// TTL pour les services volumineux (> 1 MB) : 30 minutes
    large_service_ttl: Duration,
    /// TTL pour les services normaux : 10 minutes
    normal_service_ttl: Duration,
}

impl ServiceDataCache {
    pub fn new(cache_service: Arc<CacheService>) -> Self {
        Self {
            cache_service,
            large_service_ttl: Duration::from_secs(1800), // 30 minutes pour gros services
            normal_service_ttl: Duration::from_secs(600), // 10 minutes pour services normaux
        }
    }

    /// Clé de cache pour un service
    fn cache_key(service_id: i32) -> String {
        format!("service:data:{}", service_id)
    }

    /// Récupère les données d'un service depuis le cache ou la DB
    /// Retourne (data, data_size, from_cache)
    pub async fn get_service_data(
        &self,
        service_id: i32,
        fetch_from_db: impl std::future::Future<Output = AppResult<(Value, i64)>>,
    ) -> AppResult<(Value, i64, bool)> {
        let cache_key = Self::cache_key(service_id);

        // 1. Essayer de récupérer depuis le cache
        if let Ok(Some(cached)) = self.cache_service.get::<CachedServiceData>(&cache_key).await {
            log::info!(
                "[ServiceDataCache] ✅ Cache hit pour service {} (taille: {} bytes, cached_at: {})",
                service_id,
                cached.data_size,
                cached.cached_at
            );
            return Ok((cached.data, cached.data_size, true));
        }

        // 2. Cache miss : récupérer depuis la DB
        log::debug!(
            "[ServiceDataCache] Cache miss pour service {}, récupération depuis DB",
            service_id
        );
        let (data, data_size) = fetch_from_db.await?;

        // 3. Mettre en cache (seulement si service volumineux pour économiser la mémoire)
        let ttl = if data_size > 1_000_000 {
            // Service volumineux (> 1 MB) : cache plus long
            self.large_service_ttl
        } else {
            self.normal_service_ttl
        };

        let cached_data = CachedServiceData {
            data: data.clone(),
            data_size,
            cached_at: chrono::Utc::now().timestamp(),
        };

        if let Err(e) = self.cache_service.set_with_ttl(&cache_key, &cached_data, ttl).await {
            log::warn!(
                "[ServiceDataCache] ⚠️ Erreur mise en cache service {}: {}",
                service_id,
                e
            );
        } else {
            log::info!(
                "[ServiceDataCache] ✅ Service {} mis en cache (taille: {} bytes, TTL: {}s)",
                service_id,
                data_size,
                ttl.as_secs()
            );
        }

        Ok((data, data_size, false))
    }

    /// Invalide le cache d'un service (appelé après UPDATE)
    pub async fn invalidate_service(&self, service_id: i32) {
        let cache_key = Self::cache_key(service_id);
        // Utiliser la méthode delete du CacheService
        if let Err(e) = self.cache_service.delete(&cache_key).await {
            log::warn!(
                "[ServiceDataCache] ⚠️ Erreur invalidation cache service {}: {}",
                service_id,
                e
            );
        } else {
            log::info!(
                "[ServiceDataCache] ✅ Cache invalidé pour service {}",
                service_id
            );
        }
    }

    /// Invalide le cache de plusieurs services
    pub async fn invalidate_services(&self, service_ids: &[i32]) {
        for service_id in service_ids {
            self.invalidate_service(*service_id).await;
        }
    }
}
