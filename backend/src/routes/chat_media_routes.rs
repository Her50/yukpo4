// ✅ NOUVEAU 2025-01-27 : Routes pour upload de médias de chat vers S3/Wasabi
// Utilise MediaStorageService pour uploader vers S3/Wasabi (comme les autres uploads)

use crate::{
    middlewares::jwt::{jwt_auth, AuthenticatedUser},
    state::AppState,
};
use axum::{
    extract::{multipart::Multipart, State},
    http::StatusCode,
    middleware,
    response::Json,
    routing::post,
    Extension, Router,
};
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

/// POST /api/chat/media/upload - Uploader un média (image, audio, vidéo) pour le chat
/// ✅ Utilise MediaStorageService pour uploader vers S3/Wasabi
pub async fn upload_chat_media(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    mut multipart: Multipart,
) -> Result<Json<Value>, StatusCode> {
    log::info!("[ChatMedia] 📤 Upload média chat par user {}", user.id);

    let mut uploaded_files: Vec<Value> = Vec::new();

    // Parcourir tous les champs du multipart
    while let Some(mut field) = multipart.next_field().await.map_err(|e| {
        log::error!("[ChatMedia] ❌ Erreur parsing multipart: {:?}", e);
        StatusCode::BAD_REQUEST
    })? {
        let field_name = field.name().unwrap_or("file").to_string();
        let file_name =
            field.file_name().unwrap_or(&format!("file_{}", Uuid::new_v4())).to_string();

        // Lire les données du fichier (collecter tous les chunks)
        let mut file_data = Vec::new();
        while let Some(chunk) = field.chunk().await.map_err(|e| {
            log::error!("[ChatMedia] ❌ Erreur lecture chunk: {:?}", e);
            StatusCode::BAD_REQUEST
        })? {
            file_data.extend_from_slice(&chunk);
        }

        if file_data.is_empty() {
            continue;
        }

        // Déterminer le type de contenu (doit être fait avant de consommer field)
        let content_type = {
            // Deviner le type depuis l'extension
            let ext = file_name.split('.').last().unwrap_or("jpg").to_lowercase();
            match ext.as_str() {
                "jpg" | "jpeg" => "image/jpeg",
                "png" => "image/png",
                "gif" => "image/gif",
                "webp" => "image/webp",
                "mp4" | "mov" => "video/mp4",
                "mp3" | "m4a" => "audio/mpeg",
                "pdf" => "application/pdf",
                _ => "application/octet-stream",
            }
        };

        // Générer un nom de fichier unique pour le stockage
        let file_extension = file_name.split('.').last().unwrap_or("bin");
        let unique_filename = format!("chat/{}/{}.{}", user.id, Uuid::new_v4(), file_extension);

        log::info!(
            "[ChatMedia] 📤 Upload fichier: {} ({} bytes, type: {})",
            file_name,
            file_data.len(),
            content_type
        );

        // ✅ Utiliser MediaStorageService pour uploader vers S3/Wasabi
        match state
            .media_storage
            .store_bytes(&file_data, &unique_filename, Some(&content_type))
            .await
        {
            Ok(stored_location) => {
                log::info!(
                    "[ChatMedia] ✅ Fichier uploadé vers S3/Wasabi: {} ({} bytes) -> {}",
                    file_name,
                    file_data.len(),
                    stored_location.public_url
                );

                uploaded_files.push(json!({
                    "filename": file_name,
                    "url": stored_location.public_url,
                    "storage_path": stored_location.storage_path,
                    "content_type": content_type,
                    "size": file_data.len(),
                    "field_name": field_name
                }));
            }
            Err(e) => {
                log::error!(
                    "[ChatMedia] ❌ Erreur upload S3/Wasabi pour {}: {}",
                    file_name,
                    e
                );
                // Ne pas bloquer les autres fichiers, continuer
            }
        }
    }

    if uploaded_files.is_empty() {
        log::warn!("[ChatMedia] ⚠️ Aucun fichier uploadé");
        return Err(StatusCode::BAD_REQUEST);
    }

    log::info!(
        "[ChatMedia] ✅ {} fichier(s) uploadé(s) avec succès",
        uploaded_files.len()
    );

    Ok(Json(json!({
        "success": true,
        "files": uploaded_files,
        "count": uploaded_files.len()
    })))
}

/// Créer le router pour les médias de chat
pub fn create_chat_media_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/chat/media/upload", post(upload_chat_media))
        .layer(middleware::from_fn(jwt_auth))
}
