use crate::core::types::AppResult;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::path::PathBuf;
use tokio::fs;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceMessage {
    pub id: String,
    pub user_id: i32,
    pub chat_id: String,
    pub file_path: String,
    pub duration_seconds: f32,
    pub file_size_bytes: i64, // Changé de u64 à i64 pour PostgreSQL
    pub mime_type: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>, // Ajouté
    pub is_processed: bool,
    pub transcription: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceMessageRequest {
    pub chat_id: String,
    pub duration_seconds: f32,
    pub mime_type: String,
}

pub struct VoiceMessageService {
    pool: PgPool,
    upload_dir: PathBuf,
    max_file_size: u64, // en bytes
    supported_formats: Vec<String>,
}

impl VoiceMessageService {
    pub fn new(pool: PgPool, upload_dir: PathBuf) -> Self {
        Self {
            pool,
            upload_dir,
            max_file_size: 50 * 1024 * 1024, // 50 MB
            supported_formats: vec![
                "audio/wav".to_string(),
                "audio/mp3".to_string(),
                "audio/ogg".to_string(),
                "audio/webm".to_string(),
            ],
        }
    }

    /// Enregistrer un nouveau message vocal
    pub async fn save_voice_message(
        &self,
        user_id: i32,
        request: VoiceMessageRequest,
        audio_data: Vec<u8>,
    ) -> AppResult<VoiceMessage> {
        // Vérifier la taille du fichier
        if audio_data.len() as u64 > self.max_file_size {
            return Err(crate::core::types::AppError::BadRequest(
                format!("Fichier trop volumineux. Taille max: {} MB", self.max_file_size / 1024 / 1024)
            ));
        }

        // Vérifier le format
        if !self.supported_formats.contains(&request.mime_type) {
            return Err(crate::core::types::AppError::BadRequest(
                format!("Format non supporté. Formats supportés: {:?}", self.supported_formats)
            ));
        }

        // Générer un nom de fichier unique
        let file_id = Uuid::new_v4();
        let file_extension = match request.mime_type.as_str() {
            "audio/wav" => "wav",
            "audio/mp3" => "mp3",
            "audio/ogg" => "ogg",
            "audio/webm" => "webm",
            _ => "wav",
        };
        let filename = format!("voice_{}.{}", file_id, file_extension);
        let file_path = self.upload_dir.join(&filename);

        // Créer le répertoire s'il n'existe pas
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).await?;
        }

        // Sauvegarder le fichier audio
        fs::write(&file_path, audio_data).await?;

        // Enregistrer en base de données
        let voice_message = sqlx::query_as!(
            VoiceMessage,
            r#"
            INSERT INTO voice_messages (
                id, user_id, chat_id, file_path, duration_seconds, 
                file_size_bytes, mime_type, is_processed
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, false)
            RETURNING id, user_id, chat_id, file_path, duration_seconds, 
                      file_size_bytes, mime_type, created_at, is_processed, transcription
            "#,
            file_id.to_string(),
            user_id,
            request.chat_id,
            file_path.to_string_lossy(),
            request.duration_seconds,
            audio_data.len() as i64, // Changed from u64 to i64
            request.mime_type,
        )
        .fetch_one(&self.pool)
        .await?;

        log::info!(
            "Message vocal enregistré: {} ({}s, {} bytes) pour l'utilisateur {}",
            voice_message.id,
            voice_message.duration_seconds,
            voice_message.file_size_bytes,
            user_id
        );

        Ok(voice_message)
    }

    /// Récupérer un message vocal
    pub async fn get_voice_message(&self, message_id: &str) -> AppResult<VoiceMessage> {
        let voice_message = sqlx::query_as!(
            VoiceMessage,
            "SELECT id, user_id, chat_id, file_path, duration_seconds, file_size_bytes, mime_type, created_at, updated_at, is_processed, transcription FROM voice_messages WHERE id = $1",
            message_id
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(voice_message)
    }

    /// Récupérer tous les messages vocaux d'un chat
    pub async fn get_chat_voice_messages(&self, chat_id: &str) -> AppResult<Vec<VoiceMessage>> {
        let voice_messages = sqlx::query_as!(
            VoiceMessage,
            "SELECT id, user_id, chat_id, file_path, duration_seconds, file_size_bytes, mime_type, created_at, updated_at, is_processed, transcription FROM voice_messages WHERE chat_id = $1 ORDER BY created_at DESC",
            chat_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(voice_messages)
    }

    /// Supprimer un message vocal
    pub async fn delete_voice_message(&self, message_id: &str, user_id: i32) -> AppResult<()> {
        // Vérifier que l'utilisateur est le propriétaire
        let voice_message = sqlx::query_as!(
            VoiceMessage,
            "SELECT id, user_id, chat_id, file_path, duration_seconds, file_size_bytes, mime_type, created_at, updated_at, is_processed, transcription FROM voice_messages WHERE id = $1 AND user_id = $2",
            message_id,
            user_id
        )
        .fetch_one(&self.pool)
        .await?;

        // Supprimer le fichier
        let file_path = PathBuf::from(&voice_message.file_path);
        if file_path.exists() {
            fs::remove_file(&file_path).await?;
        }

        // Supprimer de la base de données
        sqlx::query!("DELETE FROM voice_messages WHERE id = $1", message_id)
            .execute(&self.pool)
            .await?;

        log::info!("Message vocal supprimé: {}", message_id);
        Ok(())
    }

    /// Traiter un message vocal (transcription, compression, etc.)
    pub async fn process_voice_message(&self, message_id: &str) -> AppResult<()> {
        // Marquer comme en cours de traitement
        sqlx::query!(
            "UPDATE voice_messages SET is_processed = true WHERE id = $1",
            message_id
        )
        .execute(&self.pool)
        .await?;

        // TODO: Implémenter la transcription audio
        // Pour l'instant, on simule
        log::info!("Traitement du message vocal: {}", message_id);

        Ok(())
    }

    /// Obtenir les statistiques des messages vocaux
    pub async fn get_voice_message_stats(&self, user_id: i32) -> AppResult<serde_json::Value> {
        let stats = sqlx::query!(
            r#"
            SELECT 
                COUNT(*) as total_messages,
                SUM(duration_seconds) as total_duration,
                SUM(file_size_bytes) as total_size,
                AVG(duration_seconds) as avg_duration
            FROM voice_messages 
            WHERE user_id = $1
            "#,
            user_id
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(serde_json::json!({
            "total_messages": stats.total_messages.unwrap_or(0),
            "total_duration_seconds": stats.total_duration.unwrap_or(0.0),
            "total_size_bytes": stats.total_size.unwrap_or(0i64),
            "average_duration_seconds": stats.avg_duration.unwrap_or(0.0),
        }))
    }
} 