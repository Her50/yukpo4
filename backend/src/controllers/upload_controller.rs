// src/controllers/upload_controller.rs
// Contrôleur pour l'upload préalable de fichiers (avant création de service)

use crate::core::types::AppResult;
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::upload_service::handle_multipart_upload;
use crate::state::AppState;
use axum::{
    extract::{Extension, Multipart, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::info;
use serde::Serialize;
use std::sync::Arc;

#[derive(Debug, Serialize)]
pub struct UploadResponse {
    pub success: bool,
    pub files: Vec<crate::services::upload_service::UploadedFileResponse>,
    pub message: Option<String>,
}

/// ✅ NOUVEAU: Endpoint d'upload préalable (avant création de service)
/// Accepte multipart/form-data avec fichiers
/// Retourne des URLs que l'utilisateur peut utiliser dans la création de service
pub async fn upload_files(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    multipart: Multipart,
) -> AppResult<impl IntoResponse> {
    info!(
        "[upload_controller] Upload préalable demandé par user_id={}",
        user.id
    );

    let files =
        handle_multipart_upload(&state.pg, user.id, multipart, state.media_storage.clone()).await?;

    Ok((
        StatusCode::OK,
        Json(UploadResponse {
            success: true,
            files,
            message: Some(
                "Fichiers uploadés avec succès. Utilisez les URLs dans la création de service."
                    .to_string(),
            ),
        }),
    ))
}

/// ✅ NOUVEAU: Endpoint pour servir les fichiers temporaires uploadés
pub async fn serve_temp_file(
    State(_state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    axum::extract::Path(path): axum::extract::Path<String>,
) -> AppResult<impl IntoResponse> {
    // Construire le chemin du fichier
    let storage_root =
        std::env::var("UPLOAD_STORAGE_PATH").unwrap_or_else(|_| "uploads".to_string());
    let file_path = std::path::Path::new(&storage_root)
        .join("temp")
        .join(user.id.to_string())
        .join(&path);

    // Vérifier que le fichier existe et appartient à l'utilisateur
    if !file_path.exists() {
        return Err(crate::core::types::AppError::NotFound(
            "Fichier non trouvé".to_string(),
        ));
    }

    // Sécurité: vérifier que le chemin est dans uploads/temp/user_id/
    let canonical_path = file_path
        .canonicalize()
        .map_err(|_| crate::core::types::AppError::NotFound("Fichier non trouvé".to_string()))?;
    let storage_path = std::path::Path::new(&storage_root)
        .canonicalize()
        .map_err(|_| crate::core::types::AppError::Internal("Erreur système".to_string()))?;

    if !canonical_path.starts_with(storage_path.join("temp").join(user.id.to_string())) {
        return Err(crate::core::types::AppError::Unauthorized(
            "Accès non autorisé".to_string(),
        ));
    }

    // Lire le fichier
    let bytes = tokio::fs::read(&file_path).await.map_err(|_| {
        crate::core::types::AppError::Internal("Erreur lecture fichier".to_string())
    })?;

    // Déterminer le Content-Type
    let content_type_str = infer_content_type(&path);

    use axum::http::HeaderValue;
    let content_type = HeaderValue::from_static(content_type_str);
    let content_length = HeaderValue::from_str(&bytes.len().to_string())
        .unwrap_or_else(|_| HeaderValue::from_static("0"));

    Ok((
        StatusCode::OK,
        [
            (axum::http::header::CONTENT_TYPE, content_type),
            (axum::http::header::CONTENT_LENGTH, content_length),
        ],
        bytes,
    ))
}

fn infer_content_type(filename: &str) -> &'static str {
    let ext = filename.split('.').next_back().unwrap_or("").to_lowercase();
    match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "mp4" => "video/mp4",
        "mp3" => "audio/mpeg",
        "pdf" => "application/pdf",
        _ => "application/octet-stream",
    }
}
