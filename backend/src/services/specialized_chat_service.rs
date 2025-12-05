// ✅ NOUVEAU: Service de chat intégré pour services spécialisés
// Utilise le système de chat existant mais avec contexte spécialisé

use crate::core::types::{AppError, AppResult};
use serde_json::json;
use sqlx::{PgPool, Row};
use std::sync::Arc;

pub struct SpecializedChatService {
    pool: Arc<PgPool>,
}

impl SpecializedChatService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    /// Créer ou récupérer une conversation pour un service spécialisé
    /// Retourne l'ID de la conversation existante ou crée une nouvelle
    /// Note: Retourne String (UUID) car conversations.id est TEXT
    pub async fn get_or_create_conversation(
        &self,
        service_id: i32,
        service_type: &str,
        client_id: i32,
        prestataire_id: i32,
    ) -> AppResult<String> {
        // Vérifier si une conversation existe déjà
        // Note: conversations utilise client_id et prestataire_id (pas user_id/provider_id)
        let existing: Option<String> = sqlx::query_scalar(
            r#"
            SELECT id FROM conversations
            WHERE service_id = $1 AND client_id = $2 AND prestataire_id = $3
            LIMIT 1
            "#,
        )
        .bind(service_id)
        .bind(client_id)
        .bind(prestataire_id)
        .fetch_optional(&*self.pool)
        .await?;

        if let Some(conv_id) = existing {
            // Convertir String en i32 pour compatibilité (mais conversations.id est TEXT)
            // On retourne directement le String car c'est un UUID
            return Ok(conv_id.parse::<i32>().unwrap_or(0));
        }

        // Créer une nouvelle conversation
        // Note: conversations.id est TEXT (UUID), mais on retourne i32 pour compatibilité
        // En réalité, on devrait retourner String, mais pour l'instant on garde i32
        let conv_id_str: String = sqlx::query_scalar(
            r#"
            INSERT INTO conversations (
                client_id, prestataire_id, service_id, 
                service_title, status, is_active,
                created_at, updated_at, last_message_at
            )
            VALUES (
                $1, $2, $3,
                $4, 'active', true,
                NOW(), NOW(), NOW()
            )
            RETURNING id
            "#,
        )
        .bind(client_id)
        .bind(prestataire_id)
        .bind(service_id)
        .bind(format!("Service {} - {}", service_type, service_id))
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur création conversation: {}", e)))?;

        Ok(conv_id_str)
    }

    /// Envoyer un message dans une conversation spécialisée
    pub async fn send_message(
        &self,
        conversation_id: &str, // UUID string
        sender_id: i32,
        message: &str,
        message_type: Option<&str>, // "text", "reservation", "payment", etc.
    ) -> AppResult<String> {
        let message_id: String = sqlx::query_scalar(
            r#"
            INSERT INTO chat_messages (
                conversation_id, from_user_id, content, message_type,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, COALESCE($4, 'text'), NOW(), NOW())
            RETURNING id
            "#,
        )
        .bind(conversation_id)
        .bind(sender_id)
        .bind(message)
        .bind(message_type)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur envoi message: {}", e)))?;

        // Le trigger met à jour automatiquement last_message_at et updated_at
        Ok(message_id)
    }

    /// Lister les conversations d'un utilisateur pour services spécialisés
    pub async fn list_user_conversations(&self, user_id: i32) -> AppResult<Vec<serde_json::Value>> {
        let rows = sqlx::query(
            r#"
            SELECT 
                c.id, c.service_id, c.service_title, 
                c.updated_at, c.last_message_at,
                (SELECT content FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
                (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id AND is_read = false AND from_user_id != $1) as unread_count
            FROM conversations c
            WHERE (c.client_id = $1 OR c.prestataire_id = $1)
                AND c.service_id IS NOT NULL
            ORDER BY c.last_message_at DESC
            "#
        )
        .bind(user_id)
        .fetch_all(&*self.pool)
        .await?;

        let conversations: Vec<serde_json::Value> = rows
            .into_iter()
            .map(|row| {
                json!({
                    "id": row.get::<String, _>(0),
                    "service_id": row.get::<Option<i32>, _>(1),
                    "title": row.get::<Option<String>, _>(2),
                    "updated_at": row.get::<chrono::DateTime<chrono::Utc>, _>(3),
                    "last_message_at": row.get::<Option<chrono::DateTime<chrono::Utc>>, _>(4),
                    "last_message": row.get::<Option<String>, _>(5),
                    "unread_count": row.get::<Option<i64>, _>(6).unwrap_or(0),
                })
            })
            .collect();

        Ok(conversations)
    }
}
