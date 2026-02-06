// ✅ NOUVEAU: Service de preview temps réel pour calcul local côté client

use crate::core::types::{AppError, AppResult};
use log::info;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RealtimePreviewRequest {
    pub timeline: Value, // VideoTimeline JSON
    pub current_time: f64,
    pub effects: Option<Vec<String>>,
    pub transitions: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffectParam {
    pub name: String,
    pub intensity: Option<f32>,
    pub parameters: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransitionParam {
    pub r#type: String,
    pub duration: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RealtimePreviewResponse {
    pub success: bool,
    pub scene_index: usize,
    pub scene: Value,
    pub active_effects: Vec<EffectParam>,
    pub transition: Option<TransitionParam>,
    pub should_apply_transition: bool,
    pub media_url: Option<String>,
    pub timestamp: f64,
}

/// Service de preview temps réel qui retourne les paramètres d'effets
/// pour calcul local (pas la vidéo elle-même)
pub struct RealtimePreviewService;

impl RealtimePreviewService {
    pub fn new() -> Self {
        Self
    }

    /// Obtient les paramètres d'effets pour une position dans la timeline
    /// Retourne les paramètres sans la vidéo (pour calcul local)
    pub fn get_effect_params(
        &self,
        request: RealtimePreviewRequest,
    ) -> AppResult<RealtimePreviewResponse> {
        info!(
            "[RealtimePreview] Calcul paramètres effets - current_time: {}s",
            request.current_time
        );

        // Parser la timeline
        let timeline = request.timeline;
        let scenes = timeline.get("scenes").and_then(|s| s.as_array()).ok_or_else(|| {
            AppError::BadRequest("Timeline invalide: 'scenes' manquant".to_string())
        })?;

        // Trouver la scène active
        let mut active_scene_index = 0;
        let mut active_scene = None;

        for (index, scene) in scenes.iter().enumerate() {
            let start_time = scene.get("start_time").and_then(|s| s.as_f64()).unwrap_or(0.0);
            let duration = scene.get("duration").and_then(|d| d.as_f64()).unwrap_or(0.0);

            if request.current_time >= start_time && request.current_time < start_time + duration {
                active_scene_index = index;
                active_scene = Some(scene.clone());
                break;
            }
        }

        let active_scene = active_scene.ok_or_else(|| {
            AppError::BadRequest("Aucune scène trouvée pour le temps spécifié".to_string())
        })?;

        // Extraire les effets de la scène
        let scene_effects = active_scene
            .get("effects")
            .and_then(|e| e.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect::<Vec<String>>()
            })
            .unwrap_or_default();

        let active_effects: Vec<EffectParam> = scene_effects
            .iter()
            .map(|effect_name| EffectParam {
                name: effect_name.clone(),
                intensity: Some(1.0),
                parameters: None,
            })
            .collect();

        // Extraire la transition
        let transition_type = active_scene
            .get("transition")
            .and_then(|t| t.as_str())
            .unwrap_or("none")
            .to_string();

        let transition_duration = 0.5; // Durée par défaut
        let scene_start_time =
            active_scene.get("start_time").and_then(|s| s.as_f64()).unwrap_or(0.0);
        let scene_duration = active_scene.get("duration").and_then(|d| d.as_f64()).unwrap_or(0.0);
        let scene_end_time = scene_start_time + scene_duration;
        let transition_start_time = scene_end_time - transition_duration as f64;

        let (transition, should_apply_transition) =
            if transition_type != "none" && request.current_time >= transition_start_time {
                (
                    Some(TransitionParam {
                        r#type: transition_type,
                        duration: Some(transition_duration),
                    }),
                    true,
                )
            } else {
                (None, false)
            };

        // Extraire l'URL média
        let media_url =
            active_scene.get("media_url").and_then(|u| u.as_str()).map(|s| s.to_string());

        Ok(RealtimePreviewResponse {
            success: true,
            scene_index: active_scene_index,
            scene: active_scene.clone(),
            active_effects,
            transition,
            should_apply_transition,
            media_url,
            timestamp: request.current_time,
        })
    }
}

impl Default for RealtimePreviewService {
    fn default() -> Self {
        Self::new()
    }
}
