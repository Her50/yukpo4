// src/controllers/conversation_controller.rs
// Contrôleur pour gérer les participants et @mentions dans les conversations
// ✅ REFACTORÉ : Utilise sqlx::query() au lieu de sqlx::query!() pour éviter les problèmes de compilation offline

use axum::{
    extract::{Path, Query, State},
    response::Json,
    Extension,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{PgPool, Row};
use std::sync::Arc;
use log::{info, error};

use crate::{
    middlewares::jwt::AuthenticatedUser,
    state::AppState,
    core::types::{AppError, AppResult},
};

#[derive(Debug, Deserialize)]
pub struct InviteUserRequest {
    pub user_id: i32,
    pub context: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePrivateConversationRequest {
    pub target_user_id: i32,
    pub context: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SearchUsersQuery {
    pub query: Option<String>,
    pub category: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct ParticipantInfo {
    pub user_id: i32,
    pub user_name: String,
    pub user_email: String,
    pub user_avatar: Option<String>,
    pub role: String,
    pub invited_by: Option<i32>,
    pub invited_by_name: Option<String>,
    pub joined_at: chrono::DateTime<chrono::Utc>,
    pub can_remove: bool,
}

#[derive(Debug, Serialize)]
pub struct TagHistoryItem {
    pub user_id: i32,
    pub user_name: String,
    pub user_avatar: Option<String>,
    pub tag_count: i64,
    pub last_tagged: chrono::DateTime<chrono::Utc>,
    pub context: Option<String>,
}

/// Inviter un utilisateur dans une conversation
pub async fn invite_user_to_conversation(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(conversation_id): Path<String>,
    Json(payload): Json<InviteUserRequest>,
) -> AppResult<Json<serde_json::Value>> {
    info!("[invite_user_to_conversation] User {} inviting {} to conversation {}", 
          auth_user.id, payload.user_id, conversation_id);
    
    let pool = &state.pg;
    
    // Vérifier que l'utilisateur invitant est bien participant de la conversation
    let is_participant = sqlx::query(
        "SELECT EXISTS(SELECT 1 FROM conversation_participants 
         WHERE conversation_id = $1 AND user_id = $2 AND is_active = TRUE) as exists"
    )
    .bind(&conversation_id)
    .bind(auth_user.id)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        error!("[invite_user_to_conversation] Error checking participant: {:?}", e);
        AppError::Internal("Database error".to_string())
    })?
    .get::<bool, _>("exists");
    
    if !is_participant {
        return Err(AppError::Forbidden("Vous devez être participant de cette conversation pour inviter quelqu'un".to_string()));
    }
    
    // Récupérer le dernier message_id pour définir first_visible_message_id
    let last_message_id = sqlx::query("SELECT id FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1")
        .bind(&conversation_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Error fetching last message: {}", e)))?
        .map(|row| row.get::<String, _>("id"));
    
    // Ajouter le nouveau participant
    let result = sqlx::query(
        r#"
        INSERT INTO conversation_participants 
        (conversation_id, user_id, invited_by, role, can_remove, first_visible_message_id, is_active)
        VALUES ($1, $2, $3, 'participant', TRUE, $4, TRUE)
        ON CONFLICT (conversation_id, user_id) 
        DO UPDATE SET is_active = TRUE, invited_by = $3, first_visible_message_id = $4
        RETURNING id
        "#
    )
    .bind(&conversation_id)
    .bind(payload.user_id)
    .bind(auth_user.id)
    .bind(last_message_id)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        error!("[invite_user_to_conversation] Error inserting participant: {:?}", e);
        AppError::Internal("Failed to add participant".to_string())
    })?;
    
    let participant_id = result.get::<i32, _>("id");
    
    // Enregistrer dans l'historique des tags
    let _ = sqlx::query(
        "INSERT INTO conversation_tag_history (user_id, tagged_user_id, conversation_id, context)
         VALUES ($1, $2, $3, $4)"
    )
    .bind(auth_user.id)
    .bind(payload.user_id)
    .bind(&conversation_id)
    .bind(payload.context.as_deref())
    .execute(pool)
    .await;
    
    // Créer une notification pour l'utilisateur invité
    let conv_info = sqlx::query("SELECT service_title FROM conversations WHERE id = $1")
        .bind(&conversation_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Error fetching conversation: {}", e)))?;
    
    if let Some(conv) = conv_info {
        let service_title = conv.get::<Option<String>, _>("service_title");
        
        // Récupérer le nom de l'inviteur
        let inviter_name = sqlx::query("SELECT nom_complet FROM users WHERE id = $1")
            .bind(auth_user.id)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten()
            .and_then(|row| row.get::<Option<String>, _>("nom_complet"))
            .unwrap_or_else(|| "Un utilisateur".to_string());
        
        let _ = sqlx::query(
            r#"
            INSERT INTO notifications (user_id, title, message, type, priority, metadata)
            VALUES ($1, $2, $3, 'conversation_invite', 'high', $4)
            "#
        )
        .bind(payload.user_id)
        .bind(format!("💬 {} vous a invité dans une conversation", inviter_name))
        .bind(format!("Au sujet de: {}\n\nVous avez été ajouté à cette conversation.", 
                service_title.unwrap_or_else(|| "un service".to_string())))
        .bind(json!({
            "conversation_id": conversation_id,
            "inviter_id": auth_user.id,
            "inviter_name": inviter_name
        }))
        .execute(pool)
        .await;
    }
    
    info!("[invite_user_to_conversation] User {} successfully invited to conversation {}", 
          payload.user_id, conversation_id);
    
    Ok(Json(json!({
        "success": true,
        "message": "Utilisateur invité avec succès",
        "participant_id": participant_id
    })))
}

/// Retirer un participant d'une conversation
pub async fn remove_participant_from_conversation(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path((conversation_id, user_id)): Path<(String, i32)>,
) -> AppResult<Json<serde_json::Value>> {
    info!("[remove_participant] User {} removing {} from conversation {}", 
          auth_user.id, user_id, conversation_id);
    
    let pool = &state.pg;
    
    // Vérifier les permissions du participant à retirer
    let participant_info = sqlx::query(
        "SELECT can_remove, role FROM conversation_participants 
         WHERE conversation_id = $1 AND user_id = $2 AND is_active = TRUE"
    )
    .bind(&conversation_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Database error: {}", e)))?;
    
    let participant = participant_info.ok_or_else(|| 
        AppError::NotFound("Participant not found".to_string())
    )?;
    
    let can_remove = participant.get::<bool, _>("can_remove");
    
    if !can_remove {
        return Err(AppError::Forbidden("Ce participant ne peut pas être retiré (propriétaire de la conversation)".to_string()));
    }
    
    // Seuls les owners et le participant lui-même peuvent retirer
    let is_owner = sqlx::query(
        "SELECT EXISTS(SELECT 1 FROM conversation_participants 
         WHERE conversation_id = $1 AND user_id = $2 AND role = 'owner' AND is_active = TRUE) as exists"
    )
    .bind(&conversation_id)
    .bind(auth_user.id)
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Database error: {}", e)))?
    .get::<bool, _>("exists");
    
    if !is_owner && auth_user.id != user_id {
        return Err(AppError::Forbidden("Seuls les propriétaires peuvent retirer d'autres participants".to_string()));
    }
    
    // Marquer le participant comme inactif (soft delete)
    sqlx::query(
        "UPDATE conversation_participants 
         SET is_active = FALSE, left_at = NOW()
         WHERE conversation_id = $1 AND user_id = $2"
    )
    .bind(&conversation_id)
    .bind(user_id)
    .execute(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Failed to remove participant: {}", e)))?;
    
    info!("[remove_participant] User {} successfully removed from conversation {}", 
          user_id, conversation_id);
    
    Ok(Json(json!({
        "success": true,
        "message": "Participant retiré avec succès"
    })))
}

/// Liste des participants actifs d'une conversation
pub async fn get_conversation_participants(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(conversation_id): Path<String>,
) -> AppResult<Json<Vec<ParticipantInfo>>> {
    let pool = &state.pg;
    
    // Vérifier que l'utilisateur est participant
    let is_participant = sqlx::query(
        "SELECT EXISTS(SELECT 1 FROM conversation_participants 
         WHERE conversation_id = $1 AND user_id = $2 AND is_active = TRUE) as exists"
    )
    .bind(&conversation_id)
    .bind(auth_user.id)
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Database error: {}", e)))?
    .get::<bool, _>("exists");
    
    if !is_participant {
        return Err(AppError::Forbidden("Vous n'êtes pas participant de cette conversation".to_string()));
    }
    
    // Récupérer la liste des participants
    let rows = sqlx::query(
        r#"
        SELECT 
            cp.user_id,
            u.nom_complet as user_name,
            u.email as user_email,
            u.avatar_url as user_avatar,
            cp.role,
            cp.invited_by,
            inv.nom_complet as invited_by_name,
            cp.joined_at,
            cp.can_remove
        FROM conversation_participants cp
        JOIN users u ON cp.user_id = u.id
        LEFT JOIN users inv ON cp.invited_by = inv.id
        WHERE cp.conversation_id = $1 AND cp.is_active = TRUE
        ORDER BY cp.joined_at ASC
        "#
    )
    .bind(&conversation_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Failed to fetch participants: {}", e)))?;
    
    let participants: Vec<ParticipantInfo> = rows.iter().map(|row| ParticipantInfo {
        user_id: row.get("user_id"),
        user_name: row.get::<Option<String>, _>("user_name").unwrap_or_else(|| format!("User {}", row.get::<i32, _>("user_id"))),
        user_email: row.get::<Option<String>, _>("user_email").unwrap_or_default(),
        user_avatar: row.get("user_avatar"),
        role: row.get("role"),
        invited_by: row.get("invited_by"),
        invited_by_name: row.get("invited_by_name"),
        joined_at: row.get("joined_at"),
        can_remove: row.get("can_remove"),
    }).collect();
    
    Ok(Json(participants))
}

/// Rechercher des utilisateurs/prestataires pour invitation
pub async fn search_users_for_invitation(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Query(params): Query<SearchUsersQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let pool = &state.pg;
    let limit = params.limit.unwrap_or(20).min(50);
    
    let rows = if let Some(query) = params.query {
        let search_pattern = format!("%{}%", query);
        sqlx::query(
            r#"
            SELECT id, nom_complet, email, avatar_url, is_provider, role
            FROM users
            WHERE (nom_complet ILIKE $1 OR email ILIKE $1)
              AND id != $2
              AND is_active = TRUE
            ORDER BY is_provider DESC, nom_complet ASC
            LIMIT $3
            "#
        )
        .bind(search_pattern)
        .bind(auth_user.id)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Search error: {}", e)))?
    } else if let Some(category) = params.category {
        let category_pattern = format!("%{}%", category);
        sqlx::query(
            r#"
            SELECT DISTINCT u.id, u.nom_complet, u.email, u.avatar_url, u.is_provider, u.role
            FROM users u
            JOIN services s ON s.user_id = u.id
            WHERE s.is_active = TRUE
              AND (s.data->>'category' ILIKE $1 
                   OR s.data->>'titre_service' ILIKE $1)
              AND u.id != $2
              AND u.is_active = TRUE
            ORDER BY u.is_provider DESC
            LIMIT $3
            "#
        )
        .bind(category_pattern)
        .bind(auth_user.id)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Search error: {}", e)))?
    } else {
        Vec::new()
    };
    
    let results: Vec<serde_json::Value> = rows.iter().map(|row| {
        json!({
            "id": row.get::<i32, _>("id"),
            "nom_complet": row.get::<Option<String>, _>("nom_complet"),
            "email": row.get::<Option<String>, _>("email"),
            "avatar_url": row.get::<Option<String>, _>("avatar_url"),
            "is_provider": row.get::<Option<bool>, _>("is_provider"),
            "role": row.get::<Option<String>, _>("role")
        })
    }).collect();
    
    Ok(Json(json!({
        "success": true,
        "data": results,
        "count": results.len()
    })))
}

/// Obtenir l'historique des personnes taguées
pub async fn get_tag_history(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Query(params): Query<SearchUsersQuery>,
) -> AppResult<Json<Vec<TagHistoryItem>>> {
    let pool = &state.pg;
    let limit = params.limit.unwrap_or(10).min(20);
    
    let rows = sqlx::query(
        r#"
        SELECT 
            th.tagged_user_id as user_id,
            u.nom_complet as user_name,
            u.avatar_url as user_avatar,
            COUNT(*) as tag_count,
            MAX(th.tagged_at) as last_tagged,
            th.context
        FROM conversation_tag_history th
        JOIN users u ON th.tagged_user_id = u.id
        WHERE th.user_id = $1
          AND u.is_active = TRUE
        GROUP BY th.tagged_user_id, u.nom_complet, u.avatar_url, th.context
        ORDER BY MAX(th.tagged_at) DESC
        LIMIT $2
        "#
    )
    .bind(auth_user.id)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Failed to fetch tag history: {}", e)))?;
    
    let results: Vec<TagHistoryItem> = rows.iter().map(|row| TagHistoryItem {
        user_id: row.get("user_id"),
        user_name: row.get::<Option<String>, _>("user_name").unwrap_or_else(|| format!("User {}", row.get::<i32, _>("user_id"))),
        user_avatar: row.get("user_avatar"),
        tag_count: row.get("tag_count"),
        last_tagged: row.get("last_tagged"),
        context: row.get("context"),
    }).collect();
    
    Ok(Json(results))
}

/// Enregistrer une mention dans un message
pub async fn record_message_mention(
    pool: &PgPool,
    message_id: &str,
    mentioned_user_ids: &[i32],
) -> Result<(), AppError> {
    sqlx::query("UPDATE chat_messages SET mentioned_users = $1 WHERE id = $2")
        .bind(mentioned_user_ids)
        .bind(message_id)
        .execute(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to record mentions: {}", e)))?;
    
    Ok(())
}

/// GET /api/conversations/private/:target_user_id
/// Vérifier si une conversation privée existe entre l'utilisateur actuel et target_user_id
pub async fn check_private_conversation(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(target_user_id): Path<i32>,
) -> AppResult<Json<serde_json::Value>> {
    info!("[check_private_conversation] Checking private conversation between {} and {}", 
          auth_user.id, target_user_id);
    
    let pool = &state.pg;
    
    // Normaliser les IDs (user_1 < user_2)
    let (user_1, user_2) = if auth_user.id < target_user_id {
        (auth_user.id, target_user_id)
    } else {
        (target_user_id, auth_user.id)
    };
    
    // Chercher conversation privée existante
    let conversation = sqlx::query(
        "SELECT id FROM private_conversations WHERE user_1_id = $1 AND user_2_id = $2"
    )
    .bind(user_1)
    .bind(user_2)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        error!("[check_private_conversation] Database error: {:?}", e);
        AppError::Internal("Database error".to_string())
    })?;
    
    if let Some(conv) = conversation {
        let conv_id = conv.get::<i32, _>("id");
        info!("[check_private_conversation] Found existing conversation {}", conv_id);
        
        Ok(Json(json!({
            "success": true,
            "conversation_id": conv_id.to_string()
        })))
    } else {
        info!("[check_private_conversation] No existing conversation found");
        
        Ok(Json(json!({
            "success": false,
            "conversation_id": null
        })))
    }
}

/// POST /api/conversations/create-private
/// Créer une conversation privée 1-to-1
pub async fn create_private_conversation(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Json(payload): Json<CreatePrivateConversationRequest>,
) -> AppResult<Json<serde_json::Value>> {
    info!("[create_private_conversation] Creating private conversation between {} and {}", 
          auth_user.id, payload.target_user_id);
    
    let pool = &state.pg;
    
    // Vérifier que l'utilisateur cible existe et est actif
    let target_user = sqlx::query(
        "SELECT id, nom_complet FROM users WHERE id = $1 AND is_active = TRUE"
    )
    .bind(payload.target_user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        error!("[create_private_conversation] Error checking target user: {:?}", e);
        AppError::Internal("Database error".to_string())
    })?;
    
    if target_user.is_none() {
        return Err(AppError::NotFound("Utilisateur non trouvé ou inactif".to_string()));
    }
    
    let target_user_name = target_user.as_ref()
        .and_then(|row| row.get::<Option<String>, _>("nom_complet"))
        .unwrap_or_else(|| format!("User {}", payload.target_user_id));
    
    // Normaliser les IDs (user_1 < user_2)
    let (user_1, user_2) = if auth_user.id < payload.target_user_id {
        (auth_user.id, payload.target_user_id)
    } else {
        (payload.target_user_id, auth_user.id)
    };
    
    // Créer la conversation (ou récupérer si existe déjà)
    let conversation_id = sqlx::query_scalar::<_, i32>(
        r#"
        INSERT INTO private_conversations (user_1_id, user_2_id, context, last_message_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_1_id, user_2_id) DO UPDATE
        SET last_message_at = NOW(), context = COALESCE($3, private_conversations.context)
        RETURNING id
        "#
    )
    .bind(user_1)
    .bind(user_2)
    .bind(payload.context.as_deref().unwrap_or("direct_contact"))
    .fetch_one(pool)
    .await
    .map_err(|e| {
        error!("[create_private_conversation] Error creating conversation: {:?}", e);
        AppError::Internal("Failed to create conversation".to_string())
    })?;
    
    // Créer une notification pour l'utilisateur cible
    let current_user_name = sqlx::query("SELECT nom_complet FROM users WHERE id = $1")
        .bind(auth_user.id)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .and_then(|row| row.get::<Option<String>, _>("nom_complet"))
        .unwrap_or_else(|| "Un utilisateur".to_string());
    
    let _ = sqlx::query(
        r#"
        INSERT INTO notifications (user_id, title, message, type, priority, metadata)
        VALUES ($1, $2, $3, 'private_conversation', 'normal', $4)
        "#
    )
    .bind(payload.target_user_id)
    .bind(format!("💬 {} souhaite discuter avec vous", current_user_name))
    .bind("Une nouvelle conversation privée a été créée. Répondez pour commencer à discuter.")
    .bind(json!({
        "conversation_id": conversation_id,
        "initiator_id": auth_user.id,
        "initiator_name": current_user_name,
        "context": payload.context
    }))
    .execute(pool)
    .await;
    
    info!("[create_private_conversation] Conversation {} created successfully", conversation_id);
    
    Ok(Json(json!({
        "success": true,
        "conversation_id": conversation_id.to_string(),
        "message": format!("Conversation privée créée avec {}", target_user_name)
    })))
}
