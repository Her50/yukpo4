// 🎯 Routes pour le transcodage vidéo HLS/DASH
// Endpoints API pour gérer le transcodage et récupérer les URLs

use crate::services::video_transcoding_service::get_transcoding_service;
use crate::state::AppState;
use axum::{
    extract::{Path, State},
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct TranscodeRequest {
    pub video_id: i32,
    pub video_path: String,
    pub force_retranscode: Option<bool>, // Forcer le retranscodage si déjà fait
}

#[derive(Debug, Serialize)]
pub struct TranscodeResponse {
    pub success: bool,
    pub message: String,
    pub transcoded_urls: Option<TranscodedUrls>,
    pub job_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TranscodedUrls {
    pub hls_url: String,
    pub dash_url: String,
    pub thumbnail_url: String,
    pub qualities: Vec<VideoQualityInfo>,
    pub duration_seconds: f64,
    pub file_size_mb: f64,
}

#[derive(Debug, Serialize)]
pub struct VideoQualityInfo {
    pub label: String,
    pub resolution: String,
    pub bitrate: u32,
    pub fps: u32,
    pub hls_url: String,
    pub dash_url: String,
}

/// Démarre le transcodage d'une vidéo
pub async fn start_transcode(
    State(state): State<Arc<AppState>>,
    Json(request): Json<TranscodeRequest>,
) -> Result<Json<TranscodeResponse>, crate::core::types::AppError> {
    let pool = Arc::clone(&state.pg);
    let service = get_transcoding_service(pool).await;

    // Vérifier si déjà transcodé
    if request.force_retranscode.unwrap_or(false) == false {
        if let Ok(Some(transcoded)) = service.get_transcoded_urls(request.video_id).await {
            let urls = build_urls_response(&transcoded).await;
            return Ok(Json(TranscodeResponse {
                success: true,
                message: "Vidéo déjà transcodée".to_string(),
                transcoded_urls: Some(urls),
                job_id: None,
            }));
        }
    }

    // Démarrer le transcodage (en arrière-plan pour ne pas bloquer)
    let video_id = request.video_id;
    let video_path = request.video_path.clone();
    let service_clone = Arc::clone(&service);

    tokio::spawn(async move {
        match service_clone.transcode_video(&video_path, video_id).await {
            Ok(transcoded) => {
                log_info(&format!(
                    "[TranscodeAPI] ✅ Transcodage terminé pour vidéo {}: HLS={}, DASH={}",
                    video_id,
                    transcoded.hls_path,
                    transcoded.dash_path
                ));
            }
            Err(e) => {
                log_error(&format!(
                    "[TranscodeAPI] ❌ Erreur transcodage vidéo {}: {:?}",
                    video_id, e
                ));
            }
        }
    });

    Ok(Json(TranscodeResponse {
        success: true,
        message: "Transcodage démarré".to_string(),
        transcoded_urls: None,
        job_id: Some(format!("transcode_{}", request.video_id)),
    }))
}

/// Récupère les URLs transcoded pour une vidéo
pub async fn get_transcoded_urls(
    State(state): State<Arc<AppState>>,
    Path(video_id): Path<i32>,
) -> Result<Json<TranscodeResponse>, crate::core::types::AppError> {
    let pool = Arc::clone(&state.pg);
    let service = get_transcoding_service(pool).await;

    match service.get_transcoded_urls(video_id).await {
        Ok(Some(transcoded)) => {
            let urls = build_urls_response(&transcoded).await;
            Ok(Json(TranscodeResponse {
                success: true,
                message: "URLs transcoded récupérées".to_string(),
                transcoded_urls: Some(urls),
                job_id: None,
            }))
        }
        Ok(None) => {
            Ok(Json(TranscodeResponse {
                success: false,
                message: "Vidéo non transcodée".to_string(),
                transcoded_urls: None,
                job_id: None,
            }))
        }
        Err(e) => Err(e),
    }
}

/// Vérifie le statut d'un transcodage
pub async fn get_transcode_status(
    State(state): State<Arc<AppState>>,
    Path(video_id): Path<i32>,
) -> Result<Json<serde_json::Value>, crate::core::types::AppError> {
    let pool = Arc::clone(&state.pg);
    let service = get_transcoding_service(pool).await;

    let is_transcoded = service.is_transcoded(video_id).await.unwrap_or(false);
    let active_jobs = service.get_active_jobs().await;
    let job_id = format!("transcode_{}", video_id);
    let is_processing = active_jobs.contains(&job_id);

    Ok(Json(serde_json::json!({
        "video_id": video_id,
        "is_transcoded": is_transcoded,
        "is_processing": is_processing,
        "active_jobs": active_jobs
    })))
}

/// Construit la réponse avec les URLs complètes
async fn build_urls_response(transcoded: &crate::services::video_transcoding_service::TranscodedVideo) -> TranscodedUrls {
    let base_url = std::env::var("CDN_BASE_URL")
        .unwrap_or_else(|_| "https://storage.googleapis.com/yukpo-project-yukpo-backend-media".to_string());

    let hls_url = format!("{}/{}", base_url.trim_end_matches('/'), 
        transcoded.hls_path.replace("/tmp/video_transcoding/", ""));

    let dash_url = format!("{}/{}", base_url.trim_end_matches('/'), 
        transcoded.dash_path.replace("/tmp/video_transcoding/", ""));

    let thumbnail_url = format!("{}/{}", base_url.trim_end_matches('/'), 
        transcoded.thumbnail_path.replace("/tmp/video_transcoding/", ""));

    let qualities = transcoded.qualities.iter().map(|q| VideoQualityInfo {
        label: q.label.clone(),
        resolution: q.resolution.clone(),
        bitrate: q.bitrate,
        fps: q.fps,
        hls_url: format!("{}/{}_{}.m3u8", 
            base_url.trim_end_matches('/'),
            transcoded.hls_path.replace("/tmp/video_transcoding/", "").replace("playlist.m3u8", ""),
            q.label
        ),
        dash_url: format!("{}/{}", base_url.trim_end_matches('/'), 
            transcoded.dash_path.replace("/tmp/video_transcoding/", "")
        ),
    }).collect();

    TranscodedUrls {
        hls_url,
        dash_url,
        thumbnail_url,
        qualities,
        duration_seconds: transcoded.duration_seconds,
        file_size_mb: transcoded.file_size_mb,
    }
}

/// Routes du transcodage vidéo
pub fn video_transcoding_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/transcode/start", post(start_transcode))
        .route("/transcode/:video_id", get(get_transcoded_urls))
        .route("/transcode/:video_id/status", get(get_transcode_status))
}
