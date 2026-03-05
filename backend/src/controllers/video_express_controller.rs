// ✅ NOUVEAU: Controller Express Video - Endpoint optimisé pour génération 1-click
// Utilise les services existants avec une configuration prédéfinie

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::video_generation_service::{
    estimate_video_cost, generate_product_video, validate_video_generation_prerequisites, VideoGenerationPayload
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
struct ExpressVideoRequest {
    style: String,
    duration_seconds: u32,
    music_mode: String,
    auto_storyboard: bool,
    generate_square_variant: bool,
    generate_landscape_variant: bool,
    enable_watermark: bool,
    use_product_gallery: bool,
    use_service_mediatech: bool,
    auto_generate_images: bool,
    generate_subtitles: bool,
    subtitle_lang: String,
    voiceover_lang: String,
    use_ai_templates: bool,
    style_effects: Vec<String>,
    style_transitions: Vec<String>,
    style_color_palette: String,
    creation_source: String,
}

#[derive(Debug, Serialize)]
struct ExpressVideoResponse {
    success: bool,
    video_url: String,
    duration_seconds: u32,
    style: String,
    message: String,
    job_id: Option<Uuid>,
}

/// ✅ Endpoint Express - Génération vidéo optimisée 1-click
pub async fn generate_express_video(
    State(state): State<crate::state::AppState>,
    user: AuthenticatedUser,
    Path((service_id, product_index)): Path<(i32, i32)>,
    Json(payload): Json<ExpressVideoRequest>,
) -> Result<Json<ExpressVideoResponse>, AppError> {
    log::info!(
        "[ExpressVideo] Génération 1-click - user_id={}, service_id={}, product_index={}, style={}",
        user.id, service_id, product_index, payload.style
    );

    // ✅ Validation rapide des prérequis
    let video_payload = VideoGenerationPayload {
        style: Some(payload.style),
        duration_seconds: Some(payload.duration_seconds),
        music_mode: Some(payload.music_mode),
        auto_storyboard: Some(payload.auto_storyboard),
        generate_square_variant: Some(payload.generate_square_variant),
        generate_landscape_variant: Some(payload.generate_landscape_variant),
        enable_watermark: Some(payload.enable_watermark),
        use_product_gallery: Some(payload.use_product_gallery),
        use_service_mediatech: Some(payload.use_service_mediatech),
        auto_generate_images: Some(payload.auto_generate_images),
        generate_subtitles: Some(payload.generate_subtitles),
        subtitle_lang: Some(payload.subtitle_lang),
        voiceover_lang: Some(payload.voiceover_lang),
        use_ai_templates: Some(payload.use_ai_templates),
        style_effects: Some(payload.style_effects),
        style_transitions: Some(payload.style_transitions),
        style_color_palette: Some(payload.style_color_palette),
        creation_source: Some(payload.creation_source),
        // ✅ Valeurs par défaut optimisées pour Express
        ..Default::default()
    };

    // ✅ Validation avec mode permissif (auto_generate_images activé)
    if let Err(e) = validate_video_generation_prerequisites(&state, service_id, product_index, &video_payload).await {
        log::warn!("[ExpressVideo] Validation échouée: {}", e);
        return Err(AppError::BadRequest(format!(
            "Prérequis vidéo invalides: {}. Essayez d'ajouter des images au produit.",
            e
        )));
    }

    // ✅ Génération avec job_id pour tracking
    let job_id = Some(Uuid::new_v4());
    
    match generate_product_video(
        state.clone(),
        &user,
        service_id,
        product_index,
        video_payload,
        job_id,
    ).await {
        Ok(result) => {
            log::info!(
                "[ExpressVideo] ✅ Génération réussie - video_url={}, duration={}s",
                result.video_url,
                result.duration_seconds
            );

            Ok(Json(ExpressVideoResponse {
                success: true,
                video_url: result.video_url,
                duration_seconds: result.duration_seconds,
                style: result.style,
                message: format!(
                    "Vidéo générée avec succès en {} secondes!",
                    result.duration_seconds
                ),
                job_id: result.job_id,
            }))
        }
        Err(e) => {
            log::error!("[ExpressVideo] ❌ Échec génération: {}", e);
            Err(AppError::Internal(format!(
                "Échec génération vidéo Express: {}",
                e
            )))
        }
    }
}

/// ✅ Endpoint Estimation Express - Calcul rapide du coût
pub async fn estimate_express_video(
    State(state): State<crate::state::AppState>,
    user: AuthenticatedUser,
    Path((service_id, product_index)): Path<(i32, i32)>,
    Json(payload): Json<ExpressVideoRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    log::info!(
        "[ExpressVideo] Estimation coût - user_id={}, service_id={}, product_index={}",
        user.id, service_id, product_index
    );

    let video_payload = VideoGenerationPayload {
        style: Some(payload.style),
        duration_seconds: Some(payload.duration_seconds),
        ..Default::default()
    };

    match estimate_video_cost(state, &user, service_id, product_index, video_payload).await {
        Ok(cost) => {
            Ok(Json(serde_json::json!({
                "success": true,
                "estimated_cost": cost,
                "currency": "XAF",
                "processing_time_seconds": payload.duration_seconds,
                "message": format!("Coût estimé: {} XAF", cost.estimated_tokens * 10) // Approximation
            })))
        }
        Err(e) => {
            log::error!("[ExpressVideo] ❌ Erreur estimation: {}", e);
            Err(AppError::Internal(format!("Erreur estimation: {}", e)))
        }
    }
}
