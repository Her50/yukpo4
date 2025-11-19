// Contrôleur pour les appels WebRTC
use crate::{services::push_notification_service, state::AppState};
use axum::{extract::State, http::StatusCode, response::Json};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct NotifyCallRequest {
    pub recipient_id: i32,
    pub caller_id: i32,
    pub caller_name: String,
    pub call_type: String, // 'audio' ou 'video'
    pub service_id: Option<i32>,
}

/// Notifier un utilisateur d'un appel entrant
pub async fn notify_incoming_call(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<NotifyCallRequest>,
) -> Result<Json<Value>, StatusCode> {
    log::info!(
        "[WebRTCController] 📞 Notification d'appel: {} appelle {}",
        payload.caller_id,
        payload.recipient_id
    );

    // Envoyer la push notification
    match push_notification_service::send_call_notification(
        &state.pg,
        payload.recipient_id,
        payload.caller_name,
        payload.call_type.clone(),
        payload.service_id,
    )
    .await
    {
        Ok(count) => {
            log::info!(
                "[WebRTCController] ✅ {} push notifications envoyées",
                count
            );
            
            // Incrémenter métriques WebRTC
            crate::metrics::CHAT_METRICS
                .webrtc_calls_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            
            Ok(Json(json!({
                "success": true,
                "notifications_sent": count,
                "message": "Notification d'appel envoyée"
            })))
        }
        Err(e) => {
            log::error!("[WebRTCController] ❌ Erreur envoi notification: {}", e);
            // Ne pas bloquer l'appel si la notification échoue
            Ok(Json(json!({
                "success": false,
                "error": "Notification non envoyée mais appel peut continuer"
            })))
        }
    }
}
