// ✅ NOUVEAU 2025-12-02: Rate limiting adaptatif pour recherches
// Distinction premium/free avec burst allowance

use crate::core::types::{AppError, AppResult};
use crate::services::cache_service::CacheService;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

/// Rate limiting adaptatif avec distinction premium/free
pub struct AdaptiveRateLimit {
    cache: Arc<CacheService>,
    #[allow(dead_code)]
    limits: HashMap<String, RateLimitConfig>,
}

#[derive(Clone, Debug)]
struct RateLimitConfig {
    requests_per_minute: u32,
    requests_per_hour: u32,
    burst_allowance: u32, // Requêtes supplémentaires autorisées
    #[allow(dead_code)]
    premium_multiplier: f32, // Multiplicateur pour utilisateurs premium
}

impl AdaptiveRateLimit {
    /// Crée un nouveau rate limiter adaptatif
    pub fn new(cache: Arc<CacheService>) -> Self {
        Self {
            cache,
            limits: HashMap::new(),
        }
    }

    /// Vérifie le rate limit pour un utilisateur/IP
    pub async fn check_rate_limit(
        &self,
        user_id: Option<i32>,
        user_ip: &str,
        is_premium: bool,
    ) -> AppResult<()> {
        let key = if let Some(uid) = user_id {
            format!("ratelimit:user:{}", uid)
        } else {
            format!("ratelimit:ip:{}", user_ip)
        };

        // Récupérer config (premium = 10x plus de requêtes)
        let config = if is_premium {
            RateLimitConfig {
                requests_per_minute: 1000,
                requests_per_hour: 10000,
                burst_allowance: 100,
                premium_multiplier: 10.0,
            }
        } else {
            RateLimitConfig {
                requests_per_minute: 100,
                requests_per_hour: 1000,
                burst_allowance: 10,
                premium_multiplier: 1.0,
            }
        };

        // Vérifier limite minute
        let minute_key = format!("{}:minute", key);
        let minute_count: u32 = self
            .cache
            .get(&minute_key)
            .await
            .ok()
            .flatten()
            .unwrap_or(0);

        if minute_count >= config.requests_per_minute + config.burst_allowance {
            return Err(AppError::TooManyRequests(format!(
                "Limite atteinte: {} requêtes/minute (max: {})",
                minute_count,
                config.requests_per_minute + config.burst_allowance
            )));
        }

        // Vérifier limite heure
        let hour_key = format!("{}:hour", key);
        let hour_count: u32 = self.cache.get(&hour_key).await.ok().flatten().unwrap_or(0);

        if hour_count >= config.requests_per_hour {
            return Err(AppError::TooManyRequests(format!(
                "Limite atteinte: {} requêtes/heure (max: {})",
                hour_count, config.requests_per_hour
            )));
        }

        // Incrémenter compteurs avec TTL (utiliser Redis via cache service)
        // Note: CacheService n'a pas de méthode incr, on utilise set/get pour simuler
        let new_minute_count = minute_count + 1;
        let new_hour_count = hour_count + 1;

        // Stocker les nouveaux compteurs avec TTL
        self.cache
            .set_with_ttl(&minute_key, &new_minute_count, Duration::from_secs(60))
            .await?;
        self.cache
            .set_with_ttl(&hour_key, &new_hour_count, Duration::from_secs(3600))
            .await?;

        Ok(())
    }

    /// Récupère les statistiques de rate limit pour un utilisateur/IP
    pub async fn get_rate_limit_stats(
        &self,
        user_id: Option<i32>,
        user_ip: &str,
    ) -> RateLimitStats {
        let key = if let Some(uid) = user_id {
            format!("ratelimit:user:{}", uid)
        } else {
            format!("ratelimit:ip:{}", user_ip)
        };

        let minute_key = format!("{}:minute", key);
        let hour_key = format!("{}:hour", key);

        let minute_count: u32 = self
            .cache
            .get(&minute_key)
            .await
            .ok()
            .flatten()
            .unwrap_or(0);

        let hour_count: u32 = self.cache.get(&hour_key).await.ok().flatten().unwrap_or(0);

        RateLimitStats {
            requests_per_minute: minute_count,
            requests_per_hour: hour_count,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitStats {
    pub requests_per_minute: u32,
    pub requests_per_hour: u32,
}

use serde::{Deserialize, Serialize};
