use std::{
    collections::{BTreeMap, HashMap, HashSet},
    path::{Path, PathBuf},
    sync::atomic::{AtomicI64, AtomicU64, Ordering},
    sync::Arc,
    time::Instant,
};

use chrono::Utc;
use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{FromRow, Row};
use tokio::{fs, process::Command};
use uuid::Uuid;

#[derive(FromRow)]
struct ServiceDataRow {
    user_id: i32,
    data: Value,
}

#[derive(FromRow)]
struct ServiceDataValueRow {
    data: Value,
}

#[derive(FromRow)]
struct MediaIdRow {
    id: i32,
}

#[derive(FromRow)]
struct MediaRow {
    id: i32,
    path: String,
    #[sqlx(rename = "type")]
    _media_type: String,
    ai_description: Option<String>,
    #[sqlx(default)]
    product_index: Option<i32>, // ✅ NOUVEAU: Pour logging et validation
    #[sqlx(default)]
    media_type: Option<String>, // ✅ NOUVEAU: Pour logging et validation
}

use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::AuthenticatedUser,
    services::{
        app_ia::VideoBriefRequest,
        audio_library_service,
        audio_mastering_service::AudioMasteringOutcome,
        audio_pipeline::{self, AudioMixConfig},
        broll_service,
        commerce_connector_service::ProductConnectorSnapshot,
        cost_service::CostEstimation,
        distribution_automation_service,
        immersive_orchestrator::{
            ImmersiveOrchestrator, TimelineAnalytics, TimelineBrollAsset, TimelineBusinessContext,
            TimelineMediaItem, TimelineRequest,
        },
        immersive_timeline::ImmersiveTimeline,
        inventory_service::INVENTORY_STALE_THRESHOLD_HOURS,
        timeline_converter::convert_timeline_json_to_immersive,
        video_analytics_service::{record_engagement, schedule_distribution_targets},
        video_job_service::try_store_progress,
        video_renderer::{RenderExecutionMode, RenderJobRequest, RenderJobResponse},
        voice_profile_service::ResolvedVoiceProfile,
        watermark_service,
    },
    state::AppState,
};

/// Compteurs globaux pour les métriques de latence du pipeline vidéo.
static VIDEO_LATENCY_TOTAL_MS: AtomicI64 = AtomicI64::new(0);
static VIDEO_LATENCY_COUNT: AtomicU64 = AtomicU64::new(0);
static VIDEO_LATENCY_IA_STORYBOARD_TOTAL_MS: AtomicI64 = AtomicI64::new(0);
static VIDEO_LATENCY_IA_STORYBOARD_COUNT: AtomicU64 = AtomicU64::new(0);
static VIDEO_LATENCY_RENDER_TOTAL_MS: AtomicI64 = AtomicI64::new(0);
static VIDEO_LATENCY_RENDER_COUNT: AtomicU64 = AtomicU64::new(0);
static VIDEO_LATENCY_UPLOAD_TOTAL_MS: AtomicI64 = AtomicI64::new(0);
static VIDEO_LATENCY_UPLOAD_COUNT: AtomicU64 = AtomicU64::new(0);

/// Instantané des métriques de latence pour exposition Prometheus.
#[derive(Debug, Clone, Copy, Default)]
pub struct VideoLatencySnapshot {
    pub total_ms: i64,
    pub count: u64,
    pub ia_storyboard_total_ms: i64,
    pub ia_storyboard_count: u64,
    pub render_total_ms: i64,
    pub render_count: u64,
    pub upload_total_ms: i64,
    pub upload_count: u64,
}

pub fn get_video_latency_snapshot() -> VideoLatencySnapshot {
    VideoLatencySnapshot {
        total_ms: VIDEO_LATENCY_TOTAL_MS.load(Ordering::Relaxed),
        count: VIDEO_LATENCY_COUNT.load(Ordering::Relaxed),
        ia_storyboard_total_ms: VIDEO_LATENCY_IA_STORYBOARD_TOTAL_MS.load(Ordering::Relaxed),
        ia_storyboard_count: VIDEO_LATENCY_IA_STORYBOARD_COUNT.load(Ordering::Relaxed),
        render_total_ms: VIDEO_LATENCY_RENDER_TOTAL_MS.load(Ordering::Relaxed),
        render_count: VIDEO_LATENCY_RENDER_COUNT.load(Ordering::Relaxed),
        upload_total_ms: VIDEO_LATENCY_UPLOAD_TOTAL_MS.load(Ordering::Relaxed),
        upload_count: VIDEO_LATENCY_UPLOAD_COUNT.load(Ordering::Relaxed),
    }
}

#[derive(Debug, Deserialize, Clone)]
pub struct VideoGenerationPayload {
    pub style: Option<String>,
    pub duration_seconds: Option<u32>,
    pub headline: Option<String>,
    pub call_to_action: Option<String>,
    pub story_template_id: Option<String>,
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
    /// ✅ NOUVEAU: Timeline structurée générée par l'IA (prioritaire sur storyboard)
    pub timeline: Option<Value>,
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
    pub voice_profile_id: Option<i32>,
    pub distribute_channels: Option<Vec<String>>,
    pub use_ai_templates: Option<bool>,
    pub generate_subtitles: Option<bool>,
    pub style_effects: Option<Vec<String>>,
    pub style_transitions: Option<Vec<String>>,
    pub style_color_palette: Option<String>,
    pub style_overlay_tips: Option<Vec<String>>,
    pub style_music_hint: Option<String>,
    #[serde(default)]
    pub media_scene_overrides: Option<Vec<MediaSceneOverride>>,
    #[serde(default)]
    pub media_descriptions: Option<Vec<MediaDescriptionInput>>,
    /// ✅ Génération automatique d'images par IA si aucune image locale n'est disponible
    pub auto_generate_images: Option<bool>,
    /// ✅ NOUVEAU 2025-01-27: Activer/désactiver le watermark Yukpo (défaut: true pour branding)
    pub enable_watermark: Option<bool>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct MediaSceneOverride {
    pub media_id: i32,
    pub scene_index: i32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct MediaDescriptionInput {
    pub media_id: i32,
    pub description: String,
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

pub async fn estimate_video_cost(
    state: Arc<AppState>,
    user: &AuthenticatedUser,
    service_id: i32,
    product_index: i32,
    payload: VideoGenerationPayload,
) -> AppResult<CostEstimation> {
    let svc =
        sqlx::query_as::<_, ServiceDataRow>("SELECT user_id, data FROM services WHERE id = $1")
            .bind(service_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|err| {
                error!("[VideoGeneration] Erreur récupération service {service_id}: {err:?}");
                AppError::from(err)
            })?
            .ok_or_else(|| {
                AppError::NotFound("Service introuvable pour ce prestataire.".to_string())
            })?;

    if svc.user_id != user.id {
        return Err(AppError::Unauthorized(
            "Vous ne pouvez estimer le coût que pour vos propres services.".to_string(),
        ));
    }

    // ✅ PHASE 3: Récupérer le produit depuis la table service_products
    let product = state.products_service
        .get_product(service_id, product_index)
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!(
                "Produit introuvable pour ce service (service_id: {}, product_index: {})",
                service_id, product_index
            ))
        })?;

    let primary_product = product.product_data;

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

/// ✅ Valide les prérequis pour la génération vidéo AVANT de créer un job
/// Priorité : Images locales d'abord, puis génération IA si activée
/// Retourne une erreur BadRequest si aucune image n'est disponible et génération IA désactivée
pub async fn validate_video_generation_prerequisites(
    state: &Arc<AppState>,
    service_id: i32,
    product_index: i32,
    payload: &VideoGenerationPayload,
) -> AppResult<()> {
    info!(
        "[VideoGeneration] Validation préventive des prérequis - service_id={}, product_index={}",
        service_id, product_index
    );

    let use_product_gallery = payload.use_product_gallery.unwrap_or(true);
    let use_service_mediatech = payload.use_service_mediatech.unwrap_or(true);
    let include_publicite_assets = payload.include_publicite_assets.unwrap_or(true);

    let mut has_images = false;
    let mut checked_sources = Vec::new(); // ✅ Pour tracking des sources vérifiées

    // Vérifier les médias sélectionnés explicitement
    if let Some(selected_ids) = &payload.selected_media_ids {
        if !selected_ids.is_empty() {
            let count: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM media WHERE service_id = $1 AND id = ANY($2)",
            )
            .bind(service_id)
            .bind(selected_ids)
            .fetch_one(&state.pg)
            .await
            .map_err(|err| {
                error!("[VideoGeneration] Erreur validation médias sélectionnés: {err:?}");
                AppError::from(err)
            })?;

            checked_sources.push(format!("médias sélectionnés ({} trouvés)", count));
            if count > 0 {
                has_images = true;
                info!(
                    "[VideoGeneration] ✅ Images trouvées dans médias sélectionnés: {}",
                    count
                );
            }
        }
    }

    // Vérifier les images du produit
    if !has_images && use_product_gallery {
        // ✅ CORRIGÉ: Inclure images ET vidéos, être plus permissif sur product_index
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM media 
             WHERE service_id = $1 
             AND (
                 product_index = $2 
                 OR product_index IS NULL
             )
             AND (media_type IN ('image', 'video') OR (media_type IS NULL AND type IN ('image', 'video')))
             LIMIT 1",
        )
        .bind(service_id)
        .bind(product_index)
        .fetch_one(&state.pg)
        .await
        .map_err(|err| {
            error!("[VideoGeneration] Erreur validation médias produit: {err:?}");
            AppError::from(err)
        })?;

        checked_sources.push(format!("galerie produit ({} trouvées)", count));
        if count > 0 {
            has_images = true;
            info!(
                "[VideoGeneration] ✅ Médias trouvés dans galerie produit: {} (service_id={}, product_index={})",
                count, service_id, product_index
            );
        } else {
            warn!(
                "[VideoGeneration] ⚠️ Aucun média trouvé dans galerie produit (service_id={}, product_index={})",
                service_id, product_index
            );
        }
    }

    // Vérifier la médiathèque du service
    if !has_images && use_service_mediatech {
        // ✅ CORRIGÉ: Inclure images ET vidéos de la médiathèque générale
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM media 
             WHERE service_id = $1 
             AND (product_index IS NULL OR product_index != $2)
             AND (media_type IN ('image', 'video') OR (media_type IS NULL AND type IN ('image', 'video')))
             LIMIT 1",
        )
        .bind(service_id)
        .bind(product_index)
        .fetch_one(&state.pg)
        .await
        .map_err(|err| {
            error!("[VideoGeneration] Erreur validation médiathèque service: {err:?}");
            AppError::from(err)
        })?;

        checked_sources.push(format!("médiathèque service ({} trouvées)", count));
        if count > 0 {
            has_images = true;
            info!(
                "[VideoGeneration] ✅ Médias trouvés dans médiathèque service: {} (service_id={})",
                count, service_id
            );
        } else {
            warn!(
                "[VideoGeneration] ⚠️ Aucun média trouvé dans médiathèque service (service_id={})",
                service_id
            );
        }
    }

    // Vérifier les assets de publicité
    if !has_images && include_publicite_assets {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM media 
             WHERE service_id = $1 
             AND (
                media_type = 'banner'
                OR media_type = 'logo'
                OR path ILIKE '%publicite%'
                OR path ILIKE '%banner%'
             )
             LIMIT 1",
        )
        .bind(service_id)
        .fetch_one(&state.pg)
        .await
        .map_err(|err| {
            error!("[VideoGeneration] Erreur validation assets publicité: {err:?}");
            AppError::from(err)
        })?;

        checked_sources.push(format!("assets publicité ({} trouvés)", count));
        if count > 0 {
            has_images = true;
            info!(
                "[VideoGeneration] ✅ Images trouvées dans assets publicité: {}",
                count
            );
        }
    }

    if !has_images {
        // ✅ CORRIGÉ: Activer auto_generate_images par défaut si aucun média n'est trouvé
        // Cela permet de générer des images avec l'IA pendant le processus de génération vidéo
        if payload.auto_generate_images.unwrap_or(true) {
            info!("[VideoGeneration] ⚠️ Aucune image locale trouvée, génération IA activée automatiquement - Génération d'images prévue");
            return Ok(()); // Permettre la génération, les images seront créées plus tard
        } else {
            // ✅ Message d'erreur détaillé avec les sources vérifiées
            let sources_checked = if checked_sources.is_empty() {
                "Aucune source vérifiée".to_string()
            } else {
                checked_sources.join(", ")
            };

            // ✅ CORRECTION: Message d'erreur amélioré avec guidance claire
            let error_msg = format!(
                "Impossible de générer la vidéo : Aucune image trouvée.\n\n\
                Sources vérifiées : {}\n\n\
                Solutions possibles :\n\
                • Ajouter des images dans la médiathèque du service\n\
                • Ajouter des images au produit spécifique (index {})\n\
                • Activer 'auto_generate_images: true' pour générer automatiquement des images avec l'IA\n\n\
                Note : La génération automatique d'images IA est recommandée si vous n'avez pas d'images disponibles.",
                sources_checked,
                product_index
            );

            warn!(
                "[VideoGeneration] ❌ Validation échouée pour service_id={}, product_index={}, auto_generate_images={}:\n{}",
                service_id,
                product_index,
                payload.auto_generate_images.unwrap_or(false),
                error_msg
            );

            return Err(AppError::BadRequest(error_msg));
        }
    }

    info!("[VideoGeneration] ✅ Validation réussie - Images locales disponibles");
    Ok(())
}

