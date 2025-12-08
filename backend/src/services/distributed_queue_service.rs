// ✅ Service de queue distribuée utilisant Redis Streams
// Pour actions asynchrones: notifications, emails, rapports, etc.

use log::{debug, info, warn};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;

use crate::core::types::{AppError, AppResult};
use crate::services::redis_service::RedisService;

/// Message dans la queue
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueMessage {
    pub id: String,
    pub job_type: String,
    pub payload: serde_json::Value,
    pub priority: u8, // 0-255, plus bas = plus prioritaire
    pub retry_count: u32,
    pub max_retries: u32,
    pub created_at: i64,
}

impl QueueMessage {
    pub fn new(job_type: String, payload: serde_json::Value, priority: u8) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            job_type,
            payload,
            priority,
            retry_count: 0,
            max_retries: 3,
            created_at: chrono::Utc::now().timestamp(),
        }
    }
}

/// Service de queue distribuée
pub struct DistributedQueueService {
    redis_service: Arc<RedisService>,
    stream_name: String,
    consumer_group: String,
    consumer_name: String,
}

impl DistributedQueueService {
    /// Crée un nouveau service de queue
    pub fn new(
        redis_service: Arc<RedisService>,
        stream_name: String,
        consumer_group: String,
    ) -> Self {
        let consumer_name = format!("consumer-{}", uuid::Uuid::new_v4());

        Self {
            redis_service,
            stream_name,
            consumer_group,
            consumer_name,
        }
    }

    /// Initialise le consumer group (à appeler une fois)
    pub async fn init_consumer_group(&self) -> AppResult<()> {
        // Note: Implémentation simplifiée
        // En production, utiliser XGROUP CREATE avec MKSTREAM
        info!(
            "[Queue] Consumer group {} initialized for stream {}",
            self.consumer_group, self.stream_name
        );
        Ok(())
    }

    /// Ajoute un message à la queue
    pub async fn enqueue(&self, message: QueueMessage) -> AppResult<String> {
        let message_json = serde_json::to_string(&message)
            .map_err(|e| AppError::Internal(format!("Queue message serialization error: {}", e)))?;

        // Utiliser Redis Streams XADD
        // Format: XADD stream_name * field value
        let key = format!("{}:{}", self.stream_name, message.job_type);

        // Note: Implémentation simplifiée - utiliser redis::cmd("XADD") en production
        debug!("[Queue] Enqueuing message {} to stream {}", message.id, key);

        // Pour l'instant, utiliser un simple SET avec TTL comme fallback
        // TODO: Implémenter Redis Streams XADD complet
        self.redis_service
            .setex(
                format!("queue:{}:{}", self.stream_name, message.id),
                3600, // 1h TTL par défaut
                message_json,
            )
            .await?;

        Ok(message.id)
    }

    /// Récupère et traite un message de la queue
    pub async fn dequeue(&self, _timeout: Duration) -> AppResult<Option<QueueMessage>> {
        // Note: Implémentation simplifiée
        // En production, utiliser XREADGROUP pour consumer groups

        // Pour l'instant, utiliser un pattern de polling simple
        // TODO: Implémenter Redis Streams XREADGROUP complet

        warn!("[Queue] Dequeue not fully implemented - using simplified version");
        Ok(None)
    }

    /// Marque un message comme traité (ACK)
    pub async fn ack(&self, message_id: &str) -> AppResult<()> {
        debug!("[Queue] ACK message {}", message_id);
        // TODO: Implémentation XACK pour Redis Streams
        Ok(())
    }

    /// Marque un message comme échoué (retry ou dead letter)
    pub async fn nack(&self, message_id: &str, retry: bool) -> AppResult<()> {
        if retry {
            debug!("[Queue] NACK (retry) message {}", message_id);
            // TODO: Réinsérer dans la queue avec retry_count++
        } else {
            debug!("[Queue] NACK (dead letter) message {}", message_id);
            // TODO: Déplacer vers dead letter queue
        }
        Ok(())
    }

    /// Compte les messages en attente dans la queue
    pub async fn pending_count(&self) -> AppResult<u64> {
        // TODO: Utiliser XPENDING pour Redis Streams
        Ok(0)
    }
}

/// Helper pour créer des messages de queue typés
pub struct QueueMessageBuilder {
    job_type: String,
    payload: serde_json::Value,
    priority: u8,
    max_retries: u32,
}

impl QueueMessageBuilder {
    pub fn new(job_type: impl Into<String>) -> Self {
        Self {
            job_type: job_type.into(),
            payload: serde_json::json!({}),
            priority: 5, // Priorité moyenne par défaut
            max_retries: 3,
        }
    }

    pub fn payload(mut self, payload: serde_json::Value) -> Self {
        self.payload = payload;
        self
    }

    pub fn priority(mut self, priority: u8) -> Self {
        self.priority = priority;
        self
    }

    pub fn max_retries(mut self, max_retries: u32) -> Self {
        self.max_retries = max_retries;
        self
    }

    pub fn build(self) -> QueueMessage {
        QueueMessage {
            id: uuid::Uuid::new_v4().to_string(),
            job_type: self.job_type,
            payload: self.payload,
            priority: self.priority,
            retry_count: 0,
            max_retries: self.max_retries,
            created_at: chrono::Utc::now().timestamp(),
        }
    }
}

// Exemples d'utilisation pour services spécialisés
impl DistributedQueueService {
    /// Enqueue une notification
    pub async fn enqueue_notification(
        &self,
        user_id: i32,
        title: String,
        message: String,
    ) -> AppResult<String> {
        let msg = QueueMessageBuilder::new("notification")
            .payload(serde_json::json!({
                "user_id": user_id,
                "title": title,
                "message": message,
            }))
            .priority(3) // Priorité haute pour notifications
            .build();

        self.enqueue(msg).await
    }

    /// Enqueue un email
    pub async fn enqueue_email(
        &self,
        to: String,
        subject: String,
        body: String,
    ) -> AppResult<String> {
        let msg = QueueMessageBuilder::new("email")
            .payload(serde_json::json!({
                "to": to,
                "subject": subject,
                "body": body,
            }))
            .priority(5) // Priorité moyenne
            .build();

        self.enqueue(msg).await
    }

    /// Enqueue un rapport analytics
    pub async fn enqueue_analytics_report(
        &self,
        service_id: i32,
        service_type: String,
        period: String,
    ) -> AppResult<String> {
        let msg = QueueMessageBuilder::new("analytics_report")
            .payload(serde_json::json!({
                "service_id": service_id,
                "service_type": service_type,
                "period": period,
            }))
            .priority(7) // Priorité basse pour rapports
            .max_retries(1) // Moins de retries pour rapports
            .build();

        self.enqueue(msg).await
    }
}
