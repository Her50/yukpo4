// ✅ NOUVEAU Phase 3.2: Contrôleur pour preview AR/VR

use axum::{extract::State, Json};
use std::sync::Arc;

use crate::{
    core::types::{AppError, AppResult},
    models::ar_preview_model::{ARPreviewRequest, ARPreviewResponse},
    services::ar_preview_service::ARPreviewService,
    state::AppState,
};

/// Génère une preview 3D pour AR à partir d'une timeline
pub async fn generate_ar_preview(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ARPreviewRequest>,
) -> AppResult<Json<ARPreviewResponse>> {
    let ar_service = ARPreviewService::new(state.pg.clone());
    let response = ar_service
        .generate_ar_preview(request)
        .await
        .map_err(|e| AppError::Internal(e))?;

    Ok(Json(response))
}