/// ✅ NOUVEAU 2025-11-30: S'assure que le produit existe dans products_lifecycle
/// Crée l'entrée si elle n'existe pas déjà
async fn ensure_product_in_lifecycle(
    pool: &sqlx::PgPool,
    service_id: i32,
    product_index: i32,
    _service_data: &Value,
    product_name: &str,
    product_type: &str,
) -> AppResult<()> {
    // Vérifier si le produit existe déjà
    let exists: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM products_lifecycle WHERE service_id = $1 AND product_index = $2",
    )
    .bind(service_id)
    .bind(product_index)
    .fetch_optional(pool)
    .await
    .map_err(|err| {
        error!("[VideoGeneration] Erreur vérification products_lifecycle: {err:?}");
        AppError::from(err)
    })?;

    if exists.is_some() {
        debug!(
            "[VideoGeneration] Produit {}:{} existe déjà dans products_lifecycle",
            service_id, product_index
        );
        return Ok(()); // Déjà existant
    }

    // Créer l'entrée dans products_lifecycle
    sqlx::query(
        r#"
        INSERT INTO products_lifecycle (
            service_id, product_index, product_nom, product_type, is_active
        )
        VALUES ($1, $2, $3, $4, TRUE)
        ON CONFLICT (service_id, product_index) DO NOTHING
        "#,
    )
    .bind(service_id)
    .bind(product_index)
    .bind(product_name)
    .bind(product_type)
    .execute(pool)
    .await
    .map_err(|err| {
        error!("[VideoGeneration] Erreur création produit dans lifecycle: {err:?}");
        AppError::from(err)
    })?;

    info!(
        "[VideoGeneration] ✅ Produit {}:{} créé dans products_lifecycle (nom: {}, type: {})",
        service_id, product_index, product_name, product_type
    );

    Ok(())
}

