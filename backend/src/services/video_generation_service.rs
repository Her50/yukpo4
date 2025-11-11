use std::{
    collections::HashSet,
    path::{Path, PathBuf},
    sync::Arc,
};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::Utc;
use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::{fs, process::Command};
use uuid::Uuid;

use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::AuthenticatedUser,
    services::{
        app_ia::VideoBriefRequest,
        audio_library_service,
        audio_pipeline::{self, AudioMixConfig},
        broll_service,
        cost_service::CostEstimation,
        immersive_orchestrator::{
            ImmersiveOrchestrator, TimelineAnalytics, TimelineBrollAsset, TimelineRequest,
        },
        immersive_timeline::ImmersiveTimeline,
        video_analytics_service::{record_engagement, schedule_distribution_targets},
        video_job_service::try_store_progress,
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
    kind: String,
    ai_description: Option<String>,
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

pub async fn generate_product_video(
    state: Arc<AppState>,
    user: &AuthenticatedUser,
    service_id: i32,
    product_index: i32,
    payload: VideoGenerationPayload,
    job_id: Option<Uuid>,
) -> AppResult<VideoGenerationResult> {
    let svc = sqlx::query!(
        "SELECT user_id, data FROM services WHERE id = $1",
        service_id
    )
    .fetch_optional(&state.pg)
    .await
    .map_err(|err| {
        error!("[VideoGeneration] Erreur récupération service {service_id}: {err:?}");
        AppError::from(err)
    })?
    .ok_or_else(|| AppError::NotFound("Service introuvable pour ce prestataire.".to_string()))?;

    if svc.user_id != Some(user.id) {
        warn!(
            "[VideoGeneration] Tentative non autorisée - user_id={}, owner={:?}",
            user.id, svc.user_id
        );
        return Err(AppError::Unauthorized(
            "Vous ne pouvez générer des vidéos que pour vos propres services.".to_string(),
        ));
    }

    let mut service_data: Value = svc
        .data
        .ok_or_else(|| AppError::Internal("Service sans données associées.".to_string()))?;

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

    let mut media_sources = gather_media_sources(
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
                    generate_subtitles_file(&session_dir, &script_outline, duration_seconds)
                        .ok()
                        .flatten()
                } else {
                    Some(path)
                }
            }
            Ok(None) => generate_subtitles_file(&session_dir, &script_outline, duration_seconds)
                .ok()
                .flatten(),
            Err(err) => {
                warn!("[VideoGeneration] Sous-titres IA indisponibles: {err}");
                generate_subtitles_file(&session_dir, &script_outline, duration_seconds)
                    .ok()
                    .flatten()
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

    let orchestrator = ImmersiveOrchestrator::new(state.clone());
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
    let used_media_ids: Vec<i32> = media_sources
        .iter()
        .filter_map(|source| source.id)
        .collect();

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
                    Ok(None) | Err(err) => {
                        if let Err(e) = &err {
                            warn!("[VideoGeneration] Voix IA indisponible: {e}");
                        }
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
            .master_audio(&mixed_audio_path, &mastering_dir)
            .await
        {
            Ok(result) => {
                info!(
                    "[VideoGeneration] Mastering premium appliqué via {}",
                    result.provider
                );
                Some(result.mastered_path)
            }
            Err(err) => {
                warn!("[VideoGeneration] Mastering premium indisponible, fallback local: {err}");
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

    let final_filename = format!("product_video_{}.mp4", session_id);
    let relative_path = PathBuf::from("uploads")
        .join("services")
        .join(&final_filename);
    let absolute_output_path = storage_root.join("services").join(&final_filename);

    let subtitle_public_url = if let Some(sub_file) = subtitle_file.as_ref() {
        let subtitle_name = format!("subtitles_{}.srt", session_id);
        let subtitle_relative = PathBuf::from("uploads")
            .join("services")
            .join(&subtitle_name);
        let subtitle_absolute = storage_root.join("services").join(&subtitle_name);

        if let Some(parent) = subtitle_absolute.parent() {
            fs::create_dir_all(parent).await.ok();
        }

        if let Err(err) = fs::rename(sub_file, &subtitle_absolute).await {
            warn!(
                "[VideoGeneration] Impossible de déplacer le fichier de sous-titres {:?}: {err}",
                sub_file
            );
            None
        } else {
            let normalized = subtitle_relative.to_string_lossy().replace('\\', "/");
            let upload_base = std::env::var("UPLOAD_BASE_URL")
                .unwrap_or_else(|_| std::env::var("PUBLIC_BASE_URL").unwrap_or_default());
            let public_url = if upload_base.is_empty() {
                normalized.clone()
            } else {
                format!("{}/{}", upload_base.trim_end_matches('/'), normalized)
            };
            Some(public_url)
        }
    } else {
        None
    };

    if let Some(parent) = absolute_output_path.parent() {
        fs::create_dir_all(parent).await.map_err(|err| {
            AppError::Internal(format!(
                "Impossible de créer le dossier de destination de la vidéo: {err}"
            ))
        })?;
    }

    fs::rename(session_dir.join("final.mp4"), &absolute_output_path)
        .await
        .map_err(|err| {
            AppError::Internal(format!(
                "Impossible de déplacer la vidéo générée vers la médiathèque: {err}"
            ))
        })?;

    let final_metadata = fs::metadata(&absolute_output_path).await.map_err(|err| {
        AppError::Internal(format!(
            "Impossible de lire les métadonnées de la vidéo générée: {err}"
        ))
    })?;
    let file_size = final_metadata.len() as i64;

    let normalized_relative = relative_path.to_string_lossy().replace('\\', "/");
    let upload_base = std::env::var("UPLOAD_BASE_URL")
        .unwrap_or_else(|_| std::env::var("PUBLIC_BASE_URL").unwrap_or_default());
    let public_url = if upload_base.is_empty() {
        normalized_relative.clone()
    } else {
        format!(
            "{}/{}",
            upload_base.trim_end_matches('/'),
            normalized_relative
        )
    };

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
    }

    let inserted = sqlx::query!(
        "INSERT INTO media (
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
            uploaded_at
        )
        VALUES ($1, $2, $3, 'video', 'video', $4, $5, $6, $7, $8, $9, NOW())
        RETURNING id",
        service_id,
        derive_product_identifier(&primary_product, service_id, product_index),
        product_index,
        normalized_relative,
        file_size,
        "mp4",
        ai_description,
        &ai_tags,
        sqlx::types::Json(ai_metadata),
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
                "SELECT id, path, type, ai_description
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
                if let Some(source) =
                    row_to_media_source(row.id, &row.path, row.r#type, row.ai_description)
                {
                    seen_ids.insert(source.id.unwrap());
                    collected.push(source);
                }
            }
        }
    }

    if collected.is_empty() && use_product_gallery {
        let rows = sqlx::query!(
            "SELECT id, path, type, ai_description
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
            if let Some(source) =
                row_to_media_source(row.id, &row.path, row.r#type, row.ai_description)
            {
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
            "SELECT id, path, type, ai_description
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
            if let Some(source) =
                row_to_media_source(row.id, &row.path, row.r#type, row.ai_description)
            {
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
            "SELECT id, path, type, ai_description
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
            if let Some(source) =
                row_to_media_source(row.id, &row.path, row.r#type, row.ai_description)
            {
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

fn row_to_media_source(
    id: i32,
    path: &str,
    media_type: Option<String>,
    ai_description: Option<String>,
) -> Option<MediaSource> {
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
        kind: media_type.unwrap_or_else(|| "image".to_string()),
        ai_description,
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
        service_data,
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
    let mut service_row = sqlx::query!("SELECT data FROM services WHERE id = $1", service_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|err| AppError::from(err))?
        .ok_or_else(|| AppError::NotFound("Service introuvable".to_string()))?;

    if let Some(ref mut data_value) = service_row.data {
        if let Some(array) = locate_product_array_mut(data_value) {
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
    }

    sqlx::query!(
        "UPDATE services SET data = $1, updated_at = NOW() WHERE id = $2",
        service_row.data,
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
    if let Some(arr) = data.get_mut("produits").and_then(Value::as_array_mut) {
        return Some(arr);
    }

    if let Some(produits) = data.get_mut("produits") {
        if let Some(arr) = produits.get_mut("valeur").and_then(Value::as_array_mut) {
            return Some(arr);
        }
    }

    if let Some(data_obj) = data.get_mut("data") {
        if let Some(arr) = data_obj.get_mut("produits").and_then(Value::as_array_mut) {
            return Some(arr);
        }
    }

    None
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

fn curated_loop_identifier(mode: Option<&str>, hint: Option<&str>) -> Option<&'static str> {
    if let Some(mode_value) = mode {
        let lowered = mode_value.to_lowercase();
        if lowered.contains("pulse") || lowered.contains("upbeat") {
            return Some("pulse_groove");
        }
        if lowered.contains("lofi") {
            return Some("lofi_sunset");
        }
        if lowered.contains("ambient") {
            return Some("ambient_wave");
        }
        if lowered.contains("cinematic") || lowered.contains("epic") {
            return Some("cinematic_rise");
        }
    }

    if let Some(hint_value) = hint {
        let lowered = hint_value.to_lowercase();
        if lowered.contains("pulse") || lowered.contains("dance") || lowered.contains("afro") {
            return Some("pulse_groove");
        }
        if lowered.contains("lofi") || lowered.contains("chill") || lowered.contains("relax") {
            return Some("lofi_sunset");
        }
        if lowered.contains("ambient") || lowered.contains("atmos") || lowered.contains("calm") {
            return Some("ambient_wave");
        }
        if lowered.contains("cinematic")
            || lowered.contains("epic")
            || lowered.contains("orches")
            || lowered.contains("rise")
        {
            return Some("cinematic_rise");
        }
    }

    None
}

async fn generate_voiceover_audio(
    session_dir: &Path,
    script: &str,
    lang: &str,
    voice: &str,
) -> AppResult<PathBuf> {
    let voice_trimmed = voice.replace('-', "_");
    let output_path = session_dir.join("voiceover.wav");

    let status = Command::new("espeak")
        .current_dir(session_dir)
        .args([
            "-v",
            &voice_trimmed,
            "-s",
            "155",
            "-w",
            output_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .as_ref(),
            script,
        ])
        .status()
        .await
        .map_err(|err| {
            error!("[VideoGeneration] Impossible de lancer espeak: {err:?}");
            AppError::Internal(
                "Synthèse vocale indisponible (commande espeak manquante).".to_string(),
            )
        })?;

    if !status.success() {
        warn!(
            "[VideoGeneration] Synthèse vocale espeak a échoué pour la langue {}",
            lang
        );
        return Err(AppError::Internal(
            "Synthèse vocale indisponible sur ce serveur.".to_string(),
        ));
    }

    Ok(output_path)
}

async fn generate_premium_voiceover(
    session_dir: &Path,
    script: &str,
    lang: &str,
) -> AppResult<Option<PathBuf>> {
    let endpoint = match std::env::var("PREMIUM_TTS_ENDPOINT") {
        Ok(value) if !value.trim().is_empty() => value,
        _ => return Ok(None),
    };
    let api_key = std::env::var("PREMIUM_TTS_API_KEY").ok();
    let voice = std::env::var("PREMIUM_TTS_VOICE").ok();

    let client = reqwest::Client::new();
    let mut request = client.post(&endpoint).json(&json!({
        "text": script,
        "lang": lang,
        "voice": voice,
    }));

    if let Some(key) = api_key {
        request = request.header("Authorization", format!("Bearer {}", key));
    }

    let response = match request.send().await {
        Ok(resp) => resp,
        Err(err) => {
            warn!("[VideoGeneration] Premium TTS indisponible: {err}");
            return Ok(None);
        }
    };

    if !response.status().is_success() {
        warn!(
            "[VideoGeneration] Premium TTS statut inattendu: {}",
            response.status()
        );
        return Ok(None);
    }

    let body: Value = match response.json().await {
        Ok(val) => val,
        Err(err) => {
            warn!("[VideoGeneration] Premium TTS réponse illisible: {err}");
            return Ok(None);
        }
    };

    let audio_b64 = match body.get("audio_base64").and_then(Value::as_str) {
        Some(data) if !data.is_empty() => data,
        _ => {
            warn!("[VideoGeneration] Premium TTS sans audio_base64");
            return Ok(None);
        }
    };

    let format = body
        .get("format")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .unwrap_or("mp3");

    let decoded = match BASE64.decode(audio_b64.trim()) {
        Ok(bytes) => bytes,
        Err(err) => {
            warn!("[VideoGeneration] Premium TTS audio invalide: {err}");
            return Ok(None);
        }
    };

    let filename = format!("voiceover_premium_{}.{}", Uuid::new_v4(), format);
    let output_path = session_dir.join(filename);

    if let Err(err) = fs::write(&output_path, decoded).await {
        warn!(
            "[VideoGeneration] Écriture voix premium impossible ({:?}): {err}",
            output_path
        );
        return Ok(None);
    }

    Ok(Some(output_path))
}

async fn generate_additional_variant(
    session_dir: &Path,
    source_path: &Path,
    service_id: i32,
    product_index: i32,
    state: &Arc<AppState>,
    format: &str,
    width: i32,
    height: i32,
    primary_relative_path: &str,
) -> AppResult<Option<AlternativeVideoFormat>> {
    let output_name = format!("final_{}_{}.mp4", format, Uuid::new_v4());
    let relative_variant = PathBuf::from("uploads").join("services").join(&output_name);
    let storage_root = upload_storage_root();
    let absolute_variant = storage_root.join("services").join(&output_name);

    if let Some(parent) = absolute_variant.parent() {
        fs::create_dir_all(parent).await.map_err(|err| {
            AppError::Internal(format!(
                "Impossible de préparer le dossier variante ({format}): {err}"
            ))
        })?;
    }

    run_ffmpeg(
        session_dir,
        vec![
            "-y".to_string(),
            "-i".to_string(),
            source_path.to_string_lossy().to_string(),
            "-vf".to_string(),
            format!(
                "scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{},(ow-iw)/2:(oh-ih)/2",
                width, height, width, height
            ),
            "-c:v".to_string(),
            "libx264".to_string(),
            "-preset".to_string(),
            "veryfast".to_string(),
            "-c:a".to_string(),
            "aac".to_string(),
            "-b:a".to_string(),
            "192k".to_string(),
            absolute_variant.to_string_lossy().replace('\\', "/"),
        ],
    )
    .await?;

    let metadata = fs::metadata(&absolute_variant).await.map_err(|err| {
        AppError::Internal(format!(
            "Impossible de lire la variante générée ({format}): {err}"
        ))
    })?;

    let normalized = relative_variant.to_string_lossy().replace('\\', "/");
    let upload_base = std::env::var("UPLOAD_BASE_URL")
        .unwrap_or_else(|_| std::env::var("PUBLIC_BASE_URL").unwrap_or_default());
    let variant_url = if upload_base.is_empty() {
        normalized.clone()
    } else {
        format!("{}/{}", upload_base.trim_end_matches('/'), normalized)
    };

    let variant_metadata = json!({
        "format": format,
        "source": primary_relative_path,
    });

    let inserted = sqlx::query!(
        "INSERT INTO media (
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
            uploaded_at
        )
        VALUES ($1, $2, $3, 'video', $4, $5, $6, 'mp4', $7, $8, $9, NOW())
        RETURNING id",
        service_id,
        format!("{}_{}", service_id, product_index),
        product_index,
        format!("video_{}", format),
        normalized,
        metadata.len() as i64,
        format!(
            "Version {} de la vidéo marketing du produit",
            format.to_uppercase()
        ),
        &vec!["video".to_string(), format.to_string()],
        sqlx::types::Json(variant_metadata)
    )
    .fetch_one(&state.pg)
    .await
    .map_err(|err| {
        error!(
            "[VideoGeneration] Erreur insertion variante {}: {err:?}",
            format
        );
        AppError::from(err)
    })?;

    Ok(Some(AlternativeVideoFormat {
        format: format.to_string(),
        path: normalized,
        video_url: variant_url,
        media_id: inserted.id,
    }))
}

async fn resolve_audio_track(
    state: &Arc<AppState>,
    service_id: i32,
    media_id: i32,
) -> AppResult<Option<PathBuf>> {
    let row = sqlx::query!(
        "SELECT path FROM media WHERE id = $1 AND service_id = $2 AND type = 'audio'",
        media_id,
        service_id
    )
    .fetch_optional(&state.pg)
    .await
    .map_err(|err| AppError::from(err))?;

    if let Some(record) = row {
        let absolute = {
            let p = PathBuf::from(record.path.clone());
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

        if absolute.exists() {
            return Ok(Some(absolute));
        }

        warn!(
            "[VideoGeneration] Piste audio {} introuvable sur le disque",
            record.path
        );
    }

    Ok(None)
}

fn generate_subtitles_file(
    session_dir: &Path,
    lines: &[String],
    duration_seconds: u32,
) -> AppResult<Option<PathBuf>> {
    if lines.is_empty() {
        return Ok(None);
    }

    let file_path = session_dir.join("subtitles.srt");

    let total_lines = lines.len();
    let base_interval = (duration_seconds as f32 / total_lines as f32).max(2.5);

    let mut current_start = 0.0f32;
    let mut srt_content = String::new();

    for (idx, line) in lines.iter().enumerate() {
        let start = current_start;
        let end = if idx == total_lines - 1 {
            duration_seconds as f32
        } else {
            (start + base_interval).min(duration_seconds as f32)
        };

        srt_content.push_str(&format!(
            "{}\n{} --> {}\n{}\n\n",
            idx + 1,
            format_timestamp(start),
            format_timestamp(end),
            line
        ));

        current_start = end;
    }

    fs::write(&file_path, srt_content).await.map_err(|err| {
        AppError::Internal(format!(
            "Impossible d'écrire le fichier de sous-titres: {err}"
        ))
    })?;

    Ok(Some(file_path))
}

fn format_timestamp(value: f32) -> String {
    let total_ms = (value * 1000.0) as u64;
    let hours = total_ms / 3_600_000;
    let minutes = (total_ms % 3_600_000) / 60_000;
    let seconds = (total_ms % 60_000) / 1000;
    let millis = total_ms % 1000;

    format!("{:02}:{:02}:{:02},{:03}", hours, minutes, seconds, millis)
}

pub async fn estimate_video_cost(
    state: Arc<AppState>,
    user: &AuthenticatedUser,
    _service_id: i32,
    _product_index: i32,
    payload: VideoGenerationPayload,
) -> AppResult<CostEstimation> {
    let storyboard_len = payload
        .storyboard
        .as_ref()
        .map(|lines| lines.iter().filter(|line| !line.trim().is_empty()).count())
        .unwrap_or_else(|| {
            if payload.auto_storyboard.unwrap_or(false) {
                6
            } else {
                5
            }
        })
        .max(3);

    state
        .cost_service
        .estimate_video_generation_cost_only(user.id, storyboard_len)
        .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    use crate::middlewares::jwt::AuthenticatedUser;
    use crate::test_utils::{backend_test_db_lock, setup_backend_test_context};

    #[tokio::test]
    async fn estimate_video_cost_uses_storyboard_length() {
        let _lock = backend_test_db_lock().await;

        let Some(ctx) = setup_backend_test_context().await else {
            eprintln!("[tests] ⚠️ Contexte de test indisponible, test ignoré.");
            return;
        };

        let storyboard = vec![
            "Intro forte".to_string(),
            "Valeur produit".to_string(),
            "Preuve sociale".to_string(),
            "Appel à l'action".to_string(),
        ];

        let payload = VideoGenerationPayload {
            style: None,
            duration_seconds: None,
            headline: None,
            call_to_action: None,
            include_price: None,
            include_promotion: None,
            include_contact: None,
            selected_media_ids: None,
            related_product_indices: None,
            use_product_gallery: None,
            use_service_mediatech: None,
            include_publicite_assets: None,
            publish_to_chat: None,
            publish_to_product_card: None,
            storyboard: Some(storyboard.clone()),
            music_mode: None,
            music_volume: None,
            voiceover_script: None,
            voiceover_lang: None,
            voiceover_voice: None,
            generate_square_variant: None,
            generate_landscape_variant: None,
            auto_storyboard: Some(false),
            subtitle_mode: None,
            subtitle_lang: None,
            music_track_id: None,
            distribute_channels: None,
            use_ai_templates: Some(false),
            generate_subtitles: None,
            style_effects: None,
            style_transitions: None,
            style_color_palette: None,
            style_overlay_tips: None,
            style_music_hint: None,
        };

        let user = AuthenticatedUser {
            id: ctx.user_id,
            role: "user".to_string(),
        };

        let estimation = estimate_video_cost(ctx.state.clone(), &user, 0, 0, payload)
            .await
            .expect("estimation should succeed");

        // Defaults: 2400 tokens + 220 tokens per storyboard entry
        let expected_tokens = 2400 + (storyboard.len() as i64 * 220);

        assert_eq!(
            estimation.estimated_tokens, expected_tokens,
            "Le nombre de tokens estimé devrait tenir compte des slides storyboard."
        );
        assert!(
            estimation.affordable,
            "L'utilisateur de test dispose d'un solde suffisant"
        );
    }

    async fn ffmpeg_available() -> bool {
        Command::new("ffmpeg")
            .arg("-version")
            .output()
            .await
            .map(|output| output.status.success())
            .unwrap_or(false)
    }

    fn build_temp_dir() -> PathBuf {
        let candidate = std::env::temp_dir().join(format!("video_smoke_{}", Uuid::new_v4()));
        std::fs::create_dir_all(&candidate).expect("Impossible de créer le dossier temporaire");
        candidate
    }

    #[tokio::test]
    async fn crossfade_transitions_produce_combined_video() {
        if !ffmpeg_available().await {
            eprintln!("ffmpeg non disponible - test ignoré");
            return;
        }

        let temp_root = build_temp_dir();
        let slide_files = vec![
            "test_slide_01.mp4".to_string(),
            "test_slide_02.mp4".to_string(),
        ];
        let colors = ["red", "blue"];

        for (name, color) in slide_files.iter().zip(colors.iter()) {
            run_ffmpeg(
                &temp_root,
                vec![
                    "-y".to_string(),
                    "-f".to_string(),
                    "lavfi".to_string(),
                    "-i".to_string(),
                    format!("color=c={color}:s=320x240:d=2"),
                    name.clone(),
                ],
            )
            .await
            .expect("Impossible de créer le segment vidéo");
        }

        let durations = vec![2.0_f32, 2.0_f32];
        apply_crossfade_transitions(&temp_root, &slide_files, &durations, "crossfade")
            .await
            .expect("Concaténation avec crossfade échouée");

        assert!(
            temp_root.join("combined.mp4").exists(),
            "La vidéo combinée n'a pas été générée"
        );

        let _ = std::fs::remove_dir_all(&temp_root);
    }

    #[test]
    fn curated_identifier_prefers_mode() {
        assert_eq!(
            curated_loop_identifier(Some("pulse"), None),
            Some("pulse_groove")
        );
        assert_eq!(
            curated_loop_identifier(Some("LOFI"), None),
            Some("lofi_sunset")
        );
        assert_eq!(
            curated_loop_identifier(Some("cinematic"), None),
            Some("cinematic_rise")
        );
        assert_eq!(
            curated_loop_identifier(Some("ambient"), None),
            Some("ambient_wave")
        );
    }

    #[test]
    fn curated_identifier_uses_hint_when_mode_absent() {
        assert_eq!(
            curated_loop_identifier(None, Some("Ambiance cinéma épique")),
            Some("cinematic_rise")
        );
        assert_eq!(
            curated_loop_identifier(None, Some("Playlist chill lofi")),
            Some("lofi_sunset")
        );
        assert_eq!(
            curated_loop_identifier(None, Some("Ambiance relax et atmos")),
            Some("ambient_wave")
        );
        assert_eq!(
            curated_loop_identifier(None, Some("Afro dance pulse")),
            Some("pulse_groove")
        );
    }

    #[test]
    fn compute_slide_durations_respects_total() {
        let overlays = vec![
            SlideOverlay {
                top_text: Some("Titre accrocheur".to_string()),
                bottom_text: Some("Prix spécial : 5000 XAF".to_string()),
            },
            SlideOverlay {
                top_text: Some("Points forts du produit".to_string()),
                bottom_text: Some("Contactez-nous dès maintenant".to_string()),
            },
            SlideOverlay {
                top_text: Some("Livraison rapide partout".to_string()),
                bottom_text: None,
            },
        ];

        let durations = compute_slide_durations(30, &overlays);
        assert_eq!(durations.len(), overlays.len());
        let total = durations.iter().sum::<f32>();
        assert!(
            (total - 30.0).abs() < 0.5,
            "La somme des durées ({total}) devrait être proche de 30"
        );
        assert!(durations.iter().all(|d| *d > 1.0));
    }
}
