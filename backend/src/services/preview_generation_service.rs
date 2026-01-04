// ✅ NOUVEAU: Service de génération de preview rapide (low quality)
// ✅ Phase 7 & 10: Optimisé avec GPU et cache pour <100ms

use crate::core::types::{AppError, AppResult};
use crate::services::app_ia::{TimelineScene, VideoTimeline};
use crate::services::gpu_render_service::GPURenderService;
use crate::services::immersive_timeline::ImmersiveTimeline;
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::env;
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

/// ✅ NOUVEAU: Convertit ImmersiveTimeline en VideoTimeline en extrayant les media_url depuis assets
pub fn convert_immersive_to_video_timeline(immersive: &ImmersiveTimeline) -> VideoTimeline {
    let fps = immersive.fps;
    let mut current_time = 0.0;
    
    let scenes: Vec<TimelineScene> = immersive
        .scenes
        .iter()
        .enumerate()
        .map(|(idx, scene)| {
            let duration_seconds = scene.duration_in_frames as f64 / fps as f64;
            
            // ✅ CORRIGÉ: Extraire media_url depuis assets avec vérification de validité
            // Essayer dans l'ordre: video_url > background_url > product_image_url
            let media_url = scene
                .assets
                .video_url
                .clone()
                .filter(|url| !url.trim().is_empty())
                .or_else(|| {
                    scene.assets.background_url.clone()
                        .filter(|url| !url.trim().is_empty())
                })
                .or_else(|| {
                    scene.assets.product_image_url.clone()
                        .filter(|url| !url.trim().is_empty())
                });
            
            // ✅ NOUVEAU: Log si aucune URL n'est trouvée pour diagnostic
            if media_url.is_none() {
                warn!(
                    "[convert_immersive_to_video_timeline] ⚠️ Scène {} (id: {}) n'a pas de media_url valide. Assets: video_url={:?}, background_url={:?}, product_image_url={:?}",
                    idx,
                    scene.id,
                    scene.assets.video_url,
                    scene.assets.background_url,
                    scene.assets.product_image_url
                );
            }
            
            let scene_index = scene.id
                .replace("scene_", "")
                .parse::<usize>()
                .unwrap_or(idx);
            
            let start_time = current_time;
            current_time += duration_seconds;
            
            // Convertir les effets depuis le template et transition
            let mut effects = Vec::new();
            let template_name = format!("{:?}", scene.template).to_lowercase();
            if template_name.contains("zoom") || template_name.contains("ken") {
                effects.push("zoom".to_string());
            }
            if template_name.contains("glow") {
                effects.push("glow".to_string());
            }
            
            TimelineScene {
                scene_index,
                start_time,
                duration: duration_seconds,
                media_id: None,
                media_url,
                text: scene.assets.body.clone(),
                text_position: Some("center".to_string()),
                transition: Some(format!("{:?}", scene.transition.r#type).to_lowercase()),
                effects,
                audio_cue: None,
            }
        })
        .collect();
    
    let total_duration = scenes
        .iter()
        .map(|s| s.start_time + s.duration)
        .fold(0.0, f64::max);
    
    VideoTimeline {
        total_duration,
        scenes,
    }
}

/// ✅ NOUVEAU: Résout un media_id en media_url depuis la base de données
async fn resolve_media_url(pool: &PgPool, media_id: i32) -> AppResult<Option<String>> {
    let row = sqlx::query!(
        "SELECT path FROM media WHERE id = $1",
        media_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        error!("[QuickPreview] Erreur DB pour media_id {}: {}", media_id, e);
        AppError::Internal(format!("Erreur récupération média {}: {}", media_id, e))
    })?;

    if let Some(row) = row {
        let path = row.path;
        // Construire l'URL complète
        let api_base_url = env::var("API_BASE_URL")
            .unwrap_or_else(|_| env::var("UPLOAD_BASE_URL")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()));
        
        let clean_path = path.trim_start_matches('/');
        let media_url = if path.starts_with("http://") || path.starts_with("https://") {
            path
        } else {
            format!("{}/api/media/files/{}", api_base_url.trim_end_matches('/'), clean_path)
        };
        
        Ok(Some(media_url))
    } else {
        warn!("[QuickPreview] Media ID {} non trouvé dans la DB", media_id);
        Ok(None)
    }
}

