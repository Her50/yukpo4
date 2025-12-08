use crate::models::delivery_model::{DeliveryCancelReason, DeliveryStatus};
use anyhow::Result;
use chrono::{DateTime, Utc};
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json;
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicI64, AtomicU64, Ordering},
        Arc,
    },
    time::Duration,
};
use tokio::sync::{broadcast, Mutex};
use uuid::Uuid;

// Métriques WebSocket delivery (globales, en mémoire).
static DELIVERY_WS_CONNECTIONS_CURRENT: AtomicI64 = AtomicI64::new(0);
static DELIVERY_WS_MESSAGES_SENT_TOTAL: AtomicU64 = AtomicU64::new(0);
static DELIVERY_WS_ERRORS_TOTAL: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Copy, Default)]
pub struct DeliveryWsMetricsSnapshot {
    pub connections_current: i64,
    pub messages_sent_total: u64,
    pub errors_total: u64,
}

pub fn record_ws_connection_open() {
    DELIVERY_WS_CONNECTIONS_CURRENT.fetch_add(1, Ordering::Relaxed);
}

pub fn record_ws_connection_close() {
    DELIVERY_WS_CONNECTIONS_CURRENT.fetch_add(-1, Ordering::Relaxed);
}

pub fn record_ws_message_sent() {
    DELIVERY_WS_MESSAGES_SENT_TOTAL.fetch_add(1, Ordering::Relaxed);
}

pub fn record_ws_error() {
    DELIVERY_WS_ERRORS_TOTAL.fetch_add(1, Ordering::Relaxed);
}

