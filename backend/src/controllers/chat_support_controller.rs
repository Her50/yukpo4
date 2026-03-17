/**
 * Contrôleur pour le chat support en temps réel
 */
use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::chat_support_ai::{generate_support_response, should_escalate_to_human};
use crate::state::AppState;
use axum::{
    extract::{Extension, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::{error, info};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

// ============================================================================
// STRUCTURES
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatSession {
    pub id: String,
    pub status: String, // 'active', 'resolved', 'closed'
    pub created_at: i64,
    pub last_message_at: i64,
    pub agent_name: Option<String>,
    pub agent_avatar: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub text: String,
    pub sender: String, // 'user', 'support'
    pub timestamp: i64,
    pub read: bool,
    pub attachments: Option<Vec<Attachment>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Attachment {
    pub type_: String,
    pub url: String,
}

#[derive(Debug, Deserialize)]
pub struct StartChatRequest {
    pub user_id: i32,
    pub topic: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub session_id: String,
    pub text: String,
    pub attachments: Option<Vec<Attachment>>,
}

#[derive(Debug, Deserialize)]
pub struct CloseChatRequest {
    pub session_id: String,
    pub rating: Option<i32>,
    pub feedback: Option<String>,
}

// ============================================================================
// ENDPOINTS
// ============================================================================

/// Démarrer une nouvelle session de chat
/// POST /api/support/chat/start
pub async fn start_chat_session(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<StartChatRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[start_chat_session] User: {}, Topic: {:?}",
        payload.user_id, payload.topic
    );

    // Vérifier que l'utilisateur peut démarrer une session pour lui-même
    if payload.user_id != user.id {
        return Err(AppError::Forbidden(
            "Vous ne pouvez démarrer une session que pour votre propre compte".to_string(),
        ));
    }

    let session_id = Uuid::new_v4().to_string();
    let timestamp = chrono::Utc::now().timestamp();

    // Créer la session
    let query = r#"
        INSERT INTO chat_support_sessions (id, user_id, status, topic, created_at, last_message_at)
        VALUES ($1, $2, 'active', $3, to_timestamp($4), to_timestamp($4))
        RETURNING id, status, EXTRACT(EPOCH FROM created_at)::BIGINT as created_at, 
                  EXTRACT(EPOCH FROM last_message_at)::BIGINT as last_message_at
    "#;

    let row = sqlx::query(query)
        .bind(&session_id)
        .bind(payload.user_id)
        .bind(&payload.topic)
        .bind(timestamp)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| {
            error!("[start_chat_session] Erreur: {}", e);
            AppError::Internal(format!("Erreur création session: {}", e))
        })?;

    let session = ChatSession {
        id: row.get::<String, _>("id"),
        status: row.get::<String, _>("status"),
        created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").timestamp(),
        last_message_at: row
            .get::<Option<chrono::DateTime<chrono::Utc>>, _>("last_message_at")
            .map(|dt| dt.timestamp())
            .unwrap_or(0),
        agent_name: None,
        agent_avatar: None,
    };

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "session": session
        })),
    ))
}

