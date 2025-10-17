// Contrôleur pour les push notifications
use std::sync::Arc;
use axum::{
    extract::State,
    response::Json,
    Extension,
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use crate::{
    state::AppState,
    middlewares::auth::AuthenticatedUser,
    services::push_notification_service,
};

#[derive(Debug, Deserialize)]
pub struct RegisterPushTokenRequest {
    pub push_token: String,
    pub device_type: String, // 'ios', 'android', 'web'
    pub device_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SendPushRequest {
    pub user_id: i32,
    pub title: String,
    pub body: String,
    pub data: Option<Value>,
}

/// Enregistrer un token push
pub async fn register_push_token(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<RegisterPushTokenRequest>,
) -> Result<Json<Value>, StatusCode> {
    log::info!("[PushController] Enregistrement token pour user {}", user.id);
    
    match push_notification_service::register_push_token(
        &state.pg,
        user.id,
        payload.push_token,
        payload.device_type,
        payload.device_id,
    ).await {
        Ok(token_id) => Ok(Json(json!({
            "success": true,
            "token_id": token_id,
            "message": "Token push enregistré avec succès"
        }))),
        Err(e) => {
            log::error!("[PushController] Erreur enregistrement token: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Désactiver un token push (déconnexion)
pub async fn deactivate_push_token(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    let push_token = payload.get("push_token")
        .and_then(|v| v.as_str())
        .ok_or(StatusCode::BAD_REQUEST)?;
    
    match push_notification_service::deactivate_push_token(&state.pg, push_token.to_string()).await {
        Ok(true) => Ok(Json(json!({
            "success": true,
            "message": "Token désactivé"
        }))),
        Ok(false) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            log::error!("[PushController] Erreur désactivation token: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Envoyer une notification push (endpoint admin/test)
pub async fn send_push_notification(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Json(payload): Json<SendPushRequest>,
) -> Result<Json<Value>, StatusCode> {
    log::info!("[PushController] Envoi push à user {}", payload.user_id);
    
    match push_notification_service::send_push_notification(
        &state.pg,
        payload.user_id,
        payload.title,
        payload.body,
        payload.data,
        Some("default".to_string()),
    ).await {
        Ok(count) => Ok(Json(json!({
            "success": true,
            "sent_count": count,
            "message": format!("{} notifications envoyées", count)
        }))),
        Err(e) => {
            log::error!("[PushController] Erreur envoi push: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

