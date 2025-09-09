use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, State, Path},
    response::IntoResponse,
    routing::get,
    Router,
};
use std::sync::Arc;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use futures::{StreamExt, SinkExt};
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSocketMessage {
    pub message_type: String,
    pub user_id: i32,
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusMessage {
    pub message_type: String,
    pub user_id: i32,
    pub is_online: bool,
    pub timestamp: DateTime<Utc>,
}

pub fn create_websocket_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/ws/status/{user_id}", get(websocket_status_handler_adapted))
        .route("/ws/notifications/{user_id}", get(websocket_notifications_handler_adapted))
}

// Handlers adaptés pour AppState
async fn websocket_status_handler_adapted(
    ws: WebSocketUpgrade,
    Path(user_id): Path<i32>,
    State(_app_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_status_websocket(socket, user_id))
}

async fn websocket_notifications_handler_adapted(
    ws: WebSocketUpgrade,
    Path(user_id): Path<i32>,
    State(_app_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_notifications_websocket(socket, user_id))
}

async fn handle_status_websocket(
    socket: WebSocket,
    user_id: i32,
) {
    let (mut sender, mut receiver) = socket.split();
    
    log::info!("WebSocket status ouvert pour l'utilisateur {}", user_id);
    
    // Tâche de réception des messages du client
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    if let Ok(ws_msg) = serde_json::from_str::<WebSocketMessage>(&text) {
                        match ws_msg.message_type.as_str() {
                            "ping" => {
                                log::debug!("Ping reçu de l'utilisateur {}", user_id);
                            }
                            "status_request" => {
                                log::debug!("Demande de statut de l'utilisateur {}", user_id);
                            }
                            _ => {
                                log::warn!("Type de message inconnu: {}", ws_msg.message_type);
                            }
                        }
                    }
                }
                Message::Close(_) => {
                    log::info!("WebSocket fermé par le client pour l'utilisateur {}", user_id);
                    break;
                }
                _ => {}
            }
        }
    });
    
    // Tâche d'envoi de ping périodique pour maintenir la connexion
    let mut ping_task = tokio::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
            
            let ping = serde_json::json!({
                "message_type": "ping",
                "timestamp": Utc::now()
            });
            
            if let Err(e) = sender.send(Message::Text(ping.to_string().into())).await {
                log::error!("Erreur envoi ping: {}", e);
                break;
            }
        }
    });
    
    // Attendre que l'une des tâches se termine
    tokio::select! {
        _ = (&mut recv_task) => log::info!("Tâche réception terminée"),
        _ = (&mut ping_task) => log::info!("Tâche ping terminée"),
    }
    
    log::info!("WebSocket fermé pour l'utilisateur {}", user_id);
}

async fn handle_notifications_websocket(
    socket: WebSocket,
    user_id: i32,
) {
    let (mut sender, mut receiver) = socket.split();
    
    log::info!("WebSocket notifications ouvert pour l'utilisateur {}", user_id);
    
    // Tâche de réception des messages du client
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    if let Ok(ws_msg) = serde_json::from_str::<WebSocketMessage>(&text) {
                        match ws_msg.message_type.as_str() {
                            "ping" => {
                                log::debug!("Ping reçu de l'utilisateur {} (notifications)", user_id);
                            }
                            _ => {
                                log::warn!("Type de message notification inconnu: {}", ws_msg.message_type);
                            }
                        }
                    }
                }
                Message::Close(_) => {
                    log::info!("WebSocket notifications fermé par le client pour l'utilisateur {}", user_id);
                    break;
                }
                _ => {}
            }
        }
    });
    
    // Tâche d'envoi de notifications simulées
    let mut notification_task = tokio::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
            
            let notification = serde_json::json!({
                "message_type": "notification",
                "user_id": user_id,
                "data": {
                    "type": "info",
                    "message": "Nouvelle notification disponible"
                },
                "timestamp": Utc::now()
            });
            
            if let Err(e) = sender.send(Message::Text(notification.to_string().into())).await {
                log::error!("Erreur envoi notification: {}", e);
                break;
            }
        }
    });
    
    // Attendre que l'une des tâches se termine
    tokio::select! {
        _ = (&mut recv_task) => log::info!("Tâche réception notifications terminée"),
        _ = (&mut notification_task) => log::info!("Tâche notifications terminée"),
    }
    
    log::info!("WebSocket notifications fermé pour l'utilisateur {}", user_id);
} 