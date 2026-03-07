// ✅ NOUVEAU Phase 3.1: Contrôleur pour génération vidéo IA complète

use axum::{
    extract::{Extension, Path, State},
    Json,
};
use log::info;
use std::sync::Arc;

use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::AuthenticatedUser,
    models::generative_video_model::{GenerateVideoRequest, GenerateVideoResponse, GenerativeJob},
    services::generative_video_service::GenerativeVideoService,
    state::AppState,
};

/// Démarre une génération vidéo complète depuis texte
pub async fn generate_video(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
    axum::extract::Json(request): axum::extract::Json<GenerateVideoRequest>,
) -> AppResult<Json<GenerateVideoResponse>> {
    let user_id = user.id;

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
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
    Path(job_id): Path<String>,
) -> AppResult<Json<GenerativeJob>> {
    let user_id = user.id;

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
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
    Path(job_id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    let user_id = user.id;

    info!(
        "[GenerativeVideo] Annulation job: {} par user {}",
        job_id, user_id
    );

    let result = sqlx::query(
        r#"UPDATE generative_video_jobs 
        SET status = 'failed', error_message = 'Annulé par l''utilisateur', updated_at = NOW()
        WHERE job_id = $1 AND user_id = $2 AND status NOT IN ('completed', 'failed')"#,
    )
    .bind(&job_id)
    .bind(user_id)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur annulation job: {}", e)))?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!(
            "Job {} non trouvé ou déjà terminé",
            job_id
        )));
    }

    info!("[GenerativeVideo] ✅ Job {} annulé avec succès", job_id);

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Job de génération annulé avec succès",
    })))
}
