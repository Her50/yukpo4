use std::sync::Arc;

use axum::{
    extract::{Json, Path, State},
    Extension,
};
use serde::Serialize;
use serde_json::json;

use crate::{
    core::types::AppResult,
    middlewares::jwt::AuthenticatedUser,
    services::audio_library_service::{attach_loop_to_service, list_curated_audio_loops},
    state::AppState,
};

#[derive(Debug, Serialize)]
pub struct AudioLibraryResponse<'a> {
    pub loops: &'a [crate::services::audio_library_service::CuratedAudioLoop],
}

pub async fn get_audio_library() -> AppResult<Json<AudioLibraryResponse<'static>>> {
    Ok(Json(AudioLibraryResponse {
        loops: list_curated_audio_loops(),
    }))
}

pub async fn attach_audio_loop(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path((loop_id, service_id)): Path<(String, i32)>,
) -> AppResult<Json<serde_json::Value>> {
    let media_id = attach_loop_to_service(state, &user, service_id, &loop_id).await?;
    Ok(Json(json!({ "success": true, "media_id": media_id })))
}