pub fn get_delivery_ws_metrics_snapshot() -> DeliveryWsMetricsSnapshot {
    DeliveryWsMetricsSnapshot {
        connections_current: DELIVERY_WS_CONNECTIONS_CURRENT.load(Ordering::Relaxed),
        messages_sent_total: DELIVERY_WS_MESSAGES_SENT_TOTAL.load(Ordering::Relaxed),
        errors_total: DELIVERY_WS_ERRORS_TOTAL.load(Ordering::Relaxed),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryWsMessage {
    pub delivery_id: Uuid,
    pub timestamp: DateTime<Utc>,
    #[serde(flatten)]
    pub event: DeliveryWsEvent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum DeliveryWsEvent {
    Status {
        status: DeliveryStatus,
        cancel_reason: Option<DeliveryCancelReason>,
    },
    Location {
        latitude: f64,
        longitude: f64,
        #[serde(skip_serializing_if = "Option::is_none")]
        speed_kmh: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        bearing: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        accuracy_meters: Option<f64>,
    },
    Pricing {
        base_price_cents: i32,
        distance_price_cents: i32,
        surcharge_cents: i32,
        discount_cents: i32,
        currency: String,
        shopping_cost_cents: i32,
        shopping_discount_cents: i32,
    },
    RecipientDropoff {
        latitude: f64,
        longitude: f64,
        #[serde(skip_serializing_if = "Option::is_none")]
        address: Option<String>,
    },
    PickupLocationUpdated {
        latitude: f64,
        longitude: f64,
        #[serde(skip_serializing_if = "Option::is_none")]
        address: Option<String>,
    },
    WalletUpdate {
        balance_cents: i64,
        #[serde(skip_serializing_if = "Option::is_none")]
        reason: Option<String>,
    },
    // ✅ Phase 6 - Amélioration 16-17 : Suggestion automatique de changement de statut basée sur proximité GPS
    ProximitySuggestion {
        location_type: String, // "pickup" ou "dropoff"
        distance_meters: f64,
        suggested_status: DeliveryStatus,
        auto_confirm_after_seconds: Option<u64>, // Changement automatique après X secondes (optionnel)
    },
    // ✅ Phase 9 - Amélioration 29 : Notification prestataire quand client fournit adresse
    DropoffAddressProvided {
        latitude: f64,
        longitude: f64,
        #[serde(skip_serializing_if = "Option::is_none")]
        address: Option<String>,
    },
}

/// ✅ Phase 2: Batch de messages pour optimiser l'envoi
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryWsBatch {
    pub messages: Vec<DeliveryWsMessage>,
    pub batch_id: Uuid,
    pub timestamp: DateTime<Utc>,
}

#[derive(Clone)]
pub struct DeliveryTrackingManager {
    channels: Arc<Mutex<HashMap<Uuid, broadcast::Sender<DeliveryWsMessage>>>>,
    buffer: usize,
    #[allow(dead_code)]
    redis_client: Option<redis::Client>,
    // ✅ Phase 2: Batching pour réduire le nombre de messages
    message_batches: Arc<Mutex<HashMap<Uuid, Vec<DeliveryWsMessage>>>>,
    batch_flush_interval: Duration,
    batch_size_threshold: usize,
}

impl DeliveryTrackingManager {
    pub fn new(buffer: usize, redis_client: Option<redis::Client>) -> Self {
        let manager = Self {
            channels: Arc::new(Mutex::new(HashMap::new())),
            buffer,
            redis_client,
            message_batches: Arc::new(Mutex::new(HashMap::new())),
            batch_flush_interval: Duration::from_millis(100), // Flush toutes les 100ms
            batch_size_threshold: 10,                         // Flush si 10 messages en attente
        };

        if manager.redis_client.is_some() {
            manager.spawn_redis_listener();
        }

        // ✅ Phase 2: Démarrer le task de flush périodique
        manager.spawn_batch_flusher();

        manager
    }

    async fn get_sender(&self, delivery_id: Uuid) -> broadcast::Sender<DeliveryWsMessage> {
        let mut channels = self.channels.lock().await;
        if let Some(sender) = channels.get(&delivery_id) {
            sender.clone()
        } else {
            let (sender, _) = broadcast::channel(self.buffer);
            channels.insert(delivery_id, sender.clone());
            sender
        }
    }

    pub async fn subscribe(&self, delivery_id: Uuid) -> broadcast::Receiver<DeliveryWsMessage> {
        let sender = self.get_sender(delivery_id).await;
        sender.subscribe()
    }

    /// ✅ Phase 2: Broadcast avec batching automatique
    pub async fn broadcast_event(&self, delivery_id: Uuid, event: DeliveryWsEvent) {
        let message = DeliveryWsMessage {
            delivery_id,
            timestamp: Utc::now(),
            event,
        };

        // Ajouter au batch
        let should_flush = {
            let mut batches = self.message_batches.lock().await;
            let batch = batches.entry(delivery_id).or_insert_with(Vec::new);
            batch.push(message.clone());

            // Flush si le batch atteint le seuil
            batch.len() >= self.batch_size_threshold
        };

        // Flush immédiat si nécessaire
        if should_flush {
            self.flush_batch(delivery_id).await;
        }

        // Envoi immédiat pour messages critiques (status changes)
        if matches!(message.event, DeliveryWsEvent::Status { .. }) {
            self.send_message_immediate(&message).await;
        }
    }

    /// Envoi immédiat d'un message (sans batching)
    async fn send_message_immediate(&self, message: &DeliveryWsMessage) {
        let sender = self.get_sender(message.delivery_id).await;

        if let Some(client) = &self.redis_client {
            if let Err(err) = Self::publish_redis_event(client.clone(), message).await {
                log::warn!("[DeliveryWS] Publication Redis impossible: {err:?}");
            }
        }

        if sender.receiver_count() > 0 {
            let _ = sender.send(message.clone());
            record_ws_message_sent();
        }
    }

    /// ✅ Phase 2: Flush un batch de messages
    async fn flush_batch(&self, delivery_id: Uuid) {
        let messages = {
            let mut batches = self.message_batches.lock().await;
            batches.remove(&delivery_id).unwrap_or_default()
        };

        if messages.is_empty() {
            return;
        }

        // Si un seul message, envoyer directement
        if messages.len() == 1 {
            self.send_message_immediate(&messages[0]).await;
            return;
        }

        // Créer un batch
        let batch = DeliveryWsBatch {
            messages: messages.clone(),
            batch_id: Uuid::new_v4(),
            timestamp: Utc::now(),
        };

        // Sérialiser le batch
        let batch_json = match serde_json::to_string(&batch) {
            Ok(json) => json,
            Err(err) => {
                log::warn!("[DeliveryWS] Erreur sérialisation batch: {err:?}");
                // Fallback: envoyer les messages individuellement
                for msg in messages {
                    self.send_message_immediate(&msg).await;
                }
                return;
            }
        };

        // ✅ Phase 2: Compression si message > 1KB
        let payload = if batch_json.len() > 1024 {
            match Self::compress_message(&batch_json) {
                Ok(compressed) => {
                    log::debug!(
                        "[DeliveryWS] Message compressé: {} -> {} bytes",
                        batch_json.len(),
                        compressed.len()
                    );
                    compressed
                }
                Err(err) => {
                    log::warn!("[DeliveryWS] Erreur compression: {err:?}, envoi non compressé");
                    batch_json.into_bytes()
                }
            }
        } else {
            batch_json.into_bytes()
        };

        // Envoyer via Redis si disponible
        if let Some(client) = &self.redis_client {
            let channel = format!("delivery.events.{}", delivery_id);
            let mut conn = match client.get_multiplexed_async_connection().await {
                Ok(conn) => conn,
                Err(err) => {
                    log::warn!("[DeliveryWS] Erreur connexion Redis: {err:?}");
                    // Fallback: envoyer individuellement
                    for msg in messages {
                        self.send_message_immediate(&msg).await;
                    }
                    return;
                }
            };

            use redis::AsyncCommands;
            if let Err(err) = conn.publish::<_, _, i32>(&channel, payload).await {
                log::warn!("[DeliveryWS] Erreur publication Redis batch: {err:?}");
            }
        }

        // Envoyer via broadcast local (envoyer les messages individuellement pour compatibilité)
        let sender = self.get_sender(delivery_id).await;
        if sender.receiver_count() > 0 {
            // Envoyer chaque message du batch individuellement
            // Note: Le batching est principalement pour réduire la charge réseau,
            // mais pour la compatibilité client, on envoie toujours individuellement
            for msg in messages {
                let _ = sender.send(msg);
                record_ws_message_sent();
            }
        }
    }

    /// ✅ Phase 2: Compresse un message avec gzip
    fn compress_message(data: &str) -> Result<Vec<u8>, std::io::Error> {
        use flate2::write::GzEncoder;
        use flate2::Compression;
        use std::io::Write;

        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(data.as_bytes())?;
        encoder.finish()
    }

    /// ✅ Phase 2: Task périodique pour flush des batches
    fn spawn_batch_flusher(&self) {
        let batches = self.message_batches.clone();
        let flush_interval = self.batch_flush_interval;
        let manager = self.clone();

        let _ = tokio::spawn(async move {
            let mut interval = tokio::time::interval(flush_interval);
            loop {
                interval.tick().await;

                // Flush tous les batches en attente
                let delivery_ids: Vec<Uuid> = {
                    let batches_guard = batches.lock().await;
                    batches_guard.keys().cloned().collect()
                };

                for delivery_id in delivery_ids {
                    manager.flush_batch(delivery_id).await;
                }
            }
        });
    }

    pub async fn cleanup(&self, delivery_id: Uuid) {
        let mut channels = self.channels.lock().await;
        if let Some(sender) = channels.get(&delivery_id) {
            if sender.receiver_count() == 0 {
                channels.remove(&delivery_id);
            }
        }
    }

    fn spawn_redis_listener(&self) {
        let Some(client) = self.redis_client.clone() else {
            return;
        };
        let channels = self.channels.clone();
        let buffer = self.buffer;

        let _ = tokio::spawn(async move {
            if let Err(err) = Self::redis_listener_loop(client, channels, buffer).await {
                log::warn!("[DeliveryWS] Listener Redis stoppé: {err:?}");
            }
        });
    }

    async fn publish_redis_event(
        client: redis::Client,
        message: &DeliveryWsMessage,
    ) -> redis::RedisResult<()> {
        let channel = format!("delivery.events.{}", message.delivery_id);
        let payload = serde_json::to_string(message).map_err(|_| {
            redis::RedisError::from((redis::ErrorKind::TypeError, "delivery_ws_serialization"))
        })?;

        let mut conn = client.get_multiplexed_async_connection().await?;
        redis::cmd("PUBLISH")
            .arg(&channel)
            .arg(payload)
            .query_async(&mut conn)
            .await
    }

    async fn redis_listener_loop(
        client: redis::Client,
        channels: Arc<Mutex<HashMap<Uuid, broadcast::Sender<DeliveryWsMessage>>>>,
        buffer: usize,
    ) -> Result<()> {
        #[allow(deprecated)]
        let mut pubsub = client.get_async_connection().await?.into_pubsub();
        pubsub.psubscribe("delivery.events.*").await?;

        let mut messages = pubsub.on_message();
        while let Some(msg) = messages.next().await {
            let payload: String = msg.get_payload()?;
            let delivery_message: DeliveryWsMessage = match serde_json::from_str(&payload) {
                Ok(value) => value,
                Err(err) => {
                    log::warn!("[DeliveryWS] Payload Redis invalide: {err:?}");
                    continue;
                }
            };

            let mut guard = channels.lock().await;
            let sender = if let Some(existing) = guard.get(&delivery_message.delivery_id) {
                existing.clone()
            } else {
                let (sender, _) = broadcast::channel(buffer);
                guard.insert(delivery_message.delivery_id, sender.clone());
                sender
            };
            drop(guard);

            let _ = sender.send(delivery_message);
        }

        Ok(())
    }
}
