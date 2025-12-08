// ✅ Processeur de batch pour traiter des millions de jobs efficacement
// Optimisé pour le parallélisme et la performance

use std::sync::Arc;
use std::time::Instant;

use log::{error, info};
use sqlx::PgPool;
use tokio::sync::Semaphore;

use crate::core::types::AppResult;
use crate::services::video_queue_service::{VideoJobQueueItem, VideoQueueService};

pub struct BatchProcessorConfig {
    pub max_concurrent: usize,
    pub batch_size: usize,
    pub timeout_seconds: u64,
    pub retry_on_failure: bool,
}

impl Default for BatchProcessorConfig {
    fn default() -> Self {
        BatchProcessorConfig {
            max_concurrent: 1000, // ✅ Support de milliers de jobs simultanés
            batch_size: 100,
            timeout_seconds: 300, // 5 minutes
            retry_on_failure: true,
        }
    }
}

pub struct VideoBatchProcessor {
    queue_service: Arc<VideoQueueService>,
    pool: PgPool,
    config: BatchProcessorConfig,
    semaphore: Arc<Semaphore>,
}

impl VideoBatchProcessor {
    pub fn new(
        queue_service: Arc<VideoQueueService>,
        pool: PgPool,
        config: BatchProcessorConfig,
    ) -> Self {
        let semaphore = Arc::new(Semaphore::new(config.max_concurrent));
        Self {
            queue_service,
            pool,
            config,
            semaphore,
        }
    }

    /// ✅ Traite un batch de jobs en parallèle
    pub async fn process_batch(&self) -> AppResult<BatchProcessingResult> {
        let start = Instant::now();
        let jobs = self.queue_service.dequeue_batch().await?;

        if jobs.is_empty() {
            return Ok(BatchProcessingResult {
                processed: 0,
                succeeded: 0,
                failed: 0,
                duration_ms: start.elapsed().as_millis() as u64,
            });
        }

        info!("[BatchProcessor] Processing {} jobs", jobs.len());

        // ✅ Traitement parallèle avec semaphore pour limiter la concurrence
        let mut handles = Vec::new();

        for job in jobs {
            let permit = self.semaphore.clone().acquire_owned().await.unwrap();
            let queue_service = self.queue_service.clone();
            let pool = self.pool.clone();

            let handle = tokio::spawn(async move {
                let _permit = permit;
                Self::process_single_job(queue_service, pool, job).await
            });

            handles.push(handle);
        }

        // ✅ Attendre tous les résultats
        let mut succeeded = 0;
        let mut failed = 0;

        for handle in handles {
            match handle.await {
                Ok(Ok(true)) => succeeded += 1,
                Ok(Ok(false)) => failed += 1,
                Ok(Err(e)) => {
                    error!("[BatchProcessor] Job processing error: {}", e);
                    failed += 1;
                }
                Err(e) => {
                    error!("[BatchProcessor] Task join error: {}", e);
                    failed += 1;
                }
            }
        }

        let duration_ms = start.elapsed().as_millis() as u64;

        info!(
            "[BatchProcessor] Batch completed: {} succeeded, {} failed in {}ms",
            succeeded, failed, duration_ms
        );

        Ok(BatchProcessingResult {
            processed: succeeded + failed,
            succeeded,
            failed,
            duration_ms,
        })
    }

    /// ✅ Traite un job individuel
    async fn process_single_job(
        queue_service: Arc<VideoQueueService>,
        pool: PgPool,
        job: VideoJobQueueItem,
    ) -> AppResult<bool> {
        let start = Instant::now();

        // ✅ TODO: Intégrer avec video_generation_service
        // let result = video_generation_service.generate_video(job.payload).await?;

        // ✅ Simulation pour l'instant
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let success = true; // Simuler succès

        if success {
            queue_service
                .complete_job(job.job_id, None, Some(serde_json::json!({})))
                .await?;

            let duration_ms = start.elapsed().as_millis();
            info!(
                "[BatchProcessor] Job {} completed in {}ms",
                job.job_id, duration_ms
            );
        } else {
            queue_service
                .fail_job(job.job_id, "Processing failed".to_string(), true)
                .await?;
        }

        Ok(success)
    }

    /// ✅ Démarre le worker de traitement continu
    pub async fn start_worker(&self) -> AppResult<()> {
        info!(
            "[BatchProcessor] Starting worker with max_concurrent={}",
            self.config.max_concurrent
        );

        loop {
            match self.process_batch().await {
                Ok(result) => {
                    if result.processed == 0 {
                        // ✅ Pas de jobs, attendre un peu
                        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                    }
                }
                Err(e) => {
                    error!("[BatchProcessor] Batch processing error: {}", e);
                    tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
                }
            }
        }
    }
}

#[derive(Debug, Clone)]
pub struct BatchProcessingResult {
    pub processed: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub duration_ms: u64,
}
