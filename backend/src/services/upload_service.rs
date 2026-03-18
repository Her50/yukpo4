// src/services/upload_service.rs
// Service de gestion des uploads préalables (avant création de service)

use crate::core::types::{AppError, AppResult};
use crate::services::media_storage_service::MediaStorageService;
use axum::extract::Multipart;
use log::{info, warn};
use sqlx::PgPool;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs::{self, File};
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

#[derive(Debug, serde::Serialize)]
pub struct UploadedFileResponse {
    pub url: String,
    pub media_type: String,
    pub size_bytes: usize,
    pub media_id: Option<i32>, // Optionnel si on veut lier au service plus tard
}

/// Stocke un fichier uploadé et retourne son URL
/// ✅ CORRIGÉ: Upload vers S3/Wasabi via MediaStorageService
pub async fn store_uploaded_file(
    _pool: &PgPool,
    user_id: i32,
    field_name: &str,
    filename: &str,
    bytes: &[u8],
    media_storage: Arc<MediaStorageService>,
) -> AppResult<UploadedFileResponse> {
    // Déterminer le type de média
    let media_type = infer_media_type(field_name, filename);

    // ✅ CORRIGÉ: Limite différente selon le type de média
    // Vidéos peuvent être plus volumineuses (200 MB)
    let max_file_size = if media_type == "video" {
        200_000_000 // 200 MB pour les vidéos
    } else {
        20_000_000 // 20 MB pour les autres fichiers
    };

    if bytes.len() > max_file_size {
        return Err(AppError::BadRequest(format!(
            "Fichier trop volumineux: {} bytes (max: {} bytes pour type {})",
            bytes.len(),
            max_file_size,
            media_type
        )));
    }

    // Créer le répertoire de stockage
    let storage_root = upload_storage_root();
    let temp_dir = storage_root.join("temp").join(user_id.to_string());
    fs::create_dir_all(&temp_dir).await?;

    // Générer un nom de fichier unique
    let ext = filename.split('.').next_back().unwrap_or("bin").to_lowercase();
    let unique_name = format!("{}.{}", Uuid::new_v4(), ext);
    let file_path = temp_dir.join(&unique_name);

    // Déterminer le content_type
    let content_type = match ext.as_str() {
        "jpg" | "jpeg" => Some("image/jpeg"),
        "png" => Some("image/png"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        "mp4" => Some("video/mp4"),
        "mp3" => Some("audio/mpeg"),
        "pdf" => Some("application/pdf"),
        _ => None,
    };

    // ✅ NOUVEAU: Upload vers S3/Wasabi via MediaStorageService
    let storage_key = format!("temp/{}/{}", user_id, unique_name);
    let final_path = match media_storage.store_bytes(bytes, &storage_key, content_type).await {
        Ok(location) => {
            info!(
                "[upload_service] ✅ Fichier uploadé vers S3: {} ({} bytes, type: {})",
                location.storage_path,
                bytes.len(),
                media_type
            );

            // ✅ Vérifier que l'URL retournée est bien une URL CDN complète
            if location.public_url.starts_with("http://")
                || location.public_url.starts_with("https://")
            {
                info!(
                    "[upload_service] ✅ URL CDN valide retournée: {}",
                    location.public_url
                );
            } else {
                warn!(
                    "[upload_service] ⚠️ URL retournée n'est pas une URL CDN complète (pas de http/https): {}",
                    location.public_url
                );
                warn!(
                    "[upload_service] ⚠️ Vérifiez que UPLOAD_BASE_URL ou PUBLIC_BASE_URL est configuré avec une URL complète (ex: http://34.54.117.97)"
                    // ⚠️ AWS/Cloudflare (ancien, commenté pour utilisation future)
                    // "[upload_service] ⚠️ Vérifiez que UPLOAD_BASE_URL ou PUBLIC_BASE_URL est configuré avec une URL complète (ex: https://cdn.yukpomnang.com)"
                );
            }

            // Utiliser l'URL publique S3/Wasabi
            location.public_url
        }
        Err(e) => {
            warn!(
                "[upload_service] ⚠️ Erreur upload S3: {}, fallback local",
                e
            );
            // Fallback: sauvegarder localement
            let mut file = File::create(&file_path).await?;
            file.write_all(bytes).await?;
            file.sync_all().await?;

            let relative_path = format!("uploads/temp/{}/{}", user_id, unique_name);
            format!(
                "/api/media/temp/{}",
                relative_path.replace("uploads/temp/", "")
            )
        }
    };

    // ✅ CORRIGÉ: Ne pas enregistrer en DB si service_id est NULL
    // La table media requiert service_id NOT NULL, donc on skip l'insertion pour les fichiers temporaires
    // Ces fichiers seront associés à un service lors de la création/modification du service
    let media_id: Option<i32> = None; // Fichiers temporaires non enregistrés en DB

    info!("[upload_service] Fichier temporaire uploadé (sera associé à un service lors de la création)");

    Ok(UploadedFileResponse {
        url: final_path,
        media_type,
        size_bytes: bytes.len(),
        media_id,
    })
}

/// Traite un multipart et upload tous les fichiers
/// ✅ CORRIGÉ: Accepte MediaStorageService pour upload vers S3
pub async fn handle_multipart_upload(
    pool: &PgPool,
    user_id: i32,
    mut multipart: Multipart,
    media_storage: Arc<MediaStorageService>,
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

        let result = store_uploaded_file(
            pool,
            user_id,
            &field_name,
            &filename,
            &bytes,
            media_storage.clone(),
        )
        .await;
        match result {
            Ok(file_response) => uploaded_files.push(file_response),
            Err(e) => {
                warn!("[upload_service] Erreur upload fichier {}: {}", filename, e);
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
    if field_lower.contains("image")
        || field_lower.contains("photo")
        || field_lower.contains("picture")
    {
        return "image".to_string();
    }
    if field_lower.contains("video") {
        return "video".to_string();
    }
    if field_lower.contains("audio") || field_lower.contains("sound") {
        return "audio".to_string();
    }
    if field_lower.contains("document")
        || field_lower.contains("doc")
        || field_lower.contains("pdf")
    {
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
    let deleted_rows = sqlx::query(
        r#"
        DELETE FROM media
        WHERE service_id IS NULL
        AND uploaded_at < NOW() - ($1 || ' hours')::interval
        RETURNING id, path
        "#,
    )
    .bind(older_than_hours.to_string())
    .fetch_all(pool)
    .await?;

    // Supprimer les fichiers physiques
    let mut deleted_files = 0;
    for row in &deleted_rows {
        let row_path: String = row.try_get("path").unwrap_or_default();
        if let Ok(path) = storage_root.join(&row_path).canonicalize() {
            if path.starts_with(&storage_root) {
                // Sécurité: s'assurer qu'on supprime seulement dans uploads/
                if let Err(e) = fs::remove_file(&path).await {
                    warn!(
                        "[upload_service] Impossible de supprimer {}: {}",
                        row_path, e
                    );
                } else {
                    deleted_files += 1;
                }
            }
        }
    }

    Ok(deleted_files)
}
