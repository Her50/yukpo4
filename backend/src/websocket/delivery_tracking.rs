use crate::models::delivery_model::{DeliveryCancelReason, DeliveryStatus};
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::{broadcast, Mutex};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct DeliveryWsMessage {
    pub delivery_id: Uuid,
    pub timestamp: DateTime<Utc>,
    #[serde(flatten)]
    pub event: DeliveryWsEvent,
}

#[derive(Debug, Clone, Serialize)]
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
}

impl DeliveryTrackingManager {
    pub fn new(buffer: usize) -> Self {
        Self {
            channels: Arc::new(Mutex::new(HashMap::new())),
            buffer,
        }
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
}