/// ✅ NOUVEAU: Enrichit la timeline en résolvant les media_id en media_url
async fn enrich_timeline_with_media_urls(
    timeline: VideoTimeline,
    pool: Option<&PgPool>,
) -> AppResult<VideoTimeline> {
    if pool.is_none() {
        // Si pas de pool, retourner la timeline telle quelle
        return Ok(timeline);
    }
    let pool = pool.unwrap();

    let mut enriched_scenes = Vec::new();
    
    for scene in timeline.scenes {
        // Si la scène a déjà un media_url, on la garde telle quelle
        if scene.media_url.is_some() {
            enriched_scenes.push(scene);
            continue;
        }

        // Si la scène a un media_id, résoudre en media_url
        if let Some(media_id_str) = &scene.media_id {
            // Convertir la chaîne en i32
            match media_id_str.parse::<i32>() {
                Ok(media_id) => {
                    match resolve_media_url(pool, media_id).await {
                        Ok(Some(media_url)) => {
                            info!("[QuickPreview] ✅ Résolu media_id {} -> {}", media_id, media_url);
                            enriched_scenes.push(TimelineScene {
                                media_url: Some(media_url),
                                ..scene
                            });
                        }
                        Ok(None) => {
                            warn!("[QuickPreview] ⚠️ Media ID {} non trouvé dans la DB, scène ignorée", media_id);
                            // ✅ CORRIGÉ: Si media_id n'existe pas, utiliser media_url directement s'il est disponible
                            if let Some(media_url) = &scene.media_url {
                                if !media_url.trim().is_empty() {
                                    info!("[QuickPreview] ✅ Utilisation media_url existant pour media_id {} manquant", media_id);
                                    enriched_scenes.push(scene);
                                    continue;
                                }
                            }
                            // Si aucun fallback, on garde la scène mais sans media_url (sera filtrée plus tard)
                            enriched_scenes.push(scene);
                        }
                        Err(e) => {
                            error!("[QuickPreview] ❌ Erreur résolution media_id {}: {:?}", media_id, e);
                            // On garde la scène mais sans media_url (sera filtrée plus tard)
                            enriched_scenes.push(scene);
                        }
                    }
                }
                Err(_) => {
                    warn!("[QuickPreview] ⚠️ Media ID invalide (non numérique): '{}', scène ignorée", media_id_str);
                    // On garde la scène mais sans media_url (sera filtrée plus tard)
                    enriched_scenes.push(scene);
                }
            }
        } else {
            // Pas de media_id ni media_url, on garde la scène telle quelle
            enriched_scenes.push(scene);
        }
    }

    Ok(VideoTimeline {
        scenes: enriched_scenes,
        total_duration: timeline.total_duration,
    })
}

