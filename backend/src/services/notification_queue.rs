// ✅ Queue de notifications asynchrones pour Black Friday
// Permet de notifier des milliers de prestataires sans bloquer

use crate::core::types::{AppError, AppResult};
use crate::utils::redis_helper;
use redis::{AsyncCommands, Client as RedisClient};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NotificationJob {
    pub user_id: i32,
    pub notification_type: String,
    pub title: String,
    pub body: String,
    pub metadata: Option<serde_json::Value>,
    pub push_channel: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub struct NotificationQueue {
    redis: Arc<RedisClient>,
    queue_name: String,
}

impl NotificationQueue {
    pub fn new(redis: Arc<RedisClient>) -> Self {
        Self {
            redis,
            queue_name: "notifications:global_promo".to_string(),
        }
    }

    /// Ajoute une notification à la queue
    pub async fn enqueue_notification(&self, job: NotificationJob) -> AppResult<()> {
        let mut conn = redis_helper::get_redis_connection(&self.redis, 3, 100)
            .await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;

        let job_json = serde_json::to_string(&job)
            .map_err(|e| AppError::Internal(format!("Serialization failed: {}", e)))?;

        // Utiliser LPUSH pour ajouter à la queue (FIFO)
        conn.lpush::<_, _, ()>(&self.queue_name, job_json)
            .await
            .map_err(|e| AppError::Internal(format!("Redis LPUSH failed: {}", e)))?;

        Ok(())
    }

    /// Ajoute plusieurs notifications en batch
    pub async fn enqueue_notifications_batch(
        &self,
        jobs: Vec<NotificationJob>,
    ) -> AppResult<usize> {
        if jobs.is_empty() {
            return Ok(0);
        }

        let mut conn = redis_helper::get_redis_connection(&self.redis, 3, 100)
            .await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;

        let mut count = 0;
        for job in jobs {
            let job_json = serde_json::to_string(&job)
                .map_err(|e| AppError::Internal(format!("Serialization failed: {}", e)))?;

            conn.lpush::<_, _, ()>(&self.queue_name, job_json)
                .await
                .map_err(|e| AppError::Internal(format!("Redis LPUSH failed: {}", e)))?;
            count += 1;
        }

        Ok(count)
    }

    /// Récupère un batch de notifications depuis la queue
    pub async fn dequeue_notifications(
        &self,
        batch_size: usize,
    ) -> AppResult<Vec<NotificationJob>> {
        let mut conn = redis_helper::get_redis_connection(&self.redis, 3, 100)
            .await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;

        let mut jobs = Vec::new();

        // Utiliser RPOP pour récupérer depuis la fin de la queue (FIFO)
        for _ in 0..batch_size {
            let job_json: Option<String> = conn
                .rpop(&self.queue_name, None)
                .await
                .map_err(|e| AppError::Internal(format!("Redis RPOP failed: {}", e)))?;

            if let Some(json) = job_json {
                match serde_json::from_str::<NotificationJob>(&json) {
                    Ok(job) => jobs.push(job),
                    Err(e) => {
                        log::warn!(
                            "⚠️ Impossible de parser une notification de la queue: {:?}",
                            e
                        );
                        continue;
                    }
                }
            } else {
                // Plus de notifications dans la queue
                break;
            }
        }

        Ok(jobs)
    }

    /// Obtient la taille de la queue
    pub async fn queue_length(&self) -> AppResult<usize> {
        let mut conn = redis_helper::get_redis_connection(&self.redis, 3, 100)
            .await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;

        let length: usize = conn
            .llen(&self.queue_name)
            .await
            .map_err(|e| AppError::Internal(format!("Redis LLEN failed: {}", e)))?;

        Ok(length)
    }
}
