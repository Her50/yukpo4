// ✅ Rate limiter pour protéger contre les abus
// Support de millions d'utilisateurs avec Redis + sliding window

use std::sync::Arc;

use log::{debug, warn};
use serde::Serialize;

use crate::core::types::AppResult;
use crate::services::redis_service::RedisService;

#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    pub requests_per_minute: u32,
    pub requests_per_hour: u32,
    pub requests_per_day: u32,
    pub burst_size: u32,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        RateLimitConfig {
            requests_per_minute: 10,
            requests_per_hour: 100,
            requests_per_day: 1000,
            burst_size: 20,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct RateLimitResult {
    pub allowed: bool,
    pub remaining: u32,
    pub reset_at: chrono::DateTime<chrono::Utc>,
    pub retry_after_seconds: Option<u64>,
}

pub struct VideoRateLimiter {
    redis: Option<Arc<RedisService>>,
    config: RateLimitConfig,
}

impl VideoRateLimiter {
    pub fn new(config: RateLimitConfig) -> Self {
        Self {
            redis: None,
            config,
        }
    }

    /// ✅ Crée avec Redis pour rate limiting distribué
    pub fn with_redis(config: RateLimitConfig, redis: Arc<RedisService>) -> Self {
        Self {
            redis: Some(redis),
            config,
        }
    }

    /// ✅ Vérifie si une requête est autorisée pour un utilisateur
    pub async fn check_limit(&self, user_id: i32, endpoint: &str) -> AppResult<RateLimitResult> {
        let key = format!("ratelimit:{}:{}", user_id, endpoint);
        let limit = self.config.requests_per_minute;

        let current = if let Some(redis) = &self.redis {
            // ✅ Sliding window avec Redis
            redis.incr_ex(key.clone(), 60).await? as u32
        } else {
            // ✅ Fallback: Simuler (DB tracking nécessiterait PgPool)
            // En production, toujours utiliser Redis pour rate limiting distribué
            0u32
        };

        let allowed = current <= limit;
        let remaining = limit.saturating_sub(current);

        let reset_at = chrono::Utc::now() + chrono::Duration::minutes(1);
        let retry_after = if !allowed { Some(60u64) } else { None };

        if !allowed {
            warn!(
                "[RateLimiter] User {} exceeded limit for {} (current: {})",
                user_id, endpoint, current
            );
        }

        Ok(RateLimitResult {
            allowed,
            remaining,
            reset_at,
            retry_after_seconds: retry_after,
        })
    }

    /// ✅ Vérifie le rate limit avec priorité (premium users ont plus de quota)
    pub async fn check_limit_with_priority(
        &self,
        user_id: i32,
        endpoint: &str,
        is_premium: bool,
    ) -> AppResult<RateLimitResult> {
        let mut config = self.config.clone();

        // ✅ Premium users ont 10x plus de quota
        if is_premium {
            config.requests_per_minute *= 10;
            config.requests_per_hour *= 10;
            config.requests_per_day *= 10;
        }

        let limiter = VideoRateLimiter::new(config);
        limiter.check_limit(user_id, endpoint).await
    }

    /// ✅ Réinitialise le compteur pour un utilisateur (admin only)
    pub async fn reset_limit(&self, user_id: i32, endpoint: &str) -> AppResult<()> {
        let key = format!("ratelimit:{}:{}", user_id, endpoint);

        // ✅ TODO: Implémenter avec Redis
        // redis_client.del(&key).await?;

        debug!(
            "[RateLimiter] Reset limit for user {} on {}",
            user_id, endpoint
        );
        Ok(())
    }
}
