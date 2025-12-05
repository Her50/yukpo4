// ✅ Service centralisé pour la scalabilité
// Orchestre tous les composants de scalabilité

use std::sync::Arc;
use std::time::Duration;

use log::{info, warn};
use sqlx::PgPool;

use crate::core::types::{AppError, AppResult};
use crate::services::{
    video_batch_processor::{BatchProcessorConfig, VideoBatchProcessor},
    video_cache_service::VideoCacheService,
    video_queue_service::{VideoQueueConfig, VideoQueueService},
    video_rate_limiter::{RateLimitConfig, VideoRateLimiter},
};

pub struct ScalabilityConfig {
    pub max_concurrent_jobs: usize,
    pub batch_size: usize,
    pub cache_ttl_seconds: u64,
    pub rate_limit_per_minute: u32,
    pub enable_redis: bool,
    pub enable_distributed_processing: bool,
}

impl Default for ScalabilityConfig {
    fn default() -> Self {
        ScalabilityConfig {
            max_concurrent_jobs: 10000, // ✅ Support de 10k jobs simultanés par instance
            batch_size: 100,
            cache_ttl_seconds: 300,
            rate_limit_per_minute: 10,
            enable_redis: false,                  // ✅ À activer en production
            enable_distributed_processing: false, // ✅ À activer en production
        }
    }
}

pub struct VideoScalabilityService {
    queue_service: Arc<VideoQueueService>,
    cache_service: Arc<VideoCacheService>,
    rate_limiter: Arc<VideoRateLimiter>,
    batch_processor: Arc<VideoBatchProcessor>,
    config: ScalabilityConfig,
}

impl VideoScalabilityService {
    pub fn new(pool: PgPool, config: ScalabilityConfig) -> Self {
        let queue_config = VideoQueueConfig {
            max_concurrent_jobs: config.max_concurrent_jobs,
            batch_size: config.batch_size,
            retry_delay_seconds: 30,
            max_retries: 3,
            priority_queues: true,
        };

        let queue_service = Arc::new(VideoQueueService::new(pool.clone(), queue_config));

        let cache_service = Arc::new(VideoCacheService::new(pool.clone()));

        let rate_limit_config = RateLimitConfig {
            requests_per_minute: config.rate_limit_per_minute,
            requests_per_hour: config.rate_limit_per_minute * 60,
            requests_per_day: config.rate_limit_per_minute * 60 * 24,
            burst_size: config.rate_limit_per_minute * 2,
        };

        let rate_limiter = Arc::new(VideoRateLimiter::new(rate_limit_config));

        let batch_config = BatchProcessorConfig {
            max_concurrent: config.max_concurrent_jobs,
            batch_size: config.batch_size,
            timeout_seconds: 300,
            retry_on_failure: true,
        };

        let batch_processor = Arc::new(VideoBatchProcessor::new(
            queue_service.clone(),
            pool.clone(),
            batch_config,
        ));

        Self {
            queue_service,
            cache_service,
            rate_limiter,
            batch_processor,
            config,
        }
    }

    /// ✅ Initialise tous les services de scalabilité
    pub async fn initialize(&self) -> AppResult<()> {
        info!("[Scalability] Initializing scalability services...");
        info!(
            "[Scalability] Max concurrent jobs: {}",
            self.config.max_concurrent_jobs
        );
        info!("[Scalability] Batch size: {}", self.config.batch_size);
        info!("[Scalability] Redis enabled: {}", self.config.enable_redis);
        info!(
            "[Scalability] Distributed processing: {}",
            self.config.enable_distributed_processing
        );

        // ✅ Démarrer le worker de batch processing
        if self.config.enable_distributed_processing {
            let processor = self.batch_processor.clone();
            tokio::spawn(async move {
                if let Err(e) = processor.start_worker().await {
                    warn!("[Scalability] Batch processor error: {}", e);
                }
            });
        }

        Ok(())
    }

    /// ✅ Récupère les statistiques de scalabilité
    pub async fn get_stats(&self) -> AppResult<ScalabilityStats> {
        let queue_stats = self.queue_service.get_queue_stats().await?;

        Ok(ScalabilityStats {
            queue: queue_stats,
            cache_enabled: self.config.enable_redis,
            distributed_processing: self.config.enable_distributed_processing,
            max_concurrent_jobs: self.config.max_concurrent_jobs,
        })
    }

    pub fn queue_service(&self) -> Arc<VideoQueueService> {
        self.queue_service.clone()
    }

    pub fn cache_service(&self) -> Arc<VideoCacheService> {
        self.cache_service.clone()
    }

    pub fn rate_limiter(&self) -> Arc<VideoRateLimiter> {
        self.rate_limiter.clone()
    }

    pub fn batch_processor(&self) -> Arc<VideoBatchProcessor> {
        self.batch_processor.clone()
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ScalabilityStats {
    pub queue: crate::services::video_queue_service::QueueStats,
    pub cache_enabled: bool,
    pub distributed_processing: bool,
    pub max_concurrent_jobs: usize,
}