/// Envoyer un message
/// POST /api/support/chat/message
pub async fn send_chat_message(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<SendMessageRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[send_chat_message] Session: {}, User: {}",
        payload.session_id, user.id
    );

    // Vérifier que la session appartient à l'utilisateur
    let session_check = r#"
        SELECT user_id, status
        FROM chat_support_sessions
        WHERE id = $1
    "#;

    let session_row = sqlx::query(session_check)
        .bind(&payload.session_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| {
            error!("[send_chat_message] Erreur vérification session: {}", e);
            AppError::Internal(format!("Erreur vérification session: {}", e))
        })?;

    if session_row.is_none() {
        return Err(AppError::NotFound("Session introuvable".to_string()));
    }

    let session_user_id: i32 = session_row.as_ref().unwrap().get::<i32, _>("user_id");
    if session_user_id != user.id {
        return Err(AppError::Forbidden(
            "Cette session ne vous appartient pas".to_string(),
        ));
    }

    let message_id = Uuid::new_v4().to_string();
    let timestamp = chrono::Utc::now().timestamp();

    // Insérer le message
    let query = r#"
        INSERT INTO chat_support_messages (id, session_id, user_id, text, sender, timestamp, read, attachments)
        VALUES ($1, $2, $3, $4, 'user', to_timestamp($5), false, $6)
        RETURNING id, text, sender, EXTRACT(EPOCH FROM timestamp)::BIGINT as timestamp, read
    "#;

    let attachments_json = payload.attachments.as_ref().map(|a| {
        json!(a
            .iter()
            .map(|att| json!({
                "type": att.type_,
                "url": att.url
            }))
            .collect::<Vec<_>>())
    });

    let row = sqlx::query(query)
        .bind(&message_id)
        .bind(&payload.session_id)
        .bind(user.id)
        .bind(&payload.text)
        .bind(timestamp)
        .bind(attachments_json.as_ref().map(|j| j.to_string()))
        .fetch_one(&state.pg)
        .await
        .map_err(|e| {
            error!("[send_chat_message] Erreur: {}", e);
            AppError::Internal(format!("Erreur envoi message: {}", e))
        })?;

    // Mettre à jour last_message_at de la session
    let update_query = r#"
        UPDATE chat_support_sessions
        SET last_message_at = to_timestamp($1)
        WHERE id = $2
    "#;

    sqlx::query(update_query)
        .bind(timestamp)
        .bind(&payload.session_id)
        .execute(&state.pg)
        .await
        .map_err(|e| {
            error!("[send_chat_message] Erreur mise à jour session: {}", e);
        })
        .ok();

    let user_message = ChatMessage {
        id: row.get::<String, _>("id"),
        text: row.get::<String, _>("text"),
        sender: row.get::<String, _>("sender"),
        timestamp: row.get::<chrono::DateTime<chrono::Utc>, _>("timestamp").timestamp(),
        read: row.get::<bool, _>("read"),
        attachments: payload.attachments.clone(),
    };

    // ✅ NOUVEAU 2025-01-27: Générer une réponse IA automatique
    let ai_response =
        generate_ai_support_response(&state, &payload.session_id, &payload.text, user.id).await;

    // Retourner le message utilisateur + réponse IA si générée
    let mut response_data = json!({
        "success": true,
        "message": user_message,
    });

    if let Ok(ai_msg) = ai_response {
        response_data["ai_response"] = json!(ai_msg);
    }

    Ok((StatusCode::OK, Json(response_data)))
}

