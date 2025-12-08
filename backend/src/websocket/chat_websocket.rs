// ✅ NOUVEAU 2025-01-27 : WebSocket Manager pour chat avec Redis pub/sub pour scaling horizontal
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

// Métriques WebSocket chat (globales, en mémoire)
static CHAT_WS_CONNECTIONS_CURRENT: AtomicI64 = AtomicI64::new(0);
static CHAT_WS_MESSAGES_SENT_TOTAL: AtomicU64 = AtomicU64::new(0);
static CHAT_WS_ERRORS_TOTAL: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Copy, Default)]
pub struct ChatWsMetricsSnapshot {
    pub connections_current: i64,
    pub messages_sent_total: u64,
    pub errors_total: u64,
}

pub fn record_chat_ws_connection_open() {
    CHAT_WS_CONNECTIONS_CURRENT.fetch_add(1, Ordering::Relaxed);
}

pub fn record_chat_ws_connection_close() {
    CHAT_WS_CONNECTIONS_CURRENT.fetch_add(-1, Ordering::Relaxed);
}

pub fn record_chat_ws_message_sent() {
    CHAT_WS_MESSAGES_SENT_TOTAL.fetch_add(1, Ordering::Relaxed);
}

pub fn record_chat_ws_error() {
    CHAT_WS_ERRORS_TOTAL.fetch_add(1, Ordering::Relaxed);
}

pub fn get_chat_ws_metrics_snapshot() -> ChatWsMetricsSnapshot {
    ChatWsMetricsSnapshot {
        connections_current: CHAT_WS_CONNECTIONS_CURRENT.load(Ordering::Relaxed),
        messages_sent_total: CHAT_WS_MESSAGES_SENT_TOTAL.load(Ordering::Relaxed),
        errors_total: CHAT_WS_ERRORS_TOTAL.load(Ordering::Relaxed),
    }
}

/// Message WebSocket pour le chat
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatWsMessage {
    pub message_type: String, // "message", "reaction_added", "reaction_removed", "typing", etc.
    pub conversation_id: String, // ID de la conversation (service_id ou UUID)
    pub user_id: i32,
    pub data: serde_json::Value,
    pub timestamp: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instance_id: Option<String>, // ID de l'instance qui a généré le message (pour éviter les boucles)
}

/// Manager pour les connexions WebSocket de chat avec Redis pub/sub
#[derive(Clone)]
pub struct ChatWebSocketManager {
    channels: Arc<Mutex<HashMap<String, broadcast::Sender<ChatWsMessage>>>>,
    buffer: usize,
    #[allow(dead_code)]
    redis_client: Option<redis::Client>,
    instance_id: String,
}

impl ChatWebSocketManager {
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
            "✅ ChatWebSocketManager initialisé - Instance ID: {}",
            manager.instance_id
        );
        manager
    }

    async fn get_sender(&self, conversation_id: &str) -> broadcast::Sender<ChatWsMessage> {
        let mut channels = self.channels.lock().await;
        if let Some(sender) = channels.get(conversation_id) {
            sender.clone()
        } else {
            let (sender, _) = broadcast::channel(self.buffer);
            channels.insert(conversation_id.to_string(), sender.clone());
            sender
        }
    }

    pub async fn subscribe(&self, conversation_id: &str) -> broadcast::Receiver<ChatWsMessage> {
        let sender = self.get_sender(conversation_id).await;
        sender.subscribe()
    }

    /// Publie un message via Redis pub/sub ET broadcast local
    pub async fn broadcast_message(&self, conversation_id: &str, message: ChatWsMessage) {
        // Ajouter l'instance_id pour éviter les boucles
        let message_with_instance = ChatWsMessage {
            instance_id: Some(self.instance_id.clone()),
            ..message
        };

        // Publier via Redis si disponible (pour scaling horizontal)
        if let Some(client) = &self.redis_client {
            if let Err(err) =
                Self::publish_redis_message(client.clone(), conversation_id, &message_with_instance)
                    .await
            {
                log::warn!("[ChatWS] Publication Redis impossible: {err:?}");
            }
        }

        // Broadcast local (pour les clients connectés sur cette instance)
        let sender = self.get_sender(conversation_id).await;
        if sender.receiver_count() > 0 {
            if let Err(err) = sender.send(message_with_instance.clone()) {
                log::warn!("[ChatWS] Erreur broadcast local: {err:?}");
            } else {
                record_chat_ws_message_sent();
            }
        }
    }

    /// Publie un message dans Redis
    /// Note: On publie sur un channel spécifique par conversation pour permettre le pattern matching
    async fn publish_redis_message(
        client: redis::Client,
        conversation_id: &str,
        message: &ChatWsMessage,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let channel = format!("chat.messages.{}", conversation_id);
        let json = serde_json::to_string(message)?;

        let mut conn = client.get_multiplexed_async_connection().await?;
        redis::cmd("PUBLISH")
            .arg(&channel)
            .arg(json)
            .query_async::<i32>(&mut conn)
            .await?;

        Ok(())
    }

    /// Écoute les messages Redis et les distribue localement
    /// Note: On s'abonne à un channel global et on filtre par conversation_id
    fn spawn_redis_listener(&self) {
        let channels = self.channels.clone();
        let instance_id = self.instance_id.clone();
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
                    let err_str = err.to_string();
                    // Ignorer les erreurs de cancellation (arrêt normal du serveur)
                    if err_str.contains("task was cancelled") || err_str.contains("cancelled") {
                        log::debug!("[ChatWS] Connexion Redis annulée (arrêt normal)");
                    } else {
                        log::error!("[ChatWS] Erreur connexion Redis pub/sub: {err:?}");
                    }
                    return;
                }
            };

            // S'abonner au pattern pour toutes les conversations
            // Note: Utilise psubscribe pour les patterns (chat.messages.*)
            if let Err(err) = pubsub.psubscribe("chat.messages.*").await {
                log::error!("[ChatWS] Erreur abonnement Redis pattern: {err:?}");
                return;
            }

            log::info!("✅ [ChatWS] Écoute Redis pub/sub activée (pattern: chat.messages.*)");

            let mut stream = pubsub.into_on_message();

            while let Some(msg) = stream.next().await {
                let payload: String = match msg.get_payload() {
                    Ok(p) => p,
                    Err(err) => {
                        log::warn!("[ChatWS] Erreur lecture payload Redis: {err:?}");
                        continue;
                    }
                };

                let message: ChatWsMessage = match serde_json::from_str(&payload) {
                    Ok(m) => m,
                    Err(err) => {
                        log::warn!("[ChatWS] Erreur désérialisation message: {err:?}");
                        continue;
                    }
                };

                // Ignorer les messages de notre propre instance (éviter les boucles)
                if let Some(ref msg_instance_id) = message.instance_id {
                    if msg_instance_id == &instance_id {
                        continue;
                    }
                }

                // Distribuer le message localement
                let conversation_id = message.conversation_id.clone();
                let channels_guard = channels.lock().await;
                if let Some(sender) = channels_guard.get(&conversation_id) {
                    if sender.receiver_count() > 0 {
                        if let Err(err) = sender.send(message.clone()) {
                            log::warn!("[ChatWS] Erreur distribution message local: {err:?}");
                        } else {
                            record_chat_ws_message_sent();
                        }
                    }
                }
            }
        });
    }
}