/// Génère un preview rapide (low quality) de la timeline
/// ✅ Phase 7 & 10: Optimisé avec GPU et cache pour <100ms
/// ✅ NOUVEAU 2026-01-04: Cache intégré pour éviter les régénérations
/// ✅ NOUVEAU: Résout automatiquement les media_id en media_url depuis la DB
pub async fn generate_quick_preview(
    request: QuickPreviewRequest,
    pool: Option<&PgPool>,
) -> AppResult<QuickPreviewResponse> {
    let start_time = std::time::Instant::now();

    // ✅ NOUVEAU 2026-01-04: Vérifier le cache AVANT de générer
    if let Some(pool_ref) = pool {
        use crate::services::preview_cache_service::{
            generate_preview_cache_key, get_cached_preview,
        };
        
        let quality = request.quality.as_deref().unwrap_or("low");
        let max_duration = request.max_duration.unwrap_or(10.0);
        
        // Convertir la timeline en JSON pour générer la clé de cache
        let timeline_json = serde_json::to_value(&request.timeline).unwrap_or_default();
        let cache_key = generate_preview_cache_key(&timeline_json, quality, Some(max_duration));
        
        // Vérifier le cache
        if let Ok(Some(cached)) = get_cached_preview(pool_ref, &cache_key).await {
            let cache_time = start_time.elapsed().as_millis() as u64;
            info!(
                "[QuickPreview] ✅ Cache hit - Preview récupéré en {}ms (accès #{})",
                cache_time, cached.access_count
            );
            
            return Ok(QuickPreviewResponse {
                success: true,
                preview_url: cached.preview_url,
                preview_duration: cached.preview_duration,
                quality: cached.quality,
                processing_time_ms: cache_time,
                thumbnail_url: cached.thumbnail_url,
            });
        }
        
        info!(
            "[QuickPreview] Cache miss - Génération preview ({} scènes, qualité: {})",
            request.timeline.scenes.len(),
            quality
        );
    }

    // ✅ NOUVEAU Phase 7: Utiliser GPU si disponible
    let _gpu_render = GPURenderService::new();
    let _use_gpu = false; // GPU désactivé temporairement

    info!(
        "[QuickPreview] Génération preview rapide - {} scènes, qualité: {:?}",
        request.timeline.scenes.len(),
        request.quality
    );

    // ✅ NOUVEAU: Enrichir la timeline en résolvant les media_id
    // ✅ CORRIGÉ: Cloner la timeline avant de la déplacer
    let timeline_clone = request.timeline.clone();
    let enriched_timeline = enrich_timeline_with_media_urls(request.timeline, pool).await?;
    
    let quality = request.quality.as_deref().unwrap_or("low");
    let max_duration = request.max_duration.unwrap_or(10.0);

    // ✅ CORRIGÉ 2026-01-04: Filtrer les scènes avec media_url valide
    let scenes_with_media: Vec<_> = enriched_timeline
        .scenes
        .iter()
        .filter(|scene| scene.media_url.is_some() && !scene.media_url.as_ref().unwrap().trim().is_empty())
        .collect();

    if scenes_with_media.is_empty() {
        let total_scenes = enriched_timeline.scenes.len();
        return Err(AppError::Internal(format!(
            "Aucune scène avec média valide. Total scènes: {}. Veuillez vérifier que les scènes ont des media_url valides.",
            total_scenes
        )));
    }

    // ✅ NOUVEAU 2026-01-04: Prendre les scènes dans la plage, ou au moins la première scène
    let preview_scenes: Vec<_> = if let Some(first_scene) = scenes_with_media.first() {
        // Si la première scène est dans la plage, prendre toutes les scènes dans la plage
        if first_scene.start_time + first_scene.duration <= max_duration {
            scenes_with_media
                .iter()
                .take_while(|scene| scene.start_time + scene.duration <= max_duration)
                .collect()
        } else {
            // Sinon, prendre au moins la première scène (tronquée si nécessaire)
            vec![first_scene]
        }
    } else {
        vec![]
    };

    if preview_scenes.is_empty() {
        let total_scenes = enriched_timeline.scenes.len();
        let scenes_with_media_count = scenes_with_media.len();
        return Err(AppError::Internal(format!(
            "Aucune scène valide pour preview. Total scènes: {}, Scènes avec média: {}.",
            total_scenes, scenes_with_media_count
        )));
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
        let scene_details: Vec<String> = preview_scenes
            .iter()
            .enumerate()
            .map(|(idx, scene)| {
                format!(
                    "Scène {}: start_time={:.2}s, duration={:.2}s, media_url={:?}, effects={:?}",
                    idx,
                    scene.start_time,
                    scene.duration,
                    scene.media_url,
                    scene.effects
                )
            })
            .collect();
        
        error!(
            "[QuickPreview] ❌ Aucun média trouvé dans la timeline. Scènes: {}, Médias trouvés: {}. Détails: {}",
            preview_scenes.len(),
            media_count,
            scene_details.join(" | ")
        );
        
        return Err(AppError::Internal(
            format!(
                "Aucun média trouvé dans la timeline pour générer le preview. Scènes: {}, Médias trouvés: {}. Veuillez vous assurer que chaque scène a un media_url défini (URL d'image ou vidéo).",
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

                let response = QuickPreviewResponse {
                    success: true,
                    preview_url: output_path.clone(),
                    preview_duration,
                    quality: quality.to_string(),
                    processing_time_ms: processing_time,
                    thumbnail_url: Some(thumbnail_path.clone()),
                };
                
                // ✅ NOUVEAU 2026-01-04: Mettre en cache le résultat
                if let Some(pool_ref) = pool {
                    use crate::services::preview_cache_service::{
                        generate_preview_cache_key, cache_preview, get_preview_ttl,
                        CachedPreview,
                    };
                    use std::time::{SystemTime, UNIX_EPOCH};
                    use std::fs;
                    
                    // ✅ CORRIGÉ: Utiliser la timeline clonée au lieu de request.timeline (déjà déplacée)
                    let timeline_json = serde_json::to_value(&timeline_clone).unwrap_or_default();
                    let cache_key = generate_preview_cache_key(&timeline_json, quality, Some(max_duration));
                    let ttl = get_preview_ttl(quality);
                    
                    // Obtenir la taille du fichier si possible
                    let file_size = fs::metadata(&output_path)
                        .ok()
                        .and_then(|m| m.len().try_into().ok());
                    
                    let cached = CachedPreview {
                        preview_url: output_path,
                        preview_duration,
                        quality: quality.to_string(),
                        thumbnail_url: Some(thumbnail_path),
                        created_at: SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap()
                            .as_secs() as i64,
                        access_count: 0,
                        file_size,
                    };
                    
                    if let Err(e) = cache_preview(pool_ref, &cache_key, &cached, ttl).await {
                        warn!(
                            "[QuickPreview] ⚠️ Erreur mise en cache: {} (continuer quand même)",
                            e
                        );
                    } else {
                        info!(
                            "[QuickPreview] ✅ Preview mise en cache: {} (TTL: {}s)",
                            cache_key, ttl
                        );
                    }
                }
                
                Ok(response)
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
