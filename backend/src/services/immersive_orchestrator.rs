use std::collections::HashMap;
use std::sync::Arc;

use chrono::{DateTime, Utc};
use log::{info, warn};
use serde::Serialize;

use crate::{
    core::types::{AppError, AppResult},
    services::immersive_timeline::{
        AudioCueKind, ColorGradeStyle, ImmersiveAudioCue, ImmersiveContext, ImmersivePlan,
        ImmersiveScene, ImmersiveSceneAssets, ImmersiveSceneColorGrade, ImmersiveSceneTransition,
        ImmersiveSticker, ImmersiveTemplate, ImmersiveTimeline, StickerPosition, TransitionType,
    },
    services::story_template_service::StoryTemplateSpec,
    state::AppState,
};

// ✅ NOUVEAU: Templates spécifiques TikTok/Shorts
const TIKTOK_TEMPLATES: &[&str] = &[
    "tiktok_product_showcase",
    "tiktok_before_after", 
    "tiktok_unboxing",
    "tiktok_tutorial",
    "tiktok_transition",
    "tiktok_text_overlay",
];

const SHORTS_TEMPLATES: &[&str] = &[
    "shorts_vertical_story",
    "shorts_quick_demo",
    "shorts_comparison",
    "shorts_call_to_action",
];

#[derive(Debug, Clone)]
pub struct TimelineBusinessContext {
    pub service_category: Option<String>,
    pub tone: Option<String>,
    pub cta_label: Option<String>,
    pub delivery_sla_minutes: Option<u32>,
    pub stock_level: Option<i32>,
    pub promotion_active: Option<bool>,
    pub price_label: Option<String>,
    pub target_audience: Option<String>,
    pub stock_last_synced_at: Option<DateTime<Utc>>,
    pub stock_source: Option<String>,
}

#[derive(Debug, Clone)]
pub struct TimelineBrollAsset {
    pub path: String,
    pub format: String,
    pub source: String,
    pub duration_seconds: f32,
}

#[derive(Debug, Clone)]
pub struct TimelineMediaItem {
    pub id: Option<i32>,
    pub url: String,
    pub media_type: String, // 'image' | 'video'
    pub ai_description: Option<String>,
}

