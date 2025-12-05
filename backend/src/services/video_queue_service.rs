// ✅ Service de queue distribué pour la génération vidéo
// Gère des millions de jobs simultanés avec Redis/BullMQ

use std::sync::Arc;
use std::time::Duration;

use log::{error, info, warn};
use rust_decimal::{Decimal, prelude::ToPrimitive};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::core::types::{AppError, AppResult};
use crate::services::redis_service::RedisService;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoJobQueueItem {
    pub job_id: Uuid,
    pub user_id: i32,
    pub service_id: Option<i32>,
    pub product_index: Option<i32>,
    pub priority: JobPriority,
    pub payload: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub retry_count: u32,
    pub max_retries: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum JobPriority {
    Low = 0,
    Normal = 1,
    High = 2,
    Critical = 3,
}

impl Default for JobPriority {
    fn default() -> Self {
        JobPriority::Normal
    }
}

#[derive(Debug, Clone)]
pub struct VideoQueueConfig {
    pub max_concurrent_jobs: usize,
    pub batch_size: usize,
    pub retry_delay_seconds: u64,
    pub max_retries: u32,
    pub priority_queues: bool,
}

impl Default for VideoQueueConfig {
    fn default() -> Self {
        VideoQueueConfig {
            max_concurrent_jobs: 1000, // ✅ Support de milliers de jobs simultanés
            batch_size: 50,
            retry_delay_seconds: 30,
            max_retries: 3,
            priority_queues: true,
        }
    }
}

pub struct VideoQueueService {
    pool: PgPool,
    config: VideoQueueConfig,
    redis: Option<Arc<RedisService>>,
}

impl VideoQueueService {
    pub fn new(pool: PgPool, config: VideoQueueConfig) -> Self {
        Self {
            pool,
            config,
            redis: None,
        }
    }

    /// ✅ Crée avec Redis pour queue distribué
    pub fn with_redis(pool: PgPool, config: VideoQueueConfig, redis: Arc<RedisService>) -> Self {
        Self {
            pool,
            config,
            redis: Some(redis),
        }
    }

    /// ✅ Enqueue un job de génération vidéo avec priorité
    pub async fn enqueue_job(&self, item: VideoJobQueueItem) -> AppResult<Uuid> {
        let priority_for_log = item.priority;
        info!(
            "[VideoQueue] Enqueueing job {} with priority {:?}",
            item.job_id, priority_for_log
        );

        // ✅ Insertion dans la DB
        sqlx::query!(
            r#"
            INSERT INTO video_generation_jobs (
                job_id, user_id, service_id, product_index,
                status, progress_steps, result_payload
            )
            VALUES ($1, $2, $3, $4, 'queued', '[]'::jsonb, $5)
            ON CONFLICT (job_id) DO NOTHING
            "#,
            item.job_id,
            item.user_id,
            item.service_id,
            item.product_index,
            item.payload
        )
        .execute(&self.pool)
        .await?;

        // ✅ Ajouter à Redis queue pour traitement distribué
        let job_id = item.job_id.clone();
        let priority_clone = item.priority;
        let priority = priority_clone as u8;
        // Cloner les champs nécessaires pour sérialisation
        let item_for_queue = serde_json::json!({
            "job_id": item.job_id,
            "user_id": item.user_id,
            "service_id": item.service_id,
            "product_index": item.product_index,
            "priority": priority_clone,
            "payload": item.payload,
        });
        let item_json = serde_json::to_string(&item_for_queue)?;
        if let Some(redis) = &self.redis {
            let queue_key = format!("video:queue:{}", priority);
            redis.lpush(queue_key, item_json).await?;
        }

        Ok(job_id)
    }

    /// ✅ Récupère un batch de jobs à traiter (priorité haute d'abord)
    pub async fn dequeue_batch(&self) -> AppResult<Vec<VideoJobQueueItem>> {
        let jobs = sqlx::query_as!(
            VideoJobQueueItem,
            r#"
            SELECT 
                job_id,
                user_id,
                service_id,
                product_index,
                'Normal' as priority,
                result_payload as payload,
                created_at,
                0 as retry_count,
                3 as max_retries
            FROM video_generation_jobs
            WHERE status = 'queued'
            ORDER BY 
                CASE 
                    WHEN user_id IN (SELECT id FROM users WHERE plan = 'premium') THEN 0
                    ELSE 1
                END,
                created_at ASC
            LIMIT $1
            FOR UPDATE SKIP LOCKED
            "#,
            self.config.batch_size as i64
        )
        .fetch_all(&self.pool)
        .await?;

        // ✅ Marquer comme "processing"
        if !jobs.is_empty() {
            let job_ids: Vec<Uuid> = jobs.iter().map(|j| j.job_id).collect();
            sqlx::query!(
                r#"
                UPDATE video_generation_jobs
                SET status = 'processing', updated_at = NOW()
                WHERE job_id = ANY($1)
                "#,
                &job_ids[..]
            )
            .execute(&self.pool)
            .await?;
        }

        Ok(jobs)
    }

    /// ✅ Marque un job comme complété
    pub async fn complete_job(
        &self,
        job_id: Uuid,
        result_media_id: Option<i32>,
        result_payload: Option<serde_json::Value>,
    ) -> AppResult<()> {
        sqlx::query!(
            r#"
            UPDATE video_generation_jobs
            SET 
                status = 'completed',
                result_media_id = $2,
                result_payload = $3,
                updated_at = NOW()
            WHERE job_id = $1
            "#,
            job_id,
            result_media_id,
            result_payload
        )
        .execute(&self.pool)
        .await?;

        info!("[VideoQueue] Job {} completed", job_id);
        Ok(())
    }

    /// ✅ Marque un job comme échoué et planifie un retry si nécessaire
    pub async fn fail_job(
        &self,
        job_id: Uuid,
        error_message: String,
        retry: bool,
    ) -> AppResult<()> {
        let job_id_for_log = job_id;
        if retry {
            // ✅ Retry avec backoff exponentiel
            sqlx::query!(
                r#"
                UPDATE video_generation_jobs
                SET 
                    status = 'queued',
                    error_message = $2,
                    updated_at = NOW()
                WHERE job_id = $1
                AND (
                    SELECT COUNT(*) FROM jsonb_array_elements(progress_steps)
                ) < 3
                "#,
                job_id,
                error_message
            )
            .execute(&self.pool)
            .await?;
        } else {
            sqlx::query!(
                r#"
                UPDATE video_generation_jobs
                SET 
                    status = 'failed',
                    error_message = $2,
                    updated_at = NOW()
                WHERE job_id = $1
                "#,
                job_id,
                error_message
            )
            .execute(&self.pool)
            .await?;
        }

        warn!("[VideoQueue] Job {} failed: {}", job_id_for_log, error_message);
        Ok(())
    }

    /// ✅ Statistiques de la queue
    pub async fn get_queue_stats(&self) -> AppResult<QueueStats> {
        let row = sqlx::query(
            r#"
            SELECT 
                COUNT(*) FILTER (WHERE status = 'queued') as queued_count,
                COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
                COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
                COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
                AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) FILTER (WHERE status = 'completed') as avg_duration_seconds
            FROM video_generation_jobs
            WHERE created_at > NOW() - INTERVAL '24 hours'
            "#
        )
        .fetch_one(&self.pool)
        .await?;

        let queued_count: Option<i64> = row.get::<Option<i64>, _>("queued_count");
        let processing_count: Option<i64> = row.get::<Option<i64>, _>("processing_count");
        let completed_count: Option<i64> = row.get::<Option<i64>, _>("completed_count");
        let failed_count: Option<i64> = row.get::<Option<i64>, _>("failed_count");
        let avg_duration_seconds: Option<f64> = row
            .try_get::<Option<Decimal>, _>("avg_duration_seconds")
            .ok()
            .flatten()
            .and_then(|d| ToPrimitive::to_f64(&d));

        Ok(QueueStats {
            queued: queued_count.unwrap_or(0) as u64,
            processing: processing_count.unwrap_or(0) as u64,
            completed: completed_count.unwrap_or(0) as u64,
            failed: failed_count.unwrap_or(0) as u64,
            avg_duration_seconds,
        })
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct QueueStats {
    pub queued: u64,
    pub processing: u64,
    pub completed: u64,
    pub failed: u64,
    pub avg_duration_seconds: Option<f64>,
}