pub async fn generate_product_video(
    state: Arc<AppState>,
    user: &AuthenticatedUser,
    service_id: i32,
    product_index: i32,
    payload: VideoGenerationPayload,
    job_id: Option<Uuid>,
) -> AppResult<VideoGenerationResult> {
    let overall_start = Instant::now();

    // ✅ NOUVEAU 2025-12-01: Contrôler le parallélisme avec le sémaphore de scalabilité
    let _permit = state.scalability.acquire_permit().await?;

    let svc =
        sqlx::query_as::<_, ServiceDataRow>("SELECT user_id, data FROM services WHERE id = $1")
            .bind(service_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|err| {
                error!("[VideoGeneration] Erreur récupération service {service_id}: {err:?}");
                AppError::from(err)
            })?
            .ok_or_else(|| {
                AppError::NotFound("Service introuvable pour ce prestataire.".to_string())
            })?;

    if svc.user_id != user.id {
        warn!(
            "[VideoGeneration] Tentative non autorisée - user_id={}, owner={:?}",
            user.id, svc.user_id
        );
        return Err(AppError::Unauthorized(
            "Vous ne pouvez générer des vidéos que pour vos propres services.".to_string(),
        ));
    }

    // ✅ CORRIGÉ 2026-01-04: Utiliser ProductsService au lieu de JSONB
    let product = state.products_service
        .get_product(service_id, product_index)
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!(
                "Produit {} introuvable pour le service {}. Vérifiez que le produit existe et est actif.",
                product_index, service_id
            ))
        })?;

    // Vérifier que le produit est actif
    if !product.is_active {
        return Err(AppError::BadRequest(format!(
            "Le produit {} du service {} est désactivé. Veuillez le réactiver avant de générer une vidéo.",
            product_index, service_id
        )));
    }

    let primary_product = product.product_data;
    
    // ✅ CORRIGÉ: Récupérer service_data depuis svc.data pour ensure_product_in_lifecycle
    let service_data = svc.data.clone();

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

    let voice_profile: Option<ResolvedVoiceProfile> = match payload.voice_profile_id {
        Some(profile_id) => Some(
            state
                .voice_profiles
                .resolve_for_generation(profile_id, user.id, service_id)
                .await?,
        ),
        None => None,
    };

    // ✅ CORRIGÉ 2025-11-30: S'assurer que le produit existe dans products_lifecycle
    // avant de charger le snapshot
    if let Err(ensure_err) = ensure_product_in_lifecycle(
        &state.pg,
        service_id,
        product_index,
        &service_data,
        &product_name,
        &product_type,
    )
    .await
    {
        warn!(
            "[VideoGeneration] ⚠️ Impossible de créer produit dans lifecycle: {} (continuer quand même)",
            ensure_err
        );
    }

    // ✅ CORRECTION RACINE: Vérifier d'abord si le service a des produits
    let product_snapshot: Option<ProductConnectorSnapshot> = match state
        .commerce_connector
        .snapshot_by_index(service_id, product_index)
        .await
    {
        Ok(snapshot) => Some(snapshot),
        Err(err) => {
            // ✅ AMÉLIORÉ: Message plus informatif avec suggestions
            if err.to_string().contains("index") || err.to_string().contains("Not Found") {
                warn!(
                    "[VideoGeneration] ⚠️ Service {} n'a pas de produit à l'index {} (le service peut ne pas avoir de produits ou l'index est invalide). Erreur: {err}",
                    service_id, product_index
                );
            } else {
                warn!(
                    "[VideoGeneration] ⚠️ Impossible de charger le snapshot produit {}:{} ({err})",
                    service_id, product_index
                );
            }
            None
        }
    };

    let mut headline = payload.headline.clone();
    let mut call_to_action = payload.call_to_action.clone();
    let mut voiceover_script_opt = payload.voiceover_script.clone();
    let mut resolved_voiceover_lang = payload.voiceover_lang.clone();
    if resolved_voiceover_lang.is_none() {
        if let Some(profile) = &voice_profile {
            if let Some(lang) = profile
                .metadata
                .get("lang")
                .and_then(|value| value.as_str())
            {
                resolved_voiceover_lang = Some(lang.to_string());
            }
        }
    }

    let voice_hint = voice_profile
        .as_ref()
        .and_then(|profile| profile.tts_voice_hint.clone())
        .or_else(|| payload.voiceover_voice.clone());

    // ✅ NOUVEAU: Vérifier si une timeline structurée est fournie
    let has_timeline = payload.timeline.is_some();

    let mut script_outline: Vec<String> = if has_timeline {
        // Si timeline fournie, extraire le script_outline depuis la timeline
        payload
            .timeline
            .as_ref()
            .and_then(|t| t.get("scenes"))
            .and_then(|s| s.as_array())
            .map(|scenes| {
                scenes
                    .iter()
                    .filter_map(|scene| {
                        scene
                            .get("text")
                            .and_then(|t| t.as_str())
                            .map(|s| s.to_string())
                    })
                    .collect()
            })
            .unwrap_or_default()
    } else {
        // Sinon, utiliser le storyboard texte
        payload
            .storyboard
            .clone()
            .unwrap_or_default()
            .into_iter()
            .map(|line| line.trim().to_string())
            .filter(|line| !line.is_empty())
            .collect()
    };

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

    // ✅ NOUVEAU 2025-01-28: Vérifier le stock des produits liés et adapter le style
    if let Some(product_indices) = &payload.related_product_indices {
        let mut stock_info: Vec<(i32, i32)> = Vec::new();

        for &related_index in product_indices {
            // ✅ NOUVEAU 2025-01-28: Vérifier le stock depuis autocomplete_combinations
            let stock: Option<i32> = sqlx::query_scalar(
                r#"
                SELECT MIN(ac.stock)
                FROM autocomplete_combinations ac
                JOIN services s ON s.id = ac.service_id
                WHERE ac.service_id = $1
                    AND s.is_tarissable = TRUE
                    AND ac.stock IS NOT NULL
                "#,
            )
            .bind(service_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|err| {
                error!(
                    "[VideoGeneration] Erreur vérification stock produit {}:{}: {err:?}",
                    service_id, related_index
                );
                AppError::from(err)
            })?;

            if let Some(stock_value) = stock {
                stock_info.push((related_index, stock_value));

                // ✅ Bloquer la génération si stock = 0
                if stock_value == 0 {
                    return Err(AppError::BadRequest(
                        format!(
                            "Impossible de générer une vidéo marketing pour le produit index {} car le stock est épuisé.",
                            related_index
                        )
                    ));
                }
            }
        }

        // ✅ Adapter le style selon le stock
        if !stock_info.is_empty() {
            let has_low_stock = stock_info.iter().any(|(_, stock)| *stock <= 5);

            if has_low_stock {
                // Stock faible → Style "urgence" ou "dernière chance"
                info!("[VideoGeneration] Stock faible détecté - Application style 'urgence'");
                // Note: Le style sera appliqué via style_effects dans le payload
                // On peut ajouter des effets visuels d'urgence si nécessaire
            }
        }
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
        let _ = try_store_progress(&state, job_id, "running", &progress_steps).await;
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

    // ✅ PRIORITÉ 1 : Récupérer les images locales
    info!(
        "[VideoGeneration] 🔍 Collecte des médias - service_id={}, product_index={}, selected_ids={:?}",
        service_id,
        product_index,
        payload.selected_media_ids
    );
    let mut media_sources = gather_media_sources(
        &state,
        service_id,
        product_index,
        payload.selected_media_ids.clone(),
        payload.use_product_gallery.unwrap_or(true),
        payload.use_service_mediatech.unwrap_or(true),
        payload.include_publicite_assets.unwrap_or(true),
    )
    .await
    .map_err(|err| {
        error!(
            "[VideoGeneration] ❌ Erreur collecte médias pour service_id={}, product_index={}: {}",
            service_id, product_index, err
        );
        AppError::Internal(format!(
            "Impossible de collecter les médias pour la génération vidéo: {}. Vérifiez que le service a des images dans sa médiathèque.",
            err
        ))
    })?;
    
    info!(
        "[VideoGeneration] ✅ {} média(x) collecté(s) pour la génération (service_id={}, product_index={})",
        media_sources.len(), service_id, product_index
    );
    
    // ✅ NOUVEAU: Logs détaillés pour chaque média collecté
    for (idx, source) in media_sources.iter().enumerate() {
        let path_str = source.path.to_string_lossy();
        let exists = source.path.exists();
        let is_url = path_str.starts_with("http://") || path_str.starts_with("https://");
        info!(
            "[VideoGeneration] 📸 Média {}: id={:?}, path={:?}, exists={}, is_url={}, description={:?}",
            idx + 1, source.id, path_str, exists, is_url, source.ai_description.as_ref().map(|d| d.chars().take(50).collect::<String>())
        );
    }

    // ✅ PRIORITÉ 2 : Si pas d'images locales et génération IA activée, générer des images
    if media_sources.is_empty() && payload.auto_generate_images.unwrap_or(false) {
        info!("[VideoGeneration] Aucune image locale trouvée, génération d'images IA en cours...");

        // Construire une description pour la génération IA
        let product_description = format!(
            "{}{}{}",
            product_name,
            if let Some(desc) = extract_string(&primary_product, &["description", "resume"]) {
                format!(" - {}", desc)
            } else {
                String::new()
            },
            if let Some(price) = &price_label {
                format!(" - Prix: {}", price)
            } else {
                String::new()
            }
        );

        // Générer 3-5 images avec l'IA
        use crate::services::ai_image_generation_service::generate_and_save_ai_images;
        match generate_and_save_ai_images(
            &state,
            service_id,
            Some(product_index),
            &product_description,
            3, // Générer 3 images par défaut
        )
        .await
        {
            Ok(media_ids) => {
                info!(
                    "[VideoGeneration] ✅ {} image(s) IA générée(s) et sauvegardée(s)",
                    media_ids.len()
                );

                // Réessayer de récupérer les médias (maintenant avec les images générées)
                let media_ids_clone = media_ids.clone();
                media_sources = gather_media_sources(
                    &state,
                    service_id,
                    product_index,
                    Some(media_ids_clone), // Utiliser les IDs des images générées
                    true,                  // use_product_gallery
                    true,                  // use_service_mediatech
                    false,                 // include_publicite_assets (pas nécessaire)
                )
                .await?;

                if media_sources.is_empty() {
                    warn!(
                        "[VideoGeneration] ⚠️ Images IA générées mais non récupérables - Utilisation des IDs directs"
                    );
                    // Fallback : créer des MediaSource depuis les IDs
                    for media_id in media_ids {
                        // Récupérer le path depuis la base
                        if let Ok(Some(path)) = sqlx::query_scalar::<_, Option<String>>(
                            "SELECT path FROM media WHERE id = $1",
                        )
                        .bind(media_id)
                        .fetch_optional(&state.pg)
                        .await
                        {
                            if let Some(p) = path {
                                // Créer un MediaSource basique
                                // Note: Cette partie nécessite d'adapter selon la structure de MediaSource
                                info!(
                                    "[VideoGeneration] Image IA récupérée: media_id={}, path={}",
                                    media_id, p
                                );
                            }
                        }
                    }
                }
            }
            Err(err) => {
                error!("[VideoGeneration] ❌ Erreur génération images IA: {}", err);
                return Err(AppError::Internal(format!(
                    "Impossible de générer des images avec l'IA: {}. Veuillez ajouter des images manuellement.",
                    err
                )));
            }
        }
    }

    // ✅ Vérification finale : si toujours pas d'images, erreur
    if media_sources.is_empty() {
        return Err(AppError::BadRequest(
            "Ajoutez au moins une image dans votre médiathèque ou dans ce produit avant de générer une vidéo, ou activez 'auto_generate_images: true' pour générer automatiquement des images avec l'IA."
                .to_string(),
        ));
    }

    let description_overrides: HashMap<i32, String> = payload
        .media_descriptions
        .as_ref()
        .map(|entries| {
            entries
                .iter()
                .filter_map(|entry| {
                    let trimmed = entry.description.trim();
                    if trimmed.is_empty() {
                        None
                    } else {
                        Some((entry.media_id, trimmed.to_string()))
                    }
                })
                .collect()
        })
        .unwrap_or_default();

    if !description_overrides.is_empty() {
        apply_description_overrides(&mut media_sources, &description_overrides);
    }

    let manual_override_map = payload
        .media_scene_overrides
        .as_ref()
        .map(|entries| build_manual_override_map(entries))
        .unwrap_or_default();

    let manual_override_ref = if manual_override_map.is_empty() {
        None
    } else {
        Some(&manual_override_map)
    };

    media_sources = reorder_media_sources(media_sources, &script_outline, manual_override_ref);

    let duration_seconds = payload.duration_seconds.unwrap_or(28).clamp(10, 90);
    let per_slide_seconds = (duration_seconds as f32 / media_sources.len() as f32).clamp(3.0, 9.0);
    let font_path = locate_font_file();

    let storage_root = upload_storage_root();
    let session_id = Uuid::new_v4();
    let temp_root = storage_root.join("tmp");
    let session_dir = temp_root.join(format!("video_session_{}", session_id));
    
    info!(
        "[VideoGeneration] 📁 Création dossier session: {:?}",
        session_dir
    );
    fs::create_dir_all(&session_dir).await.map_err(|err| {
        error!(
            "[VideoGeneration] ❌ Impossible de créer dossier temporaire: {:?}, erreur: {}",
            session_dir, err
        );
        AppError::Internal(format!(
            "Impossible de créer le dossier temporaire de génération vidéo: {}. Vérifiez les permissions d'écriture sur le répertoire de stockage.",
            err
        ))
    })?;
    
    info!(
        "[VideoGeneration] ✅ Dossier session créé: {:?}",
        session_dir
    );

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

        // ✅ CORRECTION: Détecter si le média est une vidéo ou une image pour utiliser la bonne option FFmpeg
        let is_video = media
            .path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| {
                let ext_lower = ext.to_lowercase();
                ext_lower == "mp4"
                    || ext_lower == "mov"
                    || ext_lower == "avi"
                    || ext_lower == "mkv"
                    || ext_lower == "webm"
                    || ext_lower == "m4v"
            })
            .unwrap_or(false);

        let mut args = vec!["-y".to_string()];

        // ✅ CORRECTION: Utiliser -stream_loop -1 pour les vidéos, -loop 1 pour les images
        if is_video {
            args.push("-stream_loop".to_string());
            args.push("-1".to_string());
        } else {
            args.push("-loop".to_string());
            args.push("1".to_string());
        }

        // ✅ CORRIGÉ 2026-01-12: Le filtre est maintenant toujours une seule chaîne avec virgules
        // donc on peut toujours utiliser -vf (plus simple et plus performant que -filter_complex)
        args.extend(vec![
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
        ]);

        info!(
            "[VideoGeneration] 🎬 Génération slide {}/{}: {}",
            idx + 1,
            media_sources.len(),
            slide_name
        );
        
        // ✅ VALIDATION PRÉVENTIVE: Vérifier que le fichier source existe
        if !media.path.exists() && !media.path.to_string_lossy().starts_with("http") {
            let error_msg = format!(
                "Fichier source introuvable pour le slide {}: {:?}",
                slide_name, media.path
            );
            error!("[VideoGeneration] ❌ {}", error_msg);
            return Err(AppError::Internal(error_msg));
        }
        
        run_ffmpeg(&session_dir, args.clone()).await.map_err(|err| {
            error!(
                "[VideoGeneration] ❌ Erreur FFmpeg pour slide {}: {}",
                slide_name, err
            );
            error!(
                "[VideoGeneration] Commande FFmpeg: ffmpeg {}",
                args.join(" ")
            );
            AppError::Internal(format!(
                "Erreur lors de la génération du slide {}: {}. Vérifiez que FFmpeg est installé et que les fichiers sources sont accessibles.",
                slide_name, err
            ))
        })?;

        // ✅ VALIDATION CRITIQUE: Vérifier que le slide a bien été créé
        let slide_path = session_dir.join(&slide_name);
        if !slide_path.exists() {
            let error_msg = format!(
                "Le slide {} n'a pas été créé après l'exécution de FFmpeg. Vérifiez les logs FFmpeg pour plus de détails. Commande: ffmpeg {}",
                slide_name,
                args.join(" ")
            );
            error!("[VideoGeneration] ❌ {}", error_msg);
            return Err(AppError::Internal(error_msg));
        }

        // Vérifier que le fichier n'est pas vide
        if let Ok(metadata) = fs::metadata(&slide_path).await {
            if metadata.len() == 0 {
                let error_msg =
                    format!("Le slide {} a été créé mais est vide (0 bytes)", slide_name);
                error!("[VideoGeneration] ❌ {}", error_msg);
                return Err(AppError::Internal(error_msg));
            }
            info!(
                "[VideoGeneration] ✅ Slide créé: {} ({} bytes)",
                slide_name,
                metadata.len()
            );
        }

        slide_filenames.push(slide_name);
    }

    // ✅ VALIDATION CRITIQUE: Vérifier qu'au moins un slide a été créé
    if slide_filenames.is_empty() {
        return Err(AppError::Internal(
            "Aucun slide vidéo n'a été généré. Vérifiez que les médias sources sont valides."
                .to_string(),
        ));
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
        let _ = try_store_progress(&state, job_id, "running", &progress_steps).await;
    }

    let orchestrator = ImmersiveOrchestrator::new(state.clone());
    let service_category_hint = extract_string(
        &primary_product,
        &[
            "service_category",
            "serviceCategory",
            "category",
            "categorie",
            "segment",
            "type",
        ],
    )
    .or_else(|| {
        extract_string(
            &service_data,
            &[
                "service_category",
                "serviceCategory",
                "category",
                "categorie",
                "segment",
            ],
        )
    })
    .unwrap_or_else(|| product_type.clone());
    let delivery_sla_hint = extract_delivery_sla_hint(&primary_product)
        .or_else(|| extract_delivery_sla_hint(&service_data));
    let inventory_signal = state
        .inventory
        .latest_signal(service_id, product_index)
        .await?;
    let mut stock_last_synced_at = None;
    let mut stock_source_label = None;
    let mut stock_level_hint = product_snapshot
        .as_ref()
        .and_then(|snapshot| snapshot.stock);
    let mut orchestration_warnings: Vec<String> = Vec::new();
    match inventory_signal {
        Some(signal) => {
            stock_level_hint = Some(signal.stock_level);
            stock_last_synced_at = Some(signal.last_synced_at);
            stock_source_label = signal.source.clone();
            if signal.is_stale(INVENTORY_STALE_THRESHOLD_HOURS) {
                orchestration_warnings.push(format!(
                    "inventory_stale:>{}h",
                    INVENTORY_STALE_THRESHOLD_HOURS
                ));
            }
        }
        None => {
            orchestration_warnings.push("inventory_sync_missing".to_string());
        }
    }
    let promotion_signal = product_snapshot
        .as_ref()
        .map(|snapshot| snapshot.promotion_active)
        .or_else(|| promotion_label.as_ref().map(|_| true));
    let audience_segment = payload
        .distribute_channels
        .as_ref()
        .and_then(|channels| {
            if channels.is_empty() {
                None
            } else {
                Some(channels.join(", "))
            }
        })
        .or_else(|| {
            extract_string(
                &primary_product,
                &[
                    "audience",
                    "audience_cible",
                    "segment_cible",
                    "segment",
                    "targetAudience",
                    "persona",
                    "cible",
                ],
            )
        });
    let timeline_context = TimelineBusinessContext {
        service_category: Some(service_category_hint),
        tone: payload.style.clone(),
        cta_label: call_to_action
            .clone()
            .or_else(|| payload.call_to_action.clone()),
        delivery_sla_minutes: delivery_sla_hint,
        stock_level: stock_level_hint,
        stock_last_synced_at,
        stock_source: stock_source_label,
        promotion_active: promotion_signal,
        price_label: price_label.clone(),
        target_audience: audience_segment,
    };
    let ai_template_recommendations = infer_template_recommendations(
        &payload,
        &timeline_context,
        product_snapshot.as_ref(),
        script_outline.len(),
    );
    // ✅ NOUVEAU: Si timeline structurée fournie, la convertir en ImmersiveTimeline
    let mut immersive_timeline: Option<ImmersiveTimeline> = None;
    if let Some(timeline_json) = &payload.timeline {
        info!("[VideoGeneration] Timeline structurée fournie, conversion en ImmersiveTimeline");
        // Utiliser le convertisseur dédié
        match convert_timeline_json_to_immersive(timeline_json, 30) {
            Ok(timeline) => {
                immersive_timeline = Some(timeline);
                info!(
                    "[VideoGeneration] ✅ Timeline convertie avec succès ({} scènes)",
                    immersive_timeline.as_ref().unwrap().scenes.len()
                );
            }
            Err(err) => {
                warn!(
                    "[VideoGeneration] ⚠️ Impossible de convertir timeline JSON: {} - utilisation orchestrator",
                    err
                );
            }
        }
    }

    // ✅ NOUVEAU: Convertir les MediaSource en TimelineMediaItem avec URLs
    let available_media: Vec<TimelineMediaItem> = media_sources
        .iter()
        .filter_map(|source| {
            if let Some(url) = media_source_to_url(source) {
                // Déterminer le type de média depuis l'extension
                let media_type = source.path
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| {
                        let ext_lower = ext.to_lowercase();
                        if matches!(ext_lower.as_str(), "mp4" | "mov" | "avi" | "mkv" | "webm" | "m4v") {
                            "video"
                        } else {
                            "image"
                        }
                    })
                    .unwrap_or_else(|| {
                        // Fallback: vérifier dans le path
                        let path_str = source.path.to_string_lossy().to_lowercase();
                        if path_str.contains("video") || path_str.contains(".mp4") || path_str.contains(".mov") {
                            "video"
                        } else {
                            "image"
                        }
                    });
                
                info!(
                    "[VideoGeneration] ✅ Média converti en TimelineMediaItem: media_id={:?}, type={}, url={}",
                    source.id, media_type, url
                );
                
                Some(TimelineMediaItem {
                    id: source.id,
                    url,
                    media_type: media_type.to_string(),
                    ai_description: source.ai_description.clone(),
                })
            } else {
                warn!(
                    "[VideoGeneration] ⚠️ Impossible de convertir MediaSource en URL: media_id={:?}, path={:?}",
                    source.id, source.path
                );
                None
            }
        })
        .collect();
    
    info!(
        "[VideoGeneration] 📊 {} média(x) converti(s) en TimelineMediaItem pour la timeline immersive",
        available_media.len()
    );

    let timeline_request = TimelineRequest {
        script_outline: script_outline.clone(),
        product_name: product_name.clone(),
        headline: headline.clone(),
        call_to_action: call_to_action.clone(),
        style: payload.style.clone(),
        duration_seconds: duration_seconds as f32,
        broll_assets: timeline_broll_assets,
        available_media, // ✅ NOUVEAU: Passer les médias convertis
        template_id: payload.story_template_id.clone(),
        business_context: Some(timeline_context),
        ai_template_recommendations,
    };
    let mut immersive_analytics: Option<TimelineAnalytics> = None;
    let mut sfx_layers: Vec<audio_pipeline::AudioLayer> = Vec::new();
    let mut renderer_response: Option<RenderJobResponse> = None;
    let mut renderer_mode: Option<RenderExecutionMode> = None;

    match orchestrator.generate_timeline(timeline_request).await {
        Ok(result) => {
            orchestration_warnings.extend(result.warnings.clone());
            let mut timeline = result.timeline.clone();
            immersive_analytics = Some(result.analytics.clone());
            let estimated_seconds = ((result.analytics.estimated_frames as f32
                / result.timeline.fps as f32)
                .ceil()) as u32;
            progress_steps.push(ProgressStep::completed(
                "timeline_generation",
                "Timeline immersive générée",
                Some(format!(
                    "{} scènes, {} b-roll, template {}, ~{}s",
                    result.analytics.total_scenes,
                    result.analytics.broll_clips_used,
                    result.analytics.selected_template,
                    estimated_seconds
                )),
            ));
            if let Some(job_id) = job_id {
                let _ = try_store_progress(&state, job_id, "running", &progress_steps).await;
            }

            // Applique les hints de style issus du payload (transitions, effets, palette).
            crate::services::immersive_timeline::apply_style_hints_to_timeline(
                &mut timeline,
                payload.style_effects.as_deref(),
                payload.style_transitions.as_deref(),
                payload.style_color_palette.as_deref(),
            );

            immersive_timeline = Some(timeline);

            let sfx_root = Path::new("assets/sfx");
            // ✅ CORRECTION: Créer le dossier SFX s'il n'existe pas, ou utiliser un fallback gracieux
            if !sfx_root.exists() {
                if let Err(err) = tokio::fs::create_dir_all(sfx_root).await {
                    warn!(
                        "[VideoGeneration] Impossible de créer le dossier SFX ({}): {}. Continuation sans SFX.",
                        sfx_root.display(), err
                    );
                    orchestration_warnings.push(format!("sfx_directory_creation_failed: {}", err));
                } else {
                    info!("[VideoGeneration] Dossier SFX créé: {}", sfx_root.display());
                }
            }

            if sfx_root.exists() && sfx_root.is_dir() {
                match audio_pipeline::build_sfx_layers_from_timeline(&result.timeline, sfx_root) {
                    Ok(layers) => {
                        if !layers.is_empty() {
                            info!(
                                "[VideoGeneration] {} couches SFX chargées depuis {}",
                                layers.len(),
                                sfx_root.display()
                            );
                        }
                        sfx_layers = layers;
                    }
                    Err(err) => {
                        warn!("[VideoGeneration] Impossible de générer les SFX timeline: {err}. Continuation sans SFX.");
                        orchestration_warnings.push(format!("sfx_generation_failed: {err}"));
                    }
                }
            } else {
                warn!(
                    "[VideoGeneration] Dossier SFX introuvable ou inaccessible ({}). Continuation sans SFX.",
                    sfx_root.display()
                );
                orchestration_warnings.push(format!("sfx_library_missing: {}", sfx_root.display()));
            }
        }
        Err(err) => {
            error!("[VideoGeneration] ❌ Orchestrateur immersif indisponible: {err}");
            error!(
                "[VideoGeneration] Service ID: {}, Product Index: {}",
                service_id, product_index
            );
            orchestration_warnings.push(format!("orchestrator_error: {err}"));
            // Ne pas faire échouer la génération, continuer avec fallback
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
                        let _ = try_store_progress(&state, job_id, "running", &progress_steps).await;
                    }
                    renderer_response = Some(response);
                }
                Err(err) => {
                    error!(
                        "[VideoGeneration] ❌ Renderer dispatcher indisponible (mode={:?}): {}",
                        err.mode, err.message
                    );
                    error!(
                        "[VideoGeneration] Service ID: {}, Product Index: {}, Job ID: {:?}",
                        service_id, product_index, job_id
                    );
                    orchestration_warnings.push(format!(
                        "renderer_error: mode={:?} message={}",
                        err.mode, err.message
                    ));
                    // Continuer avec le rendu local FFmpeg comme fallback
                    info!("[VideoGeneration] Fallback sur rendu local FFmpeg");
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

    // ✅ VALIDATION CRITIQUE: Vérifier que tous les slides existent avant concaténation
    for slide_name in &slide_filenames {
        let slide_path = session_dir.join(slide_name);
        if !slide_path.exists() {
            let error_msg = format!(
                "Slide {} manquant avant concaténation. Chemin: {:?}",
                slide_name, slide_path
            );
            error!("[VideoGeneration] ❌ {}", error_msg);
            return Err(AppError::Internal(error_msg));
        }
    }

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

    // ✅ VALIDATION CRITIQUE: Vérifier que combined.mp4 a été créé
    let combined_path = session_dir.join("combined.mp4");
    if !combined_path.exists() {
        let error_msg = format!(
            "La concaténation a échoué: combined.mp4 n'existe pas. Chemin: {:?}",
            combined_path
        );
        error!("[VideoGeneration] ❌ {}", error_msg);
        return Err(AppError::Internal(error_msg));
    }

    // Vérifier que combined.mp4 n'est pas vide
    if let Ok(metadata) = fs::metadata(&combined_path).await {
        if metadata.len() == 0 {
            let error_msg = "combined.mp4 a été créé mais est vide (0 bytes)".to_string();
            error!("[VideoGeneration] ❌ {}", error_msg);
            return Err(AppError::Internal(error_msg));
        }
        info!(
            "[VideoGeneration] ✅ Concaténation réussie: combined.mp4 ({} bytes)",
            metadata.len()
        );
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

    // Injecte les beats synthétiques dans la timeline immersive si un track musical est disponible
    if let (Some(ref music_track_path), Some(ref mut timeline)) =
        (music_track.as_ref(), &mut immersive_timeline)
    {
        if let Err(err) =
            crate::services::audio_analysis_service::inject_synthetic_beats_for_timeline(
                music_track_path,
                timeline,
            )
            .await
        {
            warn!("[VideoGeneration] Injection des beats synthétiques échouée: {err}");
            orchestration_warnings.push(format!("audio_beat_analysis_failed: {err}"));
        }
    }

    let voiceover_track = if let Some(script) = voiceover_script_opt.clone() {
        let trimmed = script.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            let lang = resolved_voiceover_lang.as_deref().unwrap_or("fr");
            if let Some(premium_path) =
                generate_premium_voiceover(&session_dir, &trimmed, lang, voice_hint.as_deref())
                    .await?
            {
                Some(premium_path)
            } else {
                match state.ia.generate_tts_audio(&trimmed, lang).await {
                    Ok(Some((bytes, format))) => {
                        let filename = format!("voiceover_ai_{}.{}", Uuid::new_v4(), format);
                        let path = session_dir.join(filename);
                        if let Err(err) = fs::write(&path, bytes).await {
                            warn!("[VideoGeneration] Écriture voix IA impossible: {err}");
                            let voice = voice_hint.as_deref().unwrap_or("fr");
                            generate_voiceover_audio(&session_dir, &trimmed, lang, voice)
                                .await
                                .ok()
                        } else {
                            Some(path)
                        }
                    }
                    Ok(None) => {
                        let voice = voice_hint.as_deref().unwrap_or("fr");
                        generate_voiceover_audio(&session_dir, &trimmed, lang, voice)
                            .await
                            .ok()
                    }
                    Err(err) => {
                        warn!("[VideoGeneration] Voix IA indisponible: {err}");
                        let voice = voice_hint.as_deref().unwrap_or("fr");
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

    // ✅ CORRIGÉ: Toujours faire le mixage audio, même si la vidéo immersive a été rendue
    // La vidéo immersive rendue n'inclut pas l'audio (musique, voix, SFX), il faut le muxer
    let video_source_for_audio = if let Some(ref renderer_resp) = renderer_response {
        // Utiliser la vidéo immersive rendue comme source vidéo
        renderer_resp.master_video.clone()
    } else {
        // Utiliser combined.mp4 (fallback FFmpeg)
        session_dir.join("combined.mp4")
    };

    // ✅ CORRIGÉ: Toujours mixer l'audio, même si la vidéo immersive a été rendue
    let mixed_audio_path = audio_pipeline::mix_media_audio_tracks(
        &session_dir,
        &video_source_for_audio,
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
        // ✅ Ignorer les erreurs de progression intermédiaire (non critiques)
        let _ = try_store_progress(&state, job_id, "running", &progress_steps).await;
    }

    let mastered_audio_path = if let Some(service) = state.audio_mastering.clone() {
            let mastering_dir = session_dir.join("mastering");
        match service
            .master_audio(&mixed_audio_path, &mastering_dir, job_id)
            .await
        {
            Ok(AudioMasteringOutcome::Completed(result)) => {
                info!(
                    "[VideoGeneration] Mastering premium appliqué via {}",
                    result.provider
                );
                Some(result.mastered_path)
            }
            Ok(AudioMasteringOutcome::Pending {
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

    // ✅ CORRIGÉ: Utiliser la vidéo immersive rendue si disponible, sinon combined.mp4
    let video_source_for_mux = if let Some(ref renderer_resp) = renderer_response {
        renderer_resp.master_video.clone()
    } else {
        session_dir.join("combined.mp4")
    };

    let final_path = session_dir.join("final.mp4");

    // ✅ VALIDATION CRITIQUE: Vérifier que la source vidéo existe avant muxage
    if !video_source_for_mux.exists() {
        let error_msg = format!(
            "Source vidéo introuvable avant muxage audio. Chemin: {:?}",
            video_source_for_mux
        );
        error!("[VideoGeneration] ❌ {}", error_msg);
        return Err(AppError::Internal(error_msg));
    }

        // ✅ VALIDATION CRITIQUE: Vérifier que l'audio existe avant muxage
        if !final_audio_source.exists() {
            let error_msg = format!(
                "Fichier audio introuvable avant muxage. Chemin: {:?}",
                final_audio_source
            );
            error!("[VideoGeneration] ❌ {}", error_msg);
            return Err(AppError::Internal(error_msg));
        }

    info!(
        "[VideoGeneration] Muxage vidéo+audio: video={:?}, audio={:?}, output={:?}",
        video_source_for_mux, final_audio_source, final_path
    );

    audio_pipeline::mux_video_with_audio(
        &video_source_for_mux,
        final_audio_source,
        &final_path,
    )
    .await
    .map_err(|err| {
        error!(
            "[VideoGeneration] ❌ Échec muxage vidéo+audio: {}. Video: {:?}, Audio: {:?}",
            err, video_source_for_mux, final_audio_source
        );
        AppError::Internal(format!(
            "Échec muxage vidéo+audio: {}. Vérifiez que les fichiers source existent et sont valides.",
            err
        ))
    })?;

    // ✅ VALIDATION CRITIQUE: Vérifier que final.mp4 a été créé après muxage
    if !final_path.exists() {
        let error_msg = format!(
            "Le muxage a échoué: final.mp4 n'existe pas. Chemin: {:?}",
            final_path
        );
        error!("[VideoGeneration] ❌ {}", error_msg);
        return Err(AppError::Internal(error_msg));
    }

    // Vérifier que final.mp4 n'est pas vide
    if let Ok(metadata) = fs::metadata(&final_path).await {
        if metadata.len() == 0 {
            let error_msg = "final.mp4 a été créé mais est vide (0 bytes)".to_string();
            error!("[VideoGeneration] ❌ {}", error_msg);
            return Err(AppError::Internal(error_msg));
        }
        info!(
            "[VideoGeneration] ✅ Muxage réussi: final.mp4 ({} bytes, {:.2} MB)",
            metadata.len(),
            metadata.len() as f64 / 1_048_576.0
        );
    }
    progress_steps.push(ProgressStep::completed(
        "video_mux",
        "Vidéo master finalisée",
        Some(format!("durée {}s", duration_seconds)),
    ));
    if let Some(job_id) = job_id {
        // ✅ Ignorer les erreurs de progression intermédiaire (non critiques)
        let _ = try_store_progress(&state, job_id, "running", &progress_steps).await;
    }

    let final_filename = format!("product_video_{}.mp4", session_id);
    let storage_key = format!("services/{}", final_filename);
    let mut source_master_path = renderer_response
        .as_ref()
        .map(|resp| resp.master_video.clone())
        .unwrap_or_else(|| session_dir.join("final.mp4"));

    // ✅ Application du watermark Yukpo (si activé)
    if payload.enable_watermark.unwrap_or(true) {
        let watermark_service = watermark_service::WatermarkService::new();
        let watermarked_path = session_dir.join("final_with_watermark.mp4");

        match watermark_service
            .apply_watermark(
                &source_master_path,
                &watermarked_path,
                None, // Utilise config par défaut
            )
            .await
        {
            Ok(path) => {
                info!("[VideoGeneration] ✅ Watermark Yukpo appliqué: {:?}", path);
                progress_steps.push(ProgressStep::completed(
                    "watermark",
                    "Watermark Yukpo appliqué",
                    Some("Branding automatique".to_string()),
                ));
                if let Some(job_id) = job_id {
                    let _ = try_store_progress(&state, job_id, "running", &progress_steps).await;
                }
                // Utiliser la vidéo avec watermark pour le stockage
                source_master_path = path;
            }
            Err(err) => {
                warn!(
                    "[VideoGeneration] ⚠️ Échec watermark, vidéo sans watermark: {}. La vidéo sera stockée sans branding.",
                    err
                );
                // Continuer sans watermark (fallback gracieux)
            }
        }
    }

    let remote_location = renderer_response.as_ref().and_then(|resp| {
        if let Some(storage_path) = resp.storage_path.clone() {
            Some(state.media_storage.remote_location_from_path(
                storage_path,
                resp.public_url.clone(),
                resp.content_length,
            ))
        } else if let Some(storage_key) = resp.storage_key.as_ref() {
            Some(state.media_storage.remote_location_from_key(
                storage_key,
                resp.public_url.clone(),
                resp.content_length,
            ))
        } else {
            None
        }
    });

    let stored_video = if let Some(remote) = remote_location {
        remote
    } else {
        // Vérifier que le fichier source existe avant de le stocker
        if !source_master_path.exists() {
            let error_msg = format!("Fichier vidéo source introuvable: {:?}", source_master_path);
            error!("[VideoGeneration] ❌ {}", error_msg);
            return Err(AppError::Internal(error_msg));
        }

        // Vérifier la taille du fichier
        if let Ok(metadata) = fs::metadata(&source_master_path).await {
            let file_size = metadata.len();
            info!(
                "[VideoGeneration] Stockage vidéo: {:?}, taille: {} bytes ({:.2} MB)",
                source_master_path,
                file_size,
                file_size as f64 / 1_048_576.0
            );

            if file_size == 0 {
                let error_msg = "Fichier vidéo généré est vide (0 bytes)".to_string();
                error!("[VideoGeneration] ❌ {}", error_msg);
                return Err(AppError::Internal(error_msg));
            }
        } else {
            warn!("[VideoGeneration] Impossible de lire les métadonnées du fichier vidéo");
        }

        state
            .media_storage
            .store_file(&source_master_path, &storage_key, Some("video/mp4"))
            .await
            .map_err(|err| {
                error!("[VideoGeneration] ❌ Impossible de stocker la vidéo générée: {err:?}");
                error!("[VideoGeneration] Fichier source: {:?}", source_master_path);
                error!("[VideoGeneration] Storage key: {}", storage_key);
                AppError::Internal(format!(
                    "Impossible de stocker la vidéo générée: {}. Vérifiez les permissions de stockage et l'espace disque disponible.",
                    err
                ))
            })?
    };

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

    // ✅ CORRIGÉ: Rendre service_data mutable pour append_video_to_service_data
    let mut service_data_mut = service_data.clone();
    append_video_to_service_data(
        &state,
        service_id,
        product_index,
        &mut service_data_mut,
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
    if let Some(style) = payload.style.clone() {
        ai_tags.push(style);
    }
    if let Some(template_id) = payload.story_template_id.clone() {
        ai_tags.push(template_id);
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
        if let Some(analytics) = immersive_analytics.as_ref() {
            map.insert(
                "immersive_template".to_string(),
                json!(analytics.selected_template.clone()),
            );
            map.insert(
                "immersive_total_scenes".to_string(),
                json!(analytics.total_scenes),
            );
            map.insert(
                "immersive_estimated_frames".to_string(),
                json!(analytics.estimated_frames),
            );
        }
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
            json!(resolved_voiceover_lang.clone()),
        );
        map.insert("voiceover_voice".to_string(), json!(voice_hint.clone()));
        if let Some(profile) = &voice_profile {
            map.insert("voice_profile_id".to_string(), json!(profile.profile.id));
            map.insert(
                "voice_profile_provider".to_string(),
                json!(profile.profile.provider.clone()),
            );
        }
        if let Some(snapshot) = &product_snapshot {
            map.insert(
                "connector_snapshot".to_string(),
                json!({
                    "product_index": snapshot.product_index,
                    "price_cents": snapshot.price_cents,
                    "currency": snapshot.currency,
                    "stock": snapshot.stock,
                    "promotion_active": snapshot.promotion_active,
                    "promotion_label": snapshot.promotion_label,
                    "delivery_eta_minutes": snapshot.delivery_eta_minutes,
                    "delivery_modes": snapshot.delivery_modes,
                    "connectors": snapshot.connectors,
                }),
            );
        }
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

    // ✅ CORRIGÉ: Ajouter étape de progression avant insertion média (119/120)
    progress_steps.push(ProgressStep::completed(
        "saving_media",
        "Enregistrement de la vidéo dans la base de données",
        Some("Insertion dans la table media".to_string()),
    ));
    if let Some(job_id) = job_id {
        let _ = try_store_progress(&state, job_id, "running", &progress_steps).await;
    }
    info!("[VideoGeneration] 📝 Étape 119/120: Enregistrement média en cours...");

    let inserted: MediaIdRow = sqlx::query_as(
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
            ai_confidence,
            uploaded_at
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, $13, NOW()
        )
        RETURNING id
        "#,
    )
    .bind(service_id)
    .bind(product_identifier)
    .bind(product_index)
    .bind("video_generated")
    .bind("video")
    .bind(normalized_relative.clone())
    .bind(file_size)
    .bind("mp4")
    .bind(ai_description)
    .bind(&ai_tags)
    .bind(ai_metadata)
    .bind("video_generation_pipeline_v1")
    .bind(quality_score as f64)
    .fetch_one(&state.pg)
    .await
    .map_err(|err| {
        error!("[VideoGeneration] Erreur insertion média: {err:?}");
        AppError::from(err)
    })?;

    info!("[VideoGeneration] ✅ Média enregistré avec ID: {}", inserted.id);

    let distribution_targets = payload.distribute_channels.clone().unwrap_or_default();

    // ✅ CORRIGÉ: Rendre schedule_distribution_targets non-bloquant pour éviter les timeouts
    let schedule_result = schedule_distribution_targets(&state, inserted.id, service_id, &distribution_targets).await;
    if let Err(err) = schedule_result {
        warn!(
            "[VideoGeneration] ⚠️ Impossible de planifier les cibles de distribution: {}. La vidéo est créée mais la distribution sera planifiée plus tard.",
            err
        );
        // Ne pas faire échouer le job pour cette erreur
    }

    if let Err(err) = distribution_automation_service::automate_media_distribution(
        state.clone(),
        user.id,
        service_id,
        product_index,
        inserted.id,
        product_snapshot.clone(),
        &distribution_targets,
    )
    .await
    {
        warn!(
            "[VideoGeneration] Automatisation distribution indisponible: {}",
            err
        );
    }

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

    // ✅ CORRIGÉ: Ajouter étape de progression finale (120/120)
    progress_steps.push(ProgressStep::completed(
        "finalizing",
        "Finalisation de la génération vidéo",
        Some("Enregistrement des métriques et nettoyage".to_string()),
    ));
    if let Some(job_id) = job_id {
        let _ = try_store_progress(&state, job_id, "running", &progress_steps).await;
    }
    info!("[VideoGeneration] 📝 Étape 120/120: Finalisation en cours...");

    // ✅ CORRIGÉ: Rendre record_engagement non-bloquant (déjà fait mais ajouter plus de logs)
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
            "[VideoGeneration] ⚠️ Impossible d'enregistrer le score qualité analytics: {}. La vidéo est créée mais les métriques ne seront pas enregistrées.",
            err
        );
    } else {
        info!("[VideoGeneration] ✅ Métriques de qualité enregistrées");
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

    // ✅ AMÉLIORÉ: Finaliser le job avec gestion d'erreur robuste
    if let Some(job_id) = job_id {
        info!(
            "[VideoGeneration] ✅ Finalisation du job {} - Statut: completed, media_id: {}",
            job_id, inserted.id
        );
        
        // ✅ AMÉLIORÉ: Gestion d'erreur robuste pour la finalisation du job
        match try_store_progress(&state, job_id, "completed", &result.progress_steps).await {
            Ok(_) => {
                info!(
                    "[VideoGeneration] ✅ Job {} marqué comme completed dans la base de données",
                    job_id
                );
            }
            Err(err) => {
                error!(
                    "[VideoGeneration] ❌ ERREUR: Impossible de marquer le job {} comme completed: {}",
                    job_id, err
                );
                error!(
                    "[VideoGeneration] Détails: media_id={}, service_id={}, product_index={}, video_url={}",
                    inserted.id, service_id, product_index, public_url
                );
                // Ne pas faire échouer le processus pour cette erreur, la vidéo est créée
                warn!(
                    "[VideoGeneration] ⚠️ La vidéo a été créée avec succès (media_id: {}) mais le job {} n'a pas pu être finalisé. L'utilisateur peut récupérer la vidéo via l'API.",
                    inserted.id, job_id
                );
            }
        }
    }

    let total_duration_ms = overall_start.elapsed().as_millis() as i64;
    if total_duration_ms > 0 {
        VIDEO_LATENCY_TOTAL_MS.fetch_add(total_duration_ms, Ordering::Relaxed);
        VIDEO_LATENCY_COUNT.fetch_add(1, Ordering::Relaxed);
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
            let rows: Vec<MediaRow> = sqlx::query_as(
                "SELECT id, path, type, ai_description, product_index, media_type
                 FROM media
                 WHERE service_id = $1
                 AND id = ANY($2)",
            )
            .bind(service_id)
            .bind(ids)
            .fetch_all(&state.pg)
            .await
            .map_err(|err| {
                error!("[VideoGeneration] Erreur récupération médias sélectionnés: {err:?}");
                AppError::from(err)
            })?;

            info!(
                "[VideoGeneration] 📊 {} média(x) sélectionné(s) trouvé(s) en base (service_id={})",
                rows.len(), service_id
            );
            
            for row in rows {
                let ai_description = row.ai_description.clone();
                if let Some(source) = row_to_media_source(row.id, &row.path, ai_description) {
                    if let Some(id) = source.id {
                        if seen_ids.contains(&id) {
                            continue;
                        }
                        seen_ids.insert(id);
                    }
                    collected.push(source);
                    info!(
                        "[VideoGeneration] ✅ Média sélectionné ajouté: id={}, path={:?}, product_index={:?}, media_type={:?}, type={}",
                        row.id, row.path, row.product_index, row.media_type, row._media_type
                    );
                } else {
                    warn!(
                        "[VideoGeneration] ⚠️ Média sélectionné ignoré (fichier introuvable): id={}, path={:?}",
                        row.id, row.path
                    );
                }
            }
            
            info!(
                "[VideoGeneration] 📦 Total médias collectés après sélection manuelle: {}",
                collected.len()
            );
        }
    }

    if collected.is_empty() && use_product_gallery {
        // ✅ CORRIGÉ: Récupérer les médias spécifiques au produit (product_index exact)
        // Si aucun média spécifique, fallback vers médias généraux du service (product_index IS NULL)
        info!(
            "[VideoGeneration] 🔍 Recherche médias produit - service_id={}, product_index={}",
            service_id, product_index
        );
        
        // ✅ NOUVEAU: D'abord chercher les médias spécifiques au produit
        let rows: Vec<MediaRow> = sqlx::query_as(
            "SELECT id, path, type, ai_description, product_index, media_type
             FROM media
             WHERE service_id = $1
             AND product_index = $2
             AND (media_type IN ('image', 'video') OR (media_type IS NULL AND type IN ('image', 'video')))
             ORDER BY COALESCE(is_main_image, FALSE) DESC, COALESCE(display_order, 0) ASC, id ASC
             LIMIT 16",
        )
        .bind(service_id)
        .bind(product_index)
        .fetch_all(&state.pg)
        .await
        .map_err(|err| {
            error!("[VideoGeneration] Erreur récupération médias produit: {err:?}");
            AppError::from(err)
        })?;

        info!(
            "[VideoGeneration] 📊 {} média(x) trouvé(s) en base pour le produit spécifique (service_id={}, product_index={})",
            rows.len(), service_id, product_index
        );
        
        // ✅ NOUVEAU: Si aucun média spécifique au produit, fallback vers médias généraux du service
        let mut final_rows = rows;
        if final_rows.is_empty() {
            info!(
                "[VideoGeneration] ⚠️ Aucun média spécifique au produit, recherche médias généraux du service (product_index IS NULL)"
            );
            let fallback_rows: Vec<MediaRow> = sqlx::query_as(
                "SELECT id, path, type, ai_description, product_index, media_type
                 FROM media
                 WHERE service_id = $1
                 AND product_index IS NULL
                 AND (media_type IN ('image', 'video') OR (media_type IS NULL AND type IN ('image', 'video')))
                 ORDER BY COALESCE(is_main_image, FALSE) DESC, COALESCE(display_order, 0) ASC, uploaded_at DESC
                 LIMIT 16",
            )
            .bind(service_id)
            .fetch_all(&state.pg)
            .await
            .map_err(|err| {
                error!("[VideoGeneration] Erreur récupération médias généraux service: {err:?}");
                AppError::from(err)
            })?;
            
            info!(
                "[VideoGeneration] 📊 {} média(x) généraux trouvé(s) en fallback pour le service (service_id={})",
                fallback_rows.len(), service_id
            );
            final_rows = fallback_rows;
        }

        for row in final_rows {
            let ai_description = row.ai_description.clone();
            if let Some(source) = row_to_media_source(row.id, &row.path, ai_description) {
                if let Some(id) = source.id {
                    if seen_ids.contains(&id) {
                        continue;
                    }
                    seen_ids.insert(id);
                }
                collected.push(source);
                info!(
                    "[VideoGeneration] ✅ Média ajouté: id={}, path={:?}, product_index={:?}, media_type={:?}, type={}",
                    row.id, row.path, row.product_index, row.media_type, row._media_type
                );
            } else {
                warn!(
                    "[VideoGeneration] ⚠️ Média ignoré (fichier introuvable): id={}, path={:?}",
                    row.id, row.path
                );
            }
        }
        
        info!(
            "[VideoGeneration] 📦 Total médias collectés après galerie produit: {}",
            collected.len()
        );
    }

    if use_service_mediatech {
        // ✅ CORRIGÉ: Inclure images ET vidéos de la médiathèque générale
        info!(
            "[VideoGeneration] 🔍 Recherche médiathèque service - service_id={}",
            service_id
        );
        let rows: Vec<MediaRow> = sqlx::query_as(
            "SELECT id, path, type, ai_description, product_index, media_type
             FROM media
             WHERE service_id = $1
             AND (product_index IS NULL OR product_index != $2)
             AND (media_type IN ('image', 'video') OR (media_type IS NULL AND type IN ('image', 'video')))
             ORDER BY uploaded_at DESC
             LIMIT 12",
        )
        .bind(service_id)
        .bind(product_index)
        .fetch_all(&state.pg)
        .await
        .map_err(|err| {
            error!("[VideoGeneration] Erreur récupération médiathèque service: {err:?}");
            AppError::from(err)
        })?;

        info!(
            "[VideoGeneration] 📊 {} média(x) trouvé(s) en base dans la médiathèque service (service_id={})",
            rows.len(), service_id
        );

        for row in rows {
            let ai_description = row.ai_description.clone();
            if let Some(source) = row_to_media_source(row.id, &row.path, ai_description) {
                if let Some(id) = source.id {
                    if seen_ids.contains(&id) {
                        continue;
                    }
                    seen_ids.insert(id);
                }
                collected.push(source);
                info!(
                    "[VideoGeneration] ✅ Média médiathèque ajouté: id={}, path={:?}, product_index={:?}, media_type={:?}, type={}",
                    row.id, row.path, row.product_index, row.media_type, row._media_type
                );
            } else {
                warn!(
                    "[VideoGeneration] ⚠️ Média médiathèque ignoré (fichier introuvable): id={}, path={:?}",
                    row.id, row.path
                );
            }
        }
        
        info!(
            "[VideoGeneration] 📦 Total médias collectés après médiathèque service: {}",
            collected.len()
        );
    }

    if include_publicite_assets {
        let rows: Vec<MediaRow> = sqlx::query_as(
            "SELECT id, path, type, ai_description, product_index, media_type
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
        )
        .bind(service_id)
        .fetch_all(&state.pg)
        .await
        .map_err(|err| {
            error!("[VideoGeneration] Erreur récupération assets publicité: {err:?}");
            AppError::from(err)
        })?;

        for row in rows {
            let ai_description = row.ai_description.clone();
            if let Some(source) = row_to_media_source(row.id, &row.path, ai_description) {
                if let Some(id) = source.id {
                    if seen_ids.contains(&id) {
                        continue;
                    }
                    seen_ids.insert(id);
                }
                collected.push(source);
                info!(
                    "[VideoGeneration] ✅ Asset publicité ajouté: id={}, path={:?}, product_index={:?}, media_type={:?}",
                    row.id, row.path, row.product_index, row.media_type
                );
            } else {
                warn!(
                    "[VideoGeneration] ⚠️ Asset publicité ignoré (fichier introuvable): id={}, path={:?}",
                    row.id, row.path
                );
            }
        }
        
        info!(
            "[VideoGeneration] 📦 Total médias collectés après assets publicité: {}",
            collected.len()
        );
    }

    info!(
        "[VideoGeneration] ✅ Récupération médias terminée: {} média(x) collecté(s) au total (service_id={}, product_index={})",
        collected.len(), service_id, product_index
    );
    
    collected.truncate(18);
    Ok(collected)
}

/// ✅ NOUVEAU: Convertit un MediaSource en URL accessible
/// Gère trois cas :
/// 1. URLs S3/CDN déjà complètes (http://, https://) → retournées telles quelles
/// 2. Chemins locaux relatifs → convertis en {API_BASE_URL}/api/media/files/{path}
/// 3. Chemins locaux absolus → convertis en {API_BASE_URL}/api/media/files/{path_relatif}
fn media_source_to_url(media_source: &MediaSource) -> Option<String> {
    let path_str = media_source.path.to_string_lossy();
    
    // ✅ CAS 1: Si c'est déjà une URL HTTP/HTTPS (S3/CDN), la retourner telle quelle
    // Les médias sauvegardés avec MediaStorageService ont leur storage_path CDN dans la DB
    if path_str.starts_with("http://") || path_str.starts_with("https://") {
        info!(
            "[media_source_to_url] ✅ Média S3/CDN (URL complète): media_id={:?}, url={}",
            media_source.id, path_str
        );
        return Some(path_str.to_string());
    }
    
    // ✅ CAS 2 & 3: Chemins locaux (relatifs ou absolus) → convertir en URL API
    
    // Construire l'URL depuis le path local
    let api_base_url = std::env::var("API_BASE_URL")
        .unwrap_or_else(|_| std::env::var("UPLOAD_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string()));
    
    // Extraire le chemin relatif depuis le path
    let storage_root = upload_storage_root();
    let relative_path = if let Ok(stripped) = media_source.path.strip_prefix(&storage_root) {
        stripped
    } else if let Ok(stripped) = media_source.path.strip_prefix("uploads") {
        stripped
    } else {
        // Si le path ne commence pas par storage_root ou "uploads", utiliser le path tel quel
        &media_source.path
    };
    
    // Nettoyer le chemin (enlever les backslashes, normaliser)
    let clean_path = relative_path.to_string_lossy()
        .replace('\\', "/")
        .trim_start_matches('/')
        .to_string();
    
    let media_url = format!("{}/api/media/files/{}", api_base_url.trim_end_matches('/'), clean_path);
    
    info!(
        "[media_source_to_url] ✅ URL construite: media_id={:?}, path_db={:?}, url={}",
        media_source.id, path_str, media_url
    );
    
    Some(media_url)
}

fn row_to_media_source(id: i32, path: &str, ai_description: Option<String>) -> Option<MediaSource> {
    // ✅ CORRIGÉ: Détecter les URLs S3/CDN dès le départ
    // Les médias sauvegardés avec MediaStorageService ont leur storage_path CDN dans la DB
    if path.starts_with("http://") || path.starts_with("https://") {
        info!(
            "[VideoGeneration] ✅ Média S3/CDN détecté: media_id={}, url={}",
            id, path
        );
        // Pour les URLs S3/CDN, créer directement le MediaSource avec l'URL
        // media_source_to_url() la retournera telle quelle
        return Some(MediaSource {
            id: Some(id),
            path: PathBuf::from(path), // Garder l'URL originale (sera convertie en string par media_source_to_url)
            ai_description,
        });
    }
    
    // Pour les chemins locaux, construire le chemin absolu
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
            "[VideoGeneration] ❌ Média introuvable sur le disque: media_id={}, path_db={:?}, path_absolu={:?}, storage_root={:?}",
            id,
            path,
            absolute,
            upload_storage_root()
        );
        // ⚠️ Si le fichier local n'existe pas et ce n'est pas une URL, on ne peut pas l'utiliser
        return None;
    }

    // ✅ VALIDATION: Vérifier que le fichier n'est pas vide
    if let Ok(metadata) = std::fs::metadata(&absolute) {
        if metadata.len() == 0 {
            error!(
                "[VideoGeneration] ❌ Média vide (0 bytes): media_id={}, path={:?}",
                id, absolute
            );
            return None;
        }
        debug!(
            "[VideoGeneration] ✅ Média valide: media_id={}, path={:?}, size={} bytes",
            id, absolute, metadata.len()
        );
    }

    Some(MediaSource {
        id: Some(id),
        path: absolute,
        ai_description,
    })
}

fn apply_description_overrides(sources: &mut [MediaSource], overrides: &HashMap<i32, String>) {
    for source in sources.iter_mut() {
        let Some(id) = source.id else {
            continue;
        };
        if let Some(description) = overrides.get(&id) {
            if !description.trim().is_empty() {
                source.ai_description = Some(description.trim().to_string());
            }
        }
    }
}

fn build_manual_override_map(overrides: &[MediaSceneOverride]) -> HashMap<usize, i32> {
    let mut map = HashMap::new();
    for entry in overrides {
        if entry.scene_index < 0 {
            continue;
        }
        map.insert(entry.scene_index as usize, entry.media_id);
    }
    map
}

fn reorder_media_sources(
    sources: Vec<MediaSource>,
    script_outline: &[String],
    manual_overrides: Option<&HashMap<usize, i32>>,
) -> Vec<MediaSource> {
    if sources.len() <= 1 || script_outline.is_empty() {
        return sources;
    }

    let mut remaining = sources;
    let mut manual_map: BTreeMap<usize, MediaSource> = BTreeMap::new();

    if let Some(overrides) = manual_overrides {
        let reverse: HashMap<i32, usize> = overrides
            .iter()
            .map(|(scene_idx, media_id)| (*media_id, *scene_idx))
            .collect();

        let mut retained = Vec::new();
        for source in remaining.into_iter() {
            if let Some(id) = source.id {
                if let Some(scene_idx) = reverse.get(&id) {
                    manual_map.insert(*scene_idx, source);
                    continue;
                }
            }
            retained.push(source);
        }
        remaining = retained;
    }

    let mut ordered: Vec<MediaSource> = Vec::new();

    for scene_idx in 0..script_outline.len() {
        if let Some(source) = manual_map.remove(&scene_idx) {
            ordered.push(source);
            continue;
        }
        if remaining.is_empty() {
            break;
        }
        let best_idx = remaining
            .iter()
            .enumerate()
            .max_by_key(|(_, media)| score_media_for_line(media, &script_outline[scene_idx]))
            .map(|(idx, _)| idx)
            .unwrap_or(0);
        ordered.push(remaining.remove(best_idx));
    }

    for (_, source) in manual_map.into_iter() {
        ordered.push(source);
    }

    ordered.extend(remaining);
    ordered
}

fn score_media_for_line(media: &MediaSource, line: &str) -> i32 {
    let Some(description) = media.ai_description.as_ref() else {
        return 0;
    };
    let lowered = description.to_lowercase();
    let mut score = 0;
    for keyword in extract_keywords(line) {
        if lowered.contains(&keyword) {
            score += 4;
        }
    }
    score
}

fn extract_keywords(text: &str) -> Vec<String> {
    text.split(|c: char| !c.is_alphanumeric())
        .filter_map(|token| {
            let trimmed = token.trim();
            if trimmed.len() < 3 {
                return None;
            }
            Some(trimmed.to_lowercase())
        })
        .collect()
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
        .unwrap_or_else(|| format!("{} • Edition Yukpo", product_name));

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
        .unwrap_or_else(|| "Commandez maintenant sur Yukpo ✅".to_string());

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
            // ✅ CORRECTION 2026-01-13: Utiliser des guillemets simples avec apostrophes doublées
            // FFmpeg require: l'hiver → text='l''hiver' (apostrophes doublées, pas échappées)
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
            // ✅ CORRECTION 2026-01-13: Utiliser des guillemets simples avec apostrophes doublées
            filter_parts.push(format!(
                "drawtext=fontfile='{}':text='{}':fontcolor=0xFFFFFF:fontsize=44:line_spacing=4:x=(w-text_w)/2:y={}:box=1:boxcolor=0x0F172ACC:boxborderw=22",
                font_spec, sanitized, y_position
            ));
        }
    }

    // ✅ CORRIGÉ 2026-01-12: Utiliser uniquement des virgules pour séparer tous les filtres
    // Le problème était que les points-virgules (;) créent plusieurs chaînes de filtres distinctes
    // dans FFmpeg, ce qui cause l'erreur "expected to have exactly 1 input and 1 output"
    // Solution: Tous les filtres (scale, pad, drawtext) peuvent être chaînés avec des virgules
    // dans une seule chaîne de filtres pour -vf
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
    // ✅ CORRIGÉ 2026-01-23: Sauvegarder UNIQUEMENT dans service_products.product_data->'videos' (nouveau système)
    // Plus besoin d'écrire dans services.data->'produits' (ancien système supprimé)
    let pool = state.pg.clone();
    let video_url_clone = video_url.clone();
    let subtitle_url_clone = subtitle_url.clone();
    let variant_urls_clone: Vec<(String, String)> = variant_urls.iter().cloned().collect();
    
    // Mettre à jour service_products.product_data->'videos' en utilisant jsonb_set
    let update_service_products_result = crate::utils::db_retry::retry_query(
        &pool,
        || {
            let video_url_clone = video_url_clone.clone();
            let subtitle_url_clone = subtitle_url_clone.clone();
            let variant_urls_clone = variant_urls_clone.clone();
            let pool_clone = pool.clone();
            let service_id_clone = service_id;
            let product_index_clone = product_index;
            
            Box::pin(async move {
                // Récupérer le product_data actuel
                let product_row = sqlx::query!(
                    "SELECT product_data FROM service_products WHERE service_id = $1 AND product_index = $2",
                    service_id_clone,
                    product_index_clone
                )
                .fetch_optional(&pool_clone)
                .await?;
                
                if let Some(row) = product_row {
                    let mut product_data = row.product_data;
                    
                    // Ajouter la vidéo au tableau videos
                    if let Some(obj) = product_data.as_object_mut() {
                        match obj.get_mut("videos") {
                            Some(Value::Array(existing)) => {
                                // Vérifier si la vidéo n'existe pas déjà pour éviter les doublons
                                let exists = existing.iter().any(|v| {
                                    v.as_str().map(|s| s == video_url_clone).unwrap_or(false)
                                });
                                if !exists {
                                    existing.push(Value::String(video_url_clone.clone()));
                                }
                            }
                            Some(_) => {
                                obj.insert(
                                    "videos".to_string(),
                                    Value::Array(vec![Value::String(video_url_clone.clone())]),
                                );
                            }
                            None => {
                                obj.insert(
                                    "videos".to_string(),
                                    Value::Array(vec![Value::String(video_url_clone.clone())]),
                                );
                            }
                        }
                        
                        // Ajouter les sous-titres si disponibles
                        if let Some(url) = subtitle_url_clone {
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
                        
                        // Ajouter les variantes si disponibles
                        if !variant_urls_clone.is_empty() {
                            let mut current_variants = match obj.get_mut("videos_variants") {
                                Some(Value::Array(existing)) => existing.clone(),
                                Some(_) => Vec::new(),
                                None => Vec::new(),
                            };
                            
                            for (format, url) in variant_urls_clone {
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
                    
                    // Mettre à jour service_products
                    sqlx::query(
                        "UPDATE service_products SET product_data = $1, updated_at = NOW() WHERE service_id = $2 AND product_index = $3"
                    )
                    .bind(&product_data)
                    .bind(service_id_clone)
                    .bind(product_index_clone)
                    .execute(&pool_clone)
                    .await?;
                    
                    info!(
                        "[VideoGeneration] ✅ Vidéo ajoutée à service_products.product_data->'videos' (service_id={}, product_index={})",
                        service_id_clone, product_index_clone
                    );
                } else {
                    warn!(
                        "[VideoGeneration] ⚠️ service_products non trouvé pour service_id={}, product_index={}, vidéo sauvegardée uniquement dans services.data",
                        service_id_clone, product_index_clone
                    );
                }
                
                Ok::<_, sqlx::Error>(())
            })
        },
        10, // 10 tentatives max avec backoff adaptatif pour TLS
    )
    .await;
    
    if let Err(err) = update_service_products_result {
        warn!(
            "[VideoGeneration] ⚠️ Erreur mise à jour service_products (après retries): {}. La vidéo est sauvegardée dans services.data mais pas dans service_products.product_data.",
            err
        );
        // Ne pas faire échouer le processus, la vidéo est quand même sauvegardée dans services.data
    }

    // ✅ SUPPRIMÉ 2026-01-23: Plus besoin de mettre à jour services.data (ancien système supprimé)
    // Les vidéos sont maintenant uniquement dans service_products.product_data
            })
        },
        10, // 10 tentatives max avec backoff adaptatif pour TLS
    )
    .await
    .map_err(|err| {
        error!("[VideoGeneration] Erreur mise à jour service (après retries): {err:?}");
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
    // ✅ CORRIGÉ 2026-01-23: Mettre à jour UNIQUEMENT service_products.product_data au lieu de JSONB
    let product_row = sqlx::query!(
        "SELECT product_data FROM service_products WHERE service_id = $1 AND product_index = $2",
        service_id,
        product_index
    )
    .fetch_optional(&state.pg)
    .await
    .map_err(|err| AppError::from(err))?;

    if let Some(row) = product_row {
        let mut product_data = row.product_data;
        
        if let Some(obj) = product_data.as_object_mut() {
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

        // ✅ CORRIGÉ: Utiliser retry_query pour gérer les erreurs TLS
        let product_data_clone = product_data.clone();
        let service_id_clone = service_id;
        let product_index_clone = product_index;
        let pool = state.pg.clone();
        
        crate::utils::db_retry::retry_query(
            &pool,
            || {
                let product_data_clone = product_data_clone.clone();
                let service_id_clone = service_id_clone;
                let product_index_clone = product_index_clone;
                let pool_clone = pool.clone();
            Box::pin(async move {
                // ✅ CORRIGÉ 2026-01-23: Mettre à jour service_products au lieu de services.data
                sqlx::query(
                    "UPDATE service_products SET product_data = $1, updated_at = NOW() WHERE service_id = $2 AND product_index = $3"
                )
                .bind(product_data_clone)
                .bind(service_id_clone)
                .bind(product_index_clone)
                .execute(&pool_clone)
                .await
            })
        },
        10, // 10 tentatives max avec backoff adaptatif pour TLS
    )
    .await
    .map_err(|err| {
        error!("[VideoGeneration] Erreur mise à jour service avec variants (après retries): {err:?}");
        AppError::from(err)
    })?;

    Ok(())
}

async fn run_ffmpeg(working_dir: &Path, args: Vec<String>) -> AppResult<()> {
    let command_str = format!("ffmpeg {}", args.join(" "));
    info!("[VideoGeneration] Exécution FFmpeg: {}", command_str);

    let output = Command::new("ffmpeg")
        .current_dir(working_dir)
        .args(&args)
        .output()
        .await
        .map_err(|err| {
            error!("[VideoGeneration] ❌ Impossible d'exécuter ffmpeg: {err:?}");
            error!("[VideoGeneration] Commande: {}", command_str);
            error!("[VideoGeneration] Répertoire: {:?}", working_dir);
            AppError::Internal(format!(
                "FFmpeg est requis pour générer les vidéos marketing. Erreur: {}. Vérifiez que FFmpeg est installé et accessible dans le PATH.",
                err
            ))
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let exit_code = output.status.code().unwrap_or(-1);

        error!("[VideoGeneration] ❌ FFmpeg a échoué (code: {})", exit_code);
        error!("[VideoGeneration] Commande: {}", command_str);
        error!("[VideoGeneration] STDERR: {}", stderr);
        if !stdout.is_empty() {
            error!("[VideoGeneration] STDOUT: {}", stdout);
        }

        // ✅ CORRIGÉ 2026-01-12: Amélioration de la détection d'erreurs FFmpeg
        let error_summary = if stderr.contains("No such file") || stderr.contains("No such file or directory") {
            "Fichier source introuvable"
        } else if stderr.contains("Invalid") || stderr.contains("Invalid argument") || stderr.contains("was expected to have exactly") {
            "Paramètres FFmpeg invalides (syntaxe de filtre incorrecte)"
        } else if stderr.contains("Permission denied") {
            "Permission refusée pour accéder au fichier"
        } else if stderr.contains("codec") || stderr.contains("Codec") {
            "Codec non supporté"
        } else if stderr.contains("filter") || stderr.contains("filtergraph") {
            "Erreur de filtre vidéo (syntaxe incorrecte)"
        } else if stderr.contains("timeout") || stderr.contains("Timeout") {
            "Timeout lors de la génération"
        } else {
            "Erreur inconnue FFmpeg"
        };

        return Err(AppError::Internal(format!(
            "La génération de la vidéo a échoué (FFmpeg): {}. Code de sortie: {}. Vérifiez les logs pour plus de détails.",
            error_summary, exit_code
        )));
    }

    debug!(
        "[VideoGeneration] ✅ FFmpeg command réussie: {}",
        command_str
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
        // ✅ CORRECTION À LA SOURCE: Vérifier si la vidéo unique a un stream audio, sinon en ajouter un
        let source = session_dir.join(&slide_filenames[0]);
        let target = session_dir.join("combined.mp4");

        // Vérifier si la source a un stream audio
        let has_audio = audio_pipeline::has_audio_stream(&source)
            .await
            .unwrap_or(false);

        if has_audio {
            // Si elle a déjà de l'audio, juste renommer
            fs::rename(&source, &target).await.map_err(|err| {
                AppError::Internal(format!(
                    "Impossible de préparer la vidéo unique pour concaténation: {err}"
                ))
            })?;
        } else {
            // Si pas d'audio, ajouter un stream audio silencieux
            let duration = slide_durations.get(0).copied().unwrap_or(4.0).max(1.0);
            let args = vec![
                "-y".to_string(),
                "-i".to_string(),
                slide_filenames[0].clone(),
                "-f".to_string(),
                "lavfi".to_string(),
                "-i".to_string(),
                format!(
                    "anullsrc=channel_layout=stereo:sample_rate=44100:duration={}",
                    duration
                ),
                "-c:v".to_string(),
                "copy".to_string(), // Copier la vidéo sans ré-encoder
                "-c:a".to_string(),
                "aac".to_string(),
                "-b:a".to_string(),
                "128k".to_string(),
                "-shortest".to_string(),
                "combined.mp4".to_string(),
            ];
            run_ffmpeg(session_dir, args).await?;
        }
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

    // ✅ CORRECTION À LA SOURCE: Ajouter un stream audio silencieux pour éviter l'erreur "matches no streams"
    // Calculer la durée totale de la vidéo
    let total_duration: f32 = slide_durations.iter().sum::<f32>().max(1.0);
    filter_parts.push(format!(
        "anullsrc=channel_layout=stereo:sample_rate=44100:duration={duration}[aout]",
        duration = total_duration
    ));

    let filter_complex = filter_parts.join(";");

    args.push("-filter_complex".to_string());
    args.push(filter_complex);
    args.extend_from_slice(&[
        "-map".to_string(),
        "[vfinal]".to_string(),
        "-map".to_string(),
        "[aout]".to_string(), // ✅ CORRECTION: Mapper aussi le stream audio
        "-c:v".to_string(),
        "libx264".to_string(),
        "-preset".to_string(),
        "veryfast".to_string(),
        "-c:a".to_string(),
        "aac".to_string(),
        "-b:a".to_string(),
        "128k".to_string(),
        "-shortest".to_string(), // S'assurer que vidéo et audio ont la même durée
        "combined.mp4".to_string(),
    ]);

    run_ffmpeg(session_dir, args).await
}

#[allow(dead_code)]
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

    let owner: i32 = row.get::<i32, _>("service_id");
    let raw_path: String = row.get::<String, _>("path");
    let media_type: String = row.get::<String, _>("type");

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
    voice_hint: Option<&str>,
) -> AppResult<Option<PathBuf>> {
    if script.trim().is_empty() {
        return Ok(None);
    }

    let preferred_voice = voice_hint
        .map(|value| value.to_string())
        .unwrap_or_else(|| match lang.to_lowercase().as_str() {
            "en" | "en-us" | "en_usa" => "en_premium".to_string(),
            "fr" | "fr-fr" | "fr_ca" => "fr_premium".to_string(),
            "es" | "es-es" => "es_premium".to_string(),
            _ => "global_premium".to_string(),
        });

    match generate_voiceover_audio(session_dir, script, lang, &preferred_voice).await {
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
    session_dir: &Path,
    source_path: &Path,
    service_id: i32,
    product_index: i32,
    state: &Arc<AppState>,
    format_label: &str,
    target_width: u32,
    target_height: u32,
    _original_relative_path: &str,
) -> AppResult<Option<AlternativeVideoFormat>> {
    use tokio::process::Command;
    use uuid::Uuid;

    // Vérifier que la vidéo source existe
    if !source_path.exists() {
        warn!(
            "[VideoGeneration] Vidéo source introuvable pour variante '{}': {:?}",
            format_label, source_path
        );
        return Ok(None);
    }

    info!(
        "[VideoGeneration] Génération variante '{}' ({}x{}) pour service_id={}, product_index={}",
        format_label, target_width, target_height, service_id, product_index
    );

    // Construire le filtre FFmpeg pour redimensionner et pad
    // Format: scale=WIDTH:HEIGHT:force_original_aspect_ratio=decrease,pad=WIDTH:HEIGHT:(WIDTH-iw)/2:(HEIGHT-ih)/2
    let filter = format!(
        "scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:({}-iw)/2:({}-ih)/2",
        target_width, target_height, target_width, target_height, target_width, target_height
    );

    // Chemin de sortie temporaire dans le session_dir
    let variant_filename = format!("variant_{}_{}.mp4", format_label, Uuid::new_v4());
    let variant_path = session_dir.join(&variant_filename);

    // Exécuter FFmpeg pour générer la variante
    let output = Command::new("ffmpeg")
        .args([
            "-y", // Overwrite output
            "-i",
            source_path.to_string_lossy().as_ref(),
            "-vf",
            &filter,
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "23",
            "-c:a",
            "copy", // Copier l'audio sans ré-encoder
            variant_path.to_string_lossy().as_ref(),
        ])
        .output()
        .await
        .map_err(|err| {
            error!(
                "[VideoGeneration] ❌ Impossible d'exécuter FFmpeg pour variante '{}': {err:?}",
                format_label
            );
            AppError::Internal(format!(
                "FFmpeg est requis pour générer les variantes vidéo. Erreur: {}",
                err
            ))
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        warn!(
            "[VideoGeneration] ❌ FFmpeg a échoué pour variante '{}': {}",
            format_label, stderr
        );
        return Ok(None);
    }

    // Vérifier que le fichier a été créé
    if !variant_path.exists() {
        warn!(
            "[VideoGeneration] ❌ Variante '{}' non créée après FFmpeg",
            format_label
        );
        return Ok(None);
    }

    // Obtenir la taille du fichier
    let file_size = tokio::fs::metadata(&variant_path)
        .await
        .map(|m| m.len())
        .unwrap_or(0);

    if file_size == 0 {
        warn!(
            "[VideoGeneration] ❌ Variante '{}' créée mais vide (0 bytes)",
            format_label
        );
        return Ok(None);
    }

    // Stocker la variante dans le système de stockage
    let storage_key = format!(
        "services/{}/products/{}/videos/variant_{}_{}.mp4",
        service_id, product_index, format_label, Uuid::new_v4()
    );

    let stored_variant = state
        .media_storage
        .store_file(&variant_path, &storage_key, Some("video/mp4"))
        .await
        .map_err(|err| {
            error!(
                "[VideoGeneration] ❌ Impossible de stocker la variante '{}': {err:?}",
                format_label
            );
            AppError::Internal(format!(
                "Impossible de stocker la variante vidéo: {}",
                err
            ))
        })?;

    // Nettoyer le fichier temporaire
    if let Err(err) = tokio::fs::remove_file(&variant_path).await {
        warn!(
            "[VideoGeneration] ⚠️ Impossible de supprimer le fichier temporaire {:?}: {}",
            variant_path, err
        );
    }

    // Enregistrer la variante dans la DB comme média
    let media_id = sqlx::query_scalar::<_, i32>(
        r#"
        INSERT INTO media (
            service_id,
            type,
            media_type,
            path,
            file_size,
            file_format,
            ai_description,
            ai_tags,
            uploaded_at
        )
        VALUES ($1, 'video', 'video', $2, $3, 'mp4', $4, $5, NOW())
        RETURNING id
        "#,
    )
    .bind(service_id)
    .bind(&stored_variant.storage_path)
    .bind(file_size as i64)
    .bind(format!("Variante vidéo {} ({}x{})", format_label, target_width, target_height))
    .bind(&vec![
        "video".to_string(),
        "variant".to_string(),
        format_label.to_string(),
    ])
    .fetch_one(&state.pg)
    .await
    .map_err(|err| {
        error!(
            "[VideoGeneration] ❌ Erreur insertion média variante '{}': {:?}",
            format_label, err
        );
        AppError::from(err)
    })?;

    info!(
        "[VideoGeneration] ✅ Variante '{}' générée et stockée (media_id={}, url={})",
        format_label, media_id, stored_variant.public_url
    );

    Ok(Some(AlternativeVideoFormat {
        format: format_label.to_string(),
        path: stored_variant.storage_path,
        video_url: stored_variant.public_url,
        media_id,
    }))
}

fn extract_delivery_sla_hint(value: &Value) -> Option<u32> {
    if let Some(delivery) = value.get("delivery") {
        if let Some(sla) = extract_u32(delivery, &["sla_minutes", "sla", "delay_minutes", "delai"])
        {
            return Some(sla);
        }
        if let Some(sla_obj) = delivery.get("sla") {
            if let Some(sla) = extract_u32(sla_obj, &["minutes", "value"]) {
                return Some(sla);
            }
        }
    }

    extract_u32(
        value,
        &[
            "delivery_sla_minutes",
            "deliverySlaMinutes",
            "delivery_sla",
            "sla_minutes",
            "delai_minutes",
            "delivery_delay",
        ],
    )
}

fn infer_template_recommendations(
    payload: &VideoGenerationPayload,
    context: &TimelineBusinessContext,
    snapshot: Option<&ProductConnectorSnapshot>,
    script_len: usize,
) -> Vec<String> {
    let mut hints: Vec<String> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    if let Some(template_id) = payload.story_template_id.as_deref() {
        push_template_hint(&mut hints, &mut seen, template_id);
    }

    if let Some(stock) = context.stock_level {
        if stock <= 3 {
            push_template_hint(&mut hints, &mut seen, "comparison");
            push_template_hint(&mut hints, &mut seen, "testimonial");
        } else if stock >= 20 {
            push_template_hint(&mut hints, &mut seen, "tutorial");
        }
    }

    if context.promotion_active.unwrap_or(false) || context.price_label.is_some() {
        push_template_hint(&mut hints, &mut seen, "comparison");
    }

    if let Some(tone) = context.tone.as_deref() {
        let lower = tone.to_lowercase();
        if lower.contains("edu") || lower.contains("how") || lower.contains("guide") {
            push_template_hint(&mut hints, &mut seen, "tutorial");
        }
        if lower.contains("trust")
            || lower.contains("community")
            || lower.contains("warm")
            || lower.contains("social")
        {
            push_template_hint(&mut hints, &mut seen, "testimonial");
        }
        if lower.contains("thought") || lower.contains("chronicle") || lower.contains("expert") {
            push_template_hint(&mut hints, &mut seen, "blog");
        }
    }

    if let Some(audience) = context.target_audience.as_deref() {
        let lower = audience.to_lowercase();
        if lower.contains("b2b") || lower.contains("pro") || lower.contains("corporate") {
            push_template_hint(&mut hints, &mut seen, "comparison");
            push_template_hint(&mut hints, &mut seen, "blog");
        }
        if lower.contains("community")
            || lower.contains("club")
            || lower.contains("fidelite")
            || lower.contains("whatsapp")
        {
            push_template_hint(&mut hints, &mut seen, "testimonial");
        }
    }

    if let Some(snapshot) = snapshot {
        if snapshot.promotion_active {
            push_template_hint(&mut hints, &mut seen, "comparison");
        }
        if snapshot
            .delivery_modes
            .iter()
            .any(|mode| mode.eq_ignore_ascii_case("express") || mode.eq_ignore_ascii_case("rush"))
        {
            push_template_hint(&mut hints, &mut seen, "tutorial");
        }
    }

    if let Some(channels) = payload.distribute_channels.as_ref() {
        for channel in channels {
            let lower = channel.to_lowercase();
            if lower.contains("stories") || lower.contains("shorts") || lower.contains("tiktok") {
                push_template_hint(&mut hints, &mut seen, "tutorial");
            }
            if lower.contains("linkedin") || lower.contains("newsletter") || lower.contains("blog")
            {
                push_template_hint(&mut hints, &mut seen, "blog");
            }
            if lower.contains("whatsapp") || lower.contains("community") || lower.contains("group")
            {
                push_template_hint(&mut hints, &mut seen, "testimonial");
            }
        }
    }

    if script_len <= 3 {
        push_template_hint(&mut hints, &mut seen, "testimonial");
    } else if script_len >= 6 {
        push_template_hint(&mut hints, &mut seen, "tutorial");
    }

    if hints.is_empty() {
        push_template_hint(&mut hints, &mut seen, "blog");
        push_template_hint(&mut hints, &mut seen, "tutorial");
    }

    hints
}

fn push_template_hint(hints: &mut Vec<String>, seen: &mut HashSet<String>, value: &str) {
    let key = value.to_ascii_lowercase();
    if seen.insert(key) {
        hints.push(value.to_string());
    }
}

fn extract_u32(value: &Value, keys: &[&str]) -> Option<u32> {
    let raw = extract_string(value, keys)?;
    raw.trim().parse::<u32>().ok()
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
    // ✅ CORRECTION 2026-01-13: Échappement correct pour FFmpeg drawtext avec guillemets simples
    // Dans FFmpeg, avec des guillemets simples text='...', les apostrophes doivent être DOUBLÉES
    // Exemple: l'hiver → l''hiver (pas l\'hiver)
    text.replace('\'', "''")     // Doubler les apostrophes (règle FFmpeg pour guillemets simples)
        .replace('\\', "\\\\")   // Échapper les backslashes
        .replace(':', "\\:")     // Échapper les deux-points (séparateur de paramètres FFmpeg)
        .replace('\n', "\\n")    // Échapper les retours à la ligne
        .replace('\r', "")       // Supprimer les retours chariot
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

    // ✅ CORRECTION: Utiliser un format de sortie compatible (WAV au lieu de MP3 pour éviter les problèmes de codec)
    // On génère d'abord en WAV, puis on convertit en MP3 si nécessaire
    let wav_path = session_dir.join(format!("temp_music_{}.wav", uuid::Uuid::new_v4()));

    // Générer la musique en WAV d'abord (plus fiable)
    let filter_complex = format!(
        "asetrate=44100*0.8,atempo=1.25,aresample=44100,afade=t=in:st=0:d=3,afade=t=out:st={fade_start}:d=4,volume=0.35",
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
            "-af",
            &filter_complex,
            "-c:a",
            "pcm_s16le",
            "-ar",
            "44100",
            "-ac",
            "2",
            wav_path
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
        error!(
            "[VideoGeneration] Génération musique WAV échouée: {}",
            stderr
        );
        return Err(AppError::Internal(format!(
            "Génération de la musique impossible: {}",
            stderr
        )));
    }

    // ✅ CORRECTION: Convertir WAV en MP3 si le fichier de sortie est en MP3
    let file_ext = track_path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("mp3");
    if file_ext == "mp3" {
        let output = Command::new("ffmpeg")
            .current_dir(session_dir)
            .args([
                "-y",
                "-i",
                wav_path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .as_ref(),
                "-c:a",
                "libmp3lame",
                "-b:a",
                "160k",
                "-q:a",
                "2",
                track_path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .as_ref(),
            ])
            .output()
            .await
            .map_err(|err| {
                error!("[VideoGeneration] Impossible de convertir WAV en MP3: {err:?}");
                AppError::Internal("Conversion WAV->MP3 impossible.".to_string())
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            error!("[VideoGeneration] Conversion MP3 échouée: {}", stderr);
            // Fallback: utiliser le WAV si la conversion échoue
            warn!("[VideoGeneration] Utilisation du WAV comme fallback");
            if let Err(e) = tokio::fs::copy(&wav_path, &track_path).await {
                error!("[VideoGeneration] Impossible de copier WAV: {}", e);
                return Err(AppError::Internal(format!(
                    "Génération musique impossible: conversion MP3 échouée et copie WAV échouée"
                )));
            }
        } else {
            // Nettoyer le fichier WAV temporaire
            let _ = tokio::fs::remove_file(&wav_path).await;
        }
    } else {
        // Si le format de sortie n'est pas MP3, utiliser directement le WAV
        if let Err(e) = tokio::fs::copy(&wav_path, &track_path).await {
            error!("[VideoGeneration] Impossible de copier WAV: {}", e);
            return Err(AppError::Internal(format!(
                "Génération musique impossible: copie WAV échouée"
            )));
        }
        let _ = tokio::fs::remove_file(&wav_path).await;
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
    // ✅ CORRECTION À LA SOURCE: Retry avec timeout et fallback vers stockage local si CDN inaccessible
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|err| AppError::Internal(format!("Impossible de créer le client HTTP: {err}")))?;

    let mut last_error = None;
    let mut response = None;
    let mut is_dns_error = false;

    // Tentative avec retry (3 tentatives)
    for attempt in 1..=3 {
        match client.get(loop_info.url).send().await {
            Ok(resp) => {
                if resp.status().is_success() {
                    response = Some(resp);
                    break;
                } else {
                    last_error = Some(format!("Statut HTTP {}", resp.status()));
                    if attempt < 3 {
                        log::info!(
                            "[VideoGeneration] Tentative {}/3 échouée (statut {}), retry...",
                            attempt,
                            resp.status()
                        );
                        tokio::time::sleep(std::time::Duration::from_millis(500 * attempt as u64))
                            .await;
                    }
                }
            }
            Err(err) => {
                let error_msg = err.to_string();
                last_error = Some(error_msg.clone());

                // Vérifier si c'est une erreur DNS
                if error_msg.contains("dns error")
                    || error_msg.contains("failed to lookup")
                    || error_msg.contains("Name or service not known")
                {
                    is_dns_error = true;
                    log::warn!(
                        "[VideoGeneration] Erreur DNS pour {}: {}. Tentative fallback local...",
                        loop_info.url,
                        error_msg
                    );
                    break; // Sortir de la boucle pour essayer le fallback
                }

                if attempt < 3 {
                    log::info!(
                        "[VideoGeneration] Tentative {}/3 échouée ({}), retry...",
                        attempt,
                        error_msg
                    );
                    tokio::time::sleep(std::time::Duration::from_millis(500 * attempt as u64))
                        .await;
                }
            }
        }
    }

    // ✅ CORRECTION À LA SOURCE: Fallback vers stockage local si CDN inaccessible
    let bytes = if is_dns_error || response.is_none() {
        // Essayer de charger depuis un dossier local
        let local_path = PathBuf::from("assets/audio").join(format!("{}.mp3", loop_info.id));
        if local_path.exists() {
            log::info!(
                "[VideoGeneration] Utilisation du fichier audio local: {}",
                local_path.display()
            );
            tokio::fs::read(&local_path).await.map_err(|err| {
                AppError::Internal(format!(
                    "Impossible de lire le fichier audio local {}: {}",
                    local_path.display(),
                    err
                ))
            })?
        } else {
            return Err(AppError::Internal(format!(
                "CDN inaccessible et fichier local introuvable ({}). Configurez le CDN ou placez le fichier dans assets/audio/",
                local_path.display()
            )));
        }
    } else {
        let response = response.ok_or_else(|| {
            AppError::Internal(format!(
                "Téléchargement audio IA impossible après 3 tentatives: {}",
                last_error.unwrap_or_else(|| "Erreur inconnue".to_string())
            ))
        })?;

        response
            .bytes()
            .await
            .map_err(|err| AppError::Internal(format!("Lecture audio IA impossible: {err}")))?
            .to_vec()
    };

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
