// ✅ Service de cache Redis pour services spécialisés
// TTL: 2min pour listes, 10min pour statistiques

use crate::core::types::AppError;
use crate::state::AppState;
use log::{info, warn};
use redis::{AsyncCommands, Script};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

// TTL en secondes
const CACHE_TTL_LISTS: u64 = 120; // 2 minutes
const CACHE_TTL_STATS: u64 = 600; // 10 minutes

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedServicesList {
    pub services: Vec<serde_json::Value>,
    pub pagination: serde_json::Value,
    pub cached_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedStatistics {
    pub statistics: serde_json::Value,
    pub cached_at: i64,
}

pub struct SpecializedServicesCache {
    state: Arc<AppState>,
}

impl SpecializedServicesCache {
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    /// Génère une clé de cache pour la liste des services
    fn cache_key_list(
        &self,
        user_id: i32,
        type_filter: Option<&str>,
        status: Option<&str>,
        page: i64,
        limit: i64,
    ) -> String {
        format!(
            "specialized_services:list:{}:{}:{}:{}:{}",
            user_id,
            type_filter.unwrap_or("all"),
            status.unwrap_or("all"),
            page,
            limit
        )
    }

    /// Génère une clé de cache pour les statistiques
    fn cache_key_stats(&self, user_id: i32, status: Option<&str>) -> String {
        format!(
            "specialized_services:stats:{}:{}",
            user_id,
            status.unwrap_or("all")
        )
    }

    /// Récupère la liste des services depuis le cache
    pub async fn get_services_list(
        &self,
        user_id: i32,
        type_filter: Option<&str>,
        status: Option<&str>,
        page: i64,
        limit: i64,
    ) -> Result<Option<CachedServicesList>, AppError> {
        let cache_key = self.cache_key_list(user_id, type_filter, status, page, limit);

        // Utiliser le client Redis directement (comme CacheService)
        use crate::utils::redis_helper;
        match redis_helper::get_with_retry(&self.state.redis_client, &cache_key).await {
            Ok(Some(cached_json)) => {
                match serde_json::from_str::<CachedServicesList>(&cached_json) {
                    Ok(cached) => {
                        info!(
                            "[SpecializedServicesCache] ✅ Cache hit pour list (Redis): {}",
                            cache_key
                        );
                        return Ok(Some(cached));
                    }
                    Err(e) => {
                        warn!(
                            "[SpecializedServicesCache] ⚠️ Erreur désérialisation cache: {}",
                            e
                        );
                    }
                }
            }
            Ok(None) => {
                // Pas de cache, c'est normal
            }
            Err(e) => {
                warn!("[SpecializedServicesCache] ⚠️ Erreur Redis GET: {}", e);
            }
        }

        Ok(None)
    }

    /// Met en cache la liste des services
    pub async fn set_services_list(
        &self,
        user_id: i32,
        type_filter: Option<&str>,
        status: Option<&str>,
        page: i64,
        limit: i64,
        services: &[serde_json::Value],
        pagination: &serde_json::Value,
    ) -> Result<(), AppError> {
        let cache_key = self.cache_key_list(user_id, type_filter, status, page, limit);

        let cached = CachedServicesList {
            services: services.to_vec(),
            pagination: pagination.clone(),
            cached_at: chrono::Utc::now().timestamp(),
        };

        let cached_json = serde_json::to_string(&cached)
            .map_err(|e| AppError::Internal(format!("Erreur sérialisation cache: {}", e)))?;

        // Utiliser le client Redis directement (comme CacheService)
        use crate::utils::redis_helper;
        match redis_helper::set_with_retry(
            &self.state.redis_client,
            &cache_key,
            &cached_json,
            Some(CACHE_TTL_LISTS),
        )
        .await
        {
            Ok(_) => {
                info!(
                    "[SpecializedServicesCache] ✅ Cache set pour list (Redis): {}",
                    cache_key
                );
            }
            Err(e) => {
                warn!("[SpecializedServicesCache] ⚠️ Erreur Redis SETEX: {}", e);
            }
        }

        // Si Redis n'est pas disponible, on continue sans cache (pas d'erreur fatale)
        warn!("[SpecializedServicesCache] ⚠️ Redis non disponible, cache ignoré");
        Ok(())
    }

    /// Récupère les statistiques depuis le cache
    pub async fn get_statistics(
        &self,
        user_id: i32,
        status: Option<&str>,
    ) -> Result<Option<CachedStatistics>, AppError> {
        let cache_key = self.cache_key_stats(user_id, status);

        // Utiliser le client Redis directement (comme CacheService)
        use crate::utils::redis_helper;
        match redis_helper::get_with_retry(&self.state.redis_client, &cache_key).await {
            Ok(Some(cached_json)) => match serde_json::from_str::<CachedStatistics>(&cached_json) {
                Ok(cached) => {
                    info!(
                        "[SpecializedServicesCache] ✅ Cache hit pour stats (Redis): {}",
                        cache_key
                    );
                    return Ok(Some(cached));
                }
                Err(e) => {
                    warn!(
                        "[SpecializedServicesCache] ⚠️ Erreur désérialisation cache stats: {}",
                        e
                    );
                }
            },
            Ok(None) => {}
            Err(e) => {
                warn!(
                    "[SpecializedServicesCache] ⚠️ Erreur Redis GET stats: {}",
                    e
                );
            }
        }

        Ok(None)
    }

    /// Met en cache les statistiques
    pub async fn set_statistics(
        &self,
        user_id: i32,
        status: Option<&str>,
        statistics: &serde_json::Value,
    ) -> Result<(), AppError> {
        let cache_key = self.cache_key_stats(user_id, status);

        let cached = CachedStatistics {
            statistics: statistics.clone(),
            cached_at: chrono::Utc::now().timestamp(),
        };

        let cached_json = serde_json::to_string(&cached)
            .map_err(|e| AppError::Internal(format!("Erreur sérialisation cache stats: {}", e)))?;

        // Utiliser le client Redis directement (comme CacheService)
        use crate::utils::redis_helper;
        match redis_helper::set_with_retry(
            &self.state.redis_client,
            &cache_key,
            &cached_json,
            Some(CACHE_TTL_STATS),
        )
        .await
        {
            Ok(_) => {
                info!(
                    "[SpecializedServicesCache] ✅ Cache set pour stats (Redis): {}",
                    cache_key
                );
            }
            Err(e) => {
                warn!(
                    "[SpecializedServicesCache] ⚠️ Erreur Redis SETEX stats: {}",
                    e
                );
            }
        }

        // Si Redis n'est pas disponible, on continue sans cache (pas d'erreur fatale)
        warn!("[SpecializedServicesCache] ⚠️ Redis non disponible, cache stats ignoré");
        Ok(())
    }

    /// Invalide le cache pour un utilisateur (appelé après création/modification/suppression)
    pub async fn invalidate_user_cache(&self, user_id: i32) -> Result<(), AppError> {
        // Pattern pour invalider toutes les clés de cet utilisateur
        let pattern_list = format!("specialized_services:list:{}:*", user_id);
        let pattern_stats = format!("specialized_services:stats:{}:*", user_id);

        // Utiliser le client Redis directement avec Script
        match self
            .state
            .redis_client
            .get_multiplexed_async_connection()
            .await
        {
            Ok(mut conn) => {
                let script = redis::Script::new(
                    r#"
                    local keys = redis.call('KEYS', ARGV[1])
                    for i=1,#keys do
                        redis.call('DEL', keys[i])
                    end
                    return #keys
                "#,
                );
                let _: Result<i32, _> = script.arg(&pattern_list).invoke_async(&mut conn).await;

                let script2 = redis::Script::new(
                    r#"
                    local keys = redis.call('KEYS', ARGV[1])
                    for i=1,#keys do
                        redis.call('DEL', keys[i])
                    end
                    return #keys
                "#,
                );
                let _: Result<i32, _> = script2.arg(&pattern_stats).invoke_async(&mut conn).await;

                info!(
                    "[SpecializedServicesCache] ✅ Cache invalidé pour user_id={}",
                    user_id
                );
            }
            Err(e) => {
                warn!(
                    "[SpecializedServicesCache] ⚠️ Erreur connexion Redis pour invalidation: {}",
                    e
                );
            }
        }

        Ok(())
    }
}