/// ✅ NOUVEAU 2025-01-27: Générer une réponse IA automatique
async fn generate_ai_support_response(
    state: &Arc<AppState>,
    session_id: &str,
    user_message: &str,
    user_id: i32,
) -> Result<ChatMessage, AppError> {
    info!(
        "[generate_ai_support_response] Génération réponse IA pour session: {}",
        session_id
    );

    // Récupérer l'historique de conversation
    let history_query = r#"
        SELECT text, sender
        FROM chat_support_messages
        WHERE session_id = $1
        ORDER BY timestamp DESC
        LIMIT 10
    "#;

    let history_rows = sqlx::query(history_query)
        .bind(session_id)
        .fetch_all(&state.pg)
        .await
        .map_err(|e| {
            error!("[generate_ai_support_response] Erreur historique: {}", e);
            AppError::Internal(format!("Erreur historique: {}", e))
        })?;

    let conversation_history: Vec<String> =
        history_rows.iter().rev().map(|row| row.get::<String, _>("text")).collect();

    // Récupérer le topic de la session
    let topic_query = r#"
        SELECT topic
        FROM chat_support_sessions
        WHERE id = $1
    "#;

    let topic_row = sqlx::query(topic_query)
        .bind(session_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| {
            error!("[generate_ai_support_response] Erreur topic: {}", e);
            AppError::Internal(format!("Erreur topic: {}", e))
        })?;

    let topic: Option<String> = topic_row.and_then(|row| row.get::<Option<String>, _>("topic"));

    // Générer la réponse IA
    let ai_response_text = generate_support_response(
        state.ia.clone(),
        user_message,
        &conversation_history,
        topic.as_deref(),
        None, // TODO: pass user's language from request headers or user profile
    )
    .await
    .map_err(|e| {
        error!("[generate_ai_support_response] Erreur génération IA: {}", e);
        AppError::Internal(format!("Erreur génération IA: {}", e))
    })?;

    // Détecter si escalade nécessaire
    let needs_escalation =
        should_escalate_to_human(state.ia.clone(), user_message, &conversation_history)
            .await
            .unwrap_or(false);

    // Ajouter note d'escalade si nécessaire
    let final_response = if needs_escalation {
        format!("{}\n\n💡 Un agent humain va prendre en charge votre demande dans les plus brefs délais.", ai_response_text)
    } else {
        ai_response_text
    };

    // Enregistrer la réponse IA comme message support
    let ai_message_id = Uuid::new_v4().to_string();
    let ai_timestamp = chrono::Utc::now().timestamp();

    let insert_ai_query = r#"
        INSERT INTO chat_support_messages (id, session_id, user_id, text, sender, timestamp, read)
        VALUES ($1, $2, $3, $4, 'support', to_timestamp($5), false)
        RETURNING id, text, sender, EXTRACT(EPOCH FROM timestamp)::BIGINT as timestamp, read
    "#;

    let ai_row = sqlx::query(insert_ai_query)
        .bind(&ai_message_id)
        .bind(session_id)
        .bind(user_id)
        .bind(&final_response)
        .bind(ai_timestamp)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| {
            error!(
                "[generate_ai_support_response] Erreur insertion réponse IA: {}",
                e
            );
            AppError::Internal(format!("Erreur insertion réponse IA: {}", e))
        })?;

    // Mettre à jour last_message_at
    sqlx::query(
        "UPDATE chat_support_sessions SET last_message_at = to_timestamp($1) WHERE id = $2",
    )
    .bind(ai_timestamp)
    .bind(session_id)
    .execute(&state.pg)
    .await
    .ok();

    let ai_message = ChatMessage {
        id: ai_row.get::<String, _>("id"),
        text: ai_row.get::<String, _>("text"),
        sender: ai_row.get::<String, _>("sender"),
        timestamp: ai_row.get::<chrono::DateTime<chrono::Utc>, _>("timestamp").timestamp(),
        read: ai_row.get::<bool, _>("read"),
        attachments: None,
    };

    info!("[generate_ai_support_response] ✅ Réponse IA générée et enregistrée");
    Ok(ai_message)
}

/// Récupérer les messages d'une session
/// GET /api/support/chat/messages?session_id={id}&limit={limit}
pub async fn get_chat_messages(
    State(state): State<Arc<AppState>>,
    Query(params): Query<serde_json::Value>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let session_id = params
        .get("session_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::BadRequest("session_id requis".to_string()))?;
    let limit = params.get("limit").and_then(|v| v.as_i64()).map(|v| v as i32).unwrap_or(50);

    info!(
        "[get_chat_messages] Session: {}, Limit: {}",
        session_id, limit
    );

    // Vérifier que la session appartient à l'utilisateur
    let session_check = r#"
        SELECT user_id
        FROM chat_support_sessions
        WHERE id = $1
    "#;

    let session_row = sqlx::query(session_check)
        .bind(session_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| {
        error!("[get_chat_messages] Erreur vérification session: {}", e);
        AppError::Internal(format!("Erreur vérification session: {}", e))
    })?;

    if session_row.is_none() {
        return Err(AppError::NotFound("Session introuvable".to_string()));
    }

    let session_user_id: i32 = session_row.as_ref().unwrap().get::<i32, _>("user_id");
    if session_user_id != user.id {
        return Err(AppError::Forbidden(
            "Cette session ne vous appartient pas".to_string(),
        ));
    }

    // Récupérer les messages
    let query = r#"
        SELECT 
            id::text as id,
            text,
            sender,
            EXTRACT(EPOCH FROM timestamp)::BIGINT as timestamp,
            read,
            attachments
        FROM chat_support_messages
        WHERE session_id = $1
        ORDER BY timestamp ASC
        LIMIT $2
    "#;

    let rows = sqlx::query(query)
        .bind(session_id)
        .bind(limit)
        .fetch_all(&state.pg)
        .await
        .map_err(|e| {
            error!("[get_chat_messages] Erreur: {}", e);
            AppError::Internal(format!("Erreur récupération messages: {}", e))
        })?;

    let messages: Vec<ChatMessage> = rows
        .iter()
        .map(|row| {
            let attachments: Option<String> = row.get::<Option<String>, _>("attachments");
            let attachments_parsed = attachments.and_then(|a| {
                serde_json::from_str::<Vec<serde_json::Value>>(&a).ok().map(|v| {
                    v.iter()
                        .filter_map(|item| {
                            Some(Attachment {
                                type_: item.get("type")?.as_str()?.to_string(),
                                url: item.get("url")?.as_str()?.to_string(),
                            })
                        })
                        .collect()
                })
            });

            ChatMessage {
                id: row.get::<String, _>("id"),
                text: row.get::<String, _>("text"),
                sender: row.get::<String, _>("sender"),
                timestamp: row.get::<chrono::DateTime<chrono::Utc>, _>("timestamp").timestamp(),
                read: row.get::<bool, _>("read"),
                attachments: attachments_parsed,
            }
        })
        .collect();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "messages": messages
        })),
    ))
}