/// Route WebSocket pour le chat
pub fn create_chat_websocket_router() -> Router<Arc<AppState>> {
    Router::new().route(
        "/ws/chat/{service_id}/{prestataire_id}/{user_id}",
        get(chat_websocket_handler),
    )
}

/// Handler WebSocket pour le chat
async fn chat_websocket_handler(
    ws: WebSocketUpgrade,
    Path((service_id, prestataire_id, user_id)): Path<(i32, i32, i32)>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| {
        handle_chat_websocket(socket, service_id, prestataire_id, user_id, state)
    })
}

/// Gère une connexion WebSocket de chat
async fn handle_chat_websocket(
    socket: WebSocket,
    service_id: i32,
    prestataire_id: i32,
    user_id: i32,
    state: Arc<AppState>,
) {
    let (mut sender, mut receiver) = socket.split();

    // ID de conversation (peut être service_id ou UUID pour conversations privées)
    let conversation_id = format!("{}_{}_{}", service_id, prestataire_id, user_id);

    log::info!(
        "🔌 [ChatWS] Connexion WebSocket chat - Conversation: {}, User: {}",
        conversation_id,
        user_id
    );

    record_chat_ws_connection_open();

    // Obtenir le manager de chat WebSocket depuis AppState
    // Note: On doit créer le manager s'il n'existe pas encore
    let chat_manager = if let Some(manager) = &state.chat_ws_manager {
        manager.clone()
    } else {
        // Créer un manager temporaire (normalement créé au démarrage)
        log::warn!("[ChatWS] ChatWebSocketManager non initialisé, création temporaire");
        Arc::new(ChatWebSocketManager::new(64, Some(state.redis_client.clone())))
    };

    // S'abonner aux messages de cette conversation
    let mut rx = chat_manager.subscribe(&conversation_id).await;

    // Tâche d'envoi des messages au client
    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            let json = match serde_json::to_string(&msg) {
                Ok(json) => json,
                Err(err) => {
                    log::warn!("[ChatWS] Erreur sérialisation message: {err:?}");
                    continue;
                }
            };

            if let Err(err) = sender.send(Message::Text(json.into())).await {
                log::debug!("[ChatWS] Erreur envoi message: {err:?}");
                break;
            }
        }
    });

    // Tâche de réception des messages du client
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    // Traiter les messages du client (ping, auth, etc.)
                    if let Ok(ws_msg) = serde_json::from_str::<serde_json::Value>(&text) {
                        if let Some(msg_type) = ws_msg.get("type").and_then(|t| t.as_str()) {
                            match msg_type {
                                "ping" => {
                                    log::debug!("[ChatWS] Ping reçu de user {}", user_id);
                                }
                                "auth" => {
                                    log::debug!("[ChatWS] Auth reçu de user {}", user_id);
                                }
                                _ => {
                                    log::debug!("[ChatWS] Message type inconnu: {}", msg_type);
                                }
                            }
                        }
                    }
                }
                Message::Close(_) => {
                    log::info!(
                        "[ChatWS] Connexion fermée par le client - User: {}",
                        user_id
                    );
                    break;
                }
                _ => {}
            }
        }
    });

    // Attendre que l'une des tâches se termine
    tokio::select! {
        _ = (&mut send_task) => log::info!("[ChatWS] Tâche envoi terminée"),
        _ = (&mut recv_task) => log::info!("[ChatWS] Tâche réception terminée"),
    }

    record_chat_ws_connection_close();
    log::info!(
        "[ChatWS] Connexion fermée - Conversation: {}, User: {}",
        conversation_id,
        user_id
    );
}
