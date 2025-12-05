/**
 * Contrôleur pour upload de vidéos (multipart)
 * Gère l'upload de vidéos pour duet/remix et génération de qualités
 */
use crate::core::types::AppError;
use crate::services::video_quality_service::VideoQualityService;
use crate::state::AppState;
use axum::{
    extract::{multipart::Multipart, State},
    http::StatusCode,
    response::Json,
};
use log;
use serde::Serialize;
use std::sync::Arc;
use tokio::fs;
use tokio::io::AsyncWriteExt;

#[derive(Serialize)]
pub struct VideoUploadResponse {
    pub success: bool,
    pub video_url: String,
    pub quality_urls: Option<std::collections::HashMap<String, String>>,
    pub error: Option<String>,
}

/**
 * Upload vidéo et génère les qualités multiples
 */
pub async fn upload_video_with_qualities(
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<Json<VideoUploadResponse>, StatusCode> {
    log::info!("📤 [VideoUpload] Upload vidéo avec génération qualités");

    let mut video_data: Option<Vec<u8>> = None;
    let mut filename = String::from("video");

    // Parser le multipart
    while let Some(field) = multipart.next_field().await.map_err(|e| {
        log::error!("❌ [VideoUpload] Erreur parsing multipart: {}", e);
        StatusCode::BAD_REQUEST
    })? {
        if field.name() == Some("video") {
            filename = field.file_name().unwrap_or("video.mp4").to_string();

            let data = field.bytes().await.map_err(|e| {
                log::error!("❌ [VideoUpload] Erreur lecture données: {}", e);
                StatusCode::BAD_REQUEST
            })?;

            video_data = Some(data.to_vec());
        }
    }

    let video_bytes = video_data.ok_or_else(|| {
        log::error!("❌ [VideoUpload] Aucune vidéo fournie");
        StatusCode::BAD_REQUEST
    })?;

    // Sauvegarder temporairement
    let temp_dir = std::path::Path::new("temp/uploads");
    fs::create_dir_all(&temp_dir).await.map_err(|e| {
        log::error!("❌ [VideoUpload] Erreur création dossier: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let temp_path = temp_dir.join(&filename);
    let mut file = fs::File::create(&temp_path).await.map_err(|e| {
        log::error!("❌ [VideoUpload] Erreur création fichier: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    file.write_all(&video_bytes).await.map_err(|e| {
        log::error!("❌ [VideoUpload] Erreur écriture fichier: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Upload vers storage
    let stored = state
        .media_storage
        .store_file(
            temp_path.to_str().unwrap(),
            &format!("uploads/{}", filename),
            Some("video/mp4"),
        )
        .await
        .map_err(|e| {
            log::error!("❌ [VideoUpload] Erreur upload storage: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let video_url = stored.public_url;

    // Générer les qualités multiples
    let quality_urls = match VideoQualityService::generate_all_qualities(
        &state,
        temp_path.to_str().unwrap(),
    )
    .await
    {
        Ok(urls) => {
            log::info!("✅ [VideoUpload] {} qualités générées", urls.len());
            Some(urls)
        }
        Err(e) => {
            log::warn!("⚠️ [VideoUpload] Erreur génération qualités: {}", e);
            None // Continuer même si génération échoue
        }
    };

    // Nettoyer le fichier temporaire
    fs::remove_file(&temp_path).await.ok();

    Ok(Json(VideoUploadResponse {
        success: true,
        video_url,
        quality_urls,
        error: None,
    }))
}
