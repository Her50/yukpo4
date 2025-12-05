// ✅ NOUVEAU: WebSocket Manager pour chat de livraison
// Permet la communication en temps réel entre client, coursier et prestataire pendant une livraison

use crate::state::AppState;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use chrono::{DateTime, Utc};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicI64, AtomicU64, Ordering},
        Arc,
    },
};
use tokio::sync::{broadcast, Mutex};
use uuid::Uuid;

// Métriques WebSocket chat livraison
static DELIVERY_CHAT_WS_CONNECTIONS_CURRENT: AtomicI64 = AtomicI64::new(0);
static DELIVERY_CHAT_WS_MESSAGES_SENT_TOTAL: AtomicU64 = AtomicU64::new(0);
static DELIVERY_CHAT_WS_ERRORS_TOTAL: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Copy, Default)]
pub struct DeliveryChatWsMetricsSnapshot {
    pub connections_current: i64,
    pub messages_sent_total: u64,
    pub errors_total: u64,
}

pub fn record_delivery_chat_ws_connection_open() {
    DELIVERY_CHAT_WS_CONNECTIONS_CURRENT.fetch_add(1, Ordering::Relaxed);
}

pub fn record_delivery_chat_ws_connection_close() {
    DELIVERY_CHAT_WS_CONNECTIONS_CURRENT.fetch_add(-1, Ordering::Relaxed);
}

pub fn record_delivery_chat_ws_message_sent() {
    DELIVERY_CHAT_WS_MESSAGES_SENT_TOTAL.fetch_add(1, Ordering::Relaxed);
}

pub fn record_delivery_chat_ws_error() {
    DELIVERY_CHAT_WS_ERRORS_TOTAL.fetch_add(1, Ordering::Relaxed);
}

pub fn get_delivery_chat_ws_metrics_snapshot() -> DeliveryChatWsMetricsSnapshot {
    DeliveryChatWsMetricsSnapshot {
        connections_current: DELIVERY_CHAT_WS_CONNECTIONS_CURRENT.load(Ordering::Relaxed),
        messages_sent_total: DELIVERY_CHAT_WS_MESSAGES_SENT_TOTAL.load(Ordering::Relaxed),
        errors_total: DELIVERY_CHAT_WS_ERRORS_TOTAL.load(Ordering::Relaxed),
    }
}

