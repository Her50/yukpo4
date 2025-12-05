// ✅ NOUVEAU Phase 2.3: Contrôleur pour jobs d'export vidéo

use axum::{
    extract::{Path, Query, State},
    Json,
};
use log::info;
use std::sync::Arc;

use crate::{
    core::types::{AppError, AppResult},
    models::export_model::{ExportJob, StartExportRequest, StartExportResponse},
    services::export_service::ExportService,
    state::AppState,
};

/// Démarre un nouveau job d'export
pub async fn start_export(
    State(state): State<Arc<AppState>>,
    axum::extract::Json(request): axum::extract::Json<StartExportRequest>,
) -> AppResult<Json<StartExportResponse>> {
    // TODO: Récupérer user_id depuis le token JWT
    let user_id = 1; // Placeholder

    let export_service = ExportService::new(state.pg.clone(), state.media_storage.clone());
    let job_id = export_service
        .start_export(user_id, request)
        .await
        .map_err(|e| AppError::Internal(e))?;

    Ok(Json(StartExportResponse {
        success: true,
        job_id,
        message: Some("Job d'export démarré avec succès".to_string()),
    }))
}

/// Récupère le statut d'un job d'export
pub async fn get_export_status(
    State(state): State<Arc<AppState>>,
    Path(job_id): Path<String>,
) -> AppResult<Json<ExportJob>> {
    // TODO: Récupérer user_id depuis le token JWT
    let user_id = 1; // Placeholder

    let export_service = ExportService::new(state.pg.clone(), state.media_storage.clone());
    let job = export_service
        .get_job_status(&job_id, user_id)
        .await
        .map_err(|e| AppError::NotFound(e))?;

    Ok(Json(job))
}

/// Annule un job d'export
pub async fn cancel_export(
    State(state): State<Arc<AppState>>,
    Path(job_id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    // TODO: Récupérer user_id depuis le token JWT
    let user_id = 1; // Placeholder

    let export_service = ExportService::new(state.pg.clone(), state.media_storage.clone());
    export_service
        .cancel_job(&job_id, user_id)
        .await
        .map_err(|e| AppError::Internal(e))?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Job d'export annulé avec succès",
    })))
}

/// Liste les jobs d'export de l'utilisateur
pub async fn list_exports(
    State(state): State<Arc<AppState>>,
    Query(params): Query<serde_json::Value>,
) -> AppResult<Json<serde_json::Value>> {
    // TODO: Récupérer user_id depuis le token JWT
    let user_id = 1; // Placeholder

    let limit = params
        .get("limit")
        .and_then(|v| v.as_i64())
        .unwrap_or(20)
        .min(100);
    let offset = params
        .get("offset")
        .and_then(|v| v.as_i64())
        .unwrap_or(0)
        .max(0);

    let export_service = ExportService::new(state.pg.clone(), state.media_storage.clone());
    let jobs = export_service
        .list_jobs(user_id, limit, offset)
        .await
        .map_err(|e| AppError::Internal(e))?;

    Ok(Json(serde_json::json!({
        "success": true,
        "exports": jobs,
        "total": jobs.len(),
    })))
}
