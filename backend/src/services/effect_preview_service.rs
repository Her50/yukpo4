// ✅ NOUVEAU: Service de génération de previews d'effets à la demande

use crate::core::types::{AppError, AppResult};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use tokio::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffectPreviewRequest {
    pub effect_name: String,
    pub sample_media_url: String,
    pub duration: Option<f64>,   // secondes, défaut: 3.0
    pub quality: Option<String>, // "low" | "medium" | "high", défaut: "low"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffectPreviewResponse {
    pub success: bool,
    pub preview_url: String,
    pub effect_name: String,
    pub description: String,
    pub thumbnail_url: Option<String>,
    pub processing_time_ms: u64,
}

/// Liste des effets disponibles avec leurs paramètres FFmpeg
fn get_effect_definitions() -> std::collections::HashMap<&'static str, EffectDefinition> {
    let mut m = std::collections::HashMap::new();

    // Effets de base
    m.insert(
        "zoom",
        EffectDefinition {
            ffmpeg_filter: "zoompan=z='if(lte(zoom,1.0),1.5,max(1.001,zoom-0.0015))':d=75"
                .to_string(),
            description: "Zoom progressif pour créer un effet dynamique".to_string(),
        },
    );

    m.insert(
        "fade",
        EffectDefinition {
            ffmpeg_filter: "fade=t=in:st=0:d=0.5,fade=t=out:st=2.5:d=0.5".to_string(),
            description: "Fondu en entrée et sortie pour transition douce".to_string(),
        },
    );

    m.insert(
        "glow",
        EffectDefinition {
            ffmpeg_filter: "curves=all='0/0 0.5/0.58 1/1',eq=brightness=0.15:saturation=0.2"
                .to_string(),
            description: "Effet lumineux avec saturation augmentée".to_string(),
        },
    );

    m.insert(
        "blur",
        EffectDefinition {
            ffmpeg_filter: "boxblur=2:1".to_string(),
            description: "Flou doux pour effet artistique".to_string(),
        },
    );

    m.insert(
        "sharpen",
        EffectDefinition {
            ffmpeg_filter: "unsharp=5:5:1.0:5:5:0.0".to_string(),
            description: "Renforcement des détails pour netteté accrue".to_string(),
        },
    );

    m.insert(
        "vintage",
        EffectDefinition {
            ffmpeg_filter: "curves=all='0/0 0.5/0.45 1/1',eq=saturation=0.7:contrast=1.2"
                .to_string(),
            description: "Effet vintage avec couleurs désaturées".to_string(),
        },
    );

    m.insert(
        "neon",
        EffectDefinition {
            ffmpeg_filter: "eq=brightness=0.2:contrast=1.5:saturation=2.0".to_string(),
            description: "Effet néon avec couleurs vives et contrastées".to_string(),
        },
    );

    m.insert(
        "blackwhite",
        EffectDefinition {
            ffmpeg_filter: "hue=s=0".to_string(),
            description: "Conversion noir et blanc élégante".to_string(),
        },
    );

    m.insert(
        "warm",
        EffectDefinition {
            ffmpeg_filter: "colorbalance=rs=0.3:gs=0:bs=-0.3".to_string(),
            description: "Tons chauds pour ambiance accueillante".to_string(),
        },
    );

    m.insert(
        "cool",
        EffectDefinition {
            ffmpeg_filter: "colorbalance=rs=-0.2:gs=0:bs=0.2".to_string(),
            description: "Tons froids pour ambiance moderne".to_string(),
        },
    );

    m
}

/// Récupère la définition d'un effet (fallback hardcodé si DB non disponible)
fn get_effect_definition(effect_name: &str) -> Option<EffectDefinition> {
    get_effect_definitions().get(effect_name).cloned()
}

/// Récupère la définition d'un effet depuis la base de données
/// Fallback vers définitions hardcodées si DB non disponible
pub async fn get_effect_definition_from_db(
    pool: &sqlx::PgPool,
    effect_name: &str,
) -> Option<EffectDefinition> {
    // Essayer de charger depuis la DB
    match sqlx::query_as::<_, (String, String)>(
        "SELECT ffmpeg_filter, description FROM effects WHERE name = $1 LIMIT 1",
    )
    .bind(effect_name)
    .fetch_optional(pool)
    .await
    {
        Ok(Some((filter, description))) => {
            return Some(EffectDefinition {
                ffmpeg_filter: filter,
                description,
            });
        }
        Ok(None) => {
            // Pas trouvé en DB, essayer fallback hardcodé
            return get_effect_definition(effect_name);
        }
        Err(e) => {
            warn!(
                "[EffectPreview] Erreur DB pour effet '{}', utilisation fallback: {}",
                effect_name, e
            );
            // Fallback vers définitions hardcodées
            return get_effect_definition(effect_name);
        }
    }
}

