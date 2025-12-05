// ✅ Phase 1: Configuration Redis pour scalabilité

use std::time::Duration;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisConfig {
    pub url: String,
    pub max_connections: u32,
    pub connection_timeout: Duration,
    pub pool_size: usize,
    pub cluster_mode: bool,
    pub nodes: Vec<String>,
    pub password: Option<String>,
    pub database: u8,
}

impl Default for RedisConfig {
    fn default() -> Self {
        Self {
            url: std::env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string()),
            max_connections: 100,
            connection_timeout: Duration::from_secs(10),
            pool_size: 50,
            cluster_mode: false,
            nodes: vec![],
            password: std::env::var("REDIS_PASSWORD").ok(),
            database: 0,
        }
    }
}

impl RedisConfig {
    pub fn from_env() -> Self {
        Self {
            url: std::env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string()),
            max_connections: std::env::var("REDIS_MAX_CONNECTIONS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(100),
            connection_timeout: Duration::from_secs(
                std::env::var("REDIS_CONNECTION_TIMEOUT")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(10),
            ),
            pool_size: std::env::var("REDIS_POOL_SIZE")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(50),
            cluster_mode: std::env::var("REDIS_CLUSTER_MODE")
                .unwrap_or_else(|_| "false".to_string())
                == "true",
            nodes: std::env::var("REDIS_NODES")
                .ok()
                .map(|s| s.split(',').map(|n| n.to_string()).collect())
                .unwrap_or_default(),
            password: std::env::var("REDIS_PASSWORD").ok(),
            database: std::env::var("REDIS_DATABASE")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
        }
    }

    pub fn cluster_urls(&self) -> Vec<String> {
        if self.cluster_mode && !self.nodes.is_empty() {
            self.nodes.clone()
        } else {
            vec![self.url.clone()]
        }
    }
}
