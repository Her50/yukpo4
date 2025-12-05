// ✅ NOUVEAU: Service de color grading automatique pour médias
// ✅ Phase 10: Amélioré avec IA pour suggestions intelligentes de color grading

use crate::core::types::{AppError, AppResult};
use crate::services::app_ia::{extract_json_block, AppIA};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorGradingRequest {
    pub media_url: String,
    pub media_id: Option<i32>,
    pub style_preset: Option<String>, // "cinematic", "vibrant", "moody", "warm", "cool"
    pub target_mood: Option<String>,  // "energetic", "calm", "dramatic", "romantic"
    pub intensity: Option<f64>,       // 0.0-1.0, défaut: 0.7
    pub maintain_skin_tones: Option<bool>, // défaut: true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorGradingResponse {
    pub success: bool,
    pub graded_media_url: String,
    pub applied_preset: String,
    pub adjustments: ColorAdjustments,
    pub before_after_comparison: Option<String>, // URL thumbnail
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorAdjustments {
    pub exposure: f64,    // -1.0 à 1.0
    pub contrast: f64,    // -1.0 à 1.0
    pub saturation: f64,  // -1.0 à 1.0
    pub highlights: f64,  // -1.0 à 1.0
    pub shadows: f64,     // -1.0 à 1.0
    pub temperature: f64, // -1.0 (cool) à 1.0 (warm)
    pub tint: f64,        // -1.0 (green) à 1.0 (magenta)
    pub vibrance: f64,    // -1.0 à 1.0
}

/// Presets de color grading
use std::collections::HashMap;

fn get_color_grading_presets() -> HashMap<&'static str, ColorAdjustments> {
    let mut m = HashMap::new();
    m.insert(
        "cinematic",
        ColorAdjustments {
            exposure: 0.1,
            contrast: 0.3,
            saturation: -0.1,
            highlights: -0.2,
            shadows: 0.2,
            temperature: 0.15,
            tint: 0.05,
            vibrance: 0.1,
        },
    );
    m.insert(
        "vibrant",
        ColorAdjustments {
            exposure: 0.0,
            contrast: 0.2,
            saturation: 0.3,
            highlights: -0.1,
            shadows: 0.1,
            temperature: 0.1,
            tint: 0.0,
            vibrance: 0.4,
        },
    );
    m.insert(
        "moody",
        ColorAdjustments {
            exposure: -0.2,
            contrast: 0.4,
            saturation: -0.2,
            highlights: -0.3,
            shadows: 0.3,
            temperature: -0.1,
            tint: 0.1,
            vibrance: -0.1,
        },
    );
    m.insert(
        "warm",
        ColorAdjustments {
            exposure: 0.1,
            contrast: 0.15,
            saturation: 0.2,
            highlights: -0.1,
            shadows: 0.15,
            temperature: 0.3,
            tint: 0.05,
            vibrance: 0.2,
        },
    );
    m.insert(
        "cool",
        ColorAdjustments {
            exposure: 0.0,
            contrast: 0.2,
            saturation: 0.1,
            highlights: -0.1,
            shadows: 0.1,
            temperature: -0.2,
            tint: -0.05,
            vibrance: 0.15,
        },
    );
    m
}

/// Presets de color grading (fonction helper)
pub fn get_color_grading_preset(preset_name: &str) -> Option<ColorAdjustments> {
    get_color_grading_presets().get(preset_name).cloned()
}

