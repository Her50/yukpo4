use std::collections::HashMap;
use std::sync::Arc;

use log::info;
use serde::Serialize;

use crate::{
    core::types::{AppError, AppResult},
    services::immersive_timeline::{
        AudioCueKind, ColorGradeStyle, ImmersiveAudioCue, ImmersiveContext, ImmersivePlan,
        ImmersiveScene, ImmersiveSceneAssets, ImmersiveSceneColorGrade, ImmersiveSceneTransition,
        ImmersiveTemplate, ImmersiveTimeline, TransitionType,
    },
    state::AppState,
};

#[derive(Debug, Clone)]
pub struct TimelineBrollAsset {
    pub path: String,
    pub format: String,
    pub source: String,
    pub duration_seconds: f32,
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
}

#[derive(Debug, Clone, Serialize)]
pub struct TimelineAnalytics {
    pub total_scenes: usize,
    pub broll_clips_used: usize,
    pub broll_sources: HashMap<String, usize>,
    pub broll_formats: HashMap<String, usize>,
    pub template_breakdown: HashMap<String, usize>,
    pub estimated_frames: u32,
}

#[derive(Debug, Clone)]
pub struct TimelineResult {
    pub plan: ImmersivePlan,
    pub timeline: ImmersiveTimeline,
    pub analytics: TimelineAnalytics,
    pub warnings: Vec<String>,
}

pub struct ImmersiveOrchestrator;

impl ImmersiveOrchestrator {
    pub fn new(_state: Arc<AppState>) -> Self {
        Self
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

        let script_count = request.script_outline.len();
        let total_scenes = script_count + 2; // intro + contenu + CTA
        let context = ImmersiveContext {
            slide_count: total_scenes,
            style: request.style.clone(),
        };
        let plan = self.build_plan(&context)?;

        let fps = 30;
        let total_duration = request.duration_seconds.max(12.0);
        let per_scene_seconds = (total_duration / total_scenes as f32).clamp(3.0, 9.5);
        let per_scene_frames = (per_scene_seconds * fps as f32).round().max(15.0) as u32;

        let mut scenes: Vec<ImmersiveScene> = Vec::new();
        let mut warnings: Vec<String> = Vec::new();
        let mut template_breakdown: HashMap<String, usize> = HashMap::new();
        let mut broll_formats: HashMap<String, usize> = HashMap::new();
        let mut broll_sources: HashMap<String, usize> = HashMap::new();
        let mut broll_iter = request.broll_assets.iter();
        let mut broll_used = 0usize;

        // Intro scene
        scenes.push(create_intro_scene(
            &request,
            per_scene_frames,
            request.style.clone(),
        ));
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

            if plan.should_inject_broll(scene_index) {
                if let Some(asset) = broll_iter.next() {
                    scene_assets.video_url = Some(asset.path.clone());
                    scene_assets.background_url = Some(asset.path.clone());
                    template = ImmersiveTemplate::ARHighlight;
                    transition.r#type = TransitionType::Orbit3d;
                    color_grade = Some(ImmersiveSceneColorGrade {
                        style: ColorGradeStyle::Glow,
                        intensity: 0.5,
                    });
                    *broll_sources.entry(asset.source.clone()).or_insert(0) += 1;
                    *broll_formats.entry(asset.format.clone()).or_insert(0) += 1;
                    broll_used += 1;
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
        scenes.push(create_cta_scene(&request, per_scene_frames));
        increment_template(&mut template_breakdown, "GlowCTA");

        let mut audio_cues: Vec<ImmersiveAudioCue> = Vec::new();
        let mut current_frame: u32 = 0;
        for (idx, scene) in scenes.iter().enumerate() {
            let cue_type = if idx == 0 {
                AudioCueKind::Riser
            } else if idx == scenes.len() - 1 {
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
            current_frame += scene.duration_in_frames;
        }

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
        };

        info!(
            "[ImmersiveOrchestrator] timeline générée (scenes={}, broll={})",
            analytics.total_scenes, analytics.broll_clips_used
        );

        Ok(TimelineResult {
            plan,
            timeline,
            analytics,
            warnings,
        })
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