/// Message WebSocket pour le chat de livraison
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryChatMessage {
    pub message_type: String, // "message", "typing", "read", "delivered"
    pub delivery_id: Uuid,
    pub sender_id: i32,
    pub sender_name: String,
    pub sender_role: String, // "client", "courier", "provider"
    pub content: String,
    pub timestamp: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

/// Manager pour les connexions WebSocket de chat de livraison
#[derive(Clone)]
pub struct DeliveryChatWebSocketManager {
    channels: Arc<Mutex<HashMap<Uuid, broadcast::Sender<DeliveryChatMessage>>>>,
    buffer: usize,
    redis_client: Option<redis::Client>,
    instance_id: String,
}

impl DeliveryChatWebSocketManager {
    pub fn new(buffer: usize, redis_client: Option<redis::Client>) -> Self {
        let instance_id = std::env::var("INSTANCE_ID")
            .unwrap_or_else(|_| format!("backend-{}", uuid::Uuid::new_v4()));

        let manager = Self {
            channels: Arc::new(Mutex::new(HashMap::new())),
            buffer,
            redis_client: redis_client.clone(),
            instance_id,
        };

        if manager.redis_client.is_some() {
            manager.spawn_redis_listener();
        }

        log::info!(
            "✅ DeliveryChatWebSocketManager initialisé - Instance ID: {}",
            manager.instance_id
        );
        manager
    }

    async fn get_sender(&self, delivery_id: Uuid) -> broadcast::Sender<DeliveryChatMessage> {
        let mut channels = self.channels.lock().await;
        if let Some(sender) = channels.get(&delivery_id) {
            sender.clone()
        } else {
            let (sender, _) = broadcast::channel(self.buffer);
            channels.insert(delivery_id, sender.clone());
            sender
        }
    }

    pub async fn subscribe(&self, delivery_id: Uuid) -> broadcast::Receiver<DeliveryChatMessage> {
        let sender = self.get_sender(delivery_id).await;
        sender.subscribe()
    }

    /// Publie un message via Redis pub/sub ET broadcast local
    pub async fn broadcast_message(&self, delivery_id: Uuid, message: DeliveryChatMessage) {
        // Publier via Redis si disponible (pour scaling horizontal)
        if let Some(client) = &self.redis_client {
            if let Err(err) =
                Self::publish_redis_message(client.clone(), delivery_id, &message).await
            {
                log::warn!("[DeliveryChatWS] Publication Redis impossible: {err:?}");
            }
        }

        // Broadcast local (pour les clients connectés sur cette instance)
        let sender = self.get_sender(delivery_id).await;
        if sender.receiver_count() > 0 {
            if let Err(err) = sender.send(message.clone()) {
                log::warn!("[DeliveryChatWS] Erreur broadcast local: {err:?}");
            } else {
                record_delivery_chat_ws_message_sent();
            }
        }
    }

    /// Publie un message dans Redis
    async fn publish_redis_message(
        client: redis::Client,
        delivery_id: Uuid,
        message: &DeliveryChatMessage,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let channel = format!("delivery.chat.{}", delivery_id);
        let json = serde_json::to_string(message)?;

        let mut conn = client.get_multiplexed_async_connection().await?;
        use redis::AsyncCommands;
        conn.publish::<_, _, i32>(&channel, json).await?;

        Ok(())
    }

    /// Écoute les messages Redis et les distribue localement
    fn spawn_redis_listener(&self) {
        let channels = self.channels.clone();
        let _instance_id = self.instance_id.clone();
        let redis_client = self.redis_client.clone();

        tokio::spawn(async move {
            let client = match redis_client {
                Some(client) => client,
                None => return,
            };

            #[allow(deprecated)]
            let mut pubsub = match client.get_async_connection().await {
                Ok(conn) => conn.into_pubsub(),
                Err(err) => {
                    log::error!("[DeliveryChatWS] Erreur connexion Redis pub/sub: {err:?}");
                    return;
                }
            };

            // S'abonner au pattern pour toutes les livraisons
            if let Err(err) = pubsub.psubscribe("delivery.chat.*").await {
                log::error!("[DeliveryChatWS] Erreur abonnement Redis pattern: {err:?}");
                return;
            }

            log::info!(
                "✅ [DeliveryChatWS] Écoute Redis pub/sub activée (pattern: delivery.chat.*)"
            );

            let mut stream = pubsub.into_on_message();

            while let Some(msg) = stream.next().await {
                let payload: String = match msg.get_payload() {
                    Ok(p) => p,
                    Err(err) => {
                        log::warn!("[DeliveryChatWS] Erreur lecture payload Redis: {err:?}");
                        continue;
                    }
                };

                let message: DeliveryChatMessage = match serde_json::from_str(&payload) {
                    Ok(m) => m,
                    Err(err) => {
                        log::warn!("[DeliveryChatWS] Erreur désérialisation message: {err:?}");
                        continue;
                    }
                };

                // Distribuer le message localement
                let delivery_id = message.delivery_id;
                let channels_guard = channels.lock().await;
                if let Some(sender) = channels_guard.get(&delivery_id) {
                    if sender.receiver_count() > 0 {
                        if let Err(err) = sender.send(message.clone()) {
                            log::warn!(
                                "[DeliveryChatWS] Erreur distribution message local: {err:?}"
                            );
                        } else {
                            record_delivery_chat_ws_message_sent();
                        }
                    }
                }
            }
        });
    }
}

/// Route WebSocket pour le chat de livraison
pub fn create_delivery_chat_websocket_router() -> Router<Arc<AppState>> {
    Router::new().route(
        "/ws/delivery-chat/:delivery_id/:user_id",
        get(delivery_chat_websocket_handler),
    )
}

/// Handler WebSocket pour le chat de livraison
async fn delivery_chat_websocket_handler(
    ws: WebSocketUpgrade,
    Path((delivery_id, user_id)): Path<(String, i32)>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let delivery_uuid = match Uuid::parse_str(&delivery_id) {
        Ok(uuid) => uuid,
        Err(_) => {
            log::warn!("[DeliveryChatWS] ID de livraison invalide: {}", delivery_id);
            return axum::response::Response::builder()
                .status(400)
                .body("Invalid delivery ID".into())
                .unwrap()
                .into_response();
        }
    };

    ws.on_upgrade(move |socket| {
        handle_delivery_chat_websocket(socket, delivery_uuid, user_id, state)
    })
}

/// Gère une connexion WebSocket de chat de livraison
async fn handle_delivery_chat_websocket(
    socket: WebSocket,
    delivery_id: Uuid,
    user_id: i32,
    state: Arc<AppState>,
) {
    let (mut sender, mut receiver) = socket.split();

    log::info!(
        "🔌 [DeliveryChatWS] Connexion WebSocket chat - Delivery: {}, User: {}",
        delivery_id,
        user_id
    );

    record_delivery_chat_ws_connection_open();

    // Obtenir le manager de chat WebSocket depuis AppState
    let chat_manager: Arc<DeliveryChatWebSocketManager> =
        if let Some(manager) = &state.delivery_chat_ws_manager {
            manager.clone()
        } else {
            log::warn!(
                "[DeliveryChatWS] DeliveryChatWebSocketManager non initialisé, création temporaire"
            );
            Arc::new(DeliveryChatWebSocketManager::new(
                64,
                state.redis_client.clone(),
            ))
        };

    // Vérifier que l'utilisateur a accès à cette livraison
    let has_access = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM delivery_requests dr
            WHERE dr.id = $1
            AND (
                dr.client_id = $2
                OR dr.courier_id = $2
                OR EXISTS(
                    SELECT 1 FROM services s
                    WHERE s.id = dr.service_id
                    AND s.user_id = $2
                )
            )
        )
        "#,
    )
    .bind(delivery_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await;

    match has_access {
        Ok(true) => {
            log::info!(
                "[DeliveryChatWS] ✅ Accès autorisé pour user {} sur delivery {}",
                user_id,
                delivery_id
            );
        }
        Ok(false) => {
            log::warn!(
                "[DeliveryChatWS] ❌ Accès refusé pour user {} sur delivery {}",
                user_id,
                delivery_id
            );
            record_delivery_chat_ws_connection_close();
            return;
        }
        Err(e) => {
            log::error!("[DeliveryChatWS] ❌ Erreur vérification accès: {}", e);
            record_delivery_chat_ws_connection_close();
            return;
        }
    }

    // S'abonner aux messages de cette livraison
    let mut rx = chat_manager.subscribe(delivery_id).await;

    // Tâche d'envoi des messages au client
    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            let json = match serde_json::to_string(&msg) {
                Ok(json) => json,
                Err(err) => {
                    log::warn!("[DeliveryChatWS] Erreur sérialisation message: {err:?}");
                    continue;
                }
            };

            if let Err(err) = sender.send(Message::Text(json.into())).await {
                log::debug!("[DeliveryChatWS] Erreur envoi message: {err:?}");
                break;
            }
        }
    });

    // Tâche de réception des messages du client
    let state_recv = state.clone();
    let chat_manager_recv = chat_manager.clone();
    let delivery_id_recv = delivery_id;
    let user_id_recv = user_id;

    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    if let Ok(ws_msg) = serde_json::from_str::<serde_json::Value>(&text) {
                        if let Some(msg_type) = ws_msg.get("type").and_then(|t| t.as_str()) {
                            match msg_type {
                                "ping" => {
                                    log::debug!(
                                        "[DeliveryChatWS] Ping reçu de user {}",
                                        user_id_recv
                                    );
                                }
                                "message" => {
                                    // Traiter l'envoi d'un message
                                    if let (Some(content), Some(sender_name), Some(sender_role)) = (
                                        ws_msg.get("content").and_then(|c| c.as_str()),
                                        ws_msg.get("sender_name").and_then(|n| n.as_str()),
                                        ws_msg.get("sender_role").and_then(|r| r.as_str()),
                                    ) {
                                        // Créer le message
                                        let chat_message = DeliveryChatMessage {
                                            message_type: "message".to_string(),
                                            delivery_id: delivery_id_recv,
                                            sender_id: user_id_recv,
                                            sender_name: sender_name.to_string(),
                                            sender_role: sender_role.to_string(),
                                            content: content.to_string(),
                                            timestamp: Utc::now(),
                                            metadata: ws_msg.get("metadata").cloned(),
                                        };

                                        // Sauvegarder en base de données
                                        let _ = sqlx::query(
                                            r#"
                                            INSERT INTO delivery_chat_messages 
                                            (delivery_id, sender_id, sender_name, sender_role, content, metadata, created_at)
                                            VALUES ($1, $2, $3, $4, $5, $6, NOW())
                                            "#,
                                        )
                                        .bind(delivery_id_recv)
                                        .bind(user_id_recv)
                                        .bind(sender_name)
                                        .bind(sender_role)
                                        .bind(content)
                                        .bind(ws_msg.get("metadata").cloned())
                                        .execute(&state_recv.pg)
                                        .await;

                                        // Diffuser le message
                                        chat_manager_recv
                                            .broadcast_message(delivery_id_recv, chat_message)
                                            .await;
                                    }
                                }
                                _ => {
                                    log::debug!(
                                        "[DeliveryChatWS] Message type inconnu: {}",
                                        msg_type
                                    );
                                }
                            }
                        }
                    }
                }
                Message::Close(_) => {
                    log::info!(
                        "[DeliveryChatWS] Connexion fermée par le client - User: {}",
                        user_id_recv
                    );
                    break;
                }
                _ => {}
            }
        }
    });

    // Attendre que l'une des tâches se termine
    tokio::select! {
        _ = (&mut send_task) => log::info!("[DeliveryChatWS] Tâche envoi terminée"),
        _ = (&mut recv_task) => log::info!("[DeliveryChatWS] Tâche réception terminée"),
    }

    record_delivery_chat_ws_connection_close();
    log::info!(
        "[DeliveryChatWS] Connexion fermée - Delivery: {}, User: {}",
        delivery_id,
        user_id
    );
}