#[derive(Debug, Clone)]
pub struct EffectDefinition {
    ffmpeg_filter: String,
    description: String,
}

/// Génère un preview d'effet appliqué sur un média sample
pub async fn generate_effect_preview(
    request: EffectPreviewRequest,
) -> AppResult<EffectPreviewResponse> {
    let start_time = std::time::Instant::now();

    info!(
        "[EffectPreview] Génération preview - effet: {}, media: {}",
        request.effect_name, request.sample_media_url
    );

    // Récupérer la définition de l'effet
    let effect_def = get_effect_definition(&request.effect_name)
        .ok_or_else(|| AppError::Internal(format!("Effet '{}' non trouvé", request.effect_name)))?;

    let duration = request.duration.unwrap_or(3.0);
    let quality = request.quality.as_deref().unwrap_or("low");

    // Déterminer les paramètres de qualité
    let (video_codec, crf, preset) = match quality {
        "high" => ("libx264", "18", "slow"),
        "medium" => ("libx264", "23", "medium"),
        _ => ("libx264", "28", "ultrafast"), // low quality, rapide
    };

    // Générer le nom du fichier de sortie
    let output_path = format!(
        "{}_preview_{}_{}.mp4",
        request.sample_media_url, request.effect_name, quality
    );

    // Appliquer l'effet avec FFmpeg
    let ffmpeg_result = Command::new("ffmpeg")
        .args(&[
            "-i",
            &request.sample_media_url,
            "-vf",
            &effect_def.ffmpeg_filter,
            "-t",
            &duration.to_string(),
            "-c:v",
            video_codec,
            "-preset",
            preset,
            "-crf",
            crf,
            "-c:a",
            "copy",
            "-y", // Overwrite
            &output_path,
        ])
        .output()
        .await;

    let processing_time = start_time.elapsed().as_millis() as u64;

    match ffmpeg_result {
        Ok(output) => {
            if output.status.success() {
                info!("[EffectPreview] ✅ Preview généré: {}", output_path);

                // Générer une thumbnail
                let thumbnail_path = format!("{}_thumb.jpg", output_path);
                let _ = Command::new("ffmpeg")
                    .args(&[
                        "-i",
                        &output_path,
                        "-ss",
                        "00:00:01",
                        "-vframes",
                        "1",
                        "-y",
                        &thumbnail_path,
                    ])
                    .output()
                    .await;

                Ok(EffectPreviewResponse {
                    success: true,
                    preview_url: output_path,
                    effect_name: request.effect_name,
                    description: effect_def.description.clone(),
                    thumbnail_url: Some(thumbnail_path),
                    processing_time_ms: processing_time,
                })
            } else {
                let error = String::from_utf8_lossy(&output.stderr);
                error!("[EffectPreview] ❌ Erreur FFmpeg: {}", error);
                Err(AppError::Internal(format!(
                    "Erreur génération preview: {}",
                    error
                )))
            }
        }
        Err(e) => {
            error!("[EffectPreview] ❌ Erreur commande FFmpeg: {}", e);
            Err(AppError::Internal(format!("Erreur FFmpeg: {}", e)))
        }
    }
}

/// Génère plusieurs previews d'effets en batch
pub async fn generate_effect_previews_batch(
    effect_names: Vec<String>,
    sample_media_url: String,
) -> AppResult<Vec<EffectPreviewResponse>> {
    let mut previews = Vec::new();

    for effect_name in effect_names {
        match generate_effect_preview(EffectPreviewRequest {
            effect_name: effect_name.clone(),
            sample_media_url: sample_media_url.clone(),
            duration: Some(3.0),
            quality: Some("low".to_string()),
        })
        .await
        {
            Ok(preview) => previews.push(preview),
            Err(e) => {
                warn!("[EffectPreview] ⚠️ Erreur preview {}: {}", effect_name, e);
                // Continuer avec les autres effets
            }
        }
    }

    Ok(previews)
}
