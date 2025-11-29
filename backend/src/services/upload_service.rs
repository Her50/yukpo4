// src/services/upload_service.rs
// Service de gestion des uploads préalables (avant création de service)

use crate::core::types::{AppError, AppResult};
use axum::extract::Multipart;
use sqlx::PgPool;
use std::path::PathBuf;
use tokio::fs::{self, File};
use tokio::io::AsyncWriteExt;
use uuid::Uuid;
use log::{info, warn};

#[derive(Debug, serde::Serialize)]
pub struct UploadedFileResponse {
    pub url: String,
    pub media_type: String,
    pub size_bytes: usize,
    pub media_id: Option<i32>, // Optionnel si on veut lier au service plus tard
}

/// Stocke un fichier uploadé et retourne son URL
pub async fn store_uploaded_file(
    pool: &PgPool,
    user_id: i32,
    field_name: &str,
    filename: &str,
    bytes: &[u8],
) -> AppResult<UploadedFileResponse> {
    // Déterminer le type de média
    let media_type = infer_media_type(field_name, filename);
    
    // Valider la taille (20 MB max par fichier)
    const MAX_FILE_SIZE: usize = 20_000_000; // 20 MB
    if bytes.len() > MAX_FILE_SIZE {
        return Err(AppError::BadRequest(format!(
            "Fichier trop volumineux: {} bytes (max: {} bytes)",
            bytes.len(),
            MAX_FILE_SIZE
        )));
    }

    // Créer le répertoire de stockage
    let storage_root = upload_storage_root();
    let temp_dir = storage_root.join("temp").join(user_id.to_string());
    fs::create_dir_all(&temp_dir).await?;

    // Générer un nom de fichier unique
    let ext = filename
        .split('.')
        .next_back()
        .unwrap_or("bin")
        .to_lowercase();
    let unique_name = format!("{}.{}", Uuid::new_v4(), ext);
    let file_path = temp_dir.join(&unique_name);

    // Écrire le fichier
    let mut file = File::create(&file_path).await?;
    file.write_all(bytes).await?;
    file.sync_all().await?;

    // Créer l'URL relative (sera servie par le serveur)
    let relative_path = format!(
        "uploads/temp/{}/{}",
        user_id,
        unique_name
    );
    let url = format!("/api/media/temp/{}", relative_path.replace("uploads/temp/", ""));

    // Optionnel: Enregistrer en DB pour tracking
    // Note: user_id n'existe pas dans la table media, on utilise seulement service_id
    let media_id = match sqlx::query_scalar!(
        r#"
        INSERT INTO media (service_id, type, path, uploaded_at)
        VALUES (NULL, $1, $2, NOW())
        RETURNING id
        "#,
        media_type,
        relative_path
    )
    .fetch_optional(pool)
    .await
    {
        Ok(Some(id)) => {
            info!("[upload_service] Fichier enregistré en DB: media_id={}", id);
            Some(id)
        }
        Ok(None) => {
            warn!("[upload_service] Impossible d'enregistrer en DB, mais fichier sauvegardé");
            None
        }
        Err(e) => {
            warn!("[upload_service] Erreur DB (non bloquante): {}", e);
            None
        }
    };

    info!(
        "[upload_service] ✅ Fichier uploadé: {} ({} bytes, type: {})",
        url,
        bytes.len(),
        media_type
    );

    Ok(UploadedFileResponse {
        url,
        media_type,
        size_bytes: bytes.len(),
        media_id,
    })
}

/// Traite un multipart et upload tous les fichiers
pub async fn handle_multipart_upload(
    pool: &PgPool,
    user_id: i32,
    mut multipart: Multipart,
) -> AppResult<Vec<UploadedFileResponse>> {
    let mut uploaded_files = Vec::new();

    while let Some(field) = multipart.next_field().await? {
        let field_name = field.name().unwrap_or("file").to_string();
        let filename = field.file_name().unwrap_or("file").to_string();
        let bytes = field.bytes().await?;

        // Ignorer les champs vides
        if bytes.is_empty() {
            continue;
        }

        let result = store_uploaded_file(pool, user_id, &field_name, &filename, &bytes).await;
        match result {
            Ok(file_response) => uploaded_files.push(file_response),
            Err(e) => {
                warn!(
                    "[upload_service] Erreur upload fichier {}: {}",
                    filename, e
                );
                // Continuer avec les autres fichiers
            }
        }
    }

    if uploaded_files.is_empty() {
        return Err(AppError::BadRequest(
            "Aucun fichier valide à uploader".to_string(),
        ));
    }

    Ok(uploaded_files)
}

/// Détermine le type de média depuis le nom du champ et le nom de fichier
fn infer_media_type(field_name: &str, filename: &str) -> String {
    let field_lower = field_name.to_lowercase();
    let filename_lower = filename.to_lowercase();

    // Vérifier d'abord le nom du champ
    if field_lower.contains("image") || field_lower.contains("photo") || field_lower.contains("picture") {
        return "image".to_string();
    }
    if field_lower.contains("video") {
        return "video".to_string();
    }
    if field_lower.contains("audio") || field_lower.contains("sound") {
        return "audio".to_string();
    }
    if field_lower.contains("document") || field_lower.contains("doc") || field_lower.contains("pdf") {
        return "document".to_string();
    }

    // Vérifier l'extension du fichier
    let ext = filename_lower.split('.').next_back().unwrap_or("");
    match ext {
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "svg" | "bmp" => "image".to_string(),
        "mp4" | "avi" | "mov" | "wmv" | "flv" | "webm" => "video".to_string(),
        "mp3" | "wav" | "ogg" | "m4a" | "aac" => "audio".to_string(),
        "pdf" | "doc" | "docx" | "txt" | "rtf" => "document".to_string(),
        _ => "image".to_string(), // Par défaut, considérer comme image
    }
}

/// Retourne le répertoire racine pour les uploads
fn upload_storage_root() -> PathBuf {
    std::env::var("UPLOAD_STORAGE_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("uploads"))
}

/// Nettoie les fichiers temporaires anciens (> 24h)
pub async fn cleanup_temp_files(pool: &PgPool, older_than_hours: i32) -> AppResult<usize> {
    let storage_root = upload_storage_root();
    let temp_dir = storage_root.join("temp");
    
    if !temp_dir.exists() {
        return Ok(0);
    }

    // Supprimer les fichiers en DB qui sont orphelins (pas de service_id)
    let deleted_count = sqlx::query!(
        r#"
        DELETE FROM media
        WHERE service_id IS NULL
        AND uploaded_at < NOW() - ($1 || ' hours')::interval
        RETURNING id, path
        "#,
        older_than_hours.to_string()
    )
    .fetch_all(pool)
    .await?;

    // Supprimer les fichiers physiques
    let mut deleted_files = 0;
    for row in deleted_count {
        if let Ok(path) = storage_root.join(&row.path).canonicalize() {
            if path.starts_with(&storage_root) {
                // Sécurité: s'assurer qu'on supprime seulement dans uploads/
                if let Err(e) = fs::remove_file(&path).await {
                    warn!("[upload_service] Impossible de supprimer {}: {}", row.path, e);
                } else {
                    deleted_files += 1;
                }
            }
        }
    }

    Ok(deleted_files)
}

