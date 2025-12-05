// ✅ NOUVEAU 2025-01-27 : Contrôleur pour upload asynchrone
// Permet l'upload de fichiers volumineux avec feedback en temps réel

use crate::core::types::AppResult;
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::async_upload_service::{AsyncUploadService, UploadMetadata};
use crate::state::AppState;
use axum::{
    extract::{Extension, Multipart, Path as AxumPath, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::info;
use serde::Serialize;
use std::sync::Arc;

#[derive(Debug, Serialize)]
pub struct AsyncUploadResponse {
    pub success: bool,
    pub upload_id: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct UploadStatusResponse {
    pub success: bool,
    pub upload: UploadMetadata,
}

/// Démarre un upload asynchrone
/// POST /api/upload/async
pub async fn start_async_upload(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    multipart: Multipart,
) -> AppResult<impl IntoResponse> {
    info!(
        "[async_upload] Démarrage upload asynchrone pour user_id={}",
        user.id
    );

    let storage_root =
        std::env::var("UPLOAD_STORAGE_PATH").unwrap_or_else(|_| "./uploads".to_string());

    let upload_service = AsyncUploadService::new(Arc::new(state.pg.clone()), storage_root);

    let upload_id = upload_service
        .start_async_upload(user.id, multipart)
        .await?;

    Ok((
        StatusCode::ACCEPTED,
        Json(AsyncUploadResponse {
            success: true,
            upload_id: upload_id.clone(),
            message: format!("Upload démarré avec succès. ID: {}. Utilisez /api/upload/status/{} pour suivre le progrès.", upload_id, upload_id),
        }),
    ))
}

/// Récupère le statut d'un upload
/// GET /api/upload/status/{upload_id}
pub async fn get_upload_status(
    State(_state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    AxumPath(upload_id): AxumPath<String>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[async_upload] Statut demandé pour upload_id={}, user_id={}",
        upload_id, user.id
    );

    let storage_root =
        std::env::var("UPLOAD_STORAGE_PATH").unwrap_or_else(|_| "./uploads".to_string());

    let upload_service = AsyncUploadService::new(Arc::new(_state.pg.clone()), storage_root);

    let upload = upload_service
        .get_upload_status(&upload_id, user.id)
        .await?;

    Ok(Json(UploadStatusResponse {
        success: true,
        upload,
    }))
}
