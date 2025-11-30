// ✅ NOUVEAU: Module de conversion entre VideoTimeline (IA) et ImmersiveTimeline (Remotion)

use serde_json::Value;
use crate::services::{
    app_ia::{TimelineScene, VideoTimeline},
    immersive_timeline::{
        ImmersiveTimeline, ImmersiveScene, ImmersiveSceneAssets, ImmersiveSceneTransition,
        ImmersiveTemplate, TransitionType, ColorGradeStyle, ImmersiveSceneColorGrade,
        ImmersiveAudioCue, AudioCueKind,
    },
};
use crate::core::types::{AppError, AppResult};
use log::{info, warn};

/// Convertit une VideoTimeline (générée par l'IA) en ImmersiveTimeline (pour Remotion)
pub fn convert_video_timeline_to_immersive(
    video_timeline: &VideoTimeline,
    fps: u32,
) -> AppResult<ImmersiveTimeline> {
    info!(
        "[TimelineConverter] Conversion de {} scènes vers ImmersiveTimeline (fps: {})",
        video_timeline.scenes.len(),
        fps
    );

    let mut immersive_scenes: Vec<ImmersiveScene> = Vec::new();
    let mut audio_cues: Vec<ImmersiveAudioCue> = Vec::new();

    for (idx, scene) in video_timeline.scenes.iter().enumerate() {
        let duration_frames = (scene.duration * fps as f64).round() as u32;
        
        // Déterminer le template selon le type de scène
        let template = infer_template_from_scene(scene, idx, video_timeline.scenes.len());
        
        // Construire les assets
        let assets = ImmersiveSceneAssets {
            headline: scene.text.clone(),
            subheadline: None,
            body: None,
            product_image_url: scene.media_url.clone(),
            background_url: None,
            video_url: if scene.media_url.as_ref()
                .map(|url| url.contains(".mp4") || url.contains(".mov"))
                .unwrap_or(false) {
                scene.media_url.clone()
            } else {
                None
            },
            stickers: None,
        };

        // Convertir la transition
        let transition = convert_transition(scene.transition.as_deref());

        // Convertir les effets en color grade
        let color_grade = if !scene.effects.is_empty() {
            Some(convert_effects_to_color_grade(&scene.effects))
        } else {
            None
        };

        // Créer la scène immersive
        let immersive_scene = ImmersiveScene {
            id: format!("scene_{}", scene.scene_index),
            template,
            duration_in_frames: duration_frames.max(30), // Minimum 1 seconde à 30fps
            assets,
            transition,
            color_grade,
        };

        immersive_scenes.push(immersive_scene);

        // Ajouter les audio cues si présents
        if let Some(audio_cue_time) = scene.audio_cue {
            let cue_frame = (audio_cue_time * fps as f64).round() as u32;
            audio_cues.push(ImmersiveAudioCue {
                id: format!("cue_{}", idx),
                start_frame: cue_frame,
                cue_type: infer_audio_cue_type(&scene.effects),
            });
        }
    }

    // Créer la timeline immersive
    let immersive_timeline = ImmersiveTimeline {
        fps,
        width: 1080,
        height: 1920, // Format vertical 9:16
        audio_cue_map: if audio_cues.is_empty() {
            None
        } else {
            Some(audio_cues)
        },
        scenes: immersive_scenes,
    };

    info!(
        "[TimelineConverter] ✅ Conversion réussie: {} scènes, {} frames total",
        immersive_timeline.scenes.len(),
        immersive_timeline.total_frames()
    );

    Ok(immersive_timeline)
}

