// ✅ NOUVEAU 2025-01-27 : WebSocket Manager pour chat avec Redis pub/sub pour scaling horizontal
use crate::state::AppState;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    routing::get,
    Router,
};
use chrono::{DateTime, Utc};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use sqlx;
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

        let _ = tokio::spawn(async move {
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

/// Handler WebSocket pour le chat.
/// ✅ 2026-05-16 — Auth JWT obligatoire + l'user authentifié DOIT être soit
/// `prestataire_id` soit `user_id`. Empêche un tiers d'écouter/spammer le chat
/// privé entre deux autres users.
async fn chat_websocket_handler(
    ws: WebSocketUpgrade,
    Path((service_id, prestataire_id, user_id)): Path<(i32, i32, i32)>,
    State(state): State<Arc<AppState>>,
    axum::extract::OriginalUri(uri): axum::extract::OriginalUri,
) -> axum::response::Response {
    let auth = match crate::websocket::ws_auth::authenticate_ws(&state, &uri).await {
        Ok(Some(a)) => a,
        Ok(None) => {
            // Mode non-strict (transition) : on accepte mais on logue
            return ws.on_upgrade(move |socket| {
                handle_chat_websocket(socket, service_id, prestataire_id, user_id, state)
            });
        }
        Err(s) => {
            return crate::websocket::ws_auth::reject_upgrade(s, "Auth chat WS échouée");
        }
    };
    if auth.user_id != prestataire_id && auth.user_id != user_id {
        log::warn!(
            "[chat_ws] mismatch user : token={} chat=({}, {}) — refusé",
            auth.user_id,
            prestataire_id,
            user_id
        );
        return crate::websocket::ws_auth::reject_upgrade(
            axum::http::StatusCode::FORBIDDEN,
            "Accès refusé à ce chat",
        );
    }
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

    // ✅ CORRIGÉ: Normaliser le conversation_id pour que les deux parties (client et prestataire)
    // rejoignent le MÊME canal. On trie les user IDs pour garantir l'unicité.
    let (user_a, user_b) = if prestataire_id <= user_id {
        (prestataire_id, user_id)
    } else {
        (user_id, prestataire_id)
    };
    let conversation_id = format!("{}_{}_{}", service_id, user_a, user_b);

    log::info!(
        "🔌 [ChatWS] Connexion WebSocket chat - Conversation: {}, User: {}, Prestataire: {}",
        conversation_id,
        user_id,
        prestataire_id
    );

    record_chat_ws_connection_open();

    // Obtenir le manager de chat WebSocket depuis AppState
    let chat_manager = if let Some(manager) = &state.chat_ws_manager {
        manager.clone()
    } else {
        log::warn!("[ChatWS] ChatWebSocketManager non initialisé, création temporaire");
        Arc::new(ChatWebSocketManager::new(
            64,
            Some(state.redis_client.clone()),
        ))
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

    // Cloner les valeurs nécessaires pour la tâche de réception
    let chat_manager_recv = chat_manager.clone();
    let conversation_id_recv = conversation_id.clone();
    let state_recv = state.clone();

    // Tâche de réception des messages du client
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    if let Ok(ws_msg) = serde_json::from_str::<serde_json::Value>(&text) {
                        if let Some(msg_type) = ws_msg.get("type").and_then(|t| t.as_str()) {
                            match msg_type {
                                "ping" => {
                                    log::debug!("[ChatWS] Ping reçu de user {}", user_id);
                                }
                                "auth" => {
                                    log::debug!("[ChatWS] Auth reçu de user {}", user_id);
                                }
                                "message" => {
                                    // ✅ NOUVEAU: Relayer le message au destinataire via broadcast
                                    let content = ws_msg
                                        .get("content")
                                        .and_then(|c| c.as_str())
                                        .unwrap_or("")
                                        .to_string();
                                    let message_type = ws_msg
                                        .get("messageType")
                                        .and_then(|t| t.as_str())
                                        .unwrap_or("text")
                                        .to_string();
                                    let msg_id = ws_msg
                                        .get("id")
                                        .and_then(|i| i.as_str())
                                        .unwrap_or("")
                                        .to_string();
                                    let to_user = ws_msg
                                        .get("to")
                                        .and_then(|t| t.as_i64())
                                        .unwrap_or(prestataire_id as i64)
                                        as i32;

                                    log::info!(
                                        "📨 [ChatWS] Message de user {} vers user {} dans conversation {}: {}",
                                        user_id, to_user, conversation_id_recv, &content.chars().take(50).collect::<String>()
                                    );

                                    // Broadcast le message à tous les abonnés de cette conversation
                                    let broadcast_msg = ChatWsMessage {
                                        message_type: "message".to_string(),
                                        conversation_id: conversation_id_recv.clone(),
                                        user_id,
                                        data: serde_json::json!({
                                            "type": "message",
                                            "id": msg_id,
                                            "content": content,
                                            "messageType": message_type,
                                            "from": user_id,
                                            "to": to_user,
                                            "serviceId": service_id,
                                            "timestamp": Utc::now().to_rfc3339(),
                                            "status": "delivered",
                                            "audioUrl": ws_msg.get("audioUrl"),
                                            "imageUrl": ws_msg.get("imageUrl"),
                                            "fileUrl": ws_msg.get("fileUrl"),
                                            "mentioned_users": ws_msg.get("mentioned_users"),
                                            "reply_to_id": ws_msg.get("reply_to_id")
                                        }),
                                        timestamp: Utc::now(),
                                        instance_id: None,
                                    };

                                    chat_manager_recv
                                        .broadcast_message(&conversation_id_recv, broadcast_msg)
                                        .await;

                                    // ✅ NOUVEAU: Sauvegarder le message en base de données
                                    let db_msg_id = if msg_id.is_empty() {
                                        format!("msg_{}", Utc::now().timestamp_millis())
                                    } else {
                                        msg_id.clone()
                                    };

                                    // Créer ou récupérer la conversation en DB
                                    let db_conv_id =
                                        format!("ws_conv_{}_{}", service_id, conversation_id_recv);
                                    let _ = sqlx::query(
                                        r#"INSERT INTO conversations (id, client_id, prestataire_id, service_id, service_title, status, is_active)
                                           VALUES ($1, $2, $3, $4, 'Conversation directe', 'active', true)
                                           ON CONFLICT (id) DO UPDATE SET last_message_at = NOW()"#
                                    )
                                    .bind(&db_conv_id)
                                    .bind(user_id.min(to_user))
                                    .bind(user_id.max(to_user))
                                    .bind(service_id)
                                    .execute(&state_recv.pg)
                                    .await;

                                    // Sauvegarder le message
                                    let _ = sqlx::query(
                                        r#"INSERT INTO chat_messages (id, conversation_id, from_user_id, content, message_type)
                                           VALUES ($1, $2, $3, $4, $5)
                                           ON CONFLICT (id) DO NOTHING"#
                                    )
                                    .bind(&db_msg_id)
                                    .bind(&db_conv_id)
                                    .bind(user_id)
                                    .bind(&content)
                                    .bind(&message_type)
                                    .execute(&state_recv.pg)
                                    .await;

                                    // Note: Le trigger PostgreSQL 'increment_unread_count' s'occupe
                                    // automatiquement d'incrémenter chat_unread_counts à l'insertion du message

                                    // ✅ NOUVEAU: Envoyer une push notification au destinataire
                                    let push_title = format!("💬 Nouveau message");
                                    let push_body = if content.is_empty() {
                                        match message_type.as_str() {
                                            "image" => "📷 Image".to_string(),
                                            "audio" => "🎤 Message vocal".to_string(),
                                            "file" => "📎 Document".to_string(),
                                            _ => "Nouveau message".to_string(),
                                        }
                                    } else if content.len() > 100 {
                                        format!("{}...", &content[..100])
                                    } else {
                                        content.clone()
                                    };

                                    let _ = crate::services::push_notification_service::send_push_notification(
                                        &state_recv.pg,
                                        to_user,
                                        push_title,
                                        push_body,
                                        Some(serde_json::json!({
                                            "type": "new_message",
                                            "service_id": service_id,
                                            "sender_id": user_id,
                                            "conversation_id": db_conv_id,
                                        })),
                                        Some("message_notification.mp3".to_string()),
                                    )
                                    .await;

                                    // ✅ NOUVEAU: Créer une notification en base de données
                                    let _ = crate::services::notification_service::create_notification(
                                        &state_recv.pg,
                                        to_user,
                                        crate::services::notification_service::NotificationType::NewMessage,
                                        format!("💬 Nouveau message"),
                                        format!("Vous avez reçu un nouveau message"),
                                        Some(serde_json::json!({
                                            "service_id": service_id,
                                            "sender_id": user_id,
                                            "conversation_id": db_conv_id,
                                            "message_preview": content.chars().take(100).collect::<String>()
                                        })),
                                    )
                                    .await;

                                    log::info!(
                                        "[ChatWS] ✅ Message sauvegardé et notification envoyée"
                                    );
                                }
                                "typing" => {
                                    // ✅ NOUVEAU: Relayer l'indicateur de frappe
                                    let is_typing = ws_msg
                                        .get("isTyping")
                                        .and_then(|t| t.as_bool())
                                        .unwrap_or(true);
                                    let typing_msg = ChatWsMessage {
                                        message_type: "typing".to_string(),
                                        conversation_id: conversation_id_recv.clone(),
                                        user_id,
                                        data: serde_json::json!({
                                            "type": "typing",
                                            "isTyping": is_typing,
                                            "from": user_id
                                        }),
                                        timestamp: Utc::now(),
                                        instance_id: None,
                                    };
                                    chat_manager_recv
                                        .broadcast_message(&conversation_id_recv, typing_msg)
                                        .await;
                                }
                                "mark_read" => {
                                    // ✅ NOUVEAU: Relayer la confirmation de lecture
                                    let read_msg = ChatWsMessage {
                                        message_type: "message_read".to_string(),
                                        conversation_id: conversation_id_recv.clone(),
                                        user_id,
                                        data: serde_json::json!({
                                            "type": "message_read",
                                            "from": user_id
                                        }),
                                        timestamp: Utc::now(),
                                        instance_id: None,
                                    };
                                    chat_manager_recv
                                        .broadcast_message(&conversation_id_recv, read_msg)
                                        .await;
                                }
                                "edit_message" => {
                                    // ✅ NOUVEAU: Relayer l'édition de message
                                    let message_id = ws_msg
                                        .get("messageId")
                                        .and_then(|i| i.as_str())
                                        .unwrap_or("")
                                        .to_string();
                                    let new_content = ws_msg
                                        .get("newContent")
                                        .and_then(|c| c.as_str())
                                        .unwrap_or("")
                                        .to_string();
                                    let edit_msg = ChatWsMessage {
                                        message_type: "message_edited".to_string(),
                                        conversation_id: conversation_id_recv.clone(),
                                        user_id,
                                        data: serde_json::json!({
                                            "type": "message_edited",
                                            "messageId": message_id,
                                            "newContent": new_content,
                                            "from": user_id
                                        }),
                                        timestamp: Utc::now(),
                                        instance_id: None,
                                    };
                                    chat_manager_recv
                                        .broadcast_message(&conversation_id_recv, edit_msg)
                                        .await;
                                }
                                "delete_message" => {
                                    // ✅ NOUVEAU: Relayer la suppression de message
                                    let message_id = ws_msg
                                        .get("messageId")
                                        .and_then(|i| i.as_str())
                                        .unwrap_or("")
                                        .to_string();
                                    let delete_msg = ChatWsMessage {
                                        message_type: "message_deleted".to_string(),
                                        conversation_id: conversation_id_recv.clone(),
                                        user_id,
                                        data: serde_json::json!({
                                            "type": "message_deleted",
                                            "messageId": message_id,
                                            "from": user_id
                                        }),
                                        timestamp: Utc::now(),
                                        instance_id: None,
                                    };
                                    chat_manager_recv
                                        .broadcast_message(&conversation_id_recv, delete_msg)
                                        .await;
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
