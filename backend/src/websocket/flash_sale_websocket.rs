// ✅ WebSocket pour mises à jour temps réel des Flash Sales
// Permet aux clients de recevoir les mises à jour de stock en temps réel

use crate::state::AppState;
use crate::utils::redis_helper;
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
use redis::Client as RedisClient;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlashSaleStockUpdate {
    pub flash_sale_id: Uuid,
    pub available_stock: i32,
    pub reserved_quantity: i64,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

pub fn create_flash_sale_websocket_router() -> Router<Arc<AppState>> {
    Router::new().route(
        "/ws/flash-sales/{flash_sale_id}/stock",
        get(flash_sale_stock_websocket_handler),
    )
}

async fn flash_sale_stock_websocket_handler(
    ws: WebSocketUpgrade,
    Path(flash_sale_id): Path<Uuid>,
    State(app_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_flash_sale_stock_websocket(socket, flash_sale_id, app_state))
}

async fn handle_flash_sale_stock_websocket(
    socket: WebSocket,
    flash_sale_id: Uuid,
    app_state: Arc<AppState>,
) {
    let (mut sender, mut receiver) = socket.split();

    log::info!(
        "WebSocket flash sale stock ouvert pour flash_sale_id: {}",
        flash_sale_id
    );

    // Canal Redis pour écouter les mises à jour
    let channel = format!("flash_sale:{}:stock", flash_sale_id);

    // Tâche de réception des messages du client
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    if let Ok(ws_msg) = serde_json::from_str::<serde_json::Value>(&text) {
                        if ws_msg.get("type")
                            == Some(&serde_json::Value::String("ping".to_string()))
                        {
                            log::debug!("Ping reçu pour flash_sale {}", flash_sale_id);
                        }
                    }
                }
                Message::Close(_) => {
                    log::info!("WebSocket fermé pour flash_sale {}", flash_sale_id);
                    break;
                }
                _ => {}
            }
        }
    });

    // Tâche d'écoute Redis pub/sub
    let redis_client = app_state.redis_client.clone();
    let pubsub_task = tokio::spawn(async move {
        // Créer une connexion pubsub dédiée (même approche que chat_websocket)
        #[allow(deprecated)]
        let mut pubsub = match redis_client.get_async_connection().await {
            Ok(conn) => conn.into_pubsub(),
            Err(e) => {
                log::warn!("⚠️ Impossible de créer connexion Redis: {:?}", e);
                return;
            }
        };

        if let Err(e) = pubsub.subscribe(&channel).await {
            log::warn!("⚠️ Impossible de s'abonner au canal {}: {:?}", channel, e);
            return;
        }

        log::info!("✅ Abonné au canal Redis: {}", channel);

        // Écouter les messages
        let mut stream = pubsub.into_on_message();
        while let Some(msg) = stream.next().await {
            let payload: String = match msg.get_payload() {
                Ok(p) => p,
                Err(e) => {
                    log::warn!("⚠️ Erreur lecture payload Redis: {:?}", e);
                    continue;
                }
            };

            // Envoyer la mise à jour au client WebSocket
            if sender.send(Message::Text(payload.into())).await.is_err() {
                log::info!(
                    "Client WebSocket déconnecté pour flash_sale {}",
                    flash_sale_id
                );
                break;
            }
        }
    });

    // Attendre que l'une des tâches se termine
    tokio::select! {
        _ = recv_task => {
            log::info!("Tâche réception terminée pour flash_sale {}", flash_sale_id);
        }
        _ = pubsub_task => {
            log::info!("Tâche pubsub terminée pour flash_sale {}", flash_sale_id);
        }
    }
}
