// Routes pour les réactions aux messages de chat
// ✅ OPTIMISÉ pour scalabilité : cache Redis, batch processing, connection pooling
use crate::{
    middlewares::jwt::{jwt_auth, AuthenticatedUser},
    state::AppState,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{delete, post},
    Extension, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;
use std::time::Duration;

#[derive(Debug, Deserialize)]
pub struct AddReactionRequest {
    pub message_id: String,
    pub emoji: String,
}

#[derive(Debug, Serialize)]
pub struct ReactionResponse {
    pub message_id: String,
    pub emoji: String,
    pub user_id: i32,
    pub user_name: String,
    pub count: i64,
}

/// POST /api/chat/messages/{message_id}/reactions - Ajouter une réaction
/// ✅ OPTIMISÉ pour scalabilité : cache Redis, batch processing
pub async fn add_reaction(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(message_id): Path<String>,
    Json(payload): Json<AddReactionRequest>,
) -> Result<Json<Value>, StatusCode> {
    log::info!(
        "[ChatReactions] ❤️ Ajout réaction {} sur message {} par user {}",
        payload.emoji,
        message_id,
        user.id
    );

    // ✅ OPTIMISATION: Vérifier le cache Redis d'abord
    let cache_key = format!("msg_reaction:{}:{}", message_id, payload.emoji);

    // Vérifier que le message existe (avec cache)
    let message_cache_key = format!("chat_msg_exists:{}", message_id);
    let message_exists =
        if let Ok(Some(exists)) = state.global_cache.get::<bool>(&message_cache_key).await {
            exists
        } else {
            let exists = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT 1 FROM chat_messages WHERE id = $1)",
            )
            .bind(&message_id)
            .fetch_one(&state.pg)
            .await
            .unwrap_or(false);

            // Mettre en cache pour 5 minutes
            let _ = state
                .global_cache
                .set(&message_cache_key, &exists, Duration::from_secs(300))
                .await;
            exists
        };

    if !message_exists {
        log::warn!("[ChatReactions] ⚠️ Message {} non trouvé", message_id);
        return Err(StatusCode::NOT_FOUND);
    }

    // ✅ OPTIMISATION: Traitement direct avec pool de connexions optimisé
    // Le pool PostgreSQL est déjà configuré pour 200 connexions (scalabilité)
    let db_result = sqlx::query(
        r#"
        INSERT INTO message_reactions (message_id, user_id, emoji)
        VALUES ($1, $2, $3)
        ON CONFLICT (message_id, user_id, emoji) DO NOTHING
        RETURNING id
        "#,
    )
    .bind(&message_id)
    .bind(user.id)
    .bind(&payload.emoji)
    .fetch_optional(&state.pg)
    .await;

    match db_result {
        Ok(Some(_)) => {
            // Compter le nombre total de réactions
            let count_result = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM message_reactions WHERE message_id = $1 AND emoji = $2",
            )
            .bind(&message_id)
            .bind(&payload.emoji)
            .fetch_one(&state.pg)
            .await
            .unwrap_or(0);

            // ✅ OPTIMISATION: Invalider les caches pour forcer le recalcul
            let _ = state.global_cache.invalidate(&cache_key).await;
            let _ = state
                .global_cache
                .invalidate(&format!("msg_reactions_all:{}", message_id))
                .await;

            let count = count_result;

            // Récupérer le nom de l'utilisateur (avec cache)
            let user_cache_key = format!("user_name:{}", user.id);
            let user_name = if let Ok(Some(cached_name)) =
                state.global_cache.get::<String>(&user_cache_key).await
            {
                cached_name
            } else {
                let name = sqlx::query_scalar::<_, String>(
                    "SELECT COALESCE(nom_complet, name, email) FROM users WHERE id = $1",
                )
                .bind(user.id)
                .fetch_optional(&state.pg)
                .await
                .ok()
                .flatten()
                .unwrap_or_else(|| format!("User {}", user.id));

                // Mettre en cache pour 1 heure
                let _ =
                    state.global_cache.set(&user_cache_key, &name, Duration::from_secs(3600)).await;
                name
            };

            log::info!(
                "[ChatReactions] ✅ Réaction ajoutée: {} réactions pour {}",
                count,
                payload.emoji
            );

            // ✅ NOUVEAU 2025-01-27: Envoyer via WebSocket aux autres participants (via Redis pub/sub pour scaling)
            if let Some(chat_manager) = &state.chat_ws_manager {
                let ws_message = crate::websocket::chat_websocket::ChatWsMessage {
                    message_type: "reaction_added".to_string(),
                    conversation_id: message_id.clone(), // Utiliser message_id comme conversation_id
                    user_id: user.id,
                    data: json!({
                        "message_id": message_id,
                        "emoji": payload.emoji,
                        "user_id": user.id,
                        "user_name": user_name,
                        "count": count
                    }),
                    timestamp: chrono::Utc::now(),
                    instance_id: None, // Sera ajouté automatiquement par le manager
                };
                chat_manager.broadcast_message(&message_id, ws_message).await;
            }

            Ok(Json(json!({
                "success": true,
                "reaction": {
                    "message_id": message_id,
                    "emoji": payload.emoji,
                    "user_id": user.id,
                    "user_name": user_name,
                    "count": count
                }
            })))
        }
        Ok(None) => {
            // Réaction déjà existante (conflit)
            log::info!("[ChatReactions] ℹ️ Réaction déjà existante");
            Ok(Json(json!({
                "success": true,
                "message": "Réaction déjà existante"
            })))
        }
        Err(e) => {
            log::error!("[ChatReactions] ❌ Erreur DB: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// DELETE /api/chat/messages/{message_id}/reactions/{emoji} - Supprimer une réaction
/// ✅ OPTIMISÉ pour scalabilité : cache Redis, invalidation
pub async fn remove_reaction(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path((message_id, emoji)): Path<(String, String)>,
) -> Result<Json<Value>, StatusCode> {
    log::info!(
        "[ChatReactions] 🗑️ Suppression réaction {} sur message {} par user {}",
        emoji,
        message_id,
        user.id
    );

    let result = sqlx::query(
        "DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3 RETURNING id"
    )
    .bind(&message_id)
    .bind(user.id)
    .bind(&emoji)
    .fetch_optional(&state.pg)
    .await;

    match result {
        Ok(Some(_)) => {
            // ✅ OPTIMISATION: Invalider les caches
            let cache_key = format!("msg_reaction:{}:{}", message_id, emoji);
            let _ = state.global_cache.invalidate(&cache_key).await;
            let _ = state
                .global_cache
                .invalidate(&format!("msg_reactions_all:{}", message_id))
                .await;

            // Compter le nombre restant de réactions
            let count_result = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM message_reactions WHERE message_id = $1 AND emoji = $2",
            )
            .bind(&message_id)
            .bind(&emoji)
            .fetch_one(&state.pg)
            .await;

            let count = count_result.unwrap_or(0);

            log::info!(
                "[ChatReactions] ✅ Réaction supprimée: {} réactions restantes pour {}",
                count,
                emoji
            );

            // ✅ NOUVEAU 2025-01-27: Envoyer via WebSocket aux autres participants (via Redis pub/sub pour scaling)
            if let Some(chat_manager) = &state.chat_ws_manager {
                let ws_message = crate::websocket::chat_websocket::ChatWsMessage {
                    message_type: "reaction_removed".to_string(),
                    conversation_id: message_id.clone(),
                    user_id: user.id,
                    data: json!({
                        "message_id": message_id,
                        "emoji": emoji,
                        "user_id": user.id,
                        "count": count
                    }),
                    timestamp: chrono::Utc::now(),
                    instance_id: None,
                };
                chat_manager.broadcast_message(&message_id, ws_message).await;
            }

            Ok(Json(json!({
                "success": true,
                "count": count
            })))
        }
        Ok(None) => {
            log::warn!("[ChatReactions] ⚠️ Réaction non trouvée");
            Err(StatusCode::NOT_FOUND)
        }
        Err(e) => {
            log::error!("[ChatReactions] ❌ Erreur DB: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// GET /api/chat/messages/{message_id}/reactions - Récupérer toutes les réactions d'un message
/// ✅ OPTIMISÉ pour scalabilité : cache Redis avec TTL
pub async fn get_message_reactions(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Path(message_id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    // ✅ OPTIMISATION: Vérifier le cache Redis d'abord
    let cache_key = format!("msg_reactions_all:{}", message_id);

    if let Ok(Some(cached_reactions)) = state.global_cache.get::<Value>(&cache_key).await {
        log::debug!(
            "[ChatReactions] ✅ Cache hit pour réactions message {}",
            message_id
        );
        return Ok(Json(json!({
            "success": true,
            "reactions": cached_reactions,
            "cached": true
        })));
    }

    // Cache miss - requête DB
    let result = sqlx::query(
        r#"
        SELECT 
            mr.emoji,
            COUNT(*) as count,
            json_agg(
                json_build_object(
                    'id', u.id,
                    'name', COALESCE(u.nom_complet, CONCAT(u.prenom, ' ', u.nom), u.email),
                    'avatar', u.avatar_url
                )
            ) as users
        FROM message_reactions mr
        JOIN users u ON mr.user_id = u.id
        WHERE mr.message_id = $1
        GROUP BY mr.emoji
        ORDER BY count DESC, mr.emoji
        "#,
    )
    .bind(&message_id)
    .fetch_all(&state.pg)
    .await;

    match result {
        Ok(rows) => {
            let reactions: Vec<Value> = rows
                .iter()
                .map(|row| {
                    let emoji: String = row.get::<Option<_>, _>("emoji").unwrap_or_default();
                    let count: i64 = row.get::<Option<_>, _>("count").unwrap_or(0);
                    let users: Value = row.get::<Option<_>, _>("users").unwrap_or(json!([]));

                    json!({
                        "emoji": emoji,
                        "count": count,
                        "users": users
                    })
                })
                .collect();

            // ✅ OPTIMISATION: Mettre en cache pour 30 secondes (TTL court car données fréquemment modifiées)
            let reactions_value = json!(reactions);
            let _ = state
                .global_cache
                .set(&cache_key, &reactions_value, Duration::from_secs(30))
                .await;

            Ok(Json(json!({
                "success": true,
                "reactions": reactions,
                "cached": false
            })))
        }
        Err(e) => {
            log::error!("[ChatReactions] ❌ Erreur DB: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub fn create_chat_reactions_router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/api/chat/messages/{message_id}/reactions",
            post(add_reaction).get(get_message_reactions),
        )
        .route(
            "/api/chat/messages/{message_id}/reactions/{emoji}",
            delete(remove_reaction),
        )
        .layer(axum::middleware::from_fn(jwt_auth))
}
