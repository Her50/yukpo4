// ✅ Routes WhatsApp Business API
// Webhooks et endpoints pour la gestion WhatsApp

use crate::core::types::AppError;
use crate::services::whatsapp_service::{whatsapp_webhook_handler, WhatsAppService};
use crate::state::AppState;
use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

/// Crée les routes WhatsApp
pub fn create_whatsapp_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // with_db active le chatbot Yukpo (pharmacies, bus, transfusion sanguine)
    let whatsapp_service = Arc::new(WhatsAppService::with_db(
        Arc::new(state.pg.clone()),
        state.ia.clone(),
    ));

    Router::new()
        // Webhook pour recevoir les messages WhatsApp (Twilio pointe ici)
        .route("/api/whatsapp/webhook", post(whatsapp_webhook_handler))
        // Endpoint de test pour vérifier la configuration
        .route("/api/whatsapp/status", get(check_whatsapp_status))
        // Endpoint pour envoyer un message manuellement
        .route("/api/whatsapp/send", post(send_manual_message))
        // Endpoint pour lister les groupes configurés
        .route("/api/whatsapp/groups", get(list_groups))
        .with_state(whatsapp_service)
        .with_state(state)
}

/// Vérifie le statut du service WhatsApp
async fn check_whatsapp_status(
    axum::extract::State(whatsapp_service): axum::extract::State<Arc<WhatsAppService>>,
) -> axum::response::Json<serde_json::Value> {
    let is_available = whatsapp_service.is_available();
    let groups = whatsapp_service.get_routing_service().get_groups();

    axum::response::Json(serde_json::json!({
        "status": if is_available { "active" } else { "inactive" },
        "configured": is_available,
        "groups_count": groups.len(),
        "groups": groups.values().map(|g| serde_json::json!({
            "id": g.group_id,
            "name": g.group_name,
            "description": g.description,
            "keywords": g.keywords,
            "auto_add_keywords": g.auto_add_keywords
        })).collect::<Vec<_>>()
    }))
}

/// Envoie un message manuellement (pour les tests)
async fn send_manual_message(
    axum::extract::State(whatsapp_service): axum::extract::State<Arc<WhatsAppService>>,
    axum::extract::Json(payload): axum::extract::Json<serde_json::Value>,
) -> Result<axum::response::Json<serde_json::Value>, AppError> {
    let to = payload
        .get("to")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::BadRequest("Le champ 'to' est requis".to_string()))?;

    let message = payload
        .get("message")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::BadRequest("Le champ 'message' est requis".to_string()))?;

    let result = whatsapp_service
        .send_message_with_routing(to, message, None)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur envoi WhatsApp: {}", e)))?;

    Ok(axum::response::Json(serde_json::json!({
        "success": result.success,
        "message_id": result.message_id,
        "group_redirected": result.group_redirected,
        "error": result.error
    })))
}

/// Liste tous les groupes configurés
async fn list_groups(
    axum::extract::State(whatsapp_service): axum::extract::State<Arc<WhatsAppService>>,
) -> axum::response::Json<serde_json::Value> {
    let groups = whatsapp_service.get_routing_service().get_groups();

    axum::response::Json(serde_json::json!({
        "groups": groups.values().map(|g| serde_json::json!({
            "id": g.group_id,
            "name": g.group_name,
            "description": g.description,
            "keywords": g.keywords,
            "auto_add_keywords": g.auto_add_keywords,
            "welcome_message": g.welcome_message
        })).collect::<Vec<_>>()
    }))
}
