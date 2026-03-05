// ✅ Service de cache Redis pour Flash Sales
// Optimise les performances en mettant en cache le stock disponible et les résumés

use crate::core::types::{AppError, AppResult};
use crate::models::live_model::LiveFlashSaleSummary;
use crate::utils::redis_helper;
use redis::{AsyncCommands, Client as RedisClient};
use std::sync::Arc;
use uuid::Uuid;

const FLASH_SALE_STOCK_TTL: u64 = 5; // 5 secondes (optimisé pour réduire les appels DB)
const FLASH_SALE_SUMMARY_TTL: u64 = 5; // 5 secondes
#[allow(dead_code)]
const FLASH_SALE_LIST_TTL: u64 = 10; // 10 secondes

pub struct FlashSaleCache {
    #[allow(dead_code)]
    redis: Arc<RedisClient>,
}

impl FlashSaleCache {
    pub fn new(redis: Arc<RedisClient>) -> Self {
        Self { redis }
    }

    /// Cache le stock disponible d'une flash sale
    pub async fn set_available_stock(
        &self,
        flash_sale_id: Uuid,
        available_stock: i32,
    ) -> AppResult<()> {
        let mut conn = redis_helper::get_redis_connection(&self.redis, 3, 100)
            .await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;

        let key = format!("flash_sale:stock:{}", flash_sale_id);
        conn.set_ex::<_, _, ()>(&key, available_stock, FLASH_SALE_STOCK_TTL)
            .await
            .map_err(|e| AppError::Internal(format!("Redis SET failed: {}", e)))?;

        Ok(())
    }

    /// Récupère le stock disponible depuis le cache
    pub async fn get_available_stock(&self, flash_sale_id: Uuid) -> AppResult<Option<i32>> {
        let mut conn = redis_helper::get_redis_connection(&self.redis, 3, 100)
            .await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;

        let key = format!("flash_sale:stock:{}", flash_sale_id);
        let stock: Option<i32> = conn
            .get(&key)
            .await
            .map_err(|e| AppError::Internal(format!("Redis GET failed: {}", e)))?;

        Ok(stock)
    }

    /// Décrémente le stock disponible dans le cache (atomique)
    /// Retourne le nouveau stock disponible après décrémentation
    pub async fn decrement_available_stock(
        &self,
        flash_sale_id: Uuid,
        quantity: i32,
    ) -> AppResult<i32> {
        let mut conn = redis_helper::get_redis_connection(&self.redis, 3, 100)
            .await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;

        let key = format!("flash_sale:stock:{}", flash_sale_id);

        // Vérifier que la clé existe avant de décrémenter (éviter les valeurs négatives)
        let exists: bool = conn
            .exists(&key)
            .await
            .map_err(|e| AppError::Internal(format!("Redis EXISTS failed: {}", e)))?;

        if !exists {
            return Err(AppError::Internal(
                "Stock cache expired, please retry".into(),
            ));
        }

        let new_value: i32 = redis::cmd("DECRBY")
            .arg(&key)
            .arg(quantity)
            .query_async(&mut conn)
            .await
            .map_err(|e| AppError::Internal(format!("Redis DECRBY failed: {}", e)))?;

        // Si le stock est devenu négatif, restaurer et signaler stock épuisé
        if new_value < 0 {
            let _: () = redis::cmd("INCRBY")
                .arg(&key)
                .arg(quantity)
                .query_async(&mut conn)
                .await
                .map_err(|e| {
                AppError::Internal(format!("Redis INCRBY rollback failed: {}", e))
            })?;
            return Err(AppError::BadRequest("Stock épuisé".into()));
        }

        Ok(new_value)
    }

    /// Alias rétrocompatible pour l'ancien nom
    pub async fn increment_reserved_stock(
        &self,
        flash_sale_id: Uuid,
        quantity: i32,
    ) -> AppResult<i32> {
        self.decrement_available_stock(flash_sale_id, quantity).await
    }

    /// Cache un résumé de flash sale
    pub async fn set_flash_sale_summary(
        &self,
        flash_sale_id: Uuid,
        summary: &LiveFlashSaleSummary,
    ) -> AppResult<()> {
        let mut conn = redis_helper::get_redis_connection(&self.redis, 3, 100)
            .await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;

        let key = format!("flash_sale:summary:{}", flash_sale_id);
        let json = serde_json::to_string(summary)
            .map_err(|e| AppError::Internal(format!("Serialization failed: {}", e)))?;

        conn.set_ex::<_, _, ()>(&key, json, FLASH_SALE_SUMMARY_TTL)
            .await
            .map_err(|e| AppError::Internal(format!("Redis SET failed: {}", e)))?;

        Ok(())
    }

    /// Récupère un résumé depuis le cache
    pub async fn get_flash_sale_summary(
        &self,
        flash_sale_id: Uuid,
    ) -> AppResult<Option<LiveFlashSaleSummary>> {
        let mut conn = redis_helper::get_redis_connection(&self.redis, 3, 100)
            .await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;

        let key = format!("flash_sale:summary:{}", flash_sale_id);
        let json: Option<String> = conn
            .get(&key)
            .await
            .map_err(|e| AppError::Internal(format!("Redis GET failed: {}", e)))?;

        if let Some(json_str) = json {
            let summary: LiveFlashSaleSummary = serde_json::from_str(&json_str)
                .map_err(|e| AppError::Internal(format!("Deserialization failed: {}", e)))?;
            Ok(Some(summary))
        } else {
            Ok(None)
        }
    }

    /// Invalide le cache d'une flash sale
    pub async fn invalidate_flash_sale(&self, flash_sale_id: Uuid) -> AppResult<()> {
        let mut conn = redis_helper::get_redis_connection(&self.redis, 3, 100)
            .await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;

        let keys = vec![
            format!("flash_sale:stock:{}", flash_sale_id),
            format!("flash_sale:summary:{}", flash_sale_id),
        ];

        if !keys.is_empty() {
            conn.del::<_, ()>(keys)
                .await
                .map_err(|e| AppError::Internal(format!("Redis DEL failed: {}", e)))?;
        }

        Ok(())
    }
}
