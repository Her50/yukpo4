use crate::models::delivery_model::{DeliveryCancelReason, DeliveryStatus};
use anyhow::Result;
use chrono::{DateTime, Utc};
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::{broadcast, Mutex};
use uuid::Uuid;

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
    WalletUpdate {
        balance_cents: i64,
        #[serde(skip_serializing_if = "Option::is_none")]
        reason: Option<String>,
    },
}

#[derive(Clone)]
pub struct DeliveryTrackingManager {
    channels: Arc<Mutex<HashMap<Uuid, broadcast::Sender<DeliveryWsMessage>>>>,
    buffer: usize,
    redis_client: Option<redis::Client>,
}

impl DeliveryTrackingManager {
    pub fn new(buffer: usize, redis_client: Option<redis::Client>) -> Self {
        let manager = Self {
            channels: Arc::new(Mutex::new(HashMap::new())),
            buffer,
            redis_client,
        };

        if manager.redis_client.is_some() {
            manager.spawn_redis_listener();
        }

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

    pub async fn broadcast_event(&self, delivery_id: Uuid, event: DeliveryWsEvent) {
        let sender = self.get_sender(delivery_id).await;
        let message = DeliveryWsMessage {
            delivery_id,
            timestamp: Utc::now(),
            event,
        };

        if let Some(client) = &self.redis_client {
            if let Err(err) = Self::publish_redis_event(client.clone(), &message).await {
                log::warn!("[DeliveryWS] Publication Redis impossible: {err:?}");
            }
        }

        if sender.receiver_count() > 0 {
            let _ = sender.send(message);
        }
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

        tokio::spawn(async move {
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
