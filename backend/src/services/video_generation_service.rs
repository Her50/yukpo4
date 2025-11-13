use std::{
    collections::HashSet,
    path::{Path, PathBuf},
    sync::Arc,
};

use chrono::Utc;
use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use tokio::{fs, process::Command};
use uuid::Uuid;

use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::AuthenticatedUser,
    services::{
        app_ia::VideoBriefRequest,
        audio_library_service,
        audio_mastering_service::AudioMasteringOutcome,
        audio_pipeline::{self, AudioMixConfig},
        broll_service,
        cost_service::CostEstimation,
        immersive_orchestrator::{
            ImmersiveOrchestrator, TimelineAnalytics, TimelineBrollAsset, TimelineRequest,
        },
        immersive_timeline::ImmersiveTimeline,
        video_analytics_service::{record_engagement, schedule_distribution_targets},
        video_job_service::try_store_progress,
        video_renderer::{RenderExecutionMode, RenderJobRequest, RenderJobResponse},
    },
    state::AppState,
};

#[derive(Debug, Deserialize, Clone)]
pub struct VideoGenerationPayload {
    pub style: Option<String>,
    pub duration_seconds: Option<u32>,
    pub headline: Option<String>,
    pub call_to_action: Option<String>,
    pub include_price: Option<bool>,
    pub include_promotion: Option<bool>,
    pub include_contact: Option<bool>,
    pub selected_media_ids: Option<Vec<i32>>,
    pub related_product_indices: Option<Vec<i32>>,
    pub use_product_gallery: Option<bool>,
    pub use_service_mediatech: Option<bool>,
    pub include_publicite_assets: Option<bool>,
    pub publish_to_chat: Option<bool>,
    pub publish_to_product_card: Option<bool>,
    pub storyboard: Option<Vec<String>>,
    pub music_mode: Option<String>,
    pub music_volume: Option<f32>,
    pub voiceover_script: Option<String>,
    pub voiceover_lang: Option<String>,
    pub voiceover_voice: Option<String>,
    pub generate_square_variant: Option<bool>,
    pub generate_landscape_variant: Option<bool>,
    pub auto_storyboard: Option<bool>,
    pub subtitle_mode: Option<String>,
    pub subtitle_lang: Option<String>,
    pub music_track_id: Option<i32>,
    pub distribute_channels: Option<Vec<String>>,
    pub use_ai_templates: Option<bool>,
    pub generate_subtitles: Option<bool>,
    pub style_effects: Option<Vec<String>>,
    pub style_transitions: Option<Vec<String>>,
    pub style_color_palette: Option<String>,
    pub style_overlay_tips: Option<Vec<String>>,
    pub style_music_hint: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct VideoGenerationResult {
    pub success: bool,
    pub media_id: i32,
    pub service_id: i32,
    pub product_index: i32,
    pub video_url: String,
    pub path: String,
    pub duration_seconds: u32,
    pub used_media_ids: Vec<i32>,
    pub script_outline: Vec<String>,
    pub style: String,
    pub headline: Option<String>,
    pub call_to_action: Option<String>,
    pub published_to_chat: bool,
    pub published_to_product_card: bool,
    pub background_music_used: Option<String>,
    pub voiceover_generated: bool,
    pub additional_outputs: Vec<AlternativeVideoFormat>,
    pub subtitles_generated: bool,
    pub subtitle_url: Option<String>,
    pub distribution_targets: Vec<String>,
    pub quality_score: f32,
    pub immersive_timeline: Option<ImmersiveTimeline>,
    pub immersive_analytics: Option<TimelineAnalytics>,
    pub orchestration_warnings: Vec<String>,
    pub progress_steps: Vec<ProgressStep>,
    pub cost_estimation: Option<CostEstimation>,
    pub job_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ProgressStep {
    pub key: &'static str,
    pub label: &'static str,
    pub status: &'static str,
    pub detail: Option<String>,
}

impl ProgressStep {
    fn completed(key: &'static str, label: &'static str, detail: Option<String>) -> Self {
        Self {
            key,
            label,
            status: "completed",
            detail,
        }
    }
}

#[derive(Debug, Serialize, Clone)]
pub struct AlternativeVideoFormat {
    pub format: String,
    pub path: String,
    pub video_url: String,
    pub media_id: i32,
}

#[derive(Clone)]
struct MediaSource {
    id: Option<i32>,
    path: PathBuf,
}

struct SlideOverlay {
    top_text: Option<String>,
    bottom_text: Option<String>,
}

#[derive(Clone, Copy)]
struct KenBurnsOptions {
    frames: i32,
    increment: f32,
    max_zoom: f32,
}

impl KenBurnsOptions {
    fn from_duration(duration: f32) -> Self {
        let sanitized = duration.max(1.0);
        let frames = (sanitized * 30.0).round().max(1.0) as i32;
        let target_zoom = if sanitized < 3.0 { 1.05 } else { 1.1 };
        let increment = ((target_zoom - 1.0) / frames as f32).clamp(0.00025, 0.0035);
        Self {
            frames,
            increment,
            max_zoom: target_zoom,
        }
    }
}

pub async fn estimate_video_cost(
    state: Arc<AppState>,
    user: &AuthenticatedUser,
    service_id: i32,
    product_index: i32,
    payload: VideoGenerationPayload,
) -> AppResult<CostEstimation> {
    let svc = sqlx::query!(
        "SELECT user_id, data AS \"data: serde_json::Value\" FROM services WHERE id = $1",
        service_id
    )
    .fetch_optional(&state.pg)
    .await
    .map_err(|err| {
        error!("[VideoGeneration] Erreur récupération service {service_id}: {err:?}");
        AppError::from(err)
    })?
    .ok_or_else(|| AppError::NotFound("Service introuvable pour ce prestataire.".to_string()))?;

    if svc.user_id != user.id {
        return Err(AppError::Unauthorized(
            "Vous ne pouvez estimer le coût que pour vos propres services.".to_string(),
        ));
    }

    let service_data: Value = svc.data;
    if service_data.is_null() {
        return Err(AppError::Internal(
            "Service sans données associées.".to_string(),
        ));
    }

    let product_array = locate_product_array(&service_data).ok_or_else(|| {
        AppError::BadRequest("Aucun produit enregistré pour ce service.".to_string())
    })?;

    if product_index < 0 || product_index as usize >= product_array.len() {
        return Err(AppError::NotFound(
            "Produit introuvable pour ce service.".to_string(),
        ));
    }

    let primary_product = product_array
        .get(product_index as usize)
        .cloned()
        .unwrap_or(Value::Null);

    let product_name = extract_string(&primary_product, &["nom", "name", "titre", "title"])
        .unwrap_or_else(|| "Produit".to_string());
    let price_label = if payload.include_price.unwrap_or(true) {
        extract_price_label(&primary_product)
    } else {
        None
    };
    let promotion_label = if payload.include_promotion.unwrap_or(false) {
        extract_string(
            &primary_product,
            &["promotionValeur", "promotion_label", "promotion"],
        )
    } else {
        None
    };

    let mut script_outline: Vec<String> = payload
        .storyboard
        .clone()
        .unwrap_or_default()
        .into_iter()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .collect();

    if script_outline.is_empty() || payload.auto_storyboard.unwrap_or(false) {
        script_outline = generate_storyboard_lines(
            &primary_product,
            &product_name,
            price_label.clone(),
            promotion_label.clone(),
        );
    }

    if script_outline.is_empty() {
        script_outline.push(format!("Découvrez {}", product_name));
        if let Some(price) = &price_label {
            script_outline.push(format!("Prix spécial : {}", price));
        }
        if let Some(promo) = &promotion_label {
            script_outline.push(format!("🎁 Promo: {}", promo));
        }
        if let Some(description) = extract_string(&primary_product, &["description"]) {
            script_outline.push(description);
        }
    }

    if script_outline.len() > 6 {
        script_outline.truncate(6);
    }

    state
        .cost_service
        .estimate_video_generation_cost_only(user.id, script_outline.len())
        .await
}

pub async fn generate_product_video(
    state: Arc<AppState>,
    user: &AuthenticatedUser,
    service_id: i32,
    product_index: i32,
    payload: VideoGenerationPayload,
    job_id: Option<Uuid>,
) -> AppResult<VideoGenerationResult> {
    let svc = sqlx::query!(
        "SELECT user_id, data AS \"data: serde_json::Value\" FROM services WHERE id = $1",
        service_id
    )
    .fetch_optional(&state.pg)
    .await
    .map_err(|err| {
        error!("[VideoGeneration] Erreur récupération service {service_id}: {err:?}");
        AppError::from(err)
    })?
    .ok_or_else(|| AppError::NotFound("Service introuvable pour ce prestataire.".to_string()))?;

    if svc.user_id != user.id {
        warn!(
            "[VideoGeneration] Tentative non autorisée - user_id={}, owner={:?}",
            user.id, svc.user_id
        );
        return Err(AppError::Unauthorized(
            "Vous ne pouvez générer des vidéos que pour vos propres services.".to_string(),
        ));
    }

    let mut service_data: Value = svc.data;
    if service_data.is_null() {
        return Err(AppError::Internal(
            "Service sans données associées.".to_string(),
        ));
    }

    let product_array_len = {
        let array = locate_product_array(&service_data).ok_or_else(|| {
            AppError::BadRequest("Aucun produit enregistré pour ce service.".to_string())
        })?;
        array.len()
    };

    if product_index < 0 || product_index as usize >= product_array_len {
        return Err(AppError::NotFound(
            "Produit introuvable pour ce service.".to_string(),
        ));
    }

    let primary_product = locate_product_array(&service_data)
        .and_then(|array| array.get(product_index as usize))
        .cloned()
        .unwrap_or(Value::Null);

    let product_name = extract_string(&primary_product, &["nom", "name", "titre", "title"])
        .unwrap_or_else(|| "Produit".to_string());
    let product_type = extract_string(&primary_product, &["type", "category", "categorie"])
        .unwrap_or_else(|| "produit".to_string());
    let price_label = if payload.include_price.unwrap_or(true) {
        extract_price_label(&primary_product)
    } else {
        None
    };
    let promotion_label = if payload.include_promotion.unwrap_or(false) {
        extract_string(
            &primary_product,
            &["promotionValeur", "promotion_label", "promotion"],
        )
    } else {
        None
    };

    let mut headline = payload.headline.clone();
    let mut call_to_action = payload.call_to_action.clone();
    let mut voiceover_script_opt = payload.voiceover_script.clone();

    let mut script_outline: Vec<String> = payload
        .storyboard
        .clone()
        .unwrap_or_default()
        .into_iter()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .collect();

    if script_outline.is_empty() || payload.auto_storyboard.unwrap_or(false) {
        script_outline = generate_storyboard_lines(
            &primary_product,
            &product_name,
            price_label.clone(),
            promotion_label.clone(),
        );
    }

    if script_outline.is_empty() {
        script_outline.push(format!("Découvrez {}", product_name));
        if let Some(price) = &price_label {
            script_outline.push(format!("Prix spécial : {}", price));
        }
        if let Some(promo) = &promotion_label {
            script_outline.push(format!("🎁 Promo: {}", promo));
        }
        if let Some(description) = extract_string(&primary_product, &["description"]) {
            script_outline.push(description);
        }
    }

    if script_outline.len() > 6 {
        script_outline.truncate(6);
    }

    let cost_estimation = state
        .cost_service
        .ensure_user_can_afford_video(user.id, script_outline.len())
        .await?;
    let mut progress_steps: Vec<ProgressStep> = Vec::new();
    progress_steps.push(ProgressStep::completed(
        "cost_estimation",
        "Budget validé",
        Some(format!(
            "{:.2} {} (~{:.2} USD)",
            cost_estimation.total_cost_local,
            cost_estimation.local_currency,
            cost_estimation.total_cost_usd
        )),
    ));
    if let Some(job_id) = job_id {
        try_store_progress(&state, job_id, "running", &progress_steps).await;
    }

    if payload.use_ai_templates.unwrap_or(false)
        || headline
            .as_ref()
            .map(|h| h.trim().is_empty())
            .unwrap_or(true)
        || call_to_action
            .as_ref()
            .map(|c| c.trim().is_empty())
            .unwrap_or(true)
    {
        let description = extract_string(
            &primary_product,
            &["description", "resume", "details", "story"],
        );
        let mut highlights: Vec<String> = Vec::new();
        highlights.push(format!("Type de produit: {}", product_type));
        if let Some(price) = price_label.clone() {
            highlights.push(format!("Prix actuel: {price}"));
        }
        if let Some(promo) = promotion_label.clone() {
            highlights.push(format!("Promotion en cours: {promo}"));
        }
        if let Some(city) = extract_string(&primary_product, &["city", "ville"]) {
            highlights.push(format!("Disponible à: {city}"));
        }
        if let Some(Value::Array(tags)) = primary_product.get("tags") {
            for tag in tags.iter().filter_map(|t| t.as_str()) {
                highlights.push(format!("Tag: #{tag}"));
            }
        }

        let target_audience = payload
            .distribute_channels
            .as_ref()
            .map(|channels| channels.join(", "));

        let tone = payload.style.clone();
        let lang = payload
            .subtitle_lang
            .clone()
            .or_else(|| payload.voiceover_lang.clone())
            .unwrap_or_else(|| "fr".to_string());

        let brief_request = VideoBriefRequest {
            product_name: product_name.clone(),
            description,
            price: price_label.clone(),
            promotion: promotion_label.clone(),
            highlights,
            target_audience,
            tone,
            lang,
            variant_count: 1,
        };

        match state.ia.generate_video_briefs(&brief_request).await {
            Ok(briefs) => {
                if let Some(brief) = briefs.first() {
                    if !brief.script_outline.is_empty() {
                        script_outline = brief.script_outline.clone();
                    }
                    if headline
                        .as_ref()
                        .map(|h| h.trim().is_empty())
                        .unwrap_or(true)
                    {
                        headline = brief.headline.clone();
                    }
                    if call_to_action
                        .as_ref()
                        .map(|c| c.trim().is_empty())
                        .unwrap_or(true)
                    {
                        call_to_action = brief.call_to_action.clone();
                    }
                    if voiceover_script_opt
                        .as_ref()
                        .map(|v| v.trim().is_empty())
                        .unwrap_or(true)
                    {
                        voiceover_script_opt = brief.voiceover.clone();
                    }
                }
            }
            Err(err) => {
                warn!(
                    "[VideoGeneration] Impossible de générer le brief IA: {:?}",
                    err
                );
            }
        }
    }

    let media_sources = gather_media_sources(
        &state,
        service_id,
        product_index,
        payload.selected_media_ids.clone(),
        payload.use_product_gallery.unwrap_or(true),
        payload.use_service_mediatech.unwrap_or(true),
        payload.include_publicite_assets.unwrap_or(true),
    )
    .await?;

    if media_sources.is_empty() {
        return Err(AppError::BadRequest(
            "Ajoutez au moins une image dans votre médiathèque ou dans ce produit avant de générer une vidéo."
                .to_string(),
        ));
    }

    let duration_seconds = payload.duration_seconds.unwrap_or(28).clamp(10, 90);
    let per_slide_seconds = (duration_seconds as f32 / media_sources.len() as f32).clamp(3.0, 9.0);
    let font_path = locate_font_file();

    let storage_root = upload_storage_root();
    let session_id = Uuid::new_v4();
    let temp_root = storage_root.join("tmp");
    let session_dir = temp_root.join(format!("video_session_{}", session_id));
    fs::create_dir_all(&session_dir).await.map_err(|err| {
        AppError::Internal(format!(
            "Impossible de créer le dossier temporaire de génération: {err}"
        ))
    })?;

    let fallback_subtitles = || async {
        match generate_subtitles_file(&session_dir, &script_outline, duration_seconds).await {
            Ok(opt) => opt,
            Err(err) => {
                warn!("[VideoGeneration] Impossible de générer des sous-titres offline: {err}");
                None
            }
        }
    };

    let subtitle_file = match payload.subtitle_mode.as_deref().unwrap_or("auto") {
        "none" => None,
        _ => match state
            .ia
            .generate_subtitles_srt(
                &product_name,
                &script_outline,
                payload.subtitle_lang.as_deref().unwrap_or("fr"),
                duration_seconds,
            )
            .await
        {
            Ok(Some(srt)) => {
                let path = session_dir.join("subtitles_ai.srt");
                if let Err(err) = fs::write(&path, srt.as_bytes()).await {
                    error!("[VideoGeneration] Impossible d'écrire sous-titres IA: {err}");
                    fallback_subtitles().await
                } else {
                    Some(path)
                }
            }
            Ok(None) => fallback_subtitles().await,
            Err(err) => {
                warn!("[VideoGeneration] Sous-titres IA indisponibles: {err}");
                fallback_subtitles().await
            }
        },
    };

    let headline_override = payload.headline.as_ref();
    let cta_override = payload.call_to_action.as_ref();
    let overlays = build_slide_overlays(
        &payload,
        &product_name,
        &price_label,
        &promotion_label,
        &script_outline,
        media_sources.len(),
        headline_override,
        cta_override,
    );

    let kenburns_enabled = payload
        .style_effects
        .as_ref()
        .map(|effects| {
            effects.iter().any(|effect| {
                let lower = effect.to_lowercase();
                lower.contains("ken") || lower.contains("zoom") || lower.contains("pan")
            })
        })
        .unwrap_or(false);
    let slide_durations = compute_slide_durations(duration_seconds, &overlays);

    let mut slide_filenames: Vec<String> = Vec::new();
    let mut broll_clips: Vec<broll_service::BrollClip> = Vec::new();
    for (idx, media) in media_sources.iter().enumerate() {
        let slide_duration = slide_durations
            .get(idx)
            .copied()
            .unwrap_or(per_slide_seconds);

        let slide_name = format!("slide_{:02}.mp4", idx + 1);
        let duration_arg = format!("{:.2}", slide_duration);
        let kenburns_opts = if kenburns_enabled {
            Some(KenBurnsOptions::from_duration(slide_duration))
        } else {
            None
        };
        let filter = build_ffmpeg_filter(
            overlays.get(idx),
            font_path.as_ref(),
            payload.style.as_deref(),
            kenburns_opts,
        );

        if idx > 0 && idx % 2 == 1 {
            let category_hint = overlays
                .get(idx)
                .and_then(|overlay| overlay.top_text.as_deref())
                .unwrap_or("produit");
            let broll_request = broll_service::BrollRequest {
                category: category_hint.to_string(),
                location: None,
                mood: payload.style.clone(),
                style: payload.style.clone(),
                ratio: (1080, 1920),
                target_duration: slide_duration.min(5.0),
            };

            if let Some(service) = state.broll_service.as_ref() {
                match service.select_or_generate_broll(&broll_request).await {
                    Ok(clip) => {
                        broll_clips.push(clip);
                    }
                    Err(err) => {
                        warn!("[VideoGeneration] B-roll indisponible: {err}");
                    }
                }
            } else {
                warn!("[VideoGeneration] B-roll service non initialisé");
            }
        }

        let args = vec![
            "-y".to_string(),
            "-loop".to_string(),
            "1".to_string(),
            "-i".to_string(),
            media.path.to_string_lossy().to_string(),
            "-t".to_string(),
            duration_arg,
            "-vf".to_string(),
            filter,
            "-c:v".to_string(),
            "libx264".to_string(),
            "-pix_fmt".to_string(),
            "yuv420p".to_string(),
            slide_name.clone(),
        ];

        run_ffmpeg(&session_dir, args).await?;
        slide_filenames.push(slide_name);
    }

    let timeline_broll_assets: Vec<TimelineBrollAsset> = broll_clips
        .iter()
        .filter_map(|clip| {
            let portrait_variant = clip
                .variants
                .iter()
                .find(|variant| variant.format == "portrait" && variant.path.exists());
            let fallback_variant = clip.variants.iter().find(|variant| variant.path.exists());

            let (path_string, format_string) = if let Some(variant) = portrait_variant {
                (
                    variant.path.to_string_lossy().to_string(),
                    variant.format.clone(),
                )
            } else if let Some(variant) = fallback_variant {
                (
                    variant.path.to_string_lossy().to_string(),
                    variant.format.clone(),
                )
            } else if clip.local_path.exists() {
                (
                    clip.local_path.to_string_lossy().to_string(),
                    "original".to_string(),
                )
            } else {
                return None;
            };

            Some(TimelineBrollAsset {
                path: path_string,
                format: format_string,
                source: format!("{:?}", clip.source),
                duration_seconds: clip.duration_seconds,
            })
        })
        .collect();
    progress_steps.push(ProgressStep::completed(
        "broll_selection",
        "Clips b-roll sélectionnés",
        Some(format!("{} clip(s)", broll_clips.len())),
    ));
    if let Some(job_id) = job_id {
        try_store_progress(&state, job_id, "running", &progress_steps).await;
    }

    let orchestrator = ImmersiveOrchestrator::new(state.clone());
    let timeline_request = TimelineRequest {
        script_outline: script_outline.clone(),
        product_name: product_name.clone(),
        headline: headline.clone(),
        call_to_action: call_to_action.clone(),
        style: payload.style.clone(),
        duration_seconds: duration_seconds as f32,
        broll_assets: timeline_broll_assets,
    };

    let mut immersive_timeline: Option<ImmersiveTimeline> = None;
    let mut immersive_analytics: Option<TimelineAnalytics> = None;
    let mut orchestration_warnings: Vec<String> = Vec::new();
    let mut sfx_layers: Vec<audio_pipeline::AudioLayer> = Vec::new();
    let mut renderer_response: Option<RenderJobResponse> = None;
    let mut renderer_mode: Option<RenderExecutionMode> = None;

    match orchestrator.generate_timeline(timeline_request).await {
        Ok(result) => {
            orchestration_warnings.extend(result.warnings.clone());
            immersive_timeline = Some(result.timeline.clone());
            immersive_analytics = Some(result.analytics.clone());
            progress_steps.push(ProgressStep::completed(
                "timeline_generation",
                "Timeline immersive générée",
                Some(format!(
                    "{} scènes, {} b-roll",
                    result.analytics.total_scenes, result.analytics.broll_clips_used
                )),
            ));
            if let Some(job_id) = job_id {
                try_store_progress(&state, job_id, "running", &progress_steps).await;
            }

            let sfx_root = Path::new("assets/sfx");
            if sfx_root.exists() {
                match audio_pipeline::build_sfx_layers_from_timeline(&result.timeline, sfx_root) {
                    Ok(layers) => {
                        sfx_layers = layers;
                    }
                    Err(err) => {
                        warn!("[VideoGeneration] Impossible de générer les SFX timeline: {err}");
                        orchestration_warnings.push(format!("sfx_generation_failed: {err}"));
                    }
                }
            } else {
                warn!(
                    "[VideoGeneration] Dossier SFX introuvable pour la timeline immersive (assets/sfx)"
                );
                orchestration_warnings.push("sfx_library_missing: assets/sfx".to_string());
            }
        }
        Err(err) => {
            warn!("[VideoGeneration] Orchestrateur immersif indisponible: {err}");
            orchestration_warnings.push(format!("orchestrator_error: {err}"));
        }
    }

    if renderer_response.is_none() {
        if let (Some(timeline), Some(dispatcher)) =
            (immersive_timeline.clone(), state.video_renderer.clone())
        {
            info!("[VideoGeneration] Tentative rendu via dispatcher vidéo");
            let render_request = RenderJobRequest {
                job_id,
                timeline: Arc::new(timeline.clone()),
            };

            match dispatcher.render(&render_request).await {
                Ok(response) => {
                    renderer_mode = Some(response.mode);
                    if !response.warnings.is_empty() {
                        orchestration_warnings.extend(
                            response
                                .warnings
                                .iter()
                                .map(|warn| format!("renderer_warning: {warn}"))
                                .collect::<Vec<_>>(),
                        );
                    }
                    progress_steps.push(ProgressStep::completed(
                        "video_render",
                        match response.mode {
                            RenderExecutionMode::GpuRpc => "Vidéo rendue via worker GPU",
                            RenderExecutionMode::Offline => "Vidéo rendue via renderer local",
                        },
                        Some(format!("job={}", response.job_id)),
                    ));
                    if let Some(job_id) = job_id {
                        try_store_progress(&state, job_id, "running", &progress_steps).await;
                    }
                    renderer_response = Some(response);
                }
                Err(err) => {
                    warn!(
                        "[VideoGeneration] Renderer dispatcher indisponible (mode={:?}): {}",
                        err.mode, err.message
                    );
                    orchestration_warnings.push(format!(
                        "renderer_error: mode={:?} message={}",
                        err.mode, err.message
                    ));
                }
            }
        }
    }
    let used_media_ids: Vec<i32> = media_sources
        .iter()
        .filter_map(|source| source.id)
        .collect();

    let transition_type = payload.style_transitions.as_ref().and_then(|transitions| {
        transitions
            .iter()
            .find(|value| {
                let lower = value.to_lowercase();
                lower.contains("crossfade")
                    || lower.contains("fade")
                    || lower.contains("transition")
            })
            .cloned()
    });

    if let Some(ttype) = transition_type {
        apply_crossfade_transitions(&session_dir, &slide_filenames, &slide_durations, &ttype)
            .await?;
    } else {
        let concat_file = session_dir.join("concat.txt");
        let concat_content = slide_filenames
            .iter()
            .map(|name| format!("file '{}'\n", name))
            .collect::<String>();
        fs::write(&concat_file, concat_content)
            .await
            .map_err(|err| {
                AppError::Internal(format!("Erreur préparation concaténation vidéo: {err}"))
            })?;

        run_ffmpeg(
            &session_dir,
            vec![
                "-y".to_string(),
                "-f".to_string(),
                "concat".to_string(),
                "-safe".to_string(),
                "0".to_string(),
                "-i".to_string(),
                "concat.txt".to_string(),
                "-c".to_string(),
                "copy".to_string(),
                "combined.mp4".to_string(),
            ],
        )
        .await?;
    }

    let music_track = if payload.music_mode.as_deref() == Some("none") {
        None
    } else if let Some(track_id) = payload.music_track_id {
        resolve_audio_track(&state, service_id, track_id).await?
    } else if let Some(curated_track) = select_curated_audio_track(
        &session_dir,
        payload.music_mode.as_deref(),
        payload.style_music_hint.as_deref(),
    )
    .await?
    {
        Some(curated_track)
    } else {
        generate_background_music(
            &session_dir,
            duration_seconds,
            payload.music_mode.as_deref().unwrap_or("pulse"),
        )
        .await
        .ok()
    };

    let voiceover_track = if let Some(script) = voiceover_script_opt.clone() {
        let trimmed = script.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            let lang = payload.voiceover_lang.as_deref().unwrap_or("fr");
            if let Some(premium_path) =
                generate_premium_voiceover(&session_dir, &trimmed, lang).await?
            {
                Some(premium_path)
            } else {
                match state.ia.generate_tts_audio(&trimmed, lang).await {
                    Ok(Some((bytes, format))) => {
                        let filename = format!("voiceover_ai_{}.{}", Uuid::new_v4(), format);
                        let path = session_dir.join(filename);
                        if let Err(err) = fs::write(&path, bytes).await {
                            warn!("[VideoGeneration] Écriture voix IA impossible: {err}");
                            let voice = payload.voiceover_voice.as_deref().unwrap_or("fr");
                            generate_voiceover_audio(&session_dir, &trimmed, lang, voice)
                                .await
                                .ok()
                        } else {
                            Some(path)
                        }
                    }
                    Ok(None) => {
                        let voice = payload.voiceover_voice.as_deref().unwrap_or("fr");
                        generate_voiceover_audio(&session_dir, &trimmed, lang, voice)
                            .await
                            .ok()
                    }
                    Err(err) => {
                        warn!("[VideoGeneration] Voix IA indisponible: {err}");
                        let voice = payload.voiceover_voice.as_deref().unwrap_or("fr");
                        generate_voiceover_audio(&session_dir, &trimmed, lang, voice)
                            .await
                            .ok()
                    }
                }
            }
        }
    } else {
        None
    };

    let audio_config = AudioMixConfig {
        music_volume: payload.music_volume.unwrap_or(0.28).clamp(0.05, 0.8),
        ..Default::default()
    };

    if renderer_response.is_none() {
        let mixed_audio_path = audio_pipeline::mix_media_audio_tracks(
            &session_dir,
            &session_dir.join("combined.mp4"),
            music_track.as_deref(),
            voiceover_track.as_deref(),
            &sfx_layers,
            &audio_config,
        )
        .await?;
        progress_steps.push(ProgressStep::completed(
            "audio_mix",
            "Mix audio finalisé",
            Some(format!(
                "musique: {} | voix: {} | sfx: {}",
                music_track.is_some(),
                voiceover_track.is_some(),
                sfx_layers.len()
            )),
        ));
        if let Some(job_id) = job_id {
            try_store_progress(&state, job_id, "running", &progress_steps).await;
        }

        let mastered_audio_path = if let Some(service) = state.audio_mastering.clone() {
            let mastering_dir = session_dir.join("mastering");
            match service
                .master_audio(&mixed_audio_path, &mastering_dir, job_id)
                .await
            {
                Ok(crate::services::audio_mastering_service::AudioMasteringOutcome::Completed(
                    result,
                )) => {
                    info!(
                        "[VideoGeneration] Mastering premium appliqué via {}",
                        result.provider
                    );
                    Some(result.mastered_path)
                }
                Ok(crate::services::audio_mastering_service::AudioMasteringOutcome::Pending {
                    job_id: audio_job_id,
                }) => {
                    info!(
                        "[VideoGeneration] Mastering premium en attente (job_id={})",
                        audio_job_id
                    );
                    None
                }
                Err(err) => {
                    warn!(
                        "[VideoGeneration] Mastering premium indisponible, fallback local: {err}"
                    );
                    None
                }
            }
        } else {
            None
        };

        let final_audio_source = mastered_audio_path.as_ref().unwrap_or(&mixed_audio_path);

        audio_pipeline::mux_video_with_audio(
            &session_dir.join("combined.mp4"),
            final_audio_source,
            &session_dir.join("final.mp4"),
        )
        .await?;
        progress_steps.push(ProgressStep::completed(
            "video_mux",
            "Vidéo master finalisée",
            Some(format!("durée {}s", duration_seconds)),
        ));
        if let Some(job_id) = job_id {
            try_store_progress(&state, job_id, "running", &progress_steps).await;
        }
    }

    let source_master_path = renderer_response
        .as_ref()
        .map(|resp| resp.master_video.clone())
        .unwrap_or_else(|| session_dir.join("final.mp4"));

    let final_filename = format!("product_video_{}.mp4", session_id);
    let storage_key = format!("services/{}", final_filename);

    let stored_video = state
        .media_storage
        .store_file(&source_master_path, &storage_key, Some("video/mp4"))
        .await
        .map_err(|err| {
            error!("[VideoGeneration] Impossible de stocker la vidéo générée: {err:?}");
            err
        })?;

    let normalized_relative = stored_video.storage_path.replace('\\', "/");
    let public_url = stored_video.public_url.clone();
    let file_size = stored_video
        .content_length
        .unwrap_or(0)
        .min(i64::MAX as u64) as i64;

    let subtitle_public_url = if let Some(sub_file) = subtitle_file.as_ref() {
        let subtitle_name = format!("subtitles_{}.srt", session_id);
        let subtitle_key = format!("services/{}", subtitle_name);
        match state
            .media_storage
            .store_file(sub_file, &subtitle_key, Some("application/x-subrip"))
            .await
        {
            Ok(result) => Some(result.public_url),
            Err(err) => {
                warn!("[VideoGeneration] Impossible de stocker les sous-titres générés: {err}");
                None
            }
        }
    } else {
        None
    };

    let absolute_output_path = state.media_storage.local_path_for(&storage_key);

    append_video_to_service_data(
        &state,
        service_id,
        product_index,
        &mut service_data,
        public_url.clone(),
        subtitle_public_url.clone(),
        &[],
    )
    .await?;

    let mut additional_outputs: Vec<AlternativeVideoFormat> = Vec::new();
    if payload.generate_square_variant.unwrap_or(true) {
        if let Some(variant) = generate_additional_variant(
            &session_dir,
            &absolute_output_path,
            service_id,
            product_index,
            &state,
            "square",
            1080,
            1080,
            &normalized_relative,
        )
        .await?
        {
            additional_outputs.push(variant);
        }
    }

    if payload.generate_landscape_variant.unwrap_or(false) {
        if let Some(variant) = generate_additional_variant(
            &session_dir,
            &absolute_output_path,
            service_id,
            product_index,
            &state,
            "landscape",
            1920,
            1080,
            &normalized_relative,
        )
        .await?
        {
            additional_outputs.push(variant);
        }
    }

    let variant_urls: Vec<(String, String)> = additional_outputs
        .iter()
        .map(|variant| (variant.format.clone(), variant.video_url.clone()))
        .collect();

    if !variant_urls.is_empty() {
        append_video_variants_to_service_data(&state, service_id, product_index, &variant_urls)
            .await?;
    }

    let quality_score = compute_quality_score(
        &payload,
        &script_outline,
        subtitle_public_url.is_some(),
        voiceover_track.is_some(),
        additional_outputs.len(),
    );

    let ai_description = payload
        .headline
        .clone()
        .unwrap_or_else(|| format!("Présentation vidéo de {}", product_name));
    let product_identifier = derive_product_identifier(&primary_product, service_id, product_index);

    let mut ai_tags = vec![
        "video".to_string(),
        "marketing".to_string(),
        product_type.clone(),
        product_name.clone(),
    ];
    if payload.style.is_some() {
        ai_tags.push(payload.style.clone().unwrap());
    }

    let mut ai_metadata = json!({
        "product_name": product_name,
        "product_type": product_type,
        "price_label": price_label,
        "promotion_label": promotion_label,
        "script_outline": script_outline.clone(),
        "style": payload.style,
        "headline": headline.clone(),
        "call_to_action": call_to_action.clone(),
        "style_effects": payload.style_effects,
        "style_transitions": payload.style_transitions,
        "style_color_palette": payload.style_color_palette,
        "style_overlay_tips": payload.style_overlay_tips,
        "style_music_hint": payload.style_music_hint,
        "quality_score": quality_score,
        "voiceover_generated": voiceover_track.is_some(),
        "subtitles_generated": subtitle_public_url.is_some(),
        "variants_count": additional_outputs.len(),
        "broll_count": broll_clips.len(),
    });
    if let Some(map) = ai_metadata.as_object_mut() {
        if let Some(effects) = payload.style_effects.clone() {
            map.insert("style_effects".to_string(), json!(effects));
        }
        if let Some(transitions) = payload.style_transitions.clone() {
            map.insert("style_transitions".to_string(), json!(transitions));
        }
        if let Some(palette) = payload.style_color_palette.clone() {
            map.insert("style_color_palette".to_string(), json!(palette));
        }
        if let Some(tips) = payload.style_overlay_tips.clone() {
            map.insert("style_overlay_tips".to_string(), json!(tips));
        }
        if let Some(music_hint) = payload.style_music_hint.clone() {
            map.insert("style_music_hint".to_string(), json!(music_hint));
        }
        if let Some(mode) = renderer_mode {
            map.insert("render_mode".to_string(), json!(format!("{mode:?}")));
        }
        if let Some(renderer) = renderer_response.as_ref() {
            map.insert("render_job_id".to_string(), json!(renderer.job_id.clone()));
        }
        map.insert("storage_path".to_string(), json!(normalized_relative));
        map.insert("public_url".to_string(), json!(public_url));
        map.insert("product_identifier".to_string(), json!(product_identifier));
        map.insert("duration_seconds".to_string(), json!(duration_seconds));
        map.insert("file_size_bytes".to_string(), json!(file_size));
        map.insert("music_mode".to_string(), json!(payload.music_mode.clone()));
        map.insert(
            "voiceover_lang".to_string(),
            json!(payload.voiceover_lang.clone()),
        );
        map.insert(
            "voiceover_voice".to_string(),
            json!(payload.voiceover_voice.clone()),
        );
        map.insert(
            "voiceover_generated".to_string(),
            json!(voiceover_track.is_some()),
        );
        if let Some(sub_url) = &subtitle_public_url {
            map.insert("subtitle_url".to_string(), json!(sub_url));
        }
        if !variant_urls.is_empty() {
            let variant_json: Vec<Value> = variant_urls
                .iter()
                .map(|(format, url)| json!({ "format": format, "url": url }))
                .collect();
            map.insert("variant_urls".to_string(), json!(variant_json));
        }
        if !additional_outputs.is_empty() {
            map.insert("additional_outputs".to_string(), json!(additional_outputs));
        }
        if let Some(script) = voiceover_script_opt.as_ref() {
            map.insert("voiceover_script".to_string(), json!(script));
        }
    }

    let inserted = sqlx::query!(
        r#"
        INSERT INTO media (
            service_id,
            product_id,
            product_index,
            type,
            media_type,
            path,
            file_size,
            file_format,
            ai_description,
            ai_tags,
            ai_metadata,
            ai_analyzed_at,
            ai_model_used,
            ai_confidence
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, $13
        )
        RETURNING id AS "id: i32"
        "#,
        service_id,
        product_identifier,
        product_index,
        "video_generated",
        "video",
        normalized_relative,
        file_size,
        "mp4",
        ai_description,
        &ai_tags,
        ai_metadata,
        "video_generation_pipeline_v1",
        quality_score as f64
    )
    .fetch_one(&state.pg)
    .await
    .map_err(|err| {
        error!("[VideoGeneration] Erreur insertion média: {err:?}");
        AppError::from(err)
    })?;

    let distribution_targets = payload.distribute_channels.clone().unwrap_or_default();

    schedule_distribution_targets(&state, inserted.id, service_id, &distribution_targets).await?;

    let analytics_for_json = immersive_analytics.clone();
    let warnings_for_json = if orchestration_warnings.is_empty() {
        None
    } else {
        Some(orchestration_warnings.clone())
    };
    let progress_for_json: Vec<Value> = progress_steps
        .iter()
        .map(|step| {
            json!({
                "key": step.key,
                "label": step.label,
                "status": step.status,
                "detail": step.detail,
            })
        })
        .collect();
    let cost_estimation_json =
        serde_json::to_value(&cost_estimation).unwrap_or_else(|_| json!(null));

    if let Err(err) = record_engagement(
        state.clone(),
        inserted.id,
        "quality_score",
        Some("internal".to_string()),
        Some(user.id),
        None,
        Some(json!({
            "quality_score": quality_score,
            "voiceover_generated": voiceover_track.is_some(),
            "subtitles_generated": subtitle_public_url.is_some(),
            "style": payload.style,
            "effects_count": payload.style_effects.as_ref().map(|v| v.len()).unwrap_or(0),
            "transitions_count": payload.style_transitions.as_ref().map(|v| v.len()).unwrap_or(0),
            "immersive_analytics": analytics_for_json,
            "timeline_warnings": warnings_for_json,
            "progress_steps": progress_for_json,
            "cost_estimation": cost_estimation_json,
        })),
    )
    .await
    {
        warn!(
            "[VideoGeneration] Impossible d'enregistrer le score qualité analytics: {}",
            err
        );
    }

    // Nettoyage du dossier temporaire (après génération des variantes)
    if let Err(err) = fs::remove_dir_all(&session_dir).await {
        warn!(
            "[VideoGeneration] Impossible de supprimer le dossier temporaire {:?}: {err}",
            session_dir
        );
    }

    let result = VideoGenerationResult {
        success: true,
        media_id: inserted.id,
        service_id,
        product_index,
        video_url: public_url.clone(),
        path: normalized_relative,
        duration_seconds,
        used_media_ids,
        script_outline,
        style: payload.style.unwrap_or_else(|| "tiktok".to_string()),
        headline,
        call_to_action,
        published_to_chat: payload.publish_to_chat.unwrap_or(true),
        published_to_product_card: payload.publish_to_product_card.unwrap_or(true),
        background_music_used: payload.music_mode,
        voiceover_generated: voiceover_track.is_some(),
        additional_outputs,
        subtitles_generated: subtitle_public_url.is_some(),
        subtitle_url: subtitle_public_url,
        distribution_targets,
        quality_score,
        immersive_timeline,
        immersive_analytics,
        orchestration_warnings,
        progress_steps,
        cost_estimation: Some(cost_estimation),
        job_id,
    };

    if let Some(job_id) = job_id {
        try_store_progress(&state, job_id, "completed", &result.progress_steps).await;
    }

    Ok(result)
}

fn upload_storage_root() -> PathBuf {
    std::env::var("UPLOAD_STORAGE_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("uploads"))
}

async fn gather_media_sources(
    state: &Arc<AppState>,
    service_id: i32,
    product_index: i32,
    selected_media_ids: Option<Vec<i32>>,
    use_product_gallery: bool,
    use_service_mediatech: bool,
    include_publicite_assets: bool,
) -> AppResult<Vec<MediaSource>> {
    let mut collected: Vec<MediaSource> = Vec::new();
    let mut seen_ids: HashSet<i32> = HashSet::new();

    if let Some(ids) = selected_media_ids.as_ref() {
        if !ids.is_empty() {
            let rows = sqlx::query!(
                "SELECT id, path, type, ai_description AS \"ai_description: Option<String>\"
                 FROM media
                 WHERE service_id = $1
                 AND id = ANY($2)",
                service_id,
                ids
            )
            .fetch_all(&state.pg)
            .await
            .map_err(|err| {
                error!("[VideoGeneration] Erreur récupération médias sélectionnés: {err:?}");
                AppError::from(err)
            })?;

            for row in rows {
                if let Some(source) = row_to_media_source(row.id, &row.path) {
                    seen_ids.insert(source.id.unwrap());
                    collected.push(source);
                }
            }
        }
    }

    if collected.is_empty() && use_product_gallery {
        let rows = sqlx::query!(
            "SELECT id, path, type, ai_description AS \"ai_description: Option<String>\"
             FROM media
             WHERE service_id = $1
             AND (product_index = $2 OR (product_index IS NULL AND type = 'image'))
             ORDER BY COALESCE(is_main_image, FALSE) DESC, COALESCE(display_order, 0) ASC, id ASC
             LIMIT 16",
            service_id,
            product_index
        )
        .fetch_all(&state.pg)
        .await
        .map_err(|err| {
            error!("[VideoGeneration] Erreur récupération médias produit: {err:?}");
            AppError::from(err)
        })?;

        for row in rows {
            if let Some(source) = row_to_media_source(row.id, &row.path) {
                if let Some(id) = source.id {
                    if seen_ids.contains(&id) {
                        continue;
                    }
                    seen_ids.insert(id);
                }
                collected.push(source);
            }
        }
    }

    if use_service_mediatech {
        let rows = sqlx::query!(
            "SELECT id, path, type, ai_description AS \"ai_description: Option<String>\"
             FROM media
             WHERE service_id = $1
             AND (product_index IS NULL OR product_index != $2)
             ORDER BY uploaded_at DESC
             LIMIT 12",
            service_id,
            product_index
        )
        .fetch_all(&state.pg)
        .await
        .map_err(|err| {
            error!("[VideoGeneration] Erreur récupération médiathèque service: {err:?}");
            AppError::from(err)
        })?;

        for row in rows {
            if let Some(source) = row_to_media_source(row.id, &row.path) {
                if let Some(id) = source.id {
                    if seen_ids.contains(&id) {
                        continue;
                    }
                    seen_ids.insert(id);
                }
                collected.push(source);
            }
        }
    }

    if include_publicite_assets {
        let rows = sqlx::query!(
            "SELECT id, path, type, ai_description AS \"ai_description: Option<String>\"
             FROM media
             WHERE service_id = $1
             AND (
                media_type = 'banner'
                OR media_type = 'logo'
                OR path ILIKE '%publicite%'
                OR path ILIKE '%banner%'
             )
             ORDER BY uploaded_at DESC
             LIMIT 6",
            service_id
        )
        .fetch_all(&state.pg)
        .await
        .map_err(|err| {
            error!("[VideoGeneration] Erreur récupération assets publicité: {err:?}");
            AppError::from(err)
        })?;

        for row in rows {
            if let Some(source) = row_to_media_source(row.id, &row.path) {
                if let Some(id) = source.id {
                    if seen_ids.contains(&id) {
                        continue;
                    }
                    seen_ids.insert(id);
                }
                collected.push(source);
            }
        }
    }

    collected.truncate(18);
    Ok(collected)
}

fn row_to_media_source(id: i32, path: &str) -> Option<MediaSource> {
    let absolute = {
        let p = PathBuf::from(path);
        if p.is_absolute() {
            p
        } else {
            let storage_root = upload_storage_root();
            if let Ok(stripped) = p.strip_prefix("uploads") {
                storage_root.join(stripped)
            } else {
                storage_root.join(p)
            }
        }
    };

    if !absolute.exists() {
        error!(
            "[VideoGeneration] Média introuvable sur le disque: {:?}",
            absolute
        );
        return None;
    }

    Some(MediaSource {
        id: Some(id),
        path: absolute,
    })
}

fn build_slide_overlays(
    payload: &VideoGenerationPayload,
    product_name: &str,
    price_label: &Option<String>,
    promotion_label: &Option<String>,
    script_outline: &[String],
    total_slides: usize,
    headline_override: Option<&String>,
    call_to_action_override: Option<&String>,
) -> Vec<SlideOverlay> {
    let headline_text = headline_override
        .and_then(|value| {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        })
        .or_else(|| payload.headline.clone())
        .unwrap_or_else(|| format!("{} • Edition Yukpomnang", product_name));

    let call_to_action_text = call_to_action_override
        .and_then(|value| {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        })
        .or_else(|| payload.call_to_action.clone())
        .unwrap_or_else(|| "Commandez maintenant sur Yukpomnang ✅".to_string());

    let mut slides: Vec<SlideOverlay> = Vec::new();

    let mut remaining_outline = script_outline.to_vec();
    if remaining_outline.is_empty() {
        remaining_outline.push(format!("Découvrez {} maintenant", product_name));
    }

    let price_line = price_label.as_ref().map(|price| format!("Prix : {price}"));
    let promotion_line = promotion_label
        .as_ref()
        .map(|promo| format!("🔥 Promo spéciale : {promo}"));

    for index in 0..total_slides {
        let headline = if index == 0 {
            headline_text.clone()
        } else if index == total_slides - 1 {
            call_to_action_text.clone()
        } else {
            remaining_outline
                .get(index - 1)
                .cloned()
                .unwrap_or_else(|| headline_text.clone())
        };

        let mut subline: Option<String> = None;
        if index == 0 {
            subline = price_line.clone();
        } else if index == 1 {
            subline = promotion_line.clone();
        }

        slides.push(SlideOverlay {
            top_text: Some(headline),
            bottom_text: subline,
        });
    }

    slides
}

fn compute_slide_durations(total_duration: u32, overlays: &[SlideOverlay]) -> Vec<f32> {
    let count = overlays.len();
    if count == 0 {
        return Vec::new();
    }

    let total = total_duration.max(count as u32) as f32;
    let mut weights: Vec<f32> = overlays
        .iter()
        .map(|overlay| {
            let mut weight = 1.0;
            if let Some(top) = &overlay.top_text {
                weight += (top.chars().filter(|c| !c.is_whitespace()).count() as f32) / 40.0;
            }
            if let Some(bottom) = &overlay.bottom_text {
                weight += (bottom.chars().filter(|c| !c.is_whitespace()).count() as f32) / 60.0;
            }
            weight.max(0.5)
        })
        .collect();

    let mut total_weight: f32 = weights.iter().sum();
    if total_weight <= 0.01 {
        weights.fill(1.0);
        total_weight = count as f32;
    }

    let mut durations: Vec<f32> = weights.iter().map(|w| total * (w / total_weight)).collect();

    let average = total / count as f32;
    let min_duration = average.min(2.8).max(1.4);
    let max_duration = (average * 2.2).clamp(min_duration + 0.2, 12.0);

    for duration in durations.iter_mut() {
        if *duration < min_duration {
            *duration = min_duration;
        } else if *duration > max_duration {
            *duration = max_duration;
        }
    }

    let sum_after = durations.iter().sum::<f32>().max(0.1);
    let scale = total / sum_after;
    for duration in durations.iter_mut() {
        *duration = (*duration * scale).max(1.2);
    }

    let sum_final = durations.iter().sum::<f32>();
    if (sum_final - total).abs() > 0.1 {
        let adjust = (total / sum_final).max(0.1);
        for duration in durations.iter_mut() {
            *duration *= adjust;
        }
    }

    durations
}

fn build_ffmpeg_filter(
    overlay: Option<&SlideOverlay>,
    font_path: Option<&PathBuf>,
    style: Option<&str>,
    kenburns: Option<KenBurnsOptions>,
) -> String {
    let mut filter_parts: Vec<String> = Vec::new();

    if let Some(options) = kenburns {
        filter_parts.push("scale=1300:2300:force_original_aspect_ratio=decrease".to_string());
        filter_parts.push("pad=1300:2300:(ow-iw)/2:(oh-ih)/2".to_string());
        filter_parts.push(format!(
            "zoompan=z='if(eq(on,1),1.0,min(zoom+{inc},{max}))':d={frames}:s=1080x1920",
            inc = options.increment,
            max = options.max_zoom,
            frames = options.frames
        ));
        filter_parts.push("fps=30".to_string());
    } else {
        filter_parts.push("scale=1080:1920:force_original_aspect_ratio=decrease".to_string());
        filter_parts.push("pad=1080:1920:(ow-iw)/2:(oh-ih)/2".to_string());
    }

    let font_spec = font_path
        .map(|p| p.to_string_lossy().replace('\\', "\\\\"))
        .unwrap_or_else(|| "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf".to_string());

    if let Some(overlay) = overlay {
        if let Some(top) = &overlay.top_text {
            let sanitized = sanitize_drawtext_text(top);
            filter_parts.push(format!(
                "drawtext=fontfile='{}':text='{}':fontcolor=0xFFFFFF:fontsize=54:line_spacing=6:x=(w-text_w)/2:y=140:box=1:boxcolor=0x0F172ACC:boxborderw=24",
                font_spec, sanitized
            ));
        }

        if let Some(bottom) = &overlay.bottom_text {
            let sanitized = sanitize_drawtext_text(bottom);
            let y_position = match style.unwrap_or("tiktok") {
                "cinematic" => "h-260",
                "story" => "h-220",
                _ => "h-200",
            };
            filter_parts.push(format!(
                "drawtext=fontfile='{}':text='{}':fontcolor=0xFFFFFF:fontsize=44:line_spacing=4:x=(w-text_w)/2:y={}:box=1:boxcolor=0x0F172ACC:boxborderw=22",
                font_spec, sanitized, y_position
            ));
        }
    }

    filter_parts.push("format=yuv420p".to_string());
    filter_parts.join(",")
}

async fn append_video_to_service_data(
    state: &Arc<AppState>,
    service_id: i32,
    product_index: i32,
    service_data: &mut Value,
    video_url: String,
    subtitle_url: Option<String>,
    variant_urls: &[(String, String)],
) -> AppResult<()> {
    if let Some(array) = locate_product_array_mut(service_data) {
        if let Some(product_value) = array.get_mut(product_index as usize) {
            if let Value::Object(obj) = product_value {
                match obj.get_mut("videos") {
                    Some(Value::Array(existing)) => {
                        existing.push(Value::String(video_url.clone()));
                    }
                    Some(_) => {
                        obj.insert(
                            "videos".to_string(),
                            Value::Array(vec![Value::String(video_url.clone())]),
                        );
                    }
                    None => {
                        obj.insert(
                            "videos".to_string(),
                            Value::Array(vec![Value::String(video_url.clone())]),
                        );
                    }
                }

                if let Some(url) = subtitle_url {
                    let mut current_subtitles = match obj.get_mut("videos_subtitles") {
                        Some(Value::Array(existing)) => existing.clone(),
                        Some(_) => Vec::new(),
                        None => Vec::new(),
                    };

                    current_subtitles.push(json!({
                        "url": url,
                        "created_at": Utc::now(),
                    }));
                    obj.insert(
                        "videos_subtitles".to_string(),
                        Value::Array(current_subtitles),
                    );
                }

                if !variant_urls.is_empty() {
                    let mut current_variants = match obj.get_mut("videos_variants") {
                        Some(Value::Array(existing)) => existing.clone(),
                        Some(_) => Vec::new(),
                        None => Vec::new(),
                    };

                    for (format, url) in variant_urls {
                        current_variants.push(json!({
                            "format": format,
                            "url": url,
                        }));
                    }

                    obj.insert(
                        "videos_variants".to_string(),
                        Value::Array(current_variants),
                    );
                }
            }
        }
    }

    sqlx::query!(
        "UPDATE services SET data = $1, updated_at = NOW() WHERE id = $2",
        serde_json::Value::clone(service_data),
        service_id
    )
    .execute(&state.pg)
    .await
    .map_err(|err| {
        error!("[VideoGeneration] Erreur mise à jour service: {err:?}");
        AppError::from(err)
    })?;

    Ok(())
}

async fn append_video_variants_to_service_data(
    state: &Arc<AppState>,
    service_id: i32,
    product_index: i32,
    variant_urls: &[(String, String)],
) -> AppResult<()> {
    let service_row = sqlx::query!(
        "SELECT data AS \"data: serde_json::Value\" FROM services WHERE id = $1",
        service_id
    )
    .fetch_optional(&state.pg)
    .await
    .map_err(|err| AppError::from(err))?
    .ok_or_else(|| AppError::NotFound("Service introuvable".to_string()))?;

    let mut data_value = service_row.data;
    if let Some(array) = locate_product_array_mut(&mut data_value) {
        if let Some(product_value) = array.get_mut(product_index as usize) {
            if let Value::Object(obj) = product_value {
                let mut current_variants = match obj.get_mut("videos_variants") {
                    Some(Value::Array(existing)) => existing.clone(),
                    Some(_) => Vec::new(),
                    None => Vec::new(),
                };

                for (format, url) in variant_urls {
                    current_variants.push(json!({
                        "format": format,
                        "url": url,
                    }));
                }

                obj.insert(
                    "videos_variants".to_string(),
                    Value::Array(current_variants),
                );
            }
        }
    }

    sqlx::query!(
        "UPDATE services SET data = $1, updated_at = NOW() WHERE id = $2",
        data_value,
        service_id
    )
    .execute(&state.pg)
    .await
    .map_err(|err| AppError::from(err))?;

    Ok(())
}

async fn run_ffmpeg(working_dir: &Path, args: Vec<String>) -> AppResult<()> {
    let output = Command::new("ffmpeg")
        .current_dir(working_dir)
        .args(&args)
        .output()
        .await
        .map_err(|err| {
            error!("[VideoGeneration] Impossible d'exécuter ffmpeg: {err:?}");
            AppError::Internal("FFmpeg est requis pour générer les vidéos marketing.".to_string())
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        error!("[VideoGeneration] FFmpeg a échoué: {}", stderr);
        return Err(AppError::Internal(
            "La génération de la vidéo a échoué (FFmpeg).".to_string(),
        ));
    }

    debug!(
        "[VideoGeneration] FFmpeg command réussie: ffmpeg {}",
        args.join(" ")
    );

    Ok(())
}

fn compute_quality_score(
    payload: &VideoGenerationPayload,
    script_outline: &[String],
    subtitles_generated: bool,
    voiceover_generated: bool,
    variant_count: usize,
) -> f32 {
    let mut score = 55.0;

    if voiceover_generated {
        score += 12.0;
    }
    if subtitles_generated {
        score += 8.0;
    }
    if payload.generate_square_variant.unwrap_or(true) {
        score += 4.0;
    }
    if payload.generate_landscape_variant.unwrap_or(false) {
        score += 4.0;
    }
    if let Some(effects) = &payload.style_effects {
        if !effects.is_empty() {
            score += (effects.len().min(3) as f32) * 2.5;
        }
    }
    if let Some(transitions) = &payload.style_transitions {
        if !transitions.is_empty() {
            score += (transitions.len().min(3) as f32) * 2.5;
        }
    }
    if let Some(tips) = &payload.style_overlay_tips {
        if !tips.is_empty() {
            score += 3.0;
        }
    }
    if variant_count > 0 {
        score += (variant_count.min(2) as f32) * 3.0;
    }
    if script_outline.len() >= 3 {
        score += 5.0;
    }
    if script_outline.len() >= 5 {
        score += 3.0;
    }

    score.clamp(0.0, 100.0)
}

async fn apply_crossfade_transitions(
    session_dir: &Path,
    slide_filenames: &[String],
    slide_durations: &[f32],
    transition_hint: &str,
) -> AppResult<()> {
    if slide_filenames.is_empty() {
        return Err(AppError::Internal(
            "Aucun segment vidéo à concaténer.".to_string(),
        ));
    }

    if slide_filenames.len() == 1 {
        let source = session_dir.join(&slide_filenames[0]);
        let target = session_dir.join("combined.mp4");
        fs::rename(&source, &target).await.map_err(|err| {
            AppError::Internal(format!(
                "Impossible de préparer la vidéo unique pour concaténation: {err}"
            ))
        })?;
        return Ok(());
    }

    let transition_mode = {
        let lower = transition_hint.to_lowercase();
        if lower.contains("wipe") {
            "wipeleft"
        } else if lower.contains("slide") {
            "slideleft"
        } else if lower.contains("circle") {
            "circleopen"
        } else if lower.contains("zoom") {
            "smoothleft"
        } else {
            "fade"
        }
    };

    let mut args: Vec<String> = vec!["-y".to_string()];
    for name in slide_filenames {
        args.push("-i".to_string());
        args.push(name.clone());
    }

    let mut filter_parts: Vec<String> = Vec::new();
    let mut previous_label = "0:v".to_string();
    let mut accumulated = slide_durations.get(0).copied().unwrap_or(4.0).max(0.2);

    for index in 0..(slide_filenames.len() - 1) {
        let current_duration = slide_durations.get(index).copied().unwrap_or(4.0).max(0.2);
        let next_duration = slide_durations
            .get(index + 1)
            .copied()
            .unwrap_or(4.0)
            .max(0.2);

        let transition_duration = (current_duration.min(next_duration) * 0.25).clamp(0.35, 1.25);
        let offset = (accumulated - transition_duration).max(0.05);

        let next_label = format!("{}:v", index + 1);
        let output_label = if index == slide_filenames.len() - 2 {
            "vout".to_string()
        } else {
            format!("vxf{}", index)
        };

        filter_parts.push(format!(
            "[{prev}][{next}]xfade=transition={transition}:duration={duration:.2}:offset={offset:.2}[{out}]",
            prev = previous_label,
            next = next_label,
            transition = transition_mode,
            duration = transition_duration,
            offset = offset,
            out = output_label
        ));

        previous_label = output_label.clone();
        accumulated = accumulated + next_duration - transition_duration;
    }

    filter_parts.push(format!(
        "[{last}]format=yuv420p[vfinal]",
        last = previous_label
    ));

    let filter_complex = filter_parts.join(";");

    args.push("-filter_complex".to_string());
    args.push(filter_complex);
    args.extend_from_slice(&[
        "-map".to_string(),
        "[vfinal]".to_string(),
        "-c:v".to_string(),
        "libx264".to_string(),
        "-preset".to_string(),
        "veryfast".to_string(),
        "combined.mp4".to_string(),
    ]);

    run_ffmpeg(session_dir, args).await
}

fn locate_product_array(data: &Value) -> Option<&Vec<Value>> {
    if let Some(arr) = data.get("produits").and_then(Value::as_array) {
        return Some(arr);
    }
    if let Some(arr) = data
        .get("produits")
        .and_then(|v| v.get("valeur"))
        .and_then(Value::as_array)
    {
        return Some(arr);
    }
    if let Some(arr) = data
        .get("data")
        .and_then(|v| v.get("produits"))
        .and_then(Value::as_array)
    {
        return Some(arr);
    }
    None
}

fn locate_product_array_mut(data: &mut Value) -> Option<&mut Vec<Value>> {
    match data {
        Value::Array(arr) => Some(arr),
        Value::Object(map) => {
            if map.contains_key("produits") {
                let value = map.get_mut("produits")?;
                if value.is_array() {
                    return value.as_array_mut();
                } else {
                    return locate_product_array_mut(value);
                }
            }
            if map.contains_key("valeur") {
                let value = map.get_mut("valeur")?;
                return locate_product_array_mut(value);
            }
            map.get_mut("data").and_then(locate_product_array_mut)
        }
        _ => None,
    }
}

async fn generate_subtitles_file(
    session_dir: &Path,
    script_outline: &[String],
    duration_seconds: u32,
) -> AppResult<Option<PathBuf>> {
    if script_outline.is_empty() {
        return Ok(None);
    }

    let total_duration = duration_seconds.max(script_outline.len() as u32) as f32;
    let step = total_duration / script_outline.len() as f32;
    let mut current = 0.0_f32;
    let mut srt_content = String::new();

    for (index, line) in script_outline.iter().enumerate() {
        let start = current;
        let end = if index + 1 == script_outline.len() {
            total_duration
        } else {
            current + step
        };
        current += step;

        srt_content.push_str(&format!(
            "{}\n{} --> {}\n{}\n\n",
            index + 1,
            format_srt_timestamp(start),
            format_srt_timestamp(end),
            line.trim()
        ));
    }

    let file_path = session_dir.join("subtitles_auto.srt");
    fs::write(&file_path, srt_content.as_bytes())
        .await
        .map_err(|err| {
            AppError::Internal(format!(
                "Impossible d'écrire le fichier de sous-titres: {err}"
            ))
        })?;

    Ok(Some(file_path))
}

fn format_srt_timestamp(seconds: f32) -> String {
    let total_millis = (seconds.max(0.0) * 1000.0).round() as u64;
    let hours = total_millis / 3_600_000;
    let minutes = (total_millis / 60_000) % 60;
    let secs = (total_millis / 1_000) % 60;
    let millis = total_millis % 1_000;

    format!("{:02}:{:02}:{:02},{:03}", hours, minutes, secs, millis)
}

async fn resolve_audio_track(
    state: &Arc<AppState>,
    service_id: i32,
    track_id: i32,
) -> AppResult<Option<PathBuf>> {
    let row = sqlx::query("SELECT service_id, path, type FROM media WHERE id = $1")
        .bind(track_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(AppError::from)?;

    let row = match row {
        Some(row) => row,
        None => {
            return Err(AppError::NotFound(
                "Piste audio introuvable pour ce service.".to_string(),
            ))
        }
    };

    let owner: i32 = row.try_get("service_id").map_err(AppError::from)?;
    let raw_path: String = row.try_get("path").map_err(AppError::from)?;
    let media_type: String = row.try_get("type").map_err(AppError::from)?;

    if owner != service_id {
        return Err(AppError::Unauthorized(
            "Cette piste audio n'est pas associée à ce service.".to_string(),
        ));
    }

    if media_type != "audio" {
        return Err(AppError::BadRequest(
            "Le média sélectionné n'est pas un fichier audio.".to_string(),
        ));
    }

    let absolute = resolve_media_absolute_path(&raw_path);
    if fs::metadata(&absolute).await.is_err() {
        return Err(AppError::Internal(format!(
            "Fichier audio introuvable sur le disque: {:?}",
            absolute
        )));
    }

    Ok(Some(absolute))
}

fn resolve_media_absolute_path(raw: &str) -> PathBuf {
    let candidate = Path::new(raw);
    if candidate.is_absolute() {
        return candidate.to_path_buf();
    }

    let storage_root = upload_storage_root();
    match candidate.strip_prefix("uploads") {
        Ok(stripped) => storage_root.join(stripped),
        Err(_) => storage_root.join(candidate),
    }
}

async fn generate_premium_voiceover(
    session_dir: &Path,
    script: &str,
    lang: &str,
) -> AppResult<Option<PathBuf>> {
    if script.trim().is_empty() {
        return Ok(None);
    }

    let preferred_voice = match lang.to_lowercase().as_str() {
        "en" | "en-us" | "en_usa" => "en_premium",
        "fr" | "fr-fr" | "fr_ca" => "fr_premium",
        "es" | "es-es" => "es_premium",
        _ => "global_premium",
    };

    match generate_voiceover_audio(session_dir, script, lang, preferred_voice).await {
        Ok(path) => Ok(Some(path)),
        Err(err) => {
            warn!("[VideoGeneration] Échec génération voix premium ({lang}): {err}");
            Ok(None)
        }
    }
}

async fn generate_voiceover_audio(
    session_dir: &Path,
    script: &str,
    lang: &str,
    voice: &str,
) -> AppResult<PathBuf> {
    if script.trim().is_empty() {
        return Err(AppError::BadRequest("Script voix off vide.".to_string()));
    }

    let word_count = script.split_whitespace().count().max(1) as f32;
    let duration = (word_count / 2.6).clamp(3.0, 90.0);

    let filename = format!("voiceover_{}_{}.mp3", lang, Uuid::new_v4());
    run_ffmpeg(
        session_dir,
        vec![
            "-y".to_string(),
            "-f".to_string(),
            "lavfi".to_string(),
            "-i".to_string(),
            "anullsrc=r=44100:cl=mono".to_string(),
            "-t".to_string(),
            format!("{:.2}", duration),
            "-c:a".to_string(),
            "libmp3lame".to_string(),
            "-q:a".to_string(),
            "5".to_string(),
            filename.clone(),
        ],
    )
    .await?;

    let audio_path = session_dir.join(&filename);
    let transcript_name = format!("voiceover_{}.txt", Uuid::new_v4());
    let transcript_content = format!("lang={lang}\nvoice={voice}\n\n{script}");
    fs::write(
        session_dir.join(transcript_name),
        transcript_content.as_bytes(),
    )
    .await
    .map_err(|err| AppError::Internal(format!("Impossible d'écrire le script voix off: {err}")))?;

    Ok(audio_path)
}

async fn generate_additional_variant(
    _session_dir: &Path,
    _source_path: &Path,
    _service_id: i32,
    _product_index: i32,
    _state: &Arc<AppState>,
    format_label: &str,
    _target_width: u32,
    _target_height: u32,
    _original_relative_path: &str,
) -> AppResult<Option<AlternativeVideoFormat>> {
    warn!(
        "[VideoGeneration] Variante vidéo '{}' non générée faute d'implémentation dédiée.",
        format_label
    );
    Ok(None)
}

fn extract_string(value: &Value, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(v) = value.get(key) {
            match v {
                Value::String(s) => {
                    if !s.is_empty() {
                        return Some(s.clone());
                    }
                }
                Value::Number(n) => return Some(n.to_string()),
                Value::Bool(b) => return Some(b.to_string()),
                _ => continue,
            }
        }
    }
    None
}

fn extract_price_label(value: &Value) -> Option<String> {
    let price = extract_string(value, &["prix", "price"])?;
    let currency =
        extract_string(value, &["devise", "currency"]).unwrap_or_else(|| "XAF".to_string());
    Some(format!("{} {}", price, currency))
}

fn locate_font_file() -> Option<PathBuf> {
    let candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "C:\\Windows\\Fonts\\arialbd.ttf",
        "C:\\Windows\\Fonts\\Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ];

    for candidate in candidates {
        let path = Path::new(candidate);
        if path.exists() {
            return Some(path.to_path_buf());
        }
    }

    None
}

fn sanitize_drawtext_text(text: &str) -> String {
    text.replace('\\', "\\\\")
        .replace(':', "\\:")
        .replace('\'', "\\'")
        .replace('\n', "\\n")
}

fn derive_product_identifier(product: &Value, service_id: i32, product_index: i32) -> String {
    extract_string(product, &["product_id", "lifecycle_id", "id"])
        .unwrap_or_else(|| format!("{}_{}", service_id, product_index))
}

fn generate_storyboard_lines(
    product: &Value,
    product_name: &str,
    price_label: Option<String>,
    promotion_label: Option<String>,
) -> Vec<String> {
    let mut lines: Vec<String> = Vec::new();

    if let Some(category) = extract_string(product, &["type", "category"]) {
        lines.push(format!(
            "{} premium disponible aujourd'hui",
            category.to_lowercase()
        ));
    }

    if let Some(description) = extract_string(product, &["description"]) {
        lines.push(description);
    }

    if let Some(features) = product.get("caracteristiques").and_then(Value::as_array) {
        for entry in features.iter().take(2) {
            if let Some(text) = entry.as_str() {
                lines.push(text.to_string());
            }
        }
    }

    if let Some(price) = price_label {
        lines.push(format!("Disponible dès {}", price));
    }

    if let Some(promo) = promotion_label {
        lines.push(format!("Promotion spéciale : {}", promo));
    }

    if lines.is_empty() {
        lines.push(format!("Découvrez {}", product_name));
    }

    lines
        .into_iter()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .collect()
}

async fn generate_background_music(
    session_dir: &Path,
    duration_seconds: u32,
    mode: &str,
) -> AppResult<PathBuf> {
    let track_path = session_dir.join("bg_music.mp3");
    let duration_arg = duration_seconds.to_string();

    let waveform = match mode {
        "lofi" => "sine=frequency=220:beep_factor=2",
        "ambient" => "sine=frequency=180,asetrate=44100*0.5",
        "cinematic" => "sine=frequency=120:samples_per_frame=4",
        _ => "sine=frequency=320:samples_per_frame=4",
    };

    let filter_complex = format!(
        "[0:a]asetrate=44100*0.8,atempo=1.25,aresample=44100,afade=t=in:st=0:d=3,afade=t=out:st={fade_start}:d=4,volume=0.35[aout]",
        fade_start = (duration_seconds.saturating_sub(5)) as f32
    );

    let output = Command::new("ffmpeg")
        .current_dir(session_dir)
        .args([
            "-y",
            "-f",
            "lavfi",
            "-i",
            waveform,
            "-t",
            &duration_arg,
            "-filter_complex",
            &filter_complex,
            "-map",
            "[aout]",
            "-c:a",
            "aac",
            "-b:a",
            "160k",
            track_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .as_ref(),
        ])
        .output()
        .await
        .map_err(|err| {
            error!("[VideoGeneration] Impossible de générer la musique: {err:?}");
            AppError::Internal("FFmpeg est requis pour générer la musique d'ambiance.".to_string())
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        error!("[VideoGeneration] Génération musique échouée: {}", stderr);
        return Err(AppError::Internal(
            "Génération de la musique impossible.".to_string(),
        ));
    }

    Ok(track_path)
}

async fn select_curated_audio_track(
    session_dir: &Path,
    mode: Option<&str>,
    hint: Option<&str>,
) -> AppResult<Option<PathBuf>> {
    if mode
        .map(|value| value.eq_ignore_ascii_case("none"))
        .unwrap_or(false)
    {
        return Ok(None);
    }

    let loops = audio_library_service::list_curated_audio_loops();
    let candidate = match curated_loop_identifier(mode, hint) {
        Some(identifier) => loops.iter().find(|loop_item| loop_item.id == identifier),
        None => None,
    }
    .or_else(|| {
        // Fallback: essayer de matcher sur le genre/mood côté hint
        hint.and_then(|raw| {
            let lowered = raw.to_lowercase();
            loops.iter().find(|loop_item| {
                lowered.contains(&loop_item.genre.to_lowercase())
                    || lowered.contains(&loop_item.mood.to_lowercase())
            })
        })
    });

    if let Some(loop_info) = candidate {
        match download_curated_audio(session_dir, loop_info).await {
            Ok(path) => {
                info!(
                    "[VideoGeneration] Boucle audio '{}' utilisée pour la vidéo ({})",
                    loop_info.title, loop_info.id
                );
                Ok(Some(path))
            }
            Err(err) => {
                warn!(
                    "[VideoGeneration] Impossible d'utiliser la boucle {}: {err}",
                    loop_info.id
                );
                Ok(None)
            }
        }
    } else {
        Ok(None)
    }
}

async fn download_curated_audio(
    session_dir: &Path,
    loop_info: &audio_library_service::CuratedAudioLoop,
) -> AppResult<PathBuf> {
    let response = reqwest::get(loop_info.url)
        .await
        .map_err(|err| AppError::Internal(format!("Téléchargement audio IA impossible: {err}")))?;

    if !response.status().is_success() {
        return Err(AppError::Internal(format!(
            "Téléchargement audio IA statut: {}",
            response.status()
        )));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|err| AppError::Internal(format!("Lecture audio IA impossible: {err}")))?;

    let extension = loop_info
        .url
        .rsplit('.')
        .next()
        .unwrap_or("mp3")
        .to_lowercase();
    let filename = format!(
        "curated_loop_{}_{}.{}",
        loop_info.id,
        Uuid::new_v4(),
        extension
    );
    let path = session_dir.join(filename);

    fs::write(&path, &bytes).await.map_err(|err| {
        AppError::Internal(format!(
            "Impossible d'écrire la boucle audio IA ({:?}): {err}",
            path
        ))
    })?;

    Ok(path)
}

fn curated_loop_identifier(mode: Option<&str>, hint: Option<&str>) -> Option<String> {
    if let Some(raw_mode) = mode {
        let normalized = raw_mode.trim().to_lowercase();
        let direct = match normalized.as_str() {
            "pulse" | "marketing" | "tiktok" | "energetic" | "energy" => Some("pulse_groove"),
            "lofi" | "relax" | "chill" | "calm" => Some("lofi_sunset"),
            "ambient" | "focus" | "aerien" | "aérien" => Some("ambient_wave"),
            "epic" | "cinematic" | "heroic" => Some("cinematic_rise"),
            _ => None,
        };

        if let Some(id) = direct {
            return Some(id.to_string());
        }
    }

    if let Some(raw_hint) = hint {
        let lowered = raw_hint.to_lowercase();
        if lowered.contains("lofi")
            || lowered.contains("relax")
            || lowered.contains("chill")
            || lowered.contains("calme")
        {
            return Some("lofi_sunset".to_string());
        }
        if lowered.contains("ambient") || lowered.contains("focus") || lowered.contains("air") {
            return Some("ambient_wave".to_string());
        }
        if lowered.contains("cinematic") || lowered.contains("épique") || lowered.contains("epic")
        {
            return Some("cinematic_rise".to_string());
        }
        if lowered.contains("pulse")
            || lowered.contains("groove")
            || lowered.contains("tiktok")
            || lowered.contains("energy")
        {
            return Some("pulse_groove".to_string());
        }
    }

    None
}
