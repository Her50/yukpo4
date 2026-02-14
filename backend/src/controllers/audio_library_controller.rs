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
    services::{
        audio_library_service::{attach_loop_to_service, list_curated_audio_loops},
        voice_profile_service::{CreateVoiceProfilePayload, VoiceProfile, VoiceProfileSummary},
    },
    state::AppState,
};

#[derive(Debug, Serialize)]
pub struct AudioLibraryResponse {
    pub loops: Vec<crate::services::audio_library_service::CuratedAudioLoop>,
}

pub async fn get_audio_library() -> AppResult<Json<AudioLibraryResponse>> {
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

#[derive(Debug, Serialize)]
pub struct VoiceProfilesResponse {
    pub profiles: Vec<VoiceProfileSummary>,
}

fn to_summary(profile: &VoiceProfile) -> VoiceProfileSummary {
    VoiceProfileSummary {
        id: profile.id,
        name: profile.name.clone(),
        provider: profile.provider.clone(),
    }
}

pub async fn list_voice_profiles(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<VoiceProfilesResponse>> {
    let list = state
        .voice_profiles
        .list_for_user(user.id)
        .await?
        .into_iter()
        .map(|profile| to_summary(&profile))
        .collect::<Vec<_>>();

    Ok(Json(VoiceProfilesResponse { profiles: list }))
}

pub async fn create_voice_profile(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateVoiceProfilePayload>,
) -> AppResult<Json<VoiceProfileSummary>> {
    let record = state.voice_profiles.create_profile(user.id, payload).await?;
    Ok(Json(to_summary(&record)))
}

pub async fn delete_voice_profile(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(profile_id): Path<i32>,
) -> AppResult<Json<serde_json::Value>> {
    state.voice_profiles.delete_profile(user.id, profile_id).await?;
    Ok(Json(json!({ "success": true })))
}