/// Obtenir les sessions actives de l'utilisateur
/// GET /api/support/chat/sessions?user_id={id}
pub async fn get_chat_sessions(
    State(state): State<Arc<AppState>>,
    Query(params): Query<serde_json::Value>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let user_id = params
        .get("user_id")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32)
        .unwrap_or(user.id);

    info!("[get_chat_sessions] User ID: {}", user_id);

    let query = r#"
        SELECT 
            id::text as id,
            status,
            EXTRACT(EPOCH FROM created_at)::BIGINT as created_at,
            EXTRACT(EPOCH FROM last_message_at)::BIGINT as last_message_at,
            agent_name,
            agent_avatar
        FROM chat_support_sessions
        WHERE user_id = $1
        ORDER BY last_message_at DESC
    "#;

    let rows = sqlx::query(query).bind(user_id).fetch_all(&state.pg).await.map_err(|e| {
        error!("[get_chat_sessions] Erreur: {}", e);
        AppError::Internal(format!("Erreur récupération sessions: {}", e))
    })?;

    let sessions: Vec<ChatSession> = rows
        .iter()
        .map(|row| ChatSession {
            id: row.get::<String, _>("id"),
            status: row.get::<String, _>("status"),
            created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").timestamp(),
            last_message_at: row
                .get::<Option<chrono::DateTime<chrono::Utc>>, _>("last_message_at")
                .map(|dt| dt.timestamp())
                .unwrap_or(0),
            agent_name: row.get::<Option<String>, _>("agent_name"),
            agent_avatar: row.get::<Option<String>, _>("agent_avatar"),
        })
        .collect();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "sessions": sessions
        })),
    ))
}

/// Fermer une session de chat
/// POST /api/support/chat/close
pub async fn close_chat_session(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CloseChatRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[close_chat_session] Session: {}, User: {}",
        payload.session_id, user.id
    );

    // Vérifier que la session appartient à l'utilisateur
    let session_check = r#"
        SELECT user_id
        FROM chat_support_sessions
        WHERE id = $1
    "#;

    let session_row = sqlx::query(session_check)
        .bind(&payload.session_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| {
            error!("[close_chat_session] Erreur vérification session: {}", e);
            AppError::Internal(format!("Erreur vérification session: {}", e))
        })?;

    if session_row.is_none() {
        return Err(AppError::NotFound("Session introuvable".to_string()));
    }

    let session_user_id: i32 = session_row.as_ref().unwrap().get::<i32, _>("user_id");
    if session_user_id != user.id {
        return Err(AppError::Forbidden(
            "Cette session ne vous appartient pas".to_string(),
        ));
    }

    // Mettre à jour le statut de la session
    let update_query = r#"
        UPDATE chat_support_sessions
        SET status = 'closed', 
            rating = $1,
            feedback = $2,
            closed_at = NOW()
        WHERE id = $3
    "#;

    sqlx::query(update_query)
        .bind(payload.rating)
        .bind(&payload.feedback)
        .bind(&payload.session_id)
        .execute(&state.pg)
        .await
        .map_err(|e| {
            error!("[close_chat_session] Erreur: {}", e);
            AppError::Internal(format!("Erreur fermeture session: {}", e))
        })?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": "Session fermée avec succès"
        })),
    ))
}
