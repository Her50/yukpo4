// Routes pour le chat et messagerie
use crate::{
    middlewares::jwt::{jwt_auth, AuthenticatedUser},
    services::{notification_service, push_notification_service},
    state::AppState,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Extension, Router,
};
use chrono::{DateTime, Utc};
use futures::future;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;

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
    log::info!(
        "[ChatController] 💬 Notification message: {} → {}",
        payload.sender_id,
        payload.recipient_id
    );

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
        format!(
            "Au sujet de: {}\n\n\"{}\"",
            payload.service_title, payload.message_preview
        ),
        Some(notification_data.clone()),
    )
    .await
    {
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
    )
    .await
    {
        Ok(count) => {
            log::info!("[ChatController] ✅ {} push notifications envoyées", count);

            // Incrémenter métriques chat
            crate::metrics::CHAT_METRICS
                .messages_sent_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            crate::metrics::CHAT_METRICS
                .notifications_sent_total
                .fetch_add(count as u64, std::sync::atomic::Ordering::Relaxed);

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

// ✅ AJOUT: Structures pour les conversations et messages

#[derive(Debug, Serialize)]
pub struct Conversation {
    pub id: String,
    pub client_id: String,
    pub prestataire_id: String,
    pub client_name: String,
    pub prestataire_name: String,
    pub client_photo: Option<String>,
    pub prestataire_photo: Option<String>,
    pub last_message: String,
    pub last_message_time: DateTime<Utc>,
    pub unread_count: i32,
    pub is_active: bool,
    pub service_title: Option<String>,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct ChatMessage {
    pub id: String,
    pub conversation_id: String,
    pub from: String, // 'client' ou 'prestataire'
    pub content: String,
    pub created_at: DateTime<Utc>,
    pub is_from_client: bool,
    pub r#type: String, // 'text', 'image', 'audio', 'file'
    pub metadata: Option<Value>,
}

/// GET /api/chat/conversations - Récupère toutes les conversations de l'utilisateur
pub async fn get_user_conversations(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> Result<Json<Vec<Conversation>>, StatusCode> {
    log::info!(
        "[ChatController] 📋 Récupération conversations pour user_id={}",
        user.id
    );

    // ✅ Récupérer les conversations depuis PostgreSQL
    let rows = sqlx::query(
        r#"
        SELECT 
            c.id,
            c.client_id::text,
            c.prestataire_id::text,
            COALESCE(u_client.nom_complet, u_client.email, 'Client') as client_name,
            COALESCE(u_prestataire.nom_complet, u_prestataire.email, 'Prestataire') as prestataire_name,
            u_client.avatar_url as client_photo,
            u_prestataire.avatar_url as prestataire_photo,
            COALESCE(
                (SELECT content FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1),
                'Nouvelle conversation'
            ) as last_message,
            c.last_message_at,
            COALESCE(
                (SELECT unread_count FROM chat_unread_counts WHERE conversation_id = c.id AND user_id = $1),
                0
            ) as unread_count,
            c.is_active,
            c.service_title,
            c.status
        FROM conversations c
        LEFT JOIN users u_client ON c.client_id = u_client.id
        LEFT JOIN users u_prestataire ON c.prestataire_id = u_prestataire.id
        WHERE c.client_id = $1 OR c.prestataire_id = $1
        ORDER BY c.last_message_at DESC
        LIMIT 100
        "#
    )
    .bind(user.id)
    .fetch_all(&state.pg)
    .await;

    let mut conversations = Vec::new();

    match rows {
        Ok(rows) => {
            for row in rows {
                conversations.push(Conversation {
                    id: row.get::<Option<_>, _>("id").unwrap_or_default(),
                    client_id: row.get::<Option<_>, _>("client_id").unwrap_or_default(),
                    prestataire_id: row.get::<Option<_>, _>("prestataire_id").unwrap_or_default(),
                    client_name: row
                        .try_get("client_name")
                        .unwrap_or_else(|_| "Client".to_string()),
                    prestataire_name: row
                        .try_get("prestataire_name")
                        .unwrap_or_else(|_| "Prestataire".to_string()),
                    client_photo: row.get::<Option<_>, _>("client_photo"),
                    prestataire_photo: row.get::<Option<_>, _>("prestataire_photo"),
                    last_message: row.try_get("last_message").unwrap_or_else(|_| "".to_string()),
                    last_message_time: row
                        .try_get("last_message_at")
                        .unwrap_or_else(|_| Utc::now()),
                    unread_count: row.get::<Option<_>, _>("unread_count").unwrap_or(0),
                    is_active: row.get::<Option<_>, _>("is_active").unwrap_or(true),
                    service_title: row.get::<Option<_>, _>("service_title"),
                    status: row.try_get("status").unwrap_or_else(|_| "active".to_string()),
                });
            }
        }
        Err(e) => {
            log::error!("[ChatController] ❌ Erreur DB: {:?}", e);
            // Retourner tableau vide en cas d'erreur
        }
    }

    log::info!(
        "[ChatController] ✅ {} conversations trouvées",
        conversations.len()
    );
    Ok(Json(conversations))
}

/// GET /api/chat/messages/:conversation_id - Récupère les messages d'une conversation
pub async fn get_conversation_messages(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(conversation_id): Path<String>,
) -> Result<Json<Vec<ChatMessage>>, StatusCode> {
    log::info!(
        "[ChatController] 📨 Récupération messages conversation={} user={}",
        conversation_id,
        user.id
    );

    // ✅ Vérifier que l'utilisateur fait partie de la conversation
    let conversation_check = sqlx::query(
        "SELECT 1 FROM conversations WHERE id = $1 AND (client_id = $2 OR prestataire_id = $2)",
    )
    .bind(&conversation_id)
    .bind(user.id)
    .fetch_optional(&state.pg)
    .await;

    if conversation_check.is_err() || conversation_check.unwrap().is_none() {
        log::warn!(
            "[ChatController] ❌ Utilisateur {} n'a pas accès à la conversation {}",
            user.id,
            conversation_id
        );
        return Err(StatusCode::FORBIDDEN);
    }

    // ✅ Récupérer les messages depuis PostgreSQL
    let rows = sqlx::query(
        r#"
        SELECT 
            id,
            conversation_id,
            from_user_id,
            content,
            message_type as type,
            metadata,
            is_read,
            created_at
        FROM chat_messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC
        LIMIT 500
        "#,
    )
    .bind(&conversation_id)
    .fetch_all(&state.pg)
    .await;

    let mut messages = Vec::new();

    match rows {
        Ok(rows) => {
            // ✅ Collecter les données des messages d'abord
            let mut raw_messages = Vec::new();
            for row in rows {
                let from_user_id: i32 = row.get::<Option<_>, _>("from_user_id").unwrap_or(0);
                let from = if from_user_id == user.id {
                    "prestataire"
                } else {
                    "client"
                };

                raw_messages.push((
                    row.get::<Option<_>, _>("id").unwrap_or_default(),
                    row.get::<Option<_>, _>("conversation_id").unwrap_or_default(),
                    from.to_string(),
                    row.get::<Option<_>, _>("content").unwrap_or_default(),
                    row.get::<Option<chrono::DateTime<Utc>>, _>("created_at")
                        .unwrap_or_else(|| Utc::now()),
                    from == "client",
                    row.get::<Option<_>, _>("type").unwrap_or_else(|| "text".to_string()),
                    row.get::<Option<_>, _>("metadata"),
                ));
            }

            // ✅ Traiter les métadonnées en parallèle pour générer URLs pré-signées
            let message_futures: Vec<_> = raw_messages.into_iter().map(|(id, conv_id, from, content, created_at, is_from_client, msg_type, metadata)| {
                let state_clone = state.clone();
                async move {
                    let mut final_metadata: Option<serde_json::Value> = metadata;

                    // ✅ Générer URL pré-signée pour les médias dans les métadonnées (7 jours de validité)
                    if let Some(ref mut meta) = final_metadata {
                        // Chercher l'URL dans différents champs possibles
                        let media_url_keys = ["url", "media_url", "file_url", "image_url", "video_url", "audio_url"];
                        for key in &media_url_keys {
                            if let Some(media_url) = meta.get(key) {
                                if let Some(url_str) = media_url.as_str() {
                                    // Extraire le chemin de stockage depuis l'URL
                                    let storage_path_clean = if url_str.starts_with("http://") || url_str.starts_with("https://") {
                                        if let Some(path_start) = url_str.find("/uploads/") {
                                            url_str[path_start + 1..].to_string()
                                        } else {
                                            url_str.split('/').last().unwrap_or(url_str).to_string()
                                        }
                                    } else {
                                        if !url_str.starts_with("uploads/") {
                                            format!("uploads/{}", url_str.trim_start_matches('/'))
                                        } else {
                                            url_str.to_string()
                                        }
                                    };

                                    // Générer URL pré-signée (7 jours = 7 * 24 * 3600 secondes)
                                    match state_clone.media_storage.generate_presigned_url(&storage_path_clean, 7 * 24 * 3600).await {
                                        Ok(presigned_url) => {
                                            // Remplacer l'URL dans les métadonnées
                                            if meta.is_object() {
                                                if let Some(obj) = meta.as_object_mut() {
                                                    obj.insert(key.to_string(), Value::String(presigned_url));
                                                }
                                            }
                                            break; // Traiter seulement la première URL trouvée par message
                                        }
                                        Err(e) => {
                                            log::warn!("[ChatController] Erreur génération URL pré-signée pour {}: {}", storage_path_clean, e);
                                            // Garder l'URL originale en cas d'erreur
                                        }
                                    }
                                }
                            }
                        }
                    }

                    ChatMessage {
                        id,
                        conversation_id: conv_id,
                        from,
                        content,
                        created_at,
                        is_from_client,
                        r#type: msg_type,
                        metadata: final_metadata,
                    }
                }
            }).collect();

            messages = future::join_all(message_futures).await;

            // ✅ Marquer les messages comme lus
            let _ = sqlx::query(
                "UPDATE chat_messages SET is_read = TRUE WHERE conversation_id = $1 AND from_user_id != $2"
            )
            .bind(&conversation_id)
            .bind(user.id)
            .execute(&state.pg)
            .await;

            // ✅ Réinitialiser le compteur de non lus
            let _ = sqlx::query(
                "UPDATE chat_unread_counts SET unread_count = 0, last_read_at = NOW() WHERE conversation_id = $1 AND user_id = $2"
            )
            .bind(&conversation_id)
            .bind(user.id)
            .execute(&state.pg)
            .await;
        }
        Err(e) => {
            log::error!("[ChatController] ❌ Erreur DB: {:?}", e);
        }
    }

    log::info!("[ChatController] ✅ {} messages trouvés", messages.len());
    Ok(Json(messages))
}

#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub conversation_id: Option<String>,
    pub recipient_id: i32,
    pub service_id: Option<i32>,
    pub content: String,
    pub r#type: Option<String>, // 'text', 'image', 'audio', 'file'
    pub metadata: Option<Value>,
}

/// POST /api/chat/messages - Envoyer un nouveau message
pub async fn send_message(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<SendMessageRequest>,
) -> Result<Json<Value>, StatusCode> {
    log::info!(
        "[ChatController] 📤 Envoi message de user={} vers user={}",
        user.id,
        payload.recipient_id
    );

    // ✅ 1. Créer ou récupérer la conversation
    let conversation_id = if let Some(conv_id) = &payload.conversation_id {
        conv_id.clone()
    } else {
        // Créer une nouvelle conversation
        let new_conv_id = format!("conv_{}", chrono::Utc::now().timestamp_millis());

        let insert_result = sqlx::query(
            r#"
            INSERT INTO conversations (id, client_id, prestataire_id, service_id, service_title)
            VALUES ($1, $2, $3, $4, 'Conversation directe')
            ON CONFLICT DO NOTHING
            RETURNING id
            "#,
        )
        .bind(&new_conv_id)
        .bind(user.id)
        .bind(payload.recipient_id)
        .bind(payload.service_id)
        .fetch_optional(&state.pg)
        .await;

        match insert_result {
            Ok(Some(row)) => row.get::<Option<_>, _>("id").unwrap_or(new_conv_id.clone()),
            _ => new_conv_id,
        }
    };

    // ✅ 2. Sauvegarder le message
    let message_id = format!("msg_{}", chrono::Utc::now().timestamp_millis());
    let message_type = payload.r#type.unwrap_or_else(|| "text".to_string());

    let insert_message = sqlx::query(
        r#"
        INSERT INTO chat_messages (id, conversation_id, from_user_id, content, message_type, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        "#
    )
    .bind(&message_id)
    .bind(&conversation_id)
    .bind(user.id)
    .bind(&payload.content)
    .bind(&message_type)
    .bind(&payload.metadata)
    .execute(&state.pg)
    .await;

    if let Err(e) = insert_message {
        log::error!("[ChatController] ❌ Erreur sauvegarde message: {:?}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // ✅ 3. Le trigger PostgreSQL s'occupe automatiquement de:
    //    - Mettre à jour last_message_at dans conversations
    //    - Incrémenter unread_count pour le destinataire

    log::info!(
        "[ChatController] ✅ Message {} créé dans conversation {}",
        message_id,
        conversation_id
    );

    // Incrémenter métriques chat
    crate::metrics::CHAT_METRICS
        .messages_sent_total
        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);

    // Si message audio
    if message_type == "audio" {
        crate::metrics::CHAT_METRICS
            .audio_messages_total
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    }

    Ok(Json(json!({
        "success": true,
        "message_id": message_id,
        "conversation_id": conversation_id,
        "created_at": chrono::Utc::now()
    })))
}

pub fn chat_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // ✅ AJOUT: Routes pour conversations et messages
        .route("/api/chat/conversations", get(get_user_conversations))
        .route(
            "/api/chat/messages/{conversation_id}",
            get(get_conversation_messages),
        )
        .route("/api/chat/messages", post(send_message))
        // Notifier un nouveau message
        .route("/api/chat/notify-message", post(notify_new_message))
        // Appliquer l'authentification
        .layer(axum::middleware::from_fn(jwt_auth))
        .with_state(state)
}
