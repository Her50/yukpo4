// ✅ NOUVEAU: Routes API pour le chat de livraison
// Permet de récupérer l'historique des messages et d'envoyer des messages via REST

use crate::{
    middlewares::jwt::{jwt_auth, AuthenticatedUser},
    state::AppState,
    websocket::delivery_chat::{DeliveryChatMessage, DeliveryChatWebSocketManager},
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Extension, Router,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct DeliveryChatMessageResponse {
    pub id: i32,
    pub delivery_id: Uuid,
    pub sender_id: i32,
    pub sender_name: String,
    pub sender_role: String,
    pub content: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct SendDeliveryChatMessageRequest {
    pub content: String,
    pub sender_name: String,
    pub sender_role: String, // "client", "courier", "provider"
    #[serde(default)]
    pub metadata: Option<Value>,
}

pub fn delivery_chat_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/api/delivery/{delivery_id}/chat/messages",
            get(get_delivery_chat_messages)
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    jwt_auth,
                )),
        )
        .route(
            "/api/delivery/{delivery_id}/chat/send",
            post(send_delivery_chat_message)
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    jwt_auth,
                )),
        )
        .with_state(state)
}

/// GET /api/delivery/{delivery_id}/chat/messages
/// Récupère l'historique des messages de chat pour une livraison
async fn get_delivery_chat_messages(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<String>,
) -> Result<Json<Vec<DeliveryChatMessageResponse>>, StatusCode> {
    let delivery_uuid = match Uuid::parse_str(&delivery_id) {
        Ok(uuid) => uuid,
        Err(_) => {
            log::warn!("[DeliveryChatAPI] ID de livraison invalide: {}", delivery_id);
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    log::info!(
        "[DeliveryChatAPI] 📨 Récupération messages - Delivery: {}, User: {}",
        delivery_uuid,
        user.id
    );

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
    .bind(delivery_uuid)
    .bind(user.id)
    .fetch_one(&state.pg)
    .await;

    match has_access {
        Ok(true) => {
            log::info!(
                "[DeliveryChatAPI] ✅ Accès autorisé pour user {} sur delivery {}",
                user.id,
                delivery_uuid
            );
        }
        Ok(false) => {
            log::warn!(
                "[DeliveryChatAPI] ❌ Accès refusé pour user {} sur delivery {}",
                user.id,
                delivery_uuid
            );
            return Err(StatusCode::FORBIDDEN);
        }
        Err(e) => {
            log::error!("[DeliveryChatAPI] ❌ Erreur vérification accès: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    }

    // Récupérer les messages depuis la base de données
    let rows = sqlx::query(
        r#"
        SELECT 
            id,
            delivery_id,
            sender_id,
            sender_name,
            sender_role,
            content,
            metadata,
            created_at
        FROM delivery_chat_messages
        WHERE delivery_id = $1
        ORDER BY created_at ASC
        LIMIT 500
        "#,
    )
    .bind(delivery_uuid)
    .fetch_all(&state.pg)
    .await;

    match rows {
        Ok(rows) => {
            let messages: Vec<DeliveryChatMessageResponse> = rows
                .into_iter()
                .map(|row| DeliveryChatMessageResponse {
                    id: row.get("id"),
                    delivery_id: row.get("delivery_id"),
                    sender_id: row.get("sender_id"),
                    sender_name: row.get("sender_name"),
                    sender_role: row.get("sender_role"),
                    content: row.get("content"),
                    created_at: row.get("created_at"),
                    metadata: row.get("metadata"),
                })
                .collect();

            log::info!(
                "[DeliveryChatAPI] ✅ {} messages récupérés pour delivery {}",
                messages.len(),
                delivery_uuid
            );

            Ok(Json(messages))
        }
        Err(e) => {
            log::error!("[DeliveryChatAPI] ❌ Erreur récupération messages: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// POST /api/delivery/{delivery_id}/chat/send
/// Envoie un message de chat pour une livraison
async fn send_delivery_chat_message(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<String>,
    Json(payload): Json<SendDeliveryChatMessageRequest>,
) -> Result<Json<Value>, StatusCode> {
    let delivery_uuid = match Uuid::parse_str(&delivery_id) {
        Ok(uuid) => uuid,
        Err(_) => {
            log::warn!("[DeliveryChatAPI] ID de livraison invalide: {}", delivery_id);
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    log::info!(
        "[DeliveryChatAPI] 💬 Envoi message - Delivery: {}, User: {}",
        delivery_uuid,
        user.id
    );

    // Validation
    if payload.content.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    if !["client", "courier", "provider"].contains(&payload.sender_role.as_str()) {
        return Err(StatusCode::BAD_REQUEST);
    }

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
    .bind(delivery_uuid)
    .bind(user.id)
    .fetch_one(&state.pg)
    .await;

    match has_access {
        Ok(true) => {}
        Ok(false) => {
            log::warn!(
                "[DeliveryChatAPI] ❌ Accès refusé pour user {} sur delivery {}",
                user.id,
                delivery_uuid
            );
            return Err(StatusCode::FORBIDDEN);
        }
        Err(e) => {
            log::error!("[DeliveryChatAPI] ❌ Erreur vérification accès: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    }

    // Sauvegarder le message en base de données
    let message_id = sqlx::query_scalar::<_, i32>(
        r#"
        INSERT INTO delivery_chat_messages 
        (delivery_id, sender_id, sender_name, sender_role, content, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id
        "#,
    )
    .bind(delivery_uuid)
    .bind(user.id)
    .bind(&payload.sender_name)
    .bind(&payload.sender_role)
    .bind(&payload.content)
    .bind(&payload.metadata)
    .fetch_one(&state.pg)
    .await;

    match message_id {
        Ok(id) => {
            // Créer le message WebSocket
            let chat_message = DeliveryChatMessage {
                message_type: "message".to_string(),
                delivery_id: delivery_uuid,
                sender_id: user.id,
                sender_name: payload.sender_name.clone(),
                sender_role: payload.sender_role.clone(),
                content: payload.content.clone(),
                timestamp: Utc::now(),
                metadata: payload.metadata.clone(),
            };

            // Diffuser le message via WebSocket
            if let Some(manager) = &state.delivery_chat_ws_manager {
                manager
                    .broadcast_message(delivery_uuid, chat_message)
                    .await;
            } else {
                log::warn!("[DeliveryChatAPI] ⚠️ DeliveryChatWebSocketManager non initialisé");
            }

            log::info!(
                "[DeliveryChatAPI] ✅ Message {} envoyé pour delivery {}",
                id,
                delivery_uuid
            );

            Ok(Json(json!({
                "success": true,
                "message_id": id,
                "delivery_id": delivery_uuid
            })))
        }
        Err(e) => {
            log::error!("[DeliveryChatAPI] ❌ Erreur sauvegarde message: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}