#[derive(Debug, Clone)]
pub struct TimelineRequest {
    pub script_outline: Vec<String>,
    pub product_name: String,
    pub headline: Option<String>,
    pub call_to_action: Option<String>,
    pub style: Option<String>,
    pub duration_seconds: f32,
    pub broll_assets: Vec<TimelineBrollAsset>,
    pub available_media: Vec<TimelineMediaItem>, // ✅ NOUVEAU: Médias produits disponibles
    pub template_id: Option<String>,
    pub business_context: Option<TimelineBusinessContext>,
    pub ai_template_recommendations: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TimelineAnalytics {
    pub total_scenes: usize,
    pub broll_clips_used: usize,
    pub broll_sources: HashMap<String, usize>,
    pub broll_formats: HashMap<String, usize>,
    pub template_breakdown: HashMap<String, usize>,
    pub estimated_frames: u32,
    pub selected_template: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoryboardScene {
    pub index: usize,
    pub scene_type: String,
    pub headline: Option<String>,
    pub body: Option<String>,
    pub duration_hint_seconds: f32,
    pub media_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Storyboard {
    pub template_id: String,
    pub total_duration_seconds: f32,
    pub scenes: Vec<StoryboardScene>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct TimelineResult {
    pub plan: ImmersivePlan,
    pub timeline: ImmersiveTimeline,
    pub analytics: TimelineAnalytics,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TemplateRecommendation {
    pub id: String,
    pub label: String,
    pub description: String,
    pub score: i32,
    pub reasons: Vec<String>,
}

#[derive(Debug, Clone)]
struct TemplateEvaluation {
    score: i32,
    reasons: Vec<String>,
}

pub struct ImmersiveOrchestrator {
    state: Arc<AppState>,
}

impl ImmersiveOrchestrator {
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    pub fn build_plan(&self, context: &ImmersiveContext) -> AppResult<ImmersivePlan> {
        let mut broll_slots = Vec::new();

        if context.slide_count > 1 {
            for idx in 0..context.slide_count {
                if idx % 2 == 1 {
                    broll_slots.push(idx);
                }
            }
        }

        let plan = ImmersivePlan {
            broll_slots,
            cta_slide_index: context.slide_count.saturating_sub(1),
        };

        info!(
            "[ImmersiveOrchestrator] plan b-roll slots={:?}, cta={}",
            plan.broll_slots, plan.cta_slide_index
        );

        Ok(plan)
    }

    pub async fn generate_timeline(&self, request: TimelineRequest) -> AppResult<TimelineResult> {
        if request.script_outline.is_empty() {
            return Err(AppError::BadRequest(
                "Impossible de générer une timeline immersive sans script.".to_string(),
            ));
        }

        let selected_template = self.select_story_template(&request);
        let script_count = request.script_outline.len();
        let total_scenes = script_count + 2; // intro + contenu + CTA
        let context = ImmersiveContext {
            slide_count: total_scenes,
            style: request.style.clone(),
        };
        let plan = self.build_plan(&context)?;

        let fps = 30;
        let _total_duration = request.duration_seconds.max(12.0);
        let duration_target = selected_template.default_duration_seconds.max(12) as f32;
        let per_scene_seconds = (duration_target / total_scenes as f32).clamp(3.0, 9.5);
        let per_scene_frames = (per_scene_seconds * fps as f32).round().max(15.0) as u32;

        let mut scenes: Vec<ImmersiveScene> = Vec::new();
        let mut warnings: Vec<String> = Vec::new();
        let mut template_breakdown: HashMap<String, usize> = HashMap::new();
        let mut broll_formats: HashMap<String, usize> = HashMap::new();
        let mut broll_sources: HashMap<String, usize> = HashMap::new();
        let mut broll_iter = request.broll_assets.iter();
        let mut broll_used = 0usize;

        // ✅ NOUVEAU: Itérateur pour les médias produits disponibles
        let mut media_iter = request.available_media.iter().cycle();
        let mut media_used = 0usize;

        info!(
            "[ImmersiveOrchestrator] 📊 Médias disponibles pour timeline: {} média(x)",
            request.available_media.len()
        );

        // Intro scene
        let mut intro_scene = create_intro_scene(&request, per_scene_frames, request.style.clone());

        // ✅ NOUVEAU: Assigner un média à la scène intro si disponible
        if let Some(media) = media_iter.next() {
            if media.media_type == "video" {
                intro_scene.assets.video_url = Some(media.url.clone());
                intro_scene.assets.background_url = Some(media.url.clone());
            } else {
                intro_scene.assets.product_image_url = Some(media.url.clone());
                intro_scene.assets.background_url = Some(media.url.clone());
            }
            media_used += 1;
            info!(
                "[ImmersiveOrchestrator] ✅ Média assigné à scène intro: media_id={:?}, type={}, url={}",
                media.id, media.media_type, media.url
            );
        }

        scenes.push(intro_scene);
        increment_template(&mut template_breakdown, "IntroPulse");

        // Content scenes
        for (idx, line) in request.script_outline.iter().enumerate() {
            let scene_index = idx + 1;
            let mut scene_assets = ImmersiveSceneAssets::default();
            scene_assets.body = Some(line.clone());
            scene_assets.headline = Some(request.product_name.clone());

            let mut template = ImmersiveTemplate::ProductShowcase;
            let mut transition = ImmersiveSceneTransition {
                r#type: TransitionType::Parallax,
                duration_in_frames: 18,
            };
            let mut color_grade = Some(ImmersiveSceneColorGrade {
                style: ColorGradeStyle::Cinematic,
                intensity: 0.55,
            });

            // ✅ NOUVEAU: Assigner un média produit à chaque scène de contenu
            if let Some(media) = media_iter.next() {
                // Prioriser les images pour product_image_url, vidéos pour video_url
                if media.media_type == "video" {
                    scene_assets.video_url = Some(media.url.clone());
                    scene_assets.background_url = Some(media.url.clone());
                    info!(
                        "[ImmersiveOrchestrator] ✅ Média vidéo assigné à scène {}: media_id={:?}, url={}",
                        scene_index, media.id, media.url
                    );
                } else {
                    // Image: utiliser pour product_image_url et background_url
                    scene_assets.product_image_url = Some(media.url.clone());
                    scene_assets.background_url = Some(media.url.clone());
                    info!(
                        "[ImmersiveOrchestrator] ✅ Média image assigné à scène {}: media_id={:?}, url={}",
                        scene_index, media.id, media.url
                    );
                }
                media_used += 1;
            } else if !request.available_media.is_empty() {
                warn!(
                    "[ImmersiveOrchestrator] ⚠️ Aucun média disponible pour scène {} (tous utilisés)",
                    scene_index
                );
            } else {
                // ✅ CORRIGÉ: Logger en debug au lieu de warn (normal si médias en cours de génération)
                log::debug!(
                    "[ImmersiveOrchestrator] Aucun média produit disponible pour scène {} (médias peuvent être en cours de génération)",
                    scene_index
                );
            }

            if plan.should_inject_broll(scene_index) {
                if let Some(asset) = broll_iter.next() {
                    // Si pas de média produit, utiliser b-roll pour video_url
                    if scene_assets.video_url.is_none() {
                        scene_assets.video_url = Some(asset.path.clone());
                    }
                    // Toujours utiliser b-roll pour background si disponible
                    if scene_assets.background_url.is_none() {
                        scene_assets.background_url = Some(asset.path.clone());
                    }
                    template = ImmersiveTemplate::ARHighlight;
                    transition.r#type = TransitionType::Orbit3d;
                    color_grade = Some(ImmersiveSceneColorGrade {
                        style: ColorGradeStyle::Glow,
                        intensity: 0.5,
                    });
                    *broll_sources.entry(asset.source.clone()).or_insert(0) += 1;
                    *broll_formats.entry(asset.format.clone()).or_insert(0) += 1;
                    broll_used += 1;
                    info!(
                        "[ImmersiveOrchestrator] ✅ B-roll assigné à scène {}: path={}",
                        scene_index, asset.path
                    );
                } else {
                    warnings.push(format!(
                        "Aucun b-roll disponible pour la scène {} (slot planifié).",
                        scene_index
                    ));
                }
            }

            increment_template(&mut template_breakdown, template_name(&template));

            scenes.push(ImmersiveScene {
                id: format!("scene_{:02}", scene_index),
                template,
                duration_in_frames: per_scene_frames,
                assets: scene_assets,
                transition,
                color_grade,
            });
        }

        // CTA scene
        let mut cta_scene = create_cta_scene(&request, per_scene_frames);

        // ✅ NOUVEAU: Assigner un média à la scène CTA si disponible
        if let Some(media) = media_iter.next() {
            if media.media_type == "video" {
                cta_scene.assets.video_url = Some(media.url.clone());
                cta_scene.assets.background_url = Some(media.url.clone());
            } else {
                cta_scene.assets.product_image_url = Some(media.url.clone());
                cta_scene.assets.background_url = Some(media.url.clone());
            }
            media_used += 1;
            info!(
                "[ImmersiveOrchestrator] ✅ Média assigné à scène CTA: media_id={:?}, type={}, url={}",
                media.id, media.media_type, media.url
            );
        }

        scenes.push(cta_scene);
        increment_template(&mut template_breakdown, "GlowCTA");

        let mut audio_cues: Vec<ImmersiveAudioCue> = Vec::new();
        let mut current_frame: u32 = 0;
        let total_scenes = scenes.len();

        for (idx, scene) in scenes.iter_mut().enumerate() {
            let cue_type = if idx == 0 {
                AudioCueKind::Riser
            } else if idx == total_scenes - 1 {
                AudioCueKind::Beat
            } else if plan.should_inject_broll(idx) {
                AudioCueKind::Impact
            } else {
                AudioCueKind::Glitch
            };

            audio_cues.push(ImmersiveAudioCue {
                id: format!("scene_{}_cue", idx),
                start_frame: current_frame,
                cue_type,
            });

            // Injection de stickers métier basés sur le contexte business (promo / livraison / prix)
            if let Some(ctx) = request.business_context.as_ref() {
                let stickers = scene.assets.stickers.get_or_insert_with(Vec::new);

                // Sticker promo global si une promotion est active
                if ctx.promotion_active.unwrap_or(false) && idx > 0 && idx < total_scenes - 1 {
                    stickers.push(ImmersiveSticker {
                        id: format!("promo-main-{:02}", idx),
                        src: "/assets/stickers/promo-main.png".to_string(),
                        start_frame: current_frame.saturating_add(fps / 4),
                        duration_in_frames: scene.duration_in_frames.saturating_sub(fps / 3),
                        position: Some(StickerPosition {
                            x: 900.0,
                            y: 260.0,
                            scale: 1.0,
                        }),
                    });
                }

                // Sticker livraison sur la scène CTA si SLA disponible
                if ctx.delivery_sla_minutes.is_some() && idx == total_scenes - 1 {
                    stickers.push(ImmersiveSticker {
                        id: "livraison-express".to_string(),
                        src: "/assets/stickers/delivery-fast.png".to_string(),
                        start_frame: current_frame.saturating_add(fps / 3),
                        duration_in_frames: scene.duration_in_frames.saturating_sub(fps / 2),
                        position: Some(StickerPosition {
                            x: 860.0,
                            y: 1520.0,
                            scale: 0.95,
                        }),
                    });
                }

                // Sticker prix sur les scènes produit si un label de prix est fourni
                if ctx.price_label.is_some() && idx > 0 && idx < total_scenes - 1 {
                    stickers.push(ImmersiveSticker {
                        id: "price-tag".to_string(),
                        src: "/assets/stickers/price-tag.png".to_string(),
                        start_frame: current_frame,
                        duration_in_frames: scene.duration_in_frames.saturating_sub(fps / 2),
                        position: Some(StickerPosition {
                            x: 260.0,
                            y: 1520.0,
                            scale: 0.9,
                        }),
                    });
                }
            }

            current_frame += scene.duration_in_frames;
        }

        // ✅ CORRIGÉ: Cloner scenes avant de le passer à ImmersiveTimeline pour éviter l'erreur de borrow
        let scenes_clone = scenes.clone();

        let timeline = ImmersiveTimeline {
            fps,
            width: 1080,
            height: 1920,
            audio_cue_map: Some(audio_cues),
            scenes,
        };

        let analytics = TimelineAnalytics {
            total_scenes,
            broll_clips_used: broll_used,
            broll_sources,
            broll_formats,
            template_breakdown,
            estimated_frames: timeline.total_frames(),
            selected_template: selected_template.id.clone(),
        };

        info!(
            "[ImmersiveOrchestrator] ✅ Timeline générée: scenes={}, médias_produits={}, broll={}",
            analytics.total_scenes, media_used, analytics.broll_clips_used
        );

        // ✅ NOUVEAU: Validation - vérifier que toutes les scènes ont au moins un média
        let scenes_with_media = scenes_clone
            .iter()
            .filter(|scene| {
                scene.assets.video_url.is_some()
                    || scene.assets.background_url.is_some()
                    || scene.assets.product_image_url.is_some()
            })
            .count();

        if scenes_with_media < scenes_clone.len() {
            let missing_count = scenes_clone.len() - scenes_with_media;
            // ✅ CORRIGÉ: Logger en debug au lieu de warn si moins de 50% des scènes ont des médias
            // Sinon logger en warn seulement si aucune scène n'a de média
            if scenes_with_media == 0 {
                warn!(
                    "[ImmersiveOrchestrator] ⚠️ Aucune scène n'a de média sur {} total (problème critique)",
                    scenes_clone.len()
                );
            } else {
                log::debug!(
                    "[ImmersiveOrchestrator] {} scène(s) sans média sur {} total (normal si médias en cours de génération)",
                    missing_count, scenes_clone.len()
                );
            }
            warnings.push(format!(
                "{} scène(s) générée(s) sans média. Veuillez ajouter des images/vidéos au produit.",
                missing_count
            ));
        } else {
            info!(
                "[ImmersiveOrchestrator] ✅ Toutes les {} scènes ont au moins un média assigné",
                scenes_clone.len()
            );
        }

        Ok(TimelineResult {
            plan,
            timeline,
            analytics,
            warnings,
        })
    }

    fn select_story_template(&self, request: &TimelineRequest) -> StoryTemplateSpec {
        let ai_hints = if !request.ai_template_recommendations.is_empty() {
            request.ai_template_recommendations.clone()
        } else if let Some(context) = &request.business_context {
            self.derive_ai_recommendations(context)
        } else {
            Vec::new()
        };

        if let Some(template_id) = request.template_id.as_deref() {
            if let Some(spec) = self.state.story_templates.get(template_id) {
                return spec.clone();
            }
            warn!(
                "[ImmersiveOrchestrator] template {} introuvable, fallback sur scoring",
                template_id
            );
        }

        let templates = self.state.story_templates.list();
        let mut best = templates.first().cloned().unwrap_or_else(|| StoryTemplateSpec {
            id: "blog".into(),
            label: "Blog / Chronicle".into(),
            description: "Défaut".into(),
            recommended_categories: vec![],
            tones: vec![],
            ctas: vec![],
            default_duration_seconds: 30,
            suggested_scenes: 3,
        });
        let mut best_score = i32::MIN;

        for spec in templates {
            let mut evaluation = self.evaluate_template(spec, request);
            if let Some((position, _)) = ai_hints
                .iter()
                .enumerate()
                .find(|(_, hint)| hint.eq_ignore_ascii_case(&spec.id))
            {
                let bonus = ((ai_hints.len() - position) as i32).saturating_mul(3);
                evaluation.score += bonus;
                evaluation.reasons.push(format!("hint_ia_rank_{}", position + 1));
            }
            if evaluation.score > best_score {
                best_score = evaluation.score;
                best = spec.clone();
            }
        }

        if let Some(template_id) = &request.template_id {
            if !best.id.eq_ignore_ascii_case(template_id) {
                warn!(
                    "[ImmersiveOrchestrator] template {} indisponible, fallback {} (score={})",
                    template_id, best.id, best_score
                );
            }
        }

        best
    }

    pub fn recommend_templates(&self, request: &TimelineRequest) -> Vec<TemplateRecommendation> {
        let mut ranked: Vec<TemplateRecommendation> = self
            .state
            .story_templates
            .list()
            .iter()
            .map(|spec| {
                let evaluation = self.evaluate_template(spec, request);
                TemplateRecommendation {
                    id: spec.id.clone(),
                    label: spec.label.clone(),
                    description: spec.description.clone(),
                    score: evaluation.score,
                    reasons: evaluation.reasons.clone(),
                }
            })
            .collect();
        ranked.sort_by(|a, b| b.score.cmp(&a.score));
        ranked
    }

    fn evaluate_template(
        &self,
        spec: &StoryTemplateSpec,
        request: &TimelineRequest,
    ) -> TemplateEvaluation {
        let mut score = 0;
        let mut reasons = Vec::new();

        if let Some(template_id) = &request.template_id {
            if template_id.eq_ignore_ascii_case(&spec.id) {
                score += 120;
                reasons.push("template_force".to_string());
            }
        }

        if let Some(context) = &request.business_context {
            let context_eval = self.evaluate_business_context(spec, context);
            score += context_eval.score;
            reasons.extend(context_eval.reasons);
        }

        let scene_delta = spec.suggested_scenes as i32 - request.script_outline.len() as i32;
        if scene_delta == 0 {
            score += 3;
            reasons.push("scenes_alignees".to_string());
        } else {
            score -= scene_delta.abs();
            reasons.push(format!("ecart_scenes:{}", scene_delta));
        }

        let duration_delta =
            (spec.default_duration_seconds as f32 - request.duration_seconds).abs();
        if duration_delta < 5.0 {
            score += 2;
            reasons.push("duree_proche".to_string());
        }

        TemplateEvaluation { score, reasons }
    }

    pub fn build_storyboard(
        &self,
        request: &TimelineRequest,
        result: &TimelineResult,
    ) -> Storyboard {
        let fps = result.timeline.fps.max(1);
        let mut scenes = Vec::with_capacity(result.timeline.scenes.len());
        let mut total_duration_seconds = 0.0_f32;

        for (index, scene) in result.timeline.scenes.iter().enumerate() {
            let duration_seconds = scene.duration_in_frames as f32 / fps as f32;
            total_duration_seconds += duration_seconds;

            let scene_type = match scene.template {
                ImmersiveTemplate::IntroPulse => "intro",
                ImmersiveTemplate::GlowCTA => {
                    if let Some(ctx) = &request.business_context {
                        if ctx.delivery_sla_minutes.is_some() {
                            "delivery_cta"
                        } else if ctx.promotion_active.unwrap_or(false) {
                            "promo_cta"
                        } else {
                            "cta"
                        }
                    } else {
                        "cta"
                    }
                }
                ImmersiveTemplate::ARHighlight => "delivery",
                ImmersiveTemplate::ProductShowcase => "benefit",
            }
            .to_string();

            let headline = scene.assets.headline.clone();
            let body = scene.assets.body.clone().or_else(|| scene.assets.subheadline.clone());

            let media_hint = scene
                .assets
                .video_url
                .clone()
                .or_else(|| scene.assets.product_image_url.clone())
                .or_else(|| scene.assets.background_url.clone());

            scenes.push(StoryboardScene {
                index,
                scene_type,
                headline,
                body,
                duration_hint_seconds: duration_seconds,
                media_hint,
            });
        }

        Storyboard {
            template_id: result.analytics.selected_template.clone(),
            total_duration_seconds,
            scenes,
            warnings: result.warnings.clone(),
        }
    }

    fn evaluate_business_context(
        &self,
        spec: &StoryTemplateSpec,
        context: &TimelineBusinessContext,
    ) -> TemplateEvaluation {
        let mut score = 0;
        let mut reasons = Vec::new();

        if let Some(category) = &context.service_category {
            if spec.recommended_categories.iter().any(|cat| cat.eq_ignore_ascii_case(category)) {
                score += 6;
                reasons.push(format!("category:{}", category));
            }
        }

        if let Some(tone) = &context.tone {
            if spec.tones.iter().any(|value| value.eq_ignore_ascii_case(tone)) {
                score += 4;
                reasons.push(format!("tone:{}", tone));
            }
        }

        if let Some(cta) = &context.cta_label {
            if spec.ctas.iter().any(|value| value.eq_ignore_ascii_case(cta)) {
                score += 3;
                reasons.push(format!("cta:{}", cta));
            }
        }

        if let Some(sla) = context.delivery_sla_minutes {
            if sla <= 30 && (spec.id == "testimonial" || spec.id == "tutorial") {
                score += 4;
                reasons.push(format!("sla:{}", sla));
            } else if sla > 60 && spec.id == "comparison" {
                score += 2;
                reasons.push(format!("sla_long:{}", sla));
            } else if sla >= 90 && spec.id == "blog" {
                score += 1;
                reasons.push(format!("sla_editorial:{}", sla));
            }
        }

        if let Some(stock) = context.stock_level {
            if stock <= 3 {
                if spec.id == "comparison" {
                    score += 5;
                    reasons.push("stock_critique".to_string());
                } else {
                    score += 3;
                    reasons.push("stock_limite".to_string());
                }
            } else if stock >= 20 && spec.id == "tutorial" {
                score += 2;
                reasons.push("stock_abondant".to_string());
            }
        }

        if context.promotion_active.unwrap_or(false) {
            if spec.id == "comparison" {
                score += 4;
                reasons.push("promotion_active".to_string());
            } else {
                score += 1;
                reasons.push("promotion_info".to_string());
            }
        }

        if let Some(price) = &context.price_label {
            if !price.trim().is_empty() && spec.id == "comparison" {
                score += 2;
                reasons.push("price_visible".to_string());
            }
        }

        if let Some(segment) = &context.target_audience {
            let lower = segment.to_lowercase();
            if lower.contains("communaut") || lower.contains("fidél") || lower.contains("community")
            {
                if spec.id == "testimonial" {
                    score += 3;
                    reasons.push("audience_communaute".to_string());
                }
            }
            if lower.contains("b2b") || lower.contains("profession") {
                if spec.id == "comparison" || spec.id == "blog" {
                    score += 2;
                    reasons.push("audience_b2b".to_string());
                }
            }
        }

        TemplateEvaluation { score, reasons }
    }

    fn derive_ai_recommendations(&self, context: &TimelineBusinessContext) -> Vec<String> {
        let mut hints: Vec<String> = Vec::new();

        if context.promotion_active.unwrap_or(false) || context.price_label.is_some() {
            hints.push("comparison".to_string());
        }
        if let Some(tone) = &context.tone {
            if tone.to_lowercase().contains("edu") {
                hints.push("tutorial".to_string());
            }
            if tone.to_lowercase().contains("trust") || tone.to_lowercase().contains("commun") {
                hints.push("testimonial".to_string());
            }
        }
        if let Some(audience) = &context.target_audience {
            let lower = audience.to_lowercase();
            if lower.contains("community") || lower.contains("loyal") {
                hints.push("testimonial".to_string());
            }
            if lower.contains("b2b") {
                hints.push("comparison".to_string());
            }
        }
        if hints.is_empty() {
            if let Some(category) = &context.service_category {
                if category.to_lowercase().contains("coaching")
                    || category.to_lowercase().contains("digital")
                {
                    hints.push("blog".to_string());
                }
            }
        }

        hints.push("blog".to_string());
        hints.push("tutorial".to_string());

        let mut deduped: Vec<String> = Vec::new();
        for hint in hints {
            if !deduped.iter().any(|value| value.eq_ignore_ascii_case(&hint)) {
                deduped.push(hint);
            }
        }
        deduped
    }
}

fn create_intro_scene(
    request: &TimelineRequest,
    duration_in_frames: u32,
    style: Option<String>,
) -> ImmersiveScene {
    let headline = request
        .headline
        .clone()
        .filter(|h| !h.trim().is_empty())
        .unwrap_or_else(|| format!("Découvrez {}", request.product_name));

    let subheadline = request
        .style
        .clone()
        .or(style)
        .unwrap_or_else(|| "Expérience immersive Yukpo".to_string());

    ImmersiveScene {
        id: "scene_intro".to_string(),
        template: ImmersiveTemplate::IntroPulse,
        duration_in_frames,
        assets: ImmersiveSceneAssets {
            headline: Some(headline),
            subheadline: Some(subheadline),
            ..Default::default()
        },
        transition: ImmersiveSceneTransition {
            r#type: TransitionType::Orbit3d,
            duration_in_frames: 18,
        },
        color_grade: Some(ImmersiveSceneColorGrade {
            style: ColorGradeStyle::Cinematic,
            intensity: 0.65,
        }),
    }
}

fn create_cta_scene(request: &TimelineRequest, duration_in_frames: u32) -> ImmersiveScene {
    let cta_text = request
        .call_to_action
        .clone()
        .filter(|cta| !cta.trim().is_empty())
        .unwrap_or_else(|| "Réserve ta session immersive Yukpo".to_string());

    ImmersiveScene {
        id: "scene_cta".to_string(),
        template: ImmersiveTemplate::GlowCTA,
        duration_in_frames,
        assets: ImmersiveSceneAssets {
            headline: Some(cta_text),
            subheadline: Some("Disponible dans Yukpo Studio".to_string()),
            ..Default::default()
        },
        transition: ImmersiveSceneTransition {
            r#type: TransitionType::SpeedRamp,
            duration_in_frames: 24,
        },
        color_grade: Some(ImmersiveSceneColorGrade {
            style: ColorGradeStyle::Glow,
            intensity: 0.7,
        }),
    }
}

fn increment_template(map: &mut HashMap<String, usize>, template: &str) {
    *map.entry(template.to_string()).or_insert(0) += 1;
}

fn template_name(template: &ImmersiveTemplate) -> &'static str {
    match template {
        ImmersiveTemplate::IntroPulse => "IntroPulse",
        ImmersiveTemplate::ProductShowcase => "ProductShowcase",
        ImmersiveTemplate::ARHighlight => "ARHighlight",
        ImmersiveTemplate::GlowCTA => "GlowCTA",
    }
}
