use crate::core::types::AppResult;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::path::PathBuf;
use tokio::fs;
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SharedFile {
    pub id: String,
    pub user_id: i32,
    pub chat_id: String,
    pub original_filename: String,
    pub stored_filename: String,
    pub file_path: String,
    pub file_size_bytes: i64, // Changé de u64 à i64 pour PostgreSQL
    pub mime_type: String,
    pub is_public: bool,
    pub download_count: i32,
    pub max_downloads: Option<i32>,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileUploadRequest {
    pub chat_id: String,
    pub original_filename: String,
    pub mime_type: String,
    pub is_public: bool,
    pub max_downloads: Option<i32>,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileDownload {
    pub id: String,
    pub file_id: String,
    pub user_id: i32,
    pub downloaded_at: DateTime<Utc>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
}

pub struct FileSharingService {
    pool: PgPool,
    upload_dir: PathBuf,
    max_file_size: u64, // en bytes
    allowed_extensions: Vec<String>,
    allowed_mime_types: Vec<String>,
}

impl FileSharingService {
    pub fn new(pool: PgPool, upload_dir: PathBuf) -> Self {
        Self {
            pool,
            upload_dir,
            max_file_size: 100 * 1024 * 1024, // 100 MB
            allowed_extensions: vec![
                "pdf".to_string(), "doc".to_string(), "docx".to_string(),
                "txt".to_string(), "rtf".to_string(), "odt".to_string(),
                "jpg".to_string(), "jpeg".to_string(), "png".to_string(),
                "gif".to_string(), "bmp".to_string(), "svg".to_string(),
                "mp4".to_string(), "avi".to_string(), "mov".to_string(),
                "mp3".to_string(), "wav".to_string(), "ogg".to_string(),
                "zip".to_string(), "rar".to_string(), "7z".to_string(),
            ],
            allowed_mime_types: vec![
                "application/pdf".to_string(),
                "application/msword".to_string(),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document".to_string(),
                "text/plain".to_string(),
                "text/rtf".to_string(),
                "application/vnd.oasis.opendocument.text".to_string(),
                "image/jpeg".to_string(),
                "image/png".to_string(),
                "image/gif".to_string(),
                "image/bmp".to_string(),
                "image/svg+xml".to_string(),
                "video/mp4".to_string(),
                "video/x-msvideo".to_string(),
                "video/quicktime".to_string(),
                "audio/mpeg".to_string(),
                "audio/wav".to_string(),
                "audio/ogg".to_string(),
                "application/zip".to_string(),
                "application/x-rar-compressed".to_string(),
                "application/x-7z-compressed".to_string(),
            ],
        }
    }

    /// Uploader un fichier
    pub async fn upload_file(
        &self,
        user_id: i32,
        request: FileUploadRequest,
        file_data: Vec<u8>,
    ) -> AppResult<SharedFile> {
        // Vérifier la taille du fichier
        if file_data.len() as u64 > self.max_file_size {
            return Err(crate::core::types::AppError::BadRequest(
                format!("Fichier trop volumineux. Taille max: {} MB", self.max_file_size / 1024 / 1024)
            ));
        }

        // Vérifier l'extension
        let extension = PathBuf::from(&request.original_filename)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("")
            .to_lowercase();

        if !self.allowed_extensions.contains(&extension) {
            return Err(crate::core::types::AppError::BadRequest(
                format!("Extension non autorisée. Extensions autorisées: {:?}", self.allowed_extensions)
            ));
        }

        // Vérifier le type MIME
        if !self.allowed_mime_types.contains(&request.mime_type) {
            return Err(crate::core::types::AppError::BadRequest(
                format!("Type MIME non autorisé. Types autorisés: {:?}", self.allowed_mime_types)
            ));
        }

        // Générer un nom de fichier unique
        let file_id = Uuid::new_v4();
        let stored_filename = format!("{}.{}", file_id, extension);
        let file_path = self.upload_dir.join(&stored_filename);

        // Créer le répertoire s'il n'existe pas
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).await?;
        }

        // Sauvegarder le fichier
        fs::write(&file_path, file_data).await?;

        // Enregistrer en base de données
        let shared_file = sqlx::query_as!(
            SharedFile,
            r#"
            INSERT INTO shared_files (
                id, user_id, chat_id, original_filename, stored_filename, file_path,
                file_size_bytes, mime_type, is_public, download_count, max_downloads, expires_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, $11)
            RETURNING id, user_id, chat_id, original_filename, stored_filename, file_path,
                      file_size_bytes, mime_type, is_public, download_count, max_downloads, 
                      expires_at, created_at, updated_at
            "#,
            file_id.to_string(),
            user_id,
            request.chat_id,
            request.original_filename,
            stored_filename,
            &file_path.to_string_lossy(), // Ajout du & pour convertir Cow en &str
            file_data.len() as i64, // Changé en i64
            request.mime_type,
            request.is_public,
            request.max_downloads,
            request.expires_at,
        )
        .fetch_one(&self.pool)
        .await?;

        log::info!(
            "Fichier uploadé: {} ({} bytes) par l'utilisateur {}",
            shared_file.original_filename,
            shared_file.file_size_bytes,
            user_id
        );

        Ok(shared_file)
    }

    /// Télécharger un fichier
    pub async fn download_file(
        &self,
        file_id: &str,
        user_id: i32,
        ip_address: Option<String>,
        user_agent: Option<String>,
    ) -> AppResult<(Vec<u8>, SharedFile)> {
        // Récupérer les informations du fichier
        let shared_file = sqlx::query_as!(
            SharedFile,
            "SELECT * FROM shared_files WHERE id = $1",
            file_id
        )
        .fetch_one(&self.pool)
        .await?;

        // Vérifier si le fichier a expiré
        if let Some(expires_at) = shared_file.expires_at {
            if Utc::now() > expires_at {
                return Err(crate::core::types::AppError::BadRequest(
                    "Ce fichier a expiré".into()
                ));
            }
        }

        // Vérifier le nombre maximum de téléchargements
        if let Some(max_downloads) = shared_file.max_downloads {
            if shared_file.download_count >= max_downloads {
                return Err(crate::core::types::AppError::BadRequest(
                    "Nombre maximum de téléchargements atteint".into()
                ));
            }
        }

        // Lire le fichier
        let file_path = PathBuf::from(&shared_file.file_path);
        let file_data = fs::read(&file_path).await?;

        // Enregistrer le téléchargement
        let download_id = Uuid::new_v4();
        sqlx::query!(
            r#"
            INSERT INTO file_downloads (id, file_id, user_id, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5)
            "#,
            download_id.to_string(),
            file_id,
            user_id,
            ip_address,
            user_agent
        )
        .execute(&self.pool)
        .await?;

        // Incrémenter le compteur de téléchargements
        sqlx::query!(
            "UPDATE shared_files SET download_count = download_count + 1 WHERE id = $1",
            file_id
        )
        .execute(&self.pool)
        .await?;

        log::info!(
            "Fichier téléchargé: {} par l'utilisateur {}",
            shared_file.original_filename,
            user_id
        );

        Ok((file_data, shared_file))
    }

    /// Récupérer tous les fichiers d'un chat
    pub async fn get_chat_files(&self, chat_id: &str) -> AppResult<Vec<SharedFile>> {
        let files = sqlx::query_as!(
            SharedFile,
            "SELECT * FROM shared_files WHERE chat_id = $1 ORDER BY created_at DESC",
            chat_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(files)
    }

    /// Supprimer un fichier
    pub async fn delete_file(&self, file_id: &str, user_id: i32) -> AppResult<()> {
        // Vérifier que l'utilisateur est le propriétaire
        let shared_file = sqlx::query_as!(
            SharedFile,
            "SELECT * FROM shared_files WHERE id = $1 AND user_id = $2",
            file_id,
            user_id
        )
        .fetch_one(&self.pool)
        .await?;

        // Supprimer le fichier physique
        let file_path = PathBuf::from(&shared_file.file_path);
        if file_path.exists() {
            fs::remove_file(&file_path).await?;
        }

        // Supprimer de la base de données
        sqlx::query!("DELETE FROM shared_files WHERE id = $1", file_id)
            .execute(&self.pool)
            .await?;

        // Supprimer les enregistrements de téléchargement
        sqlx::query!("DELETE FROM file_downloads WHERE file_id = $1", file_id)
            .execute(&self.pool)
            .await?;

        log::info!("Fichier supprimé: {}", file_id);
        Ok(())
    }

    /// Obtenir les statistiques des fichiers
    pub async fn get_file_stats(&self, user_id: i32) -> AppResult<serde_json::Value> {
        let stats = sqlx::query!(
            r#"
            SELECT 
                COUNT(*) as total_files,
                SUM(file_size_bytes) as total_size,
                AVG(file_size_bytes) as avg_size,
                SUM(download_count) as total_downloads
            FROM shared_files 
            WHERE user_id = $1
            "#,
            user_id
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(serde_json::json!({
            "total_files": stats.total_files.unwrap_or(0),
            "total_size_bytes": stats.total_size.unwrap_or(0),
            "average_size_bytes": stats.avg_size.unwrap_or(0.0),
            "total_downloads": stats.total_downloads.unwrap_or(0),
        }))
    }

    /// Nettoyer les fichiers expirés
    pub async fn cleanup_expired_files(&self) -> AppResult<u64> {
        let now = Utc::now();
        
        // Récupérer les fichiers expirés
        let expired_files = sqlx::query_as!(
            SharedFile,
            "SELECT * FROM shared_files WHERE expires_at < $1",
            now
        )
        .fetch_all(&self.pool)
        .await?;

        let mut deleted_count = 0;
        for file in expired_files {
            // Supprimer le fichier physique
            let file_path = PathBuf::from(&file.file_path);
            if file_path.exists() {
                if let Err(e) = fs::remove_file(&file_path).await {
                    log::error!("Erreur suppression fichier expiré {}: {}", file.id, e);
                    continue;
                }
            }

            // Supprimer de la base de données
            if let Err(e) = sqlx::query!("DELETE FROM shared_files WHERE id = $1", file.id)
                .execute(&self.pool)
                .await
            {
                log::error!("Erreur suppression fichier expiré {} de la DB: {}", file.id, e);
                continue;
            }

            deleted_count += 1;
        }

        log::info!("{} fichiers expirés supprimés", deleted_count);
        Ok(deleted_count)
    }
} 