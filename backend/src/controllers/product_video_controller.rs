use std::sync::Arc;

use axum::{
    extract::{Path, State},
    Extension, Json,
};
use log::{error, info, warn};
use serde::Serialize;
use serde_json::json;
use uuid::Uuid;

use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::AuthenticatedUser,
    services::video_generation_service::{
        estimate_video_cost, generate_product_video, validate_video_generation_prerequisites,
        VideoGenerationPayload,
    },
    services::video_job_service::VideoGenerationJob,
    state::AppState,
};

#[derive(Debug, Serialize)]
pub struct StartVideoGenerationResponse {
    pub job_id: Uuid,
    pub status: &'static str,
}

/// Crée une vidéo marketing pour un produit spécifique et l'enregistre dans la médiathèque.
pub async fn generate_video_for_product(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path((service_id, product_index)): Path<(i32, i32)>,
    Json(payload): Json<VideoGenerationPayload>,
) -> AppResult<Json<StartVideoGenerationResponse>> {
    info!(
        "[ProductVideoController] Génération vidéo - user_id={}, service_id={}, product_index={}",
        user.id, service_id, product_index
    );

    // ✅ VALIDATION PRÉVENTIVE : Vérifier les prérequis AVANT de créer le job
    validate_video_generation_prerequisites(&state, service_id, product_index, &payload).await
        .map_err(|err| {
            error!(
                "[ProductVideoController] ❌ Validation échouée pour service_id={}, product_index={}: {}",
                service_id, product_index, err
            );
            err
        })?;

    // ✅ Créer le job seulement si la validation réussit
    let job_id = state
        .video_jobs
        .create_job(user.id, service_id, product_index)
        .await?;

    state.video_jobs.mark_running(job_id).await?;

    let state_clone = state.clone();
    let user_clone = user.clone();
    let payload_clone = payload.clone();

    tokio::spawn(async move {
        match generate_product_video(
            state_clone.clone(),
            &user_clone,
            service_id,
            product_index,
            payload_clone,
            Some(job_id),
        )
        .await
        {
            Ok(result) => {
                let steps = result.progress_steps.clone();
                let result_json = serde_json::to_value(&result).unwrap_or_else(|_| json!({}));
                if let Err(err) = state_clone
                    .video_jobs
                    .mark_completed(job_id, result.media_id, &steps, &result_json)
                    .await
                {
                    warn!(
                        "[ProductVideoController] Impossible de marquer le job {} comme terminé: {}",
                        job_id, err
                    );
                }
            }
            Err(err) => {
                let error_message = format!("{}", err);
                let error_detail = format!("{:?}", err);
                
                error!(
                    "[ProductVideoController] ❌ Erreur génération vidéo pour job {}: {}",
                    job_id, error_message
                );
                error!(
                    "[ProductVideoController] Détails: service_id={}, product_index={}, user_id={}",
                    service_id, product_index, user_clone.id
                );
                error!(
                    "[ProductVideoController] Stack trace: {}",
                    error_detail
                );
                
                // Créer des steps d'erreur pour le tracking
                let error_steps = vec![
                    crate::services::video_generation_service::ProgressStep {
                        key: "error",
                        label: "Erreur de génération",
                        status: "failed",
                        detail: Some(error_message.clone()),
                    }
                ];
                
                if let Err(mark_err) = state_clone
                    .video_jobs
                    .mark_failed(job_id, &error_message, Some(&error_steps))
                    .await
                {
                    error!(
                        "[ProductVideoController] ❌ Impossible de marquer le job {} comme échoué: {}",
                        job_id, mark_err
                    );
                } else {
                    info!(
                        "[ProductVideoController] ✅ Job {} marqué comme échoué dans la base de données",
                        job_id
                    );
                }
            }
        }
    });

    Ok(Json(StartVideoGenerationResponse {
        job_id,
        status: "running",
    }))
}

/// Estime le coût de génération d'une vidéo immersive sans lancer le rendu.
pub async fn estimate_video_cost_for_product(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path((service_id, product_index)): Path<(i32, i32)>,
    Json(payload): Json<VideoGenerationPayload>,
) -> AppResult<Json<crate::services::cost_service::CostEstimation>> {
    info!(
        "[ProductVideoController] Estimation coût vidéo - user_id={}, service_id={}, product_index={}",
        user.id, service_id, product_index
    );

    let estimation = estimate_video_cost(state, &user, service_id, product_index, payload).await?;
    Ok(Json(estimation))
}

pub async fn get_video_generation_job_status(
    State(state): State<Arc<AppState>>,
    Path(job_id): Path<Uuid>,
) -> AppResult<Json<VideoGenerationJob>> {
    let job = state
        .video_jobs
        .get_job(job_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Job de génération introuvable".to_string()))?;

    Ok(Json(job))
}
