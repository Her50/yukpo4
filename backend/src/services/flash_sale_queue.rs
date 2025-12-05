// ✅ Queue de réservations Flash Sales avec Redis Streams
// Permet de gérer des millions de réservations simultanées

use crate::core::types::{AppError, AppResult};
use crate::utils::redis_helper;
use chrono::{DateTime, Utc};
use redis::{AsyncCommands, Client as RedisClient};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FlashSaleReservationRequest {
    pub flash_sale_id: Uuid,
    pub user_id: i32,
    pub quantity: i32,
    pub requested_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FlashSaleReservationTicket {
    pub ticket_id: String,
    pub flash_sale_id: Uuid,
    pub status: String, // "pending", "processing", "completed", "failed"
    pub estimated_wait_time_seconds: Option<u64>,
    pub created_at: DateTime<Utc>,
}

pub struct FlashSaleReservationQueue {
    redis: Arc<RedisClient>,
    stream_name: String,
}

impl FlashSaleReservationQueue {
    pub fn new(redis: Arc<RedisClient>) -> Self {
        Self {
            redis,
            stream_name: "flash_sale:reservations".to_string(),
        }
    }

    /// Ajoute une réservation à la queue (retourne immédiatement un ticket)
    pub async fn enqueue_reservation(
        &self,
        request: FlashSaleReservationRequest,
    ) -> AppResult<FlashSaleReservationTicket> {
        let mut conn = redis_helper::get_redis_connection(&self.redis, 3, 100)
            .await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;

        let ticket_id = uuid::Uuid::new_v4().to_string();
        let request_json = serde_json::to_string(&request)
            .map_err(|e| AppError::Internal(format!("Serialization failed: {}", e)))?;

        // Ajouter à Redis Streams
        // Note: Utiliser l'API AsyncCommands de redis-rs
        let message_id: String = conn
            .xadd(
                &self.stream_name,
                "*", // Auto-generate message ID
                &[
                    ("ticket_id", ticket_id.as_str()),
                    ("request", request_json.as_str()),
                ],
            )
            .await
            .map_err(|e| AppError::Internal(format!("Redis XADD failed: {}", e)))?;

        // Créer le ticket
        let ticket = FlashSaleReservationTicket {
            ticket_id: ticket_id.clone(),
            flash_sale_id: request.flash_sale_id,
            status: "pending".to_string(),
            estimated_wait_time_seconds: Some(5), // Estimation basique
            created_at: Utc::now(),
        };

        // Stocker le ticket dans Redis (pour consultation)
        let ticket_key = format!("flash_sale:ticket:{}", ticket_id);
        let ticket_json = serde_json::to_string(&ticket)
            .map_err(|e| AppError::Internal(format!("Serialization failed: {}", e)))?;

        conn.set_ex::<_, _, ()>(&ticket_key, ticket_json, 300)
            .await // 5 minutes TTL
            .map_err(|e| AppError::Internal(format!("Redis SET failed: {}", e)))?;

        Ok(ticket)
    }

    /// Récupère le statut d'un ticket
    pub async fn get_ticket_status(
        &self,
        ticket_id: &str,
    ) -> AppResult<Option<FlashSaleReservationTicket>> {
        let mut conn = redis_helper::get_redis_connection(&self.redis, 3, 100)
            .await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;

        let ticket_key = format!("flash_sale:ticket:{}", ticket_id);
        let ticket_json: Option<String> = conn
            .get(&ticket_key)
            .await
            .map_err(|e| AppError::Internal(format!("Redis GET failed: {}", e)))?;

        if let Some(json) = ticket_json {
            let ticket: FlashSaleReservationTicket = serde_json::from_str(&json)
                .map_err(|e| AppError::Internal(format!("Deserialization failed: {}", e)))?;
            Ok(Some(ticket))
        } else {
            Ok(None)
        }
    }
}
