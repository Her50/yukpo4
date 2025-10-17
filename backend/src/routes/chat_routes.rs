// Routes pour le chat et messagerie
use std::sync::Arc;
use axum::{
    routing::post,
    Router,
    extract::State,
    response::Json,
    Extension,
    http::StatusCode,
};
use serde::Deserialize;
use serde_json::{json, Value};
use crate::{
    state::AppState,
    middlewares::jwt::{jwt_auth, AuthenticatedUser},
    services::{notification_service, push_notification_service},
};

#[derive(Debug, Deserialize)]
pub struct NotifyMessageRequest {
    pub recipient_id: i32,
    pub sender_id: i32,
    pub sender_name: String,
    pub message_preview: String,
    pub service_id: i32,
    pub service_title: String,
}

/// Notifier un utilisateur d'un nouveau message
pub async fn notify_new_message(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Json(payload): Json<NotifyMessageRequest>,
) -> Result<Json<Value>, StatusCode> {
    log::info!("[ChatController] 💬 Notification message: {} → {}", 
        payload.sender_id, payload.recipient_id);
    
    // 1. Créer une notification en base de données
    let notification_data = json!({
        "service_id": payload.service_id,
        "service_title": payload.service_title,
        "sender_id": payload.sender_id,
        "sender_name": payload.sender_name,
        "message_preview": payload.message_preview
    });
    
    if let Err(e) = notification_service::create_notification(
        &state.pg,
        payload.recipient_id,
        notification_service::NotificationType::NewMessage,
        format!("💬 Message de {}", payload.sender_name),
        format!("Au sujet de: {}\n\n\"{}\"", payload.service_title, payload.message_preview),
        Some(notification_data.clone()),
    ).await {
        log::error!("[ChatController] ❌ Erreur création notification: {}", e);
    }
    
    // 2. Envoyer une push notification
    let push_title = format!("💬 {}", payload.sender_name);
    let push_body = if payload.message_preview.len() > 100 {
        format!("{}...", &payload.message_preview[..100])
    } else {
        payload.message_preview.clone()
    };
    
    match push_notification_service::send_push_notification(
        &state.pg,
        payload.recipient_id,
        push_title,
        push_body,
        Some(json!({
            "type": "new_message",
            "service_id": payload.service_id,
            "sender_id": payload.sender_id,
            "sender_name": payload.sender_name,
        })),
        Some("message_notification.mp3".to_string()),
    ).await {
        Ok(count) => {
            log::info!("[ChatController] ✅ {} push notifications envoyées", count);
            Ok(Json(json!({
                "success": true,
                "notifications_sent": count
            })))
        }
        Err(e) => {
            log::error!("[ChatController] ❌ Erreur push notification: {}", e);
            // Ne pas bloquer le message
            Ok(Json(json!({
                "success": false,
                "error": "Push notification échouée mais message envoyé"
            })))
        }
    }
}

pub fn chat_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::<Arc<AppState>>::new()
        // Notifier un nouveau message
        .route("/api/chat/notify-message", post(notify_new_message))
        
        // Appliquer l'authentification
        .layer(axum::middleware::from_fn_with_state(state.clone(), jwt_auth))
        .with_state(state)
}