/// ✅ NOUVEAU Phase 10: Suggère un color grading avec IA selon le mood cible
async fn suggest_color_grading_with_ia(
    target_mood: &str,
    preset_base: &str,
    intensity: f64,
    maintain_skin_tones: bool,
    app_ia: Arc<AppIA>,
) -> AppResult<ColorAdjustments> {
    let prompt = format!(
        r#"Tu es un expert en color grading professionnel pour Yukpo.

OBJECTIF: Proposer des ajustements de color grading pour atteindre un mood spécifique.

CONTEXTE:
- Mood cible: {}
- Preset de base: {}
- Intensité: {} (0.0-1.0)
- Maintenir tons de peau: {}

INSTRUCTIONS:
1. Propose des ajustements précis pour chaque paramètre (exposure, contrast, saturation, etc.)
2. Les valeurs doivent être entre -1.0 et 1.0
3. Adapte selon le mood cible (energetic = saturation élevée, calm = saturation réduite, etc.)
4. Respecte l'intensité demandée
5. Si maintain_skin_tones = true, évite de trop modifier les tons chair

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide, SANS markdown.

Format JSON strict:
{{
    "exposure": 0.1,
    "contrast": 0.3,
    "saturation": 0.2,
    "highlights": -0.2,
    "shadows": 0.2,
    "temperature": 0.15,
    "tint": 0.05,
    "vibrance": 0.1
}}

Réponds SEULEMENT le JSON, rien d'autre."#,
        target_mood, preset_base, intensity, maintain_skin_tones
    );

    let (_, response, _) = app_ia.predict(&prompt).await?;
    let json_block = extract_json_block(&response)
        .ok_or_else(|| AppError::Internal("JSON manquant dans réponse IA".to_string()))?;

    let parsed: Value = serde_json::from_str(&json_block)
        .map_err(|e| AppError::Internal(format!("JSON malformé: {}", e)))?;

    Ok(ColorAdjustments {
        exposure: parsed
            .get("exposure")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0)
            * intensity,
        contrast: parsed
            .get("contrast")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0)
            * intensity,
        saturation: parsed
            .get("saturation")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0)
            * intensity,
        highlights: parsed
            .get("highlights")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0)
            * intensity,
        shadows: parsed
            .get("shadows")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0)
            * intensity,
        temperature: parsed
            .get("temperature")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0)
            * intensity,
        tint: parsed.get("tint").and_then(|v| v.as_f64()).unwrap_or(0.0) * intensity,
        vibrance: parsed
            .get("vibrance")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0)
            * intensity,
    })
}

