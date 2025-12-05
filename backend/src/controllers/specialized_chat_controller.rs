// ✅ NOUVEAU: Contrôleur pour chat services spécialisés

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::specialized_chat_service::SpecializedChatService;
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::info;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct CreateConversationRequest {
    pub service_id: i32,
    pub service_type: String,
}

#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub message: String,
    pub message_type: Option<String>, // "text", "reservation", "payment"
}

/// POST /api/specialized-services/:service_id/chat/conversation
/// Créer ou récupérer une conversation pour un service
pub async fn get_or_create_conversation(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(service_id): Path<i32>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> AppResult<impl IntoResponse> {
    let service_type = params
        .get("service_type")
        .ok_or_else(|| AppError::BadRequest("service_type requis".to_string()))?;

    // Récupérer le prestataire_id depuis le service
    let prestataire_id: i32 = sqlx::query_scalar(
        r#"
        SELECT user_id FROM services
        WHERE id = $1 AND specialized_type = $2
        "#,
    )
    .bind(service_id)
    .bind(service_type)
    .fetch_optional(&state.pg)
    .await?
    .ok_or_else(|| AppError::NotFound("Service non trouvé".to_string()))?;

    let chat_service = SpecializedChatService::new(Arc::new(state.pg.clone()));
    let conversation_id = chat_service
        .get_or_create_conversation(service_id, service_type, user_id, prestataire_id)
        .await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "conversation_id": conversation_id // String UUID
        })),
    ))
}

/// POST /api/specialized-services/chat/:conversation_id/message
/// Envoyer un message dans une conversation
pub async fn send_message(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(conversation_id): Path<i32>,
    Json(payload): Json<SendMessageRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[send_message] user_id={}, conversation_id={}",
        user_id, conversation_id
    );

    let chat_service = SpecializedChatService::new(Arc::new(state.pg.clone()));
    let message_id = chat_service
        .send_message(
            &conversation_id.to_string(), // Convertir en String
            user_id,
            &payload.message,
            payload.message_type.as_deref(),
        )
        .await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "message_id": message_id
        })),
    ))
}

/// GET /api/specialized-services/chat/conversations
/// Lister les conversations de l'utilisateur
pub async fn list_conversations(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let chat_service = SpecializedChatService::new(Arc::new(state.pg.clone()));
    let conversations = chat_service.list_user_conversations(user_id).await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "conversations": conversations
        })),
    ))
}
