// ✅ NOUVEAU 2025-01-27 : Service d'upload asynchrone pour gros fichiers
// Permet l'upload de fichiers volumineux avec feedback en temps réel via WebSocket

use crate::core::types::{AppError, AppResult};
use axum::extract::multipart::Multipart;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::fs;
use tokio::sync::broadcast;
use uuid::Uuid;

/// Statut d'un upload asynchrone
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UploadStatus {
    Pending,
    Processing,
    Uploading { progress: u8 }, // 0-100
    Completed { file_path: String },
    Failed { error: String },
}

/// Métadonnées d'un upload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadMetadata {
    pub upload_id: String,
    pub user_id: i32,
    pub file_name: String,
    pub file_size: u64,
    pub file_type: String,
    pub status: UploadStatus,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Gestionnaire d'uploads asynchrones
pub struct AsyncUploadService {
    pool: Arc<PgPool>,
    storage_root: PathBuf,
    // Channel pour notifications WebSocket (partagé globalement)
    status_broadcast: Arc<broadcast::Sender<(String, UploadStatus)>>,
}

// ✅ Instance globale du channel broadcast pour WebSocket
static UPLOAD_STATUS_BROADCAST: Lazy<broadcast::Sender<(String, UploadStatus)>> = Lazy::new(|| {
    let (tx, _) = broadcast::channel(1000);
    tx
});

impl AsyncUploadService {
    pub fn new(pool: Arc<PgPool>, storage_root: impl AsRef<Path>) -> Self {
        Self {
            pool,
            storage_root: storage_root.as_ref().to_path_buf(),
            status_broadcast: Arc::new((*UPLOAD_STATUS_BROADCAST).clone()),
        }
    }

    /// Récupère le receiver pour WebSocket
    pub fn subscribe(&self) -> broadcast::Receiver<(String, UploadStatus)> {
        self.status_broadcast.subscribe()
    }

