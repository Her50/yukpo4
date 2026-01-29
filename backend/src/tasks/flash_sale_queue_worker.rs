// ✅ Worker de traitement des réservations Flash Sales
// Traite les réservations par batch depuis Redis Streams

use crate::core::types::AppResult;
use crate::services::{
    flash_sale_cache::FlashSaleCache, flash_sale_queue::FlashSaleReservationRequest,
    live_flash_sale_service::LiveFlashSaleService,
};
use crate::utils::redis_helper;
use redis::{AsyncCommands, Client as RedisClient};
use sqlx::PgPool;
use std::sync::Arc;

const BATCH_SIZE: usize = 100;
const POLL_INTERVAL_MS: u64 = 100; // 100ms entre les polls

pub struct FlashSaleQueueWorker {
    #[allow(dead_code)]
    redis: Arc<RedisClient>,
    #[allow(dead_code)]
    pool: Arc<PgPool>,
    cache: FlashSaleCache,
    stream_name: String,
    consumer_group: String,
    consumer_name: String,
}

impl FlashSaleQueueWorker {
    pub fn new(redis: Arc<RedisClient>, pool: Arc<PgPool>, cache: FlashSaleCache) -> Self {
        Self {
            redis,
            pool,
            cache,
            stream_name: "flash_sale:reservations".to_string(),
            consumer_group: "reservation_workers".to_string(),
            consumer_name: format!("worker_{}", uuid::Uuid::new_v4()),
        }
    }

