use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use futures::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use serde_json;
use crate::models::webrtc_model::{SignalingMessage, SignalingError, PeerState};
use crate::state::AppState;

/// Manager de connexions WebRTC
/// Maintient l'état de toutes les connexions actives et route les messages
pub struct WebRTCSignalingManager {
    /// Connexions actives: user_id -> sender channel
    connections: Arc<RwLock<HashMap<String, mpsc::UnboundedSender<Message>>>>,
    
    /// État des pairs
    peers: Arc<RwLock<HashMap<String, PeerState>>>,
}

impl WebRTCSignalingManager {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
            peers: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Enregistre une nouvelle connexion
    async fn register_connection(&self, user_id: String, tx: mpsc::UnboundedSender<Message>) {
        let mut connections = self.connections.write().await;
        connections.insert(user_id.clone(), tx);
        
        // Mettre à jour l'état du pair
        let mut peers = self.peers.write().await;
        peers.insert(user_id.clone(), PeerState {
            user_id: user_id.clone(),
            is_online: true,
            is_in_call: false,
            current_call_id: None,
            last_activity: chrono::Utc::now(),
        });
        
        log::info!("🌐 WebRTC: Connexion enregistrée pour l'utilisateur {}", user_id);
    }
    
    /// Désenregistre une connexion
    async fn unregister_connection(&self, user_id: &str) {
        let mut connections = self.connections.write().await;
        connections.remove(user_id);
        
        // Mettre à jour l'état du pair
        let mut peers = self.peers.write().await;
        if let Some(peer) = peers.get_mut(user_id) {
            peer.is_online = false;
            peer.is_in_call = false;
            peer.current_call_id = None;
        }
        
        log::info!("🌐 WebRTC: Connexion fermée pour l'utilisateur {}", user_id);
    }
    
    /// Route un message vers le destinataire
    async fn route_message(&self, msg: SignalingMessage) -> Result<(), String> {
        let connections = self.connections.read().await;
        
        if let Some(tx) = connections.get(&msg.to) {
            let json_msg = serde_json::to_string(&msg)
                .map_err(|e| format!("Erreur sérialisation: {}", e))?;
            
            tx.send(Message::Text(json_msg.into()))
                .map_err(|e| format!("Erreur envoi message: {}", e))?;
            
            log::debug!("📨 WebRTC: Message routé de {} vers {} (type: {:?})", 
                msg.from, msg.to, msg.message_type);
            
            Ok(())
        } else {
            let err_msg = format!("Destinataire {} non connecté", msg.to);
            log::warn!("⚠️ WebRTC: {}", err_msg);
            Err(err_msg)
        }
    }
    
    /// Obtient l'état d'un pair
    async fn get_peer_state(&self, user_id: &str) -> Option<PeerState> {
        let peers = self.peers.read().await;
        peers.get(user_id).cloned()
    }
}

/// Handler WebSocket pour le signaling WebRTC
pub async fn webrtc_signaling_handler(
    ws: WebSocketUpgrade,
    State(_app_state): State<Arc<AppState>>,
    axum::extract::Extension(manager): axum::extract::Extension<Arc<WebRTCSignalingManager>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_webrtc_socket(socket, manager))
}

/// Gère une connexion WebSocket WebRTC
async fn handle_webrtc_socket(
    socket: WebSocket,
    manager: Arc<WebRTCSignalingManager>,
) {
    let (mut sender, mut receiver) = socket.split();
    
    // Canal pour envoyer des messages au client
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();
    
    // Variable pour stocker l'user_id une fois authentifié
    let user_id = Arc::new(RwLock::new(None::<String>));
    let user_id_clone = user_id.clone();
    
    // Tâche d'envoi des messages
    let mut send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(msg).await.is_err() {
                break;
            }
        }
    });
    
    // Tâche de réception des messages
    let user_id_recv = user_id.clone();
    let manager_recv = manager.clone();
    let tx_recv = tx.clone();
    
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    // Parser le message
                    match serde_json::from_str::<SignalingMessage>(&text) {
                        Ok(signaling_msg) => {
                            // Premier message: enregistrer la connexion
                            let mut uid = user_id_recv.write().await;
                            if uid.is_none() {
                                *uid = Some(signaling_msg.from.clone());
                                drop(uid);
                                manager_recv.register_connection(
                                    signaling_msg.from.clone(),
                                    tx_recv.clone()
                                ).await;
                            }
                            
                            // Router le message
                            if let Err(e) = manager_recv.route_message(signaling_msg.clone()).await {
                                let error = SignalingError::new("routing_error", e);
                                if let Ok(error_json) = serde_json::to_string(&error) {
                                    let _ = tx_recv.send(Message::Text(error_json.into()));
                                }
                            }
                        }
                        Err(e) => {
                            log::warn!("⚠️ WebRTC: Message invalide: {}", e);
                            let error = SignalingError::new(
                                "invalid_message",
                                format!("Format de message invalide: {}", e)
                            );
                            if let Ok(error_json) = serde_json::to_string(&error) {
                                let _ = tx_recv.send(Message::Text(error_json.into()));
                            }
                        }
                    }
                }
                Message::Close(_) => {
                    log::info!("🔌 WebRTC: Connexion fermée par le client");
                    break;
                }
                Message::Ping(_) => {
                    // Les pings sont automatiquement gérés par Axum
                }
                _ => {}
            }
        }
        
        // Désenregistrer la connexion
        if let Some(uid) = user_id_recv.read().await.as_ref() {
            manager_recv.unregister_connection(uid).await;
        }
    });
    
    // Attendre que l'une des tâches se termine
    tokio::select! {
        _ = (&mut send_task) => {
            recv_task.abort();
        }
        _ = (&mut recv_task) => {
            send_task.abort();
        }
    }
    
    // Cleanup final
    let uid_option = user_id_clone.read().await.clone();
    if let Some(uid) = uid_option {
        manager.unregister_connection(&uid).await;
        log::info!("✅ WebRTC: Connexion nettoyée pour l'utilisateur {}", uid);
    }
}

/// Crée le router WebRTC avec le manager partagé
pub fn create_webrtc_router(manager: Arc<WebRTCSignalingManager>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/ws/webrtc", get(webrtc_signaling_handler))
        .layer(axum::Extension(manager))
}

/// Crée une instance du manager WebRTC pour être partagée
pub fn create_webrtc_manager() -> Arc<WebRTCSignalingManager> {
    Arc::new(WebRTCSignalingManager::new())
}

