// ✅ NOUVEAU Phase 3.1: Contrôleur pour génération vidéo IA complète

use axum::{
    extract::{Path, State},
    Json,
};
use log::info;
use std::sync::Arc;

use crate::{
    core::types::{AppError, AppResult},
    models::generative_video_model::{GenerateVideoRequest, GenerateVideoResponse, GenerativeJob},
    services::generative_video_service::GenerativeVideoService,
    state::AppState,
};

/// Démarre une génération vidéo complète depuis texte
pub async fn generate_video(
    State(state): State<Arc<AppState>>,
    axum::extract::Json(request): axum::extract::Json<GenerateVideoRequest>,
) -> AppResult<Json<GenerateVideoResponse>> {
    // TODO: Récupérer user_id depuis le token JWT
    let user_id = 1; // Placeholder

    let generative_service =
        GenerativeVideoService::new(Arc::new(state.pg.clone()), state.ia.clone());
    let job_id = generative_service
        .generate_video(user_id, request)
        .await
        .map_err(|e| AppError::Internal(e))?;

    Ok(Json(GenerateVideoResponse {
        success: true,
        job_id,
        message: Some("Génération vidéo démarrée avec succès".to_string()),
        estimated_time_seconds: Some(300), // 5 minutes estimé
    }))
}

/// Récupère le statut d'un job de génération
pub async fn get_generation_status(
    State(state): State<Arc<AppState>>,
    Path(job_id): Path<String>,
) -> AppResult<Json<GenerativeJob>> {
    // TODO: Récupérer user_id depuis le token JWT
    let user_id = 1; // Placeholder

    let generative_service =
        GenerativeVideoService::new(Arc::new(state.pg.clone()), state.ia.clone());
    let job = generative_service
        .get_job_status(&job_id, user_id)
        .await
        .map_err(|e| AppError::NotFound(e))?;

    Ok(Json(job))
}

/// Annule un job de génération
pub async fn cancel_generation(
    State(state): State<Arc<AppState>>,
    Path(job_id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    // TODO: Récupérer user_id depuis le token JWT
    let user_id = 1; // Placeholder

    // TODO: Implémenter l'annulation
    info!("[GenerativeVideo] Annulation job: {}", job_id);

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Job de génération annulé avec succès",
    })))
}