    pub async fn start(&self) -> AppResult<()> {
        // Créer le consumer group si nécessaire
        self.ensure_consumer_group().await?;

        log::info!("🚀 Flash Sale Queue Worker démarré: {}", self.consumer_name);

        let mut backoff_ms = 1000u64; // Délai initial de 1 seconde
        const MAX_BACKOFF_MS: u64 = 30000; // Maximum 30 secondes
        const BACKOFF_MULTIPLIER: u64 = 2;

        loop {
            match self.process_batch().await {
                Ok(_) => {
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
                        log::error!("Erreur traitement batch: {:?}", e);
                        // Pour les autres erreurs, utiliser un délai plus court
                        tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
                        backoff_ms = 1000; // Réinitialiser le backoff pour les erreurs non rate-limited
                    }
                }
            }
        }
    }

    async fn ensure_consumer_group(&self) -> AppResult<()> {
        let mut conn = redis_helper::get_redis_connection(&self.redis, 3, 100)
            .await
            .map_err(|e| {
                crate::core::types::AppError::Internal(format!("Redis connection failed: {}", e))
            })?;

        // XGROUP CREATE avec MKSTREAM si nécessaire
        // Note: Utiliser xgroup_create_mkstream de redis-rs
        use redis::AsyncCommands;
        let _: Result<(), _> = conn
            .xgroup_create_mkstream(&self.stream_name, &self.consumer_group, "0")
            .await;

        // Si le groupe existe déjà, on ignore l'erreur

        // Ignorer l'erreur si le groupe existe déjà
        Ok(())
    }

    async fn process_batch(&self) -> AppResult<()> {
        let mut conn = redis_helper::get_redis_connection(&self.redis, 3, 100)
            .await
            .map_err(|e| {
                crate::core::types::AppError::Internal(format!("Redis connection failed: {}", e))
            })?;

        // Lire un batch de messages depuis le stream
        // Note: Utiliser redis::cmd avec MultiplexedConnection
        let messages_result: Result<Vec<redis::streams::StreamReadReply>, _> =
            redis::cmd("XREADGROUP")
                .arg("GROUP")
                .arg(&self.consumer_group)
                .arg(&self.consumer_name)
                .arg("COUNT")
                .arg(BATCH_SIZE)
                .arg("STREAMS")
                .arg(&self.stream_name)
                .arg(">")
                .query_async(&mut conn)
                .await;

        let messages = match messages_result {
            Ok(msgs) => msgs,
            Err(e) if e.kind() == redis::ErrorKind::TypeError => {
                // Stream vide ou pas de messages
                return Ok(());
            }
            Err(e) => {
                return Err(crate::core::types::AppError::Internal(format!(
                    "Redis XREADGROUP failed: {}",
                    e
                )));
            }
        };

        if messages.is_empty() {
            return Ok(());
        }

        let stream_reply = &messages[0];
        let mut processed = 0;
        let mut failed = 0;

        for stream_id in &stream_reply.keys {
            for message in &stream_id.ids {
                let message_id = &message.id;

                // Parser les champs du message
                let mut ticket_id = None;
                let mut request_json = None;

                for (key, value) in &message.map {
                    if key == "ticket_id" {
                        match redis::from_redis_value::<String>(value) {
                            Ok(s) => ticket_id = Some(s),
                            Err(_) => {
                                if let Ok(bytes) = redis::from_redis_value::<Vec<u8>>(value) {
                                    if let Ok(s) = String::from_utf8(bytes) {
                                        ticket_id = Some(s);
                                    }
                                }
                            }
                        }
                    } else if key == "request" {
                        match redis::from_redis_value::<String>(value) {
                            Ok(s) => request_json = Some(s),
                            Err(_) => {
                                if let Ok(bytes) = redis::from_redis_value::<Vec<u8>>(value) {
                                    if let Ok(s) = String::from_utf8(bytes) {
                                        request_json = Some(s);
                                    }
                                }
                            }
                        }
                    }
                }

                if let (Some(ticket_id), Some(request_json)) = (ticket_id, request_json) {
                    match self.process_reservation(&ticket_id, &request_json).await {
                        Ok(_) => {
                            // ACK le message
                            self.ack_message(message_id).await?;
                            processed += 1;
                        }
                        Err(e) => {
                            log::error!("Erreur traitement réservation {}: {:?}", ticket_id, e);
                            failed += 1;
                            // Ne pas ACK, le message sera retraité
                        }
                    }
                }
            }
        }

        if processed > 0 || failed > 0 {
            log::info!("Batch traité: {} succès, {} échecs", processed, failed);
        }

        Ok(())
    }

    async fn process_reservation(&self, ticket_id: &str, request_json: &str) -> AppResult<()> {
        // Parser la requête
        let request: FlashSaleReservationRequest =
            serde_json::from_str(request_json).map_err(|e| {
                crate::core::types::AppError::Internal(format!("Deserialization failed: {}", e))
            })?;

        // Mettre à jour le statut du ticket
        self.update_ticket_status(ticket_id, "processing").await?;

        // Vérifier le stock dans le cache (fast path)
        if let Some(available_stock) = self
            .cache
            .get_available_stock(request.flash_sale_id)
            .await?
        {
            if available_stock < request.quantity {
                self.update_ticket_status(ticket_id, "failed").await?;
                return Err(crate::core::types::AppError::BadRequest(
                    "Stock insuffisant".into(),
                ));
            }
        }

        // Traiter la réservation dans la DB (avec transaction)
        match LiveFlashSaleService::reserve_slot(
            &self.pool,
            request.flash_sale_id,
            request.user_id,
            request.quantity,
        )
        .await
        {
            Ok(summary) => {
                // Mettre à jour le cache
                let available =
                    (summary.stock_target as i64 - summary.reserved_quantity).max(0) as i32;
                self.cache
                    .set_available_stock(request.flash_sale_id, available)
                    .await?;
                self.cache
                    .set_flash_sale_summary(request.flash_sale_id, &summary)
                    .await?;

                // ✅ NOUVEAU: Diffuser la mise à jour de stock via Redis pub/sub
                LiveFlashSaleService::broadcast_stock_update(
                    &self.redis,
                    request.flash_sale_id,
                    available,
                    summary.reserved_quantity,
                )
                .await;

                // Mettre à jour le statut du ticket
                self.update_ticket_status(ticket_id, "completed").await?;

                Ok(())
            }
            Err(e) => {
                self.update_ticket_status(ticket_id, "failed").await?;
                Err(e)
            }
        }
    }

    async fn update_ticket_status(&self, ticket_id: &str, status: &str) -> AppResult<()> {
        let mut conn = redis_helper::get_redis_connection(&self.redis, 3, 100)
            .await
            .map_err(|e| {
                crate::core::types::AppError::Internal(format!("Redis connection failed: {}", e))
            })?;

        let ticket_key = format!("flash_sale:ticket:{}", ticket_id);
        let ticket_json: Option<String> = conn.get(&ticket_key).await.map_err(|e| {
            crate::core::types::AppError::Internal(format!("Redis GET failed: {}", e))
        })?;

        if let Some(mut json) = ticket_json {
            // Mettre à jour le statut dans le JSON
            let mut ticket: serde_json::Value = serde_json::from_str(&json).map_err(|e| {
                crate::core::types::AppError::Internal(format!("Deserialization failed: {}", e))
            })?;
            ticket["status"] = serde_json::Value::String(status.to_string());

            json = serde_json::to_string(&ticket).map_err(|e| {
                crate::core::types::AppError::Internal(format!("Serialization failed: {}", e))
            })?;

            conn.set_ex::<_, _, ()>(&ticket_key, json, 300)
                .await
                .map_err(|e| {
                    crate::core::types::AppError::Internal(format!("Redis SET failed: {}", e))
                })?;
        }

        Ok(())
    }

    async fn ack_message(&self, message_id: &str) -> AppResult<()> {
        let mut conn = redis_helper::get_redis_connection(&self.redis, 3, 100)
            .await
            .map_err(|e| {
                crate::core::types::AppError::Internal(format!("Redis connection failed: {}", e))
            })?;

        use redis::AsyncCommands;
        let _: usize = conn
            .xack(&self.stream_name, &self.consumer_group, &[message_id])
            .await
            .map_err(|e| {
                crate::core::types::AppError::Internal(format!("Redis XACK failed: {}", e))
            })?;

        Ok(())
    }
}
