// ✅ Service de cache Redis pour Black Friday / Global Promo
// Optimise les performances en mettant en cache le catalogue et les prix promotionnels

use crate::core::types::{AppError, AppResult};
use crate::models::global_promo_model::GlobalPromoCatalogPage;
use crate::utils::redis_helper;
use redis::{AsyncCommands, Client as RedisClient};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::Arc;

const CATALOG_CACHE_TTL: u64 = 30; // 30 secondes
const PRICE_CACHE_TTL: u64 = 60; // 1 minute

pub struct GlobalPromoCache {
    redis: Arc<RedisClient>,
}

impl GlobalPromoCache {
    pub fn new(redis: Arc<RedisClient>) -> Self {
        Self { redis }
    }

    /// Génère une clé de cache pour une requête de catalogue
    fn catalog_cache_key(
        &self,
        query: &crate::models::global_promo_model::GlobalPromoCatalogQuery,
    ) -> String {
        let mut hasher = DefaultHasher::new();
        query.hash(&mut hasher);
        let hash = hasher.finish();

        format!("global_promo:catalog:{}", hash)
    }

    /// Cache une page de catalogue
    pub async fn set_catalog_page(
        &self,
        query: &crate::models::global_promo_model::GlobalPromoCatalogQuery,
        page: &GlobalPromoCatalogPage,
    ) -> AppResult<()> {
        let mut conn = redis_helper::get_redis_connection(&self.redis, 3, 100)
            .await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;

        let key = self.catalog_cache_key(query);
        let json = serde_json::to_string(page)
            .map_err(|e| AppError::Internal(format!("Serialization failed: {}", e)))?;

        conn.set_ex::<_, _, ()>(&key, json, CATALOG_CACHE_TTL)
            .await
            .map_err(|e| AppError::Internal(format!("Redis SET failed: {}", e)))?;

        Ok(())
    }

    /// Récupère une page de catalogue depuis le cache
    pub async fn get_catalog_page(
        &self,
        query: &crate::models::global_promo_model::GlobalPromoCatalogQuery,
    ) -> AppResult<Option<GlobalPromoCatalogPage>> {
        let mut conn = redis_helper::get_redis_connection(&self.redis, 3, 100)
            .await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;

        let key = self.catalog_cache_key(query);
        let json: Option<String> = conn
            .get(&key)
            .await
            .map_err(|e| AppError::Internal(format!("Redis GET failed: {}", e)))?;

        if let Some(json_str) = json {
            let page: GlobalPromoCatalogPage = serde_json::from_str(&json_str)
                .map_err(|e| AppError::Internal(format!("Deserialization failed: {}", e)))?;
            Ok(Some(page))
        } else {
            Ok(None)
        }
    }

    /// Cache un prix promotionnel
    pub async fn set_promo_price(&self, service_id: i32, promo_price: f64) -> AppResult<()> {
        let mut conn = redis_helper::get_redis_connection(&self.redis, 3, 100)
            .await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;

        let key = format!("global_promo:price:{}", service_id);
        conn.set_ex::<_, _, ()>(&key, promo_price.to_string(), PRICE_CACHE_TTL)
            .await
            .map_err(|e| AppError::Internal(format!("Redis SET failed: {}", e)))?;

        Ok(())
    }

    /// Récupère un prix promotionnel depuis le cache
    pub async fn get_promo_price(&self, service_id: i32) -> AppResult<Option<f64>> {
        let mut conn = redis_helper::get_redis_connection(&self.redis, 3, 100)
            .await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;

        let key = format!("global_promo:price:{}", service_id);
        let price_str: Option<String> = conn
            .get(&key)
            .await
            .map_err(|e| AppError::Internal(format!("Redis GET failed: {}", e)))?;

        if let Some(str) = price_str {
            let price: f64 = str
                .parse()
                .map_err(|e| AppError::Internal(format!("Parse failed: {}", e)))?;
            Ok(Some(price))
        } else {
            Ok(None)
        }
    }

    /// Invalide le cache d'un événement
    pub async fn invalidate_event(&self, _event_id: uuid::Uuid) -> AppResult<()> {
        let mut conn = redis_helper::get_redis_connection(&self.redis, 3, 100)
            .await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;

        // Supprimer toutes les clés de catalogue (pattern matching)
        // Note: En production, utiliser SCAN pour éviter de bloquer Redis
        let pattern = "global_promo:catalog:*";
        let keys: Vec<String> = conn
            .keys(pattern)
            .await
            .map_err(|e| AppError::Internal(format!("Redis KEYS failed: {}", e)))?;

        if !keys.is_empty() {
            conn.del::<_, ()>(keys)
                .await
                .map_err(|e| AppError::Internal(format!("Redis DEL failed: {}", e)))?;
        }

        Ok(())
    }
}
