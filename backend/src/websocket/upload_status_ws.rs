// ✅ NOUVEAU 2025-01-27 : WebSocket pour feedback en temps réel des uploads asynchrones

use crate::services::async_upload_service::UploadStatus;
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
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::broadcast;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadStatusMessage {
    pub upload_id: String,
    pub status: String, // JSON string de UploadStatus
    pub progress: Option<u8>,
    pub file_path: Option<String>,
    pub error: Option<String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// Ajoute les routes WebSocket pour upload status
pub fn add_upload_status_websocket_routes(router: Router<Arc<AppState>>) -> Router<Arc<AppState>> {
    router.route(
        "/ws/upload/{upload_id}",
        get(upload_status_websocket_handler),
    )
}

/// Handler WebSocket pour le statut d'upload
async fn upload_status_websocket_handler(
    ws: WebSocketUpgrade,
    Path(upload_id): Path<String>,
    State(app_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_upload_status_websocket(socket, upload_id, app_state))
}

async fn handle_upload_status_websocket(
    socket: WebSocket,
    upload_id: String,
    app_state: Arc<AppState>,
) {
    let (mut sender, mut receiver) = socket.split();

    log::info!(
        "[UploadStatusWS] WebSocket ouvert pour upload_id={}",
        upload_id
    );

    // ✅ S'abonner au channel broadcast depuis AsyncUploadService
    use crate::services::async_upload_service::AsyncUploadService;
    use std::env;
    let storage_root = env::var("UPLOAD_STORAGE_PATH").unwrap_or_else(|_| "./uploads".to_string());

    // Créer un service avec le pool depuis AppState
    let upload_service = AsyncUploadService::new(app_state.pg.clone(), storage_root);

    let mut status_rx = upload_service.subscribe();
    let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(500));

    // Tâche de réception des messages du client
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    if let Ok(ping) = serde_json::from_str::<serde_json::Value>(&text) {
                        if ping.get("type").and_then(|v| v.as_str()) == Some("ping") {
                            log::debug!("[UploadStatusWS] Ping reçu pour upload_id={}", upload_id);
                        }
                    }
                }
                Message::Close(_) => {
                    log::info!(
                        "[UploadStatusWS] WebSocket fermé par le client pour upload_id={}",
                        upload_id
                    );
                    break;
                }
                _ => {}
            }
        }
    });

    // Tâche d'envoi de statut depuis broadcast
    let mut status_task = tokio::spawn(async move {
        loop {
            tokio::select! {
                // Recevoir depuis le broadcast
                Ok((id, status)) = status_rx.recv() => {
                    if id == upload_id {
                        let status_msg = UploadStatusMessage {
                            upload_id: id.clone(),
                            status: serde_json::to_string(&status).unwrap_or_default(),
                            progress: match &status {
                                UploadStatus::Uploading { progress } => Some(*progress),
                                _ => None,
                            },
                            file_path: match &status {
                                UploadStatus::Completed { file_path } => Some(file_path.clone()),
                                _ => None,
                            },
                            error: match &status {
                                UploadStatus::Failed { error } => Some(error.clone()),
                                _ => None,
                            },
                            timestamp: chrono::Utc::now(),
                        };

                        let json_msg = serde_json::to_string(&status_msg).unwrap_or_default();

                        if let Err(e) = sender.send(Message::Text(json_msg.into())).await {
                            log::error!("[UploadStatusWS] Erreur envoi statut: {}", e);
                            break;
                        }

                        // Si terminé (succès ou échec), fermer la connexion
                        if matches!(status, UploadStatus::Completed { .. } | UploadStatus::Failed { .. }) {
                            log::info!("[UploadStatusWS] Upload terminé, fermeture WebSocket pour upload_id={}", upload_id);
                            break;
                        }
                    }
                }
                // Timeout pour ping
                _ = interval.tick() => {
                    // Envoyer un ping pour maintenir la connexion
                    let ping = serde_json::json!({
                        "type": "ping",
                        "upload_id": upload_id,
                        "timestamp": chrono::Utc::now()
                    });
                    if let Err(e) = sender.send(Message::Text(ping.to_string().into())).await {
                        log::error!("[UploadStatusWS] Erreur envoi ping: {}", e);
                        break;
                    }
                }
            }
        }
    });

    // Attendre que l'une des tâches se termine
    tokio::select! {
        _ = (&mut recv_task) => log::info!("[UploadStatusWS] Tâche réception terminée"),
        _ = (&mut status_task) => log::info!("[UploadStatusWS] Tâche statut terminée"),
    }

    log::info!(
        "[UploadStatusWS] WebSocket fermé pour upload_id={}",
        upload_id
    );
}
