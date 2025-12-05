// ✅ Phase 1: Service Redis pour queue, cache et rate limiting distribué

use std::sync::Arc;
use std::time::Duration;

use log::{error, info, warn};
use redis::{aio::MultiplexedConnection, Commands, RedisResult};
use serde::{Deserialize, Serialize};

use crate::config::redis_config::RedisConfig;
use crate::core::types::{AppError, AppResult};

pub struct RedisService {
    connection_manager: Arc<MultiplexedConnection>,
    config: RedisConfig,
}

impl RedisService {
    /// ✅ Crée un nouveau service Redis
    pub async fn new(config: RedisConfig) -> AppResult<Self> {
        info!("[Redis] Connecting to Redis: {}", config.url);

        let client = if config.cluster_mode {
            // ✅ Mode cluster
            redis::cluster::ClusterClient::new(config.cluster_urls())?
                .get_multiplexed_async_connection()
                .await?
        } else {
            // ✅ Mode standalone
            let client = redis::Client::open(config.url.as_str())?;
            client.get_multiplexed_async_connection().await?
        };

        info!("[Redis] Connected successfully");

        Ok(Self {
            connection_manager: Arc::new(client),
            config,
        })
    }

    /// ✅ Set avec TTL
    pub async fn setex<K, V>(&self, key: K, seconds: u64, value: V) -> AppResult<()>
    where
        K: redis::ToRedisArgs + Send + Sync,
        V: redis::ToRedisArgs + Send + Sync,
    {
        let mut conn = self.connection_manager.clone();
        redis::cmd("SETEX")
            .arg(key)
            .arg(seconds)
            .arg(value)
            .query_async(&mut *conn)
            .await
            .map_err(|e| AppError::Internal(format!("Redis SETEX error: {}", e)))?;
        Ok(())
    }

    /// ✅ Get
    pub async fn get<K, V>(&self, key: K) -> AppResult<Option<V>>
    where
        K: redis::ToRedisArgs + Send + Sync,
        V: redis::FromRedisValue,
    {
        let mut conn = self.connection_manager.clone();
        let result: RedisResult<Option<V>> =
            redis::cmd("GET").arg(key).query_async(&mut *conn).await;

        match result {
            Ok(value) => Ok(value),
            Err(e) if e.is_connection_dropped() || e.is_connection_refused() => {
                warn!("[Redis] Connection error, returning None: {}", e);
                Ok(None)
            }
            Err(e) => Err(AppError::Internal(format!("Redis GET error: {}", e))),
        }
    }

    /// ✅ Delete
    pub async fn del<K>(&self, key: K) -> AppResult<()>
    where
        K: redis::ToRedisArgs + Send + Sync,
    {
        let mut conn = self.connection_manager.clone();
        redis::cmd("DEL")
            .arg(key)
            .query_async(&mut *conn)
            .await
            .map_err(|e| AppError::Internal(format!("Redis DEL error: {}", e)))?;
        Ok(())
    }

    /// ✅ Increment avec expiration
    pub async fn incr_ex<K>(&self, key: K, ttl: u64) -> AppResult<u64>
    where
        K: redis::ToRedisArgs + Send + Sync + Clone,
    {
        let mut conn = self.connection_manager.clone();
        let count: u64 = redis::cmd("INCR")
            .arg(key.clone())
            .query_async(&mut *conn)
            .await
            .map_err(|e| AppError::Internal(format!("Redis INCR error: {}", e)))?;

        // ✅ Set expiration si première incrémentation
        if count == 1 {
            redis::cmd("EXPIRE")
                .arg(key)
                .arg(ttl)
                .query_async(&mut *conn)
                .await
                .map_err(|e| AppError::Internal(format!("Redis EXPIRE error: {}", e)))?;
        }

        Ok(count)
    }

    /// ✅ Push dans une liste (queue)
    pub async fn lpush<K, V>(&self, key: K, value: V) -> AppResult<()>
    where
        K: redis::ToRedisArgs + Send + Sync,
        V: redis::ToRedisArgs + Send + Sync,
    {
        let mut conn = self.connection_manager.clone();
        redis::cmd("LPUSH")
            .arg(key)
            .arg(value)
            .query_async(&mut *conn)
            .await
            .map_err(|e| AppError::Internal(format!("Redis LPUSH error: {}", e)))?;
        Ok(())
    }

    /// ✅ Pop depuis une liste (queue) avec timeout
    pub async fn brpop<K, V>(&self, key: K, timeout: u64) -> AppResult<Option<(String, V)>>
    where
        K: redis::ToRedisArgs + Send + Sync,
        V: redis::FromRedisValue,
    {
        let mut conn = self.connection_manager.clone();
        let result: RedisResult<Option<(String, V)>> = redis::cmd("BRPOP")
            .arg(key)
            .arg(timeout)
            .query_async(&mut *conn)
            .await;

        match result {
            Ok(value) => Ok(value),
            Err(e) if e.is_connection_dropped() || e.is_connection_refused() => {
                warn!("[Redis] Connection error during BRPOP: {}", e);
                Ok(None)
            }
            Err(e) => Err(AppError::Internal(format!("Redis BRPOP error: {}", e))),
        }
    }

    /// ✅ Set avec JSON serialization
    pub async fn set_json<K, V>(&self, key: K, value: &V, ttl: Option<u64>) -> AppResult<()>
    where
        K: redis::ToRedisArgs + Send + Sync,
        V: Serialize,
    {
        let json = serde_json::to_string(value)
            .map_err(|e| AppError::Internal(format!("JSON serialization error: {}", e)))?;

        if let Some(seconds) = ttl {
            self.setex(key, seconds, json).await
        } else {
            let mut conn = self.connection_manager.clone();
            redis::cmd("SET")
                .arg(key)
                .arg(json)
                .query_async(&mut *conn)
                .await
                .map_err(|e| AppError::Internal(format!("Redis SET error: {}", e)))?;
            Ok(())
        }
    }

    /// ✅ Get avec JSON deserialization
    pub async fn get_json<K, V>(&self, key: K) -> AppResult<Option<V>>
    where
        K: redis::ToRedisArgs + Send + Sync,
        V: for<'de> Deserialize<'de>,
    {
        let json_str: Option<String> = self.get(key).await?;
        match json_str {
            Some(json) => serde_json::from_str(&json)
                .map(Some)
                .map_err(|e| AppError::Internal(format!("JSON deserialization error: {}", e))),
            None => Ok(None),
        }
    }

    /// ✅ Health check
    pub async fn ping(&self) -> AppResult<bool> {
        let mut conn = self.connection_manager.clone();
        let result: RedisResult<String> = redis::cmd("PING").query_async(&mut *conn).await;

        match result {
            Ok(_) => Ok(true),
            Err(e) => {
                error!("[Redis] Ping failed: {}", e);
                Ok(false)
            }
        }
    }

    /// ✅ Get connection manager (pour usage avancé)
    pub fn connection_manager(&self) -> Arc<MultiplexedConnection> {
        self.connection_manager.clone()
    }
}
