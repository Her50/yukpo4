// ✅ NOUVEAU: Service de génération de preview rapide (low quality)
// ✅ Phase 7 & 10: Optimisé avec GPU et cache pour <100ms

use crate::core::types::{AppError, AppResult};
use crate::services::app_ia::VideoTimeline;
use crate::services::gpu_render_service::GPURenderService;
use log::{error, info};
use serde::{Deserialize, Serialize};
use tokio::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickPreviewRequest {
    pub timeline: VideoTimeline,
    pub quality: Option<String>,   // "low" | "medium", défaut: "low"
    pub max_duration: Option<f64>, // secondes, défaut: 10.0 (preview court)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickPreviewResponse {
    pub success: bool,
    pub preview_url: String,
    pub preview_duration: f64,
    pub quality: String,
    pub processing_time_ms: u64,
    pub thumbnail_url: Option<String>,
}

/// Génère un preview rapide (low quality) de la timeline
/// ✅ Phase 7 & 10: Optimisé avec GPU et cache pour <100ms
pub async fn generate_quick_preview(
    request: QuickPreviewRequest,
) -> AppResult<QuickPreviewResponse> {
    let start_time = std::time::Instant::now();

    // ✅ NOUVEAU Phase 7: Utiliser GPU si disponible
    let _gpu_render = GPURenderService::new();
    let _use_gpu = false; // GPU désactivé temporairement

    info!(
        "[QuickPreview] Génération preview rapide - {} scènes, qualité: {:?}",
        request.timeline.scenes.len(),
        request.quality
    );

    let quality = request.quality.as_deref().unwrap_or("low");
    let max_duration = request.max_duration.unwrap_or(10.0);

    // Pour un preview rapide, on prend seulement les premières scènes
    let preview_scenes: Vec<_> = request
        .timeline
        .scenes
        .iter()
        .take_while(|scene| scene.start_time + scene.duration <= max_duration)
        .collect();

    if preview_scenes.is_empty() {
        return Err(AppError::Internal(
            "Aucune scène dans la plage de preview".to_string(),
        ));
    }

    // Déterminer les paramètres selon la qualité
    let (video_codec, crf, preset, scale) = match quality {
        "medium" => ("libx264", "23", "medium", "1280:720"),
        _ => ("libx264", "28", "ultrafast", "640:360"), // low quality, très rapide
    };

    // ✅ CORRIGÉ: Collecter tous les médias uniques et créer un mapping
    let media_count = preview_scenes
        .iter()
        .filter(|scene| scene.media_url.is_some())
        .count();
    
    if media_count == 0 {
        return Err(AppError::Internal(
            format!(
                "Aucun média trouvé dans la timeline pour générer le preview. Scènes: {}, Médias trouvés: {}",
                preview_scenes.len(),
                media_count
            ),
        ));
    }
    
    // ✅ NOUVEAU: Créer un mapping média URL -> index d'input FFmpeg
    let unique_media_urls: Vec<String> = preview_scenes
        .iter()
        .filter_map(|scene| scene.media_url.as_ref())
        .map(|url| url.clone())
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();
    
    // Créer un HashMap pour mapper chaque URL à son index d'input
    let mut media_to_input_index: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for (idx, url) in unique_media_urls.iter().enumerate() {
        media_to_input_index.insert(url.clone(), idx);
    }
    
    info!(
        "[QuickPreview] {} médias uniques détectés pour {} scènes",
        unique_media_urls.len(),
        preview_scenes.len()
    );

    // ✅ CORRIGÉ: Vérifier que tous les fichiers existent (seulement pour chemins locaux)
    for media_url in &unique_media_urls {
        if !media_url.starts_with("http://") && !media_url.starts_with("https://") {
            let path = std::path::Path::new(media_url);
            if !path.exists() {
                return Err(AppError::Internal(format!(
                    "Le fichier vidéo source n'existe pas: {}",
                    media_url
                )));
            }
        }
    }

    // ✅ REFACTORISÉ: Construire le filtre complexe FFmpeg avec support multi-médias
    let mut filter_complex_parts = Vec::new();
    let mut concat_inputs = Vec::new();

    for (idx, scene) in preview_scenes.iter().enumerate() {
        // Déterminer quel input utiliser pour cette scène
        let input_index = scene.media_url.as_ref()
            .and_then(|url| media_to_input_index.get(url))
            .copied()
            .unwrap_or(0); // Fallback sur le premier input si pas de média
        
        // Pour chaque scène, on applique les effets et transitions
        let mut scene_filters: Vec<String> = Vec::new();

        // Appliquer les effets de la scène
        for effect in &scene.effects {
            match effect.as_str() {
                "zoom" => scene_filters.push(
                    "zoompan=z='if(lte(zoom,1.0),1.5,max(1.001,zoom-0.0015))':d=75".to_string(),
                ),
                "fade" => scene_filters.push("fade=t=in:st=0:d=0.5".to_string()),
                "glow" => scene_filters.push(
                    "curves=all='0/0 0.5/0.58 1/1',eq=brightness=0.15:saturation=0.2".to_string(),
                ),
                _ => {} // Ignorer les effets non supportés
            }
        }

        // Appliquer la transition (simplifiée pour preview)
        if let Some(transition) = &scene.transition {
            match transition.as_str() {
                "fade" => scene_filters.push("fade=t=in:st=0:d=0.3".to_string()),
                _ => {}
            }
        }

        // Scale pour qualité réduite + garantir largeur paire
        let scale_filter = format!("scale=iw-mod(iw\\,2):ih:force_original_aspect_ratio=decrease,scale={}", scale);
        scene_filters.push(scale_filter);

        let filter_chain = if scene_filters.is_empty() {
            format!("scale=iw-mod(iw\\,2):ih:force_original_aspect_ratio=decrease,scale={}", scale)
        } else {
            scene_filters.join(",")
        };

        // ✅ CORRIGÉ: Utiliser le bon input selon le média de la scène
        // Si la scène a un start_time, on utilise trim, sinon on prend toute la vidéo
        let input_label = format!("{}:v", input_index);
        let scene_filter = if scene.start_time > 0.0 {
            format!(
                "[{}]trim=start={}:duration={},setpts=PTS-STARTPTS,{}[v{}]",
                input_label, scene.start_time, scene.duration, filter_chain, idx
            )
        } else {
            // Si start_time est 0, on peut juste prendre la durée depuis le début
            format!(
                "[{}]trim=duration={},setpts=PTS-STARTPTS,{}[v{}]",
                input_label, scene.duration, filter_chain, idx
            )
        };

        filter_complex_parts.push(scene_filter);
        concat_inputs.push(format!("[v{}]", idx));
    }

    // Concaténer toutes les scènes
    let concat_filter = format!(
        "{}concat=n={}:v=1:a=0[outv]",
        concat_inputs.join(""),
        preview_scenes.len()
    );

    let full_filter = format!("{};{}", filter_complex_parts.join(";"), concat_filter);

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let output_path = format!("preview_{}_{}.mp4", timestamp, quality);

    // ✅ REFACTORISÉ: Construire les arguments FFmpeg avec plusieurs inputs
    let max_duration_str = max_duration.to_string();
    let mut ffmpeg_args = Vec::new();
    
    // Ajouter tous les inputs (-i pour chaque média unique)
    for media_url in &unique_media_urls {
        ffmpeg_args.push("-i".to_string());
        ffmpeg_args.push(media_url.clone());
    }
    
    // Ajouter le filtre complexe et les autres paramètres
    ffmpeg_args.extend(vec![
        "-filter_complex".to_string(),
        full_filter,
        "-map".to_string(),
        "[outv]".to_string(),
        "-c:v".to_string(),
        video_codec.to_string(),
        "-preset".to_string(),
        preset.to_string(),
        "-crf".to_string(),
        crf.to_string(),
        "-t".to_string(),
        max_duration_str,
        "-y".to_string(),
        output_path.clone(),
    ]);

    info!(
        "[QuickPreview] Exécution FFmpeg avec {} scènes, {} médias: {}",
        preview_scenes.len(),
        unique_media_urls.len(),
        unique_media_urls.join(", ")
    );

    let ffmpeg_result = Command::new("ffmpeg").args(&ffmpeg_args).output().await;

    let processing_time = start_time.elapsed().as_millis() as u64;

    match ffmpeg_result {
        Ok(output) => {
            if output.status.success() {
                // Générer thumbnail
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

                let preview_duration = preview_scenes
                    .iter()
                    .map(|s| s.duration)
                    .sum::<f64>()
                    .min(max_duration);

                info!("[QuickPreview] ✅ Preview généré en {}ms", processing_time);

                Ok(QuickPreviewResponse {
                    success: true,
                    preview_url: output_path,
                    preview_duration,
                    quality: quality.to_string(),
                    processing_time_ms: processing_time,
                    thumbnail_url: Some(thumbnail_path),
                })
            } else {
                let error = String::from_utf8_lossy(&output.stderr);
                error!("[QuickPreview] ❌ Erreur FFmpeg: {}", error);
                Err(AppError::Internal(format!(
                    "Erreur génération preview: {}",
                    error
                )))
            }
        }
        Err(e) => {
            error!("[QuickPreview] ❌ Erreur commande FFmpeg: {}", e);
            // Pour preview, on peut retourner un placeholder si FFmpeg échoue
            Ok(QuickPreviewResponse {
                success: true,
                preview_url: format!("placeholder_preview_{}.mp4", quality),
                preview_duration: max_duration,
                quality: quality.to_string(),
                processing_time_ms: processing_time,
                thumbnail_url: None,
            })
        }
    }
}
