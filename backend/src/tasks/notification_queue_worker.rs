// ✅ Worker de traitement des notifications par batch
// Traite les notifications Black Friday de manière asynchrone

use crate::core::types::AppResult;
use crate::services::notification_queue::NotificationQueue;
use crate::services::{notification_service, push_notification_service};
use redis::Client as RedisClient;
use sqlx::PgPool;
use std::sync::Arc;

const BATCH_SIZE: usize = 50; // Traiter 50 notifications par batch
const POLL_INTERVAL_MS: u64 = 500; // 500ms entre les polls

pub struct NotificationQueueWorker {
    #[allow(dead_code)]
    redis: Arc<RedisClient>,
    #[allow(dead_code)]
    pool: Arc<PgPool>,
    queue: NotificationQueue,
}

impl NotificationQueueWorker {
    pub fn new(redis: Arc<RedisClient>, pool: Arc<PgPool>) -> Self {
        let queue = NotificationQueue::new(redis.clone());
        Self { redis, pool, queue }
    }

    pub async fn start(&self) -> AppResult<()> {
        log::info!("🚀 Notification Queue Worker démarré");

        let mut backoff_ms = 1000u64; // Délai initial de 1 seconde
        const MAX_BACKOFF_MS: u64 = 30000; // Maximum 30 secondes
        const BACKOFF_MULTIPLIER: u64 = 2;

        loop {
            match self.process_batch().await {
                Ok(processed) => {
                    if processed > 0 {
                        log::debug!("✅ {} notifications traitées", processed);
                    }
                    // Succès : réinitialiser le backoff et utiliser l'intervalle normal
                    backoff_ms = 1000;
                    tokio::time::sleep(tokio::time::Duration::from_millis(POLL_INTERVAL_MS)).await;
                }
                Err(e) => {
                    let error_msg = format!("{:?}", e);
                    let is_rate_limited = error_msg.contains("rate-limited")
                        || error_msg.contains("rate limited")
                        || error_msg.contains("rate_limit");

                    if is_rate_limited {
                        log::warn!(
                            "⚠️ Rate limiting détecté, attente de {}ms avant retry",
                            backoff_ms
                        );
                        // En cas de rate limiting, utiliser un délai plus long
                        tokio::time::sleep(tokio::time::Duration::from_millis(backoff_ms)).await;
                        // Augmenter le backoff exponentiellement (max 30s)
                        backoff_ms = (backoff_ms * BACKOFF_MULTIPLIER).min(MAX_BACKOFF_MS);
                    } else {
                        log::error!("❌ Erreur traitement batch notifications: {:?}", e);
                        // Pour les autres erreurs, utiliser un délai plus court
                        tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
                        backoff_ms = 1000; // Réinitialiser le backoff pour les erreurs non rate-limited
                    }
                }
            }
        }
    }

    async fn process_batch(&self) -> AppResult<usize> {
        // Récupérer un batch de notifications
        let jobs = self.queue.dequeue_notifications(BATCH_SIZE).await?;

        if jobs.is_empty() {
            return Ok(0);
        }

        let mut processed = 0;
        let mut failed = 0;

        for job in jobs {
            let user_id = job.user_id;
            match self.process_notification(job).await {
                Ok(_) => {
                    processed += 1;
                }
                Err(e) => {
                    log::warn!(
                        "⚠️ Erreur traitement notification user_id={}: {:?}",
                        user_id,
                        e
                    );
                    failed += 1;
                    // Ne pas réessayer automatiquement pour éviter les boucles infinies
                }
            }
        }

        if failed > 0 {
            log::warn!(
                "⚠️ {} notifications échouées sur {} traitées",
                failed,
                processed + failed
            );
        }

        Ok(processed)
    }

    async fn process_notification(
        &self,
        job: crate::services::notification_queue::NotificationJob,
    ) -> AppResult<()> {
        use notification_service::NotificationType;

        // Parser le type de notification
        let notification_type = job.notification_type.clone();
        let notif_type = match notification_type.as_str() {
            "GlobalPromoEventCreated" => NotificationType::GlobalPromoEventCreated,
            "GlobalPromoEntryApproved" => NotificationType::GlobalPromoEntryApproved,
            "GlobalPromoEntryRejected" => NotificationType::GlobalPromoEntryRejected,
            "GlobalPromoEntryPublished" => NotificationType::GlobalPromoEntryPublished,
            "GlobalPromoEntryEnded" => NotificationType::GlobalPromoEntryEnded,
            _ => {
                log::warn!("⚠️ Type de notification inconnu: {}", notification_type);
                return Err(crate::core::types::AppError::BadRequest(format!(
                    "Type de notification inconnu: {}",
                    notification_type
                )));
            }
        };

        // Créer la notification en base
        if let Err(err) = notification_service::create_notification(
            &self.pool,
            job.user_id,
            notif_type,
            job.title.clone(),
            job.body.clone(),
            job.metadata.clone(),
        )
        .await
        {
            log::warn!(
                "⚠️ Erreur création notification DB user_id={}: {:?}",
                job.user_id,
                err
            );
            // Continuer quand même pour envoyer la push
        }

        // Envoyer la push notification
        if let Err(err) = push_notification_service::send_push_notification(
            &self.pool,
            job.user_id,
            job.title,
            job.body,
            job.metadata,
            job.push_channel,
        )
        .await
        {
            log::warn!(
                "⚠️ Erreur push notification user_id={}: {:?}",
                job.user_id,
                err
            );
            // Ne pas échouer complètement si la push échoue
        }

        Ok(())
    }
}