    /// Démarre un upload asynchrone
    pub async fn start_async_upload(
        &self,
        user_id: i32,
        multipart: Multipart,
    ) -> AppResult<String> {
        let upload_id = Uuid::new_v4().to_string();

        // Créer le répertoire de travail
        let upload_dir = self.storage_root.join("async_uploads").join(&upload_id);
        fs::create_dir_all(&upload_dir).await?;

        // Enregistrer les métadonnées dans la base
        let metadata = UploadMetadata {
            upload_id: upload_id.clone(),
            user_id,
            file_name: "pending".to_string(),
            file_size: 0,
            file_type: "unknown".to_string(),
            status: UploadStatus::Pending,
            created_at: chrono::Utc::now(),
        };

        sqlx::query(
            r#"
            INSERT INTO async_uploads (upload_id, user_id, file_name, file_size, file_type, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#
        )
        .bind(&upload_id)
        .bind(user_id)
        .bind(&metadata.file_name)
        .bind(metadata.file_size as i64)
        .bind(&metadata.file_type)
        .bind(serde_json::to_string(&metadata.status)?)
        .bind(metadata.created_at.naive_utc())
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur enregistrement upload: {}", e)))?;

        // Démarrer le traitement asynchrone
        let pool_clone = self.pool.clone();
        let storage_clone = self.storage_root.clone();
        let upload_id_clone = upload_id.clone();
        let status_tx = self.status_broadcast.clone();

        let _ = tokio::spawn(async move {
            if let Err(e) = Self::process_upload(
                &pool_clone,
                &storage_clone,
                &upload_id_clone,
                multipart,
                (*status_tx).clone(),
            )
            .await
            {
                log::error!(
                    "[AsyncUploadService] Erreur traitement upload {}: {}",
                    upload_id_clone,
                    e
                );
            }
        });

        Ok(upload_id)
    }

    /// Traite un upload de manière asynchrone
    async fn process_upload(
        pool: &PgPool,
        storage_root: &Path,
        upload_id: &str,
        mut multipart: Multipart,
        status_tx: broadcast::Sender<(String, UploadStatus)>,
    ) -> AppResult<()> {
        // Mettre à jour le statut : Processing
        Self::update_status(pool, upload_id, UploadStatus::Processing).await?;
        let _ = status_tx.send((upload_id.to_string(), UploadStatus::Processing));

        let mut file_name = String::new();
        let mut file_size = 0u64;
        let mut file_type = String::new();
        let mut file_data = Vec::new();

        // Lire les données multipart
        while let Some(field) = multipart
            .next_field()
            .await
            .map_err(|e| AppError::BadRequest(format!("Erreur lecture multipart: {}", e)))?
        {
            let name = field.name().unwrap_or("").to_string();

            if name == "file" {
                file_name = field.file_name().unwrap_or("unknown").to_string();

                // Détecter le type MIME
                if let Some(content_type) = field.content_type() {
                    file_type = content_type.to_string();
                }

                // Lire les données par chunks pour gérer les gros fichiers
                let mut chunk_count = 0;
                let mut field = field;
                while let Some(chunk) = field
                    .chunk()
                    .await
                    .map_err(|e| AppError::BadRequest(format!("Erreur lecture chunk: {}", e)))?
                {
                    file_data.extend_from_slice(&chunk);
                    file_size += chunk.len() as u64;
                    chunk_count += 1;

                    // Mettre à jour le progrès tous les 10 chunks (ou 1 MB)
                    if chunk_count % 10 == 0 || file_data.len() > 1_000_000 {
                        let progress =
                            ((file_data.len() as f64 / (file_size.max(1) as f64)) * 100.0) as u8;
                        let status = UploadStatus::Uploading {
                            progress: progress.min(99),
                        };
                        Self::update_status(pool, upload_id, status.clone()).await?;
                        let _ = status_tx.send((upload_id.to_string(), status));
                    }
                }
            }
        }

        if file_data.is_empty() {
            let error = "Aucun fichier fourni".to_string();
            Self::update_status(
                pool,
                upload_id,
                UploadStatus::Failed {
                    error: error.clone(),
                },
            )
            .await?;
            let _ = status_tx.send((upload_id.to_string(), UploadStatus::Failed { error }));
            return Err(AppError::BadRequest("Aucun fichier fourni".to_string()));
        }

        // Déterminer le sous-répertoire selon le type
        let subdir = if file_type.starts_with("image/") {
            "images"
        } else if file_type.starts_with("video/") {
            "videos"
        } else {
            "files"
        };

        // Créer le répertoire de destination
        let dest_dir = storage_root.join("uploads").join(subdir);
        fs::create_dir_all(&dest_dir).await?;

        // Générer un nom de fichier unique
        let extension = Path::new(&file_name).extension().and_then(|e| e.to_str()).unwrap_or("bin");
        let unique_name = format!("{}_{}.{}", upload_id, Uuid::new_v4(), extension);
        let file_path = dest_dir.join(&unique_name);

        // Sauvegarder le fichier
        fs::write(&file_path, &file_data).await?;

        // Chemin relatif pour la réponse
        let relative_path = format!("uploads/{}/{}", subdir, unique_name);

        // Mettre à jour le statut : Completed
        let status = UploadStatus::Completed {
            file_path: relative_path.clone(),
        };
        Self::update_status(pool, upload_id, status.clone()).await?;
        let _ = status_tx.send((upload_id.to_string(), status));

        // Mettre à jour les métadonnées
        sqlx::query(
            r#"
            UPDATE async_uploads
            SET file_name = $1, file_size = $2, file_type = $3, completed_at = NOW()
            WHERE upload_id = $4
            "#,
        )
        .bind(&file_name)
        .bind(file_size as i64)
        .bind(&file_type)
        .bind(upload_id)
        .execute(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur mise à jour métadonnées: {}", e)))?;

        Ok(())
    }

    /// Met à jour le statut d'un upload
    async fn update_status(pool: &PgPool, upload_id: &str, status: UploadStatus) -> AppResult<()> {
        sqlx::query(
            r#"
            UPDATE async_uploads
            SET status = $1, updated_at = NOW()
            WHERE upload_id = $2
            "#,
        )
        .bind(serde_json::to_string(&status)?)
        .bind(upload_id)
        .execute(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur mise à jour statut: {}", e)))?;

        Ok(())
    }

    /// Récupère le statut d'un upload
    pub async fn get_upload_status(
        &self,
        upload_id: &str,
        user_id: i32,
    ) -> AppResult<UploadMetadata> {
        let row = sqlx::query_as::<_, UploadMetadataRow>(
            r#"
            SELECT upload_id, user_id, file_name, file_size, file_type, status, created_at
            FROM async_uploads
            WHERE upload_id = $1 AND user_id = $2
            "#,
        )
        .bind(upload_id)
        .bind(user_id)
        .fetch_one(&*self.pool)
        .await
        .map_err(|_| AppError::NotFound("Upload non trouvé".to_string()))?;

        let status: UploadStatus = serde_json::from_str(&row.status)
            .map_err(|e| AppError::Internal(format!("Erreur parsing statut: {}", e)))?;

        Ok(UploadMetadata {
            upload_id: row.upload_id,
            user_id: row.user_id,
            file_name: row.file_name,
            file_size: row.file_size as u64,
            file_type: row.file_type,
            status,
            created_at: chrono::DateTime::from_naive_utc_and_offset(row.created_at, chrono::Utc),
        })
    }
}

#[derive(sqlx::FromRow)]
struct UploadMetadataRow {
    upload_id: String,
    user_id: i32,
    file_name: String,
    file_size: i64,
    file_type: String,
    status: String, // JSON string
    created_at: chrono::NaiveDateTime,
}