/// Convertit une timeline JSON (depuis le payload) en ImmersiveTimeline
pub fn convert_timeline_json_to_immersive(
    timeline_json: &Value,
    fps: u32,
) -> AppResult<ImmersiveTimeline> {
    // Essayer de parser comme VideoTimeline d'abord
    if let Ok(video_timeline) = serde_json::from_value::<VideoTimeline>(timeline_json.clone()) {
        return convert_video_timeline_to_immersive(&video_timeline, fps);
    }

    // Sinon, essayer de parser directement comme ImmersiveTimeline
    match serde_json::from_value::<ImmersiveTimeline>(timeline_json.clone()) {
        Ok(timeline) => {
            info!("[TimelineConverter] Timeline déjà au format ImmersiveTimeline");
            Ok(timeline)
        }
        Err(err) => {
            warn!(
                "[TimelineConverter] ⚠️ Impossible de parser timeline JSON: {}",
                err
            );
            Err(AppError::Internal(format!(
                "Format de timeline invalide: {}",
                err
            )))
        }
    }
}

/// Infère le template ImmersiveTemplate selon le type de scène
fn infer_template_from_scene(
    scene: &TimelineScene,
    index: usize,
    total_scenes: usize,
) -> ImmersiveTemplate {
    // Première scène = Intro
    if index == 0 {
        return ImmersiveTemplate::IntroPulse;
    }

    // Dernière scène = CTA
    if index == total_scenes - 1 {
        return ImmersiveTemplate::GlowCTA;
    }

    // Scène avec média produit = ProductShowcase
    if scene.media_id.is_some() || scene.media_url.is_some() {
        return ImmersiveTemplate::ProductShowcase;
    }

    // Scène avec effets AR/glow = ARHighlight
    if scene.effects.iter().any(|e| {
        e.to_lowercase().contains("glow")
            || e.to_lowercase().contains("ar")
            || e.to_lowercase().contains("highlight")
    }) {
        return ImmersiveTemplate::ARHighlight;
    }

    // Par défaut = ProductShowcase
    ImmersiveTemplate::ProductShowcase
}

/// Convertit une transition string en TransitionType
fn convert_transition(transition_str: Option<&str>) -> ImmersiveSceneTransition {
    let transition_type = match transition_str {
        Some("fade") => TransitionType::HardCut, // Fade sera géré par Remotion
        Some("slide") => TransitionType::Parallax,
        Some("zoom") => TransitionType::Orbit3d,
        Some("speed-ramp") => TransitionType::SpeedRamp,
        _ => TransitionType::HardCut,
    };

    ImmersiveSceneTransition {
        r#type: transition_type,
        duration_in_frames: 12, // ~0.4s à 30fps
    }
}

/// Convertit les effets en ColorGradeStyle
fn convert_effects_to_color_grade(effects: &[String]) -> ImmersiveSceneColorGrade {
    let has_glow = effects.iter().any(|e| {
        e.to_lowercase().contains("glow") || e.to_lowercase().contains("lumière")
    });
    let has_cinematic = effects.iter().any(|e| {
        e.to_lowercase().contains("cinematic")
            || e.to_lowercase().contains("cinéma")
            || e.to_lowercase().contains("cinema")
    });

    let style = if has_glow {
        ColorGradeStyle::Glow
    } else if has_cinematic {
        ColorGradeStyle::Cinematic
    } else {
        ColorGradeStyle::None
    };

    ImmersiveSceneColorGrade {
        style,
        intensity: if has_glow { 0.8 } else { 0.6 },
    }
}

/// Infère le type d'audio cue selon les effets
fn infer_audio_cue_type(effects: &[String]) -> AudioCueKind {
    if effects.iter().any(|e| e.to_lowercase().contains("glitch")) {
        return AudioCueKind::Glitch;
    }
    if effects.iter().any(|e| {
        e.to_lowercase().contains("impact")
            || e.to_lowercase().contains("punch")
            || e.to_lowercase().contains("hit")
    }) {
        return AudioCueKind::Impact;
    }
    if effects.iter().any(|e| {
        e.to_lowercase().contains("rise")
            || e.to_lowercase().contains("build")
            || e.to_lowercase().contains("montée")
    }) {
        return AudioCueKind::Riser;
    }
    if effects.iter().any(|e| {
        e.to_lowercase().contains("beat")
            || e.to_lowercase().contains("rythme")
            || e.to_lowercase().contains("pulse")
    }) {
        return AudioCueKind::Beat;
    }

    // Par défaut = Impact
    AudioCueKind::Impact
}