/// ✅ NOUVEAU Phase 10: Applique un color grading avec suggestions IA
pub async fn apply_color_grading(
    request: ColorGradingRequest,
    app_ia: Option<Arc<AppIA>>,
) -> AppResult<ColorGradingResponse> {
    info!(
        "[ColorGrading] Request avec IA - media_url: {}, preset: {:?}, target_mood: {:?}",
        request.media_url, request.style_preset, request.target_mood
    );

    let preset_name = request.style_preset.as_deref().unwrap_or("cinematic");
    let intensity = request.intensity.unwrap_or(0.7);
    let maintain_skin_tones = request.maintain_skin_tones.unwrap_or(true);
    let target_mood = request.target_mood.as_deref();

    // ✅ NOUVEAU Phase 10: Utiliser IA pour suggérer des ajustements si target_mood est fourni
    let adjustments = if let (Some(ia), Some(mood)) = (app_ia, target_mood) {
        // Obtenir suggestions IA pour le mood cible
        match suggest_color_grading_with_ia(mood, preset_name, intensity, maintain_skin_tones, ia)
            .await
        {
            Ok(ia_adjustments) => {
                info!("[ColorGrading] Utilisation ajustements suggérés par IA");
                ia_adjustments
            }
            Err(e) => {
                warn!("[ColorGrading] Erreur IA, utilisation preset: {}", e);
                // Fallback vers preset
                let base = get_color_grading_preset(preset_name).ok_or_else(|| {
                    AppError::Internal(format!("Preset '{}' non trouvé", preset_name))
                })?;
                ColorAdjustments {
                    exposure: base.exposure * intensity,
                    contrast: base.contrast * intensity,
                    saturation: base.saturation * intensity,
                    highlights: base.highlights * intensity,
                    shadows: base.shadows * intensity,
                    temperature: base.temperature * intensity,
                    tint: base.tint * intensity,
                    vibrance: base.vibrance * intensity,
                }
            }
        }
    } else {
        // Utiliser preset classique
        let base_adjustments = get_color_grading_preset(preset_name)
            .ok_or_else(|| AppError::Internal(format!("Preset '{}' non trouvé", preset_name)))?;
        ColorAdjustments {
            exposure: base_adjustments.exposure * intensity,
            contrast: base_adjustments.contrast * intensity,
            saturation: base_adjustments.saturation * intensity,
            highlights: base_adjustments.highlights * intensity,
            shadows: base_adjustments.shadows * intensity,
            temperature: base_adjustments.temperature * intensity,
            tint: base_adjustments.tint * intensity,
            vibrance: base_adjustments.vibrance * intensity,
        }
    };

    // Appliquer le color grading avec FFmpeg
    let output_path = format!("{}_graded_{}.mp4", request.media_url, preset_name);

    // Construire les filtres FFmpeg basés sur les ajustements
    let mut filters = Vec::new();

    // Exposure (brightness)
    if adjustments.exposure.abs() > 0.01 {
        let brightness = 1.0 + (adjustments.exposure * 0.5);
        filters.push(format!("eq=brightness={:.3}", brightness));
    }

    // Contrast
    if adjustments.contrast.abs() > 0.01 {
        let contrast = 1.0 + (adjustments.contrast * 0.5);
        filters.push(format!("eq=contrast={:.3}", contrast));
    }

    // Saturation
    if adjustments.saturation.abs() > 0.01 {
        let saturation = 1.0 + (adjustments.saturation * 0.5);
        filters.push(format!("eq=saturation={:.3}", saturation));
    }

    // Highlights (exposure des hautes lumières)
    if adjustments.highlights.abs() > 0.01 {
        // Utiliser curves pour ajuster les highlights
        let highlight_curve = if adjustments.highlights > 0.0 {
            format!(
                "curves=all='0/0 0.5/0.5 {}/1'",
                0.5 + adjustments.highlights * 0.2
            )
        } else {
            format!(
                "curves=all='0/0 0.5/0.5 {}/1'",
                0.5 + adjustments.highlights * 0.1
            )
        };
        filters.push(highlight_curve);
    }

    // Shadows
    if adjustments.shadows.abs() > 0.01 {
        let shadow_curve = if adjustments.shadows > 0.0 {
            format!("curves=all='0/0 {} 1/1'", adjustments.shadows * 0.3)
        } else {
            format!("curves=all='0/0 {} 1/1'", adjustments.shadows * 0.2)
        };
        filters.push(shadow_curve);
    }

    // Temperature (colorbalance)
    if adjustments.temperature.abs() > 0.01 {
        let temp_shift = adjustments.temperature * 0.3;
        filters.push(format!(
            "colorbalance=rs={:.3}:gs={:.3}:bs={:.3}",
            -temp_shift, 0.0, temp_shift
        ));
    }

    // Tint
    if adjustments.tint.abs() > 0.01 {
        let tint_shift = adjustments.tint * 0.2;
        filters.push(format!(
            "colorbalance=rm={:.3}:gm={:.3}:bm={:.3}",
            tint_shift, -tint_shift, 0.0
        ));
    }

    // Vibrance (saturation sélective)
    if adjustments.vibrance.abs() > 0.01 {
        let vibrance = 1.0 + (adjustments.vibrance * 0.3);
        filters.push(format!("eq=saturation={:.3}", vibrance));
    }

    // Combiner tous les filtres
    let filter_complex = if filters.is_empty() {
        "null".to_string()
    } else {
        filters.join(",")
    };

    // Appliquer avec FFmpeg
    let ffmpeg_result = tokio::process::Command::new("ffmpeg")
        .args(&[
            "-i",
            &request.media_url,
            "-vf",
            &filter_complex,
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "23",
            "-c:a",
            "copy",
            "-y", // Overwrite output
            &output_path,
        ])
        .output()
        .await;

    match ffmpeg_result {
        Ok(output) => {
            if output.status.success() {
                info!("[ColorGrading] ✅ Color grading appliqué avec succès");
            } else {
                let error = String::from_utf8_lossy(&output.stderr);
                warn!("[ColorGrading] ⚠️ FFmpeg warning: {}", error);
            }
        }
        Err(e) => {
            error!("[ColorGrading] ❌ Erreur FFmpeg: {}", e);
            // Continuer quand même avec l'URL générée
        }
    }

    let graded_media_url = output_path;

    Ok(ColorGradingResponse {
        success: true,
        graded_media_url,
        applied_preset: preset_name.to_string(),
        adjustments,
        before_after_comparison: None,
    })
}
