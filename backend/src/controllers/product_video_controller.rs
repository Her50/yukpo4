use std::sync::Arc;

use axum::{
    extract::{Path, State},
    Extension, Json,
};
use log::{error, info, warn};
use serde::Serialize;
use serde_json::json;
use sqlx::FromRow;
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
            // ✅ AMÉLIORÉ: Retourner une erreur BadRequest pour les erreurs de validation
            // au lieu d'une erreur Internal pour que le client comprenne mieux
            match err {
                AppError::BadRequest(_) => err,
                AppError::NotFound(_) => err,
                _ => AppError::BadRequest(format!(
                    "Impossible de générer la vidéo: {}. Vérifiez que le service et le produit existent et ont des images.",
                    err
                )),
            }
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
                error!("[ProductVideoController] Stack trace: {}", error_detail);

                // Créer des steps d'erreur pour le tracking
                let error_steps = vec![crate::services::video_generation_service::ProgressStep {
                    key: "error",
                    label: "Erreur de génération",
                    status: "failed",
                    detail: Some(error_message.clone()),
                }];

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
#[axum::debug_handler]
pub async fn estimate_video_cost_for_product(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path((service_id, product_index)): Path<(i32, i32)>,
    Json(payload): Json<VideoGenerationPayload>,
) -> AppResult<Json<crate::services::cost_service::CostEstimation>> {
    info!(
        "[ProductVideoController] ✅ Route estimate_video_cost_for_product appelée - user_id={}, service_id={}, product_index={}",
        user.id, service_id, product_index
    );
    
    // ✅ CORRIGÉ 2025-12-24: Valider les paramètres
    if service_id <= 0 {
        return Err(AppError::BadRequest(format!("Service ID invalide: {}", service_id)));
    }
    if product_index < 0 {
        return Err(AppError::BadRequest(format!("Product index invalide: {}", product_index)));
    }

    let estimation = estimate_video_cost(state, &user, service_id, product_index, payload)
        .await
        .map_err(|err| {
            error!(
                "[ProductVideoController] ❌ Erreur estimation coût pour service_id={}, product_index={}: {}",
                service_id, product_index, err
            );
            // ✅ AMÉLIORÉ: Retourner des erreurs appropriées selon le type
            match err {
                AppError::NotFound(_) | AppError::BadRequest(_) | AppError::Unauthorized(_) => err,
                _ => AppError::Internal(format!(
                    "Erreur lors de l'estimation du coût: {}. Veuillez réessayer plus tard.",
                    err
                )),
            }
        })?;
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

/// ✅ NOUVEAU: Récupère toutes les vidéos générées par l'utilisateur
#[derive(Debug, FromRow, Serialize)]
struct UserVideoRow {
    id: i32,
    service_id: i32,
    product_index: i32,
    path: String,
    ai_description: Option<String>,
    ai_metadata: Option<serde_json::Value>,
    created_at: chrono::DateTime<chrono::Utc>,
    service_title: Option<String>,
    product_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UserVideo {
    pub id: i32,
    pub service_id: i32,
    pub product_index: i32,
    pub video_url: String,
    pub description: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub service_title: Option<String>,
    pub product_name: Option<String>,
}

pub async fn get_my_videos(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<serde_json::Value>> {
    info!(
        "[ProductVideoController] Récupération vidéos pour user_id={}",
        user.id
    );

    // ✅ CORRIGÉ: Syntaxe SQL - WITH ORDINALITY doit être dans le FROM, pas dans un SELECT
    let videos: Vec<UserVideoRow> = sqlx::query_as::<_, UserVideoRow>(
        r#"
        SELECT 
            m.id,
            m.service_id,
            m.product_index,
            m.path,
            m.ai_description,
            m.ai_metadata,
            COALESCE(m.uploaded_at, s.created_at) as created_at,
            s.data->>'titre' as service_title,
            -- ✅ PHASE 3: Récupérer le nom du produit depuis service_products
            (
                SELECT p.product_name
                FROM service_products p
                WHERE p.service_id = s.id
                AND p.product_index = m.product_index
                AND p.is_active = true
                LIMIT 1
            ) as product_name
        FROM media m
        INNER JOIN services s ON s.id = m.service_id
        WHERE s.user_id = $1
        AND m.type = 'video_generated'
        AND m.media_type = 'video'
        ORDER BY COALESCE(m.uploaded_at, s.created_at) DESC
        "#,
    )
    .bind(user.id)
    .fetch_all(&state.pg)
    .await
    .map_err(|err| {
        error!("[ProductVideoController] Erreur récupération vidéos: {err:?}");
        AppError::Internal(format!(
            "Erreur lors de la récupération des vidéos: {}",
            err
        ))
    })?;

    info!(
        "[ProductVideoController] ✅ {} vidéo(s) trouvée(s) pour user_id={}",
        videos.len(),
        user.id
    );

    // Construire l'URL complète pour chaque vidéo
    let api_base_url = std::env::var("PUBLIC_BASE_URL")
        .or_else(|_| std::env::var("UPLOAD_BASE_URL"))
        .unwrap_or_else(|_| "http://localhost:3000".to_string());
    let formatted_videos: Vec<UserVideo> = videos
        .into_iter()
        .map(|row| {
            let video_url = if row.path.starts_with("http://") || row.path.starts_with("https://") {
                row.path.clone()
            } else {
                format!(
                    "{}/{}",
                    api_base_url.trim_end_matches('/'),
                    row.path.trim_start_matches('/')
                )
            };

            UserVideo {
                id: row.id,
                service_id: row.service_id,
                product_index: row.product_index,
                video_url,
                description: row.ai_description,
                metadata: row.ai_metadata,
                created_at: row.created_at,
                service_title: row.service_title,
                product_name: row.product_name,
            }
        })
        .collect();

    Ok(Json(json!({
        "success": true,
        "data": formatted_videos,
        "count": formatted_videos.len()
    })))
}
