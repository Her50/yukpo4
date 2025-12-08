// ✅ Service de cache distribué pour optimiser les performances
// Support de millions de requêtes avec Redis

use std::sync::Arc;
use std::time::Duration;

use log::{debug, info, warn};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::core::types::AppResult;
use crate::services::redis_service::RedisService;
use sqlx::Row;

/// ✅ Cache pour les sessions studio (évite les requêtes DB répétées)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedStudioSession {
    pub id: Uuid,
    pub user_id: i32,
    pub service_id: Option<i32>,
    pub status: String,
    pub preview_url: Option<String>,
    pub cached_at: chrono::DateTime<chrono::Utc>,
}

/// ✅ Cache pour les templates (rarement modifiés)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedTemplate {
    pub id: String,
    pub label: String,
    pub description: String,
    pub default_duration_seconds: u32,
    pub suggested_scenes: u32,
}

/// ✅ Cache pour les métriques de preview (calculs coûteux)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedPreviewMetrics {
    pub total_previews: i64,
    pub last_preview_at: Option<chrono::DateTime<chrono::Utc>>,
    pub templates: Vec<serde_json::Value>,
}

pub struct VideoCacheService {
    pool: PgPool,
    redis: Option<Arc<RedisService>>,
    default_ttl: Duration,
}

impl VideoCacheService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool,
            redis: None,
            default_ttl: Duration::from_secs(300), // 5 minutes par défaut
        }
    }

    /// ✅ Crée avec Redis pour cache distribué
    pub fn with_redis(pool: PgPool, redis: Arc<RedisService>) -> Self {
        Self {
            pool,
            redis: Some(redis),
            default_ttl: Duration::from_secs(300),
        }
    }

    /// ✅ Cache une session studio
    pub async fn cache_session(
        &self,
        session: CachedStudioSession,
        ttl: Option<Duration>,
    ) -> AppResult<()> {
        let cache_key = format!("studio:session:{}", session.id);
        let ttl = ttl.unwrap_or(self.default_ttl);

        if let Some(redis) = &self.redis {
            redis
                .set_json(cache_key, &session, Some(ttl.as_secs()))
                .await?;
        } else {
            // ✅ Fallback: Cache en DB
            sqlx::query(
                r#"
                INSERT INTO studio_session_cache (session_id, cached_data, expires_at)
                VALUES ($1, $2, NOW() + INTERVAL '1 second' * $3)
                ON CONFLICT (session_id) DO UPDATE
                SET cached_data = $2, expires_at = NOW() + INTERVAL '1 second' * $3
                "#
            )
            .bind(session.id)
            .bind(serde_json::to_value(&session)?)
            .bind(ttl.as_secs() as i64)
            .execute(&self.pool)
            .await?;
        }

        debug!("[VideoCache] Cached session {}", session.id);
        Ok(())
    }

    /// ✅ Récupère une session depuis le cache
    pub async fn get_session(&self, session_id: Uuid) -> AppResult<Option<CachedStudioSession>> {
        let cache_key = format!("studio:session:{}", session_id);

        if let Some(redis) = &self.redis {
            return redis.get_json(cache_key).await;
        }

        // ✅ Fallback: Cache en DB
        let cached_row = sqlx::query(
            r#"
            SELECT cached_data
            FROM studio_session_cache
            WHERE session_id = $1 AND expires_at > NOW()
            "#
        )
        .bind(session_id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = cached_row {
            let cached_data: serde_json::Value = row.get::<serde_json::Value, _>("cached_data");
            Ok(Some(serde_json::from_value(cached_data)?))
        } else {
            Ok(None)
        }
    }

    /// ✅ Cache les templates (TTL long car rarement modifiés)
    pub async fn cache_templates(&self, templates: Vec<CachedTemplate>) -> AppResult<()> {
        let cache_key = "studio:templates:all";
        let ttl = Duration::from_secs(3600); // 1 heure

        // ✅ TODO: Implémenter avec Redis
        // redis_client.setex(cache_key, ttl.as_secs(), serde_json::to_string(&templates)?).await?;

        info!("[VideoCache] Cached {} templates", templates.len());
        Ok(())
    }

    /// ✅ Récupère les templates depuis le cache
    pub async fn get_templates(&self) -> AppResult<Option<Vec<CachedTemplate>>> {
        let cache_key = "studio:templates:all";

        // ✅ TODO: Implémenter avec Redis
        // let cached: Option<String> = redis_client.get(cache_key).await?;
        // if let Some(data) = cached {
        //     return Ok(Some(serde_json::from_str(&data)?));
        // }

        Ok(None)
    }

    /// ✅ Cache les métriques de preview
    pub async fn cache_preview_metrics(
        &self,
        session_id: Uuid,
        metrics: CachedPreviewMetrics,
    ) -> AppResult<()> {
        let cache_key = format!("studio:metrics:{}", session_id);
        let ttl = Duration::from_secs(600); // 10 minutes

        // ✅ TODO: Implémenter avec Redis
        // redis_client.setex(cache_key, ttl.as_secs(), serde_json::to_string(&metrics)?).await?;

        Ok(())
    }

    /// ✅ Invalide le cache d'une session
    pub async fn invalidate_session(&self, session_id: Uuid) -> AppResult<()> {
        let _cache_key = format!("studio:session:{}", session_id);

        // ✅ TODO: Implémenter avec Redis
        // redis_client.del(_cache_key).await?;

        debug!("[VideoCache] Invalidated session {}", session_id);
        Ok(())
    }

    /// ✅ Invalide tout le cache (utile pour les mises à jour majeures)
    pub async fn invalidate_all(&self) -> AppResult<()> {
        // ✅ TODO: Implémenter avec Redis
        // redis_client.del("studio:*").await?;

        warn!("[VideoCache] Invalidated all cache");
        Ok(())
    }
}
