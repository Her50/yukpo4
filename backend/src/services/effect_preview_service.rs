// ✅ NOUVEAU: Service de génération de previews d'effets à la demande

use crate::core::types::{AppError, AppResult};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use tokio::process::Command;
use base64::{Engine as _, engine::general_purpose};
use std::fs;
use std::path::PathBuf;

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

    // ✅ CORRIGÉ: Ajouter "blur" et ses alias français
    m.insert(
        "blur",
        EffectDefinition {
            ffmpeg_filter: "boxblur=2:1".to_string(),
            description: "Flou doux pour effet artistique".to_string(),
        },
    );
    // Alias français pour "blur"
    m.insert(
        "flou artistique",
        EffectDefinition {
            ffmpeg_filter: "boxblur=2:1".to_string(),
            description: "Flou doux pour effet artistique".to_string(),
        },
    );
    m.insert(
        "flou",
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

    // ✅ CORRIGÉ: Ajouter effet vignette (manquant)
    m.insert(
        "vignette",
        EffectDefinition {
            ffmpeg_filter: "vignette=angle=PI/4:x0=w/2:y0=h/2".to_string(),
            description: "Vignette douce pour concentrer l'attention".to_string(),
        },
    );
    // Alias français pour "vignette"
    m.insert(
        "vignette douce",
        EffectDefinition {
            ffmpeg_filter: "vignette=angle=PI/4:x0=w/2:y0=h/2".to_string(),
            description: "Vignette douce pour concentrer l'attention".to_string(),
        },
    );

    // ✅ CORRIGÉ: Ajouter effet "split screen" (manquant)
    m.insert(
        "split screen",
        EffectDefinition {
            ffmpeg_filter: "split[main][tmp];[tmp]crop=iw/2:ih:0:0[left];[tmp]crop=iw/2:ih:iw/2:0[right];[left][right]hstack".to_string(),
            description: "Écran divisé avec deux vues côte à côte".to_string(),
        },
    );
    m.insert(
        "splitscreen",
        EffectDefinition {
            ffmpeg_filter: "split[main][tmp];[tmp]crop=iw/2:ih:0:0[left];[tmp]crop=iw/2:ih:iw/2:0[right];[left][right]hstack".to_string(),
            description: "Écran divisé avec deux vues côte à côte".to_string(),
        },
    );

    // ✅ CORRIGÉ: Ajouter effet "glitch" (manquant)
    m.insert(
        "glitch",
        EffectDefinition {
            ffmpeg_filter: "curves=all='0/0 0.5/0.58 1/1',hue=s=1.1,eq=contrast=1.2:brightness=0.05".to_string(),
            description: "Effet glitch avec distorsion des couleurs".to_string(),
        },
    );
    m.insert(
        "glitch effect",
        EffectDefinition {
            ffmpeg_filter: "curves=all='0/0 0.5/0.58 1/1',hue=s=1.1,eq=contrast=1.2:brightness=0.05".to_string(),
            description: "Effet glitch avec distorsion des couleurs".to_string(),
        },
    );

    // ✅ CORRIGÉ: Ajouter effet "pan" (mouvement panoramique)
    m.insert(
        "pan",
        EffectDefinition {
            ffmpeg_filter: "crop=iw*0.8:ih:iw*0.1:0,scale=iw*1.25:ih,setpts=PTS-STARTPTS".to_string(),
            description: "Mouvement panoramique horizontal pour effet dynamique".to_string(),
        },
    );
    m.insert(
        "panoramic",
        EffectDefinition {
            ffmpeg_filter: "crop=iw*0.8:ih:iw*0.1:0,scale=iw*1.25:ih,setpts=PTS-STARTPTS".to_string(),
            description: "Mouvement panoramique horizontal pour effet dynamique".to_string(),
        },
    );

    // ✅ CORRIGÉ: Ajouter effet "slow motion" (ralenti)
    m.insert(
        "slow motion",
        EffectDefinition {
            ffmpeg_filter: "setpts=2.0*PTS".to_string(),
            description: "Ralenti pour effet dramatique".to_string(),
        },
    );
    m.insert(
        "slowmotion",
        EffectDefinition {
            ffmpeg_filter: "setpts=2.0*PTS".to_string(),
            description: "Ralenti pour effet dramatique".to_string(),
        },
    );
    m.insert(
        "slow",
        EffectDefinition {
            ffmpeg_filter: "setpts=2.0*PTS".to_string(),
            description: "Ralenti pour effet dramatique".to_string(),
        },
    );

    // ✅ CORRIGÉ: Ajouter effet "focus blur" (flou de profondeur de champ)
    m.insert(
        "focus blur",
        EffectDefinition {
            ffmpeg_filter: "boxblur=5:2:enable='between(t,0,1)+between(t,2,3)'".to_string(),
            description: "Flou de profondeur de champ pour effet cinématique".to_string(),
        },
    );
    m.insert(
        "focusblur",
        EffectDefinition {
            ffmpeg_filter: "boxblur=5:2:enable='between(t,0,1)+between(t,2,3)'".to_string(),
            description: "Flou de profondeur de champ pour effet cinématique".to_string(),
        },
    );
    m.insert(
        "depth of field",
        EffectDefinition {
            ffmpeg_filter: "boxblur=5:2:enable='between(t,0,1)+between(t,2,3)'".to_string(),
            description: "Flou de profondeur de champ pour effet cinématique".to_string(),
        },
    );

    // ✅ CORRIGÉ: Ajouter effet "cinematic" (effet cinématique)
    m.insert(
        "cinematic",
        EffectDefinition {
            ffmpeg_filter: "curves=all='0/0 0.5/0.45 1/1',eq=contrast=1.1:saturation=0.85:gamma=1.05".to_string(),
            description: "Effet cinématique avec courbes de couleur et contraste".to_string(),
        },
    );
    m.insert(
        "cinema",
        EffectDefinition {
            ffmpeg_filter: "curves=all='0/0 0.5/0.45 1/1',eq=contrast=1.1:saturation=0.85:gamma=1.05".to_string(),
            description: "Effet cinématique avec courbes de couleur et contraste".to_string(),
        },
    );
    m.insert(
        "cinéma",
        EffectDefinition {
            ffmpeg_filter: "curves=all='0/0 0.5/0.45 1/1',eq=contrast=1.1:saturation=0.85:gamma=1.05".to_string(),
            description: "Effet cinématique avec courbes de couleur et contraste".to_string(),
        },
    );

    // ✅ CORRIGÉ: Ajouter effet "ken burns" (zoom + pan combiné)
    m.insert(
        "ken burns",
        EffectDefinition {
            ffmpeg_filter: "zoompan=z='if(lte(zoom,1.0),1.5,max(1.001,zoom-0.0015))':d=75:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'".to_string(),
            description: "Effet Ken Burns combinant zoom et mouvement panoramique".to_string(),
        },
    );
    m.insert(
        "kenburns",
        EffectDefinition {
            ffmpeg_filter: "zoompan=z='if(lte(zoom,1.0),1.5,max(1.001,zoom-0.0015))':d=75:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'".to_string(),
            description: "Effet Ken Burns combinant zoom et mouvement panoramique".to_string(),
        },
    );
    m.insert(
        "ken",
        EffectDefinition {
            ffmpeg_filter: "zoompan=z='if(lte(zoom,1.0),1.5,max(1.001,zoom-0.0015))':d=75:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'".to_string(),
            description: "Effet Ken Burns combinant zoom et mouvement panoramique".to_string(),
        },
    );

    // ✅ CORRIGÉ: Ajouter effet "slide" (transition slide comme effet)
    m.insert(
        "slide",
        EffectDefinition {
            ffmpeg_filter: "crop=iw:ih*0.9:0:ih*0.05,scale=iw:ih".to_string(),
            description: "Effet slide pour transition dynamique".to_string(),
        },
    );
    m.insert(
        "slideleft",
        EffectDefinition {
            ffmpeg_filter: "crop=iw*0.9:ih:iw*0.1:0,scale=iw:ih".to_string(),
            description: "Slide vers la gauche pour transition dynamique".to_string(),
        },
    );
    m.insert(
        "slideright",
        EffectDefinition {
            ffmpeg_filter: "crop=iw*0.9:ih:0:0,scale=iw:ih".to_string(),
            description: "Slide vers la droite pour transition dynamique".to_string(),
        },
    );

    // ✅ CORRIGÉ: Ajouter alias français pour les effets courants
    m.insert(
        "zoom dynamique",
        EffectDefinition {
            ffmpeg_filter: "zoompan=z='if(lte(zoom,1.0),1.5,max(1.001,zoom-0.0015))':d=75".to_string(),
            description: "Zoom progressif pour créer un effet dynamique".to_string(),
        },
    );
    m.insert(
        "fade doux",
        EffectDefinition {
            ffmpeg_filter: "fade=t=in:st=0:d=0.5,fade=t=out:st=2.5:d=0.5".to_string(),
            description: "Fondu en entrée et sortie pour transition douce".to_string(),
        },
    );
    m.insert(
        "ralenti",
        EffectDefinition {
            ffmpeg_filter: "setpts=2.0*PTS".to_string(),
            description: "Ralenti pour effet dramatique".to_string(),
        },
    );
    // ✅ CORRIGÉ 2025-12-28: Ajouter alias "ralenti dramatique"
    m.insert(
        "ralenti dramatique",
        EffectDefinition {
            ffmpeg_filter: "setpts=2.0*PTS".to_string(),
            description: "Ralenti pour effet dramatique".to_string(),
        },
    );

    // ✅ CORRIGÉ 2025-12-18: Ajouter alias "éclat lumineux" (alias de glow)
    m.insert(
        "éclat lumineux",
        EffectDefinition {
            ffmpeg_filter: "curves=all='0/0 0.5/0.58 1/1',eq=brightness=0.15:saturation=0.2".to_string(),
            description: "Effet lumineux avec saturation augmentée".to_string(),
        },
    );

    // ✅ CORRIGÉ 2025-12-18: Ajouter alias "zoom rapide" (zoom accéléré)
    m.insert(
        "zoom rapide",
        EffectDefinition {
            ffmpeg_filter: "zoompan=z='if(lte(zoom,1.0),2.0,max(1.001,zoom-0.003))':d=50".to_string(),
            description: "Zoom rapide pour effet dynamique et percutant".to_string(),
        },
    );

    // ✅ CORRIGÉ: Ajouter effet "parallax" (mentionné dans timeline_converter)
    m.insert(
        "parallax",
        EffectDefinition {
            ffmpeg_filter: "crop=iw*0.9:ih:iw*0.05:0,scale=iw:ih".to_string(),
            description: "Effet parallaxe pour profondeur visuelle".to_string(),
        },
    );

    // ✅ CORRIGÉ: Ajouter effet "orbit" ou "3d" (rotation 3D)
    m.insert(
        "orbit",
        EffectDefinition {
            ffmpeg_filter: "perspective=x0=iw/2:y0=ih/2:x1=iw/2+100:y1=ih/2-50:x2=iw/2-100:y2=ih/2-50:x3=iw/2:y3=ih/2+100".to_string(),
            description: "Rotation orbitale 3D pour effet immersif".to_string(),
        },
    );
    m.insert(
        "3d",
        EffectDefinition {
            ffmpeg_filter: "perspective=x0=iw/2:y0=ih/2:x1=iw/2+100:y1=ih/2-50:x2=iw/2-100:y2=ih/2-50:x3=iw/2:y3=ih/2+100".to_string(),
            description: "Rotation orbitale 3D pour effet immersif".to_string(),
        },
    );
    m.insert(
        "orbit3d",
        EffectDefinition {
            ffmpeg_filter: "perspective=x0=iw/2:y0=ih/2:x1=iw/2+100:y1=ih/2-50:x2=iw/2-100:y2=ih/2-50:x3=iw/2:y3=ih/2+100".to_string(),
            description: "Rotation orbitale 3D pour effet immersif".to_string(),
        },
    );

    // ✅ CORRIGÉ: Ajouter effet "speed ramp" (accélération/ralenti variable)
    m.insert(
        "speed ramp",
        EffectDefinition {
            ffmpeg_filter: "setpts='if(lt(t,1),0.5*PTS,if(lt(t,2),PTS,2*PTS))'".to_string(),
            description: "Variation de vitesse pour effet dynamique".to_string(),
        },
    );
    m.insert(
        "speedramp",
        EffectDefinition {
            ffmpeg_filter: "setpts='if(lt(t,1),0.5*PTS,if(lt(t,2),PTS,2*PTS))'".to_string(),
            description: "Variation de vitesse pour effet dynamique".to_string(),
        },
    );
    m.insert(
        "speed-ramp",
        EffectDefinition {
            ffmpeg_filter: "setpts='if(lt(t,1),0.5*PTS,if(lt(t,2),PTS,2*PTS))'".to_string(),
            description: "Variation de vitesse pour effet dynamique".to_string(),
        },
    );

    // ✅ CORRIGÉ: Ajouter effet "overlay" (superposition - effet visuel de base)
    // Note: "Texte animé" et "Overlay élégant" sont des overlays de texte, pas des effets FFmpeg purs
    // Mais on peut créer un effet de superposition visuelle
    m.insert(
        "overlay",
        EffectDefinition {
            ffmpeg_filter: "eq=contrast=1.1:brightness=0.05".to_string(),
            description: "Effet de superposition pour enrichir la composition".to_string(),
        },
    );
    m.insert(
        "overlay élégant",
        EffectDefinition {
            ffmpeg_filter: "eq=contrast=1.1:brightness=0.05".to_string(),
            description: "Effet de superposition pour enrichir la composition".to_string(),
        },
    );

    m
}

/// Récupère la définition d'un effet (fallback hardcodé si DB non disponible)
/// ✅ CORRIGÉ: Normalisation du nom d'effet (lowercase, trim, etc.)
fn get_effect_definition(effect_name: &str) -> Option<EffectDefinition> {
    let normalized = effect_name.trim().to_lowercase();
    get_effect_definitions().get(normalized.as_str()).cloned()
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

    // ✅ CORRIGÉ: Récupérer la définition de l'effet avec normalisation
    let normalized_effect_name = request.effect_name.trim().to_lowercase();
    let effect_def = get_effect_definition(&normalized_effect_name)
        .ok_or_else(|| {
            let available_effects: Vec<&str> = get_effect_definitions().keys().copied().collect();
            error!(
                "[EffectPreview] Effet '{}' (normalisé: '{}') non trouvé. Effets disponibles: {:?}",
                request.effect_name, normalized_effect_name, available_effects
            );
            AppError::BadRequest(format!(
                "Effet '{}' non trouvé. Effets disponibles: {}",
                request.effect_name,
                available_effects.join(", ")
            ))
        })?;

    let duration = request.duration.unwrap_or(3.0);
    let quality = request.quality.as_deref().unwrap_or("low");

    // Déterminer les paramètres de qualité
    let (video_codec, crf, preset) = match quality {
        "high" => ("libx264", "18", "slow"),
        "medium" => ("libx264", "23", "medium"),
        _ => ("libx264", "28", "ultrafast"), // low quality, rapide
    };

    // ✅ CORRIGÉ 2025-12-28: Gérer les data URIs en créant un fichier temporaire
    let (input_path, is_temp_file, temp_file_path) = if request.sample_media_url.starts_with("data:") {
        // Extraire le base64 depuis le data URI
        let base64_data = if let Some(idx) = request.sample_media_url.find(',') {
            &request.sample_media_url[idx + 1..]
        } else {
            return Err(AppError::BadRequest(
                "Format data URI invalide. Format attendu: data:image/jpeg;base64,...".to_string(),
            ));
        };

        // Déterminer l'extension depuis le MIME type
        let extension = if request.sample_media_url.starts_with("data:image/") {
            if request.sample_media_url.contains("png") {
                "png"
            } else if request.sample_media_url.contains("gif") {
                "gif"
            } else {
                "jpg"
            }
        } else if request.sample_media_url.starts_with("data:video/") {
            "mp4"
        } else {
            "tmp"
        };

        // Décoder le base64
        let decoded_data = general_purpose::STANDARD.decode(base64_data)
            .map_err(|e| AppError::BadRequest(format!("Erreur décodage base64: {}", e)))?;

        // Créer un fichier temporaire
        let temp_dir = std::env::temp_dir();
        let temp_file = temp_dir.join(format!("effect_preview_{}_{}.{}", 
            normalized_effect_name, 
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
            extension));
        
        // Écrire les données dans le fichier temporaire
        fs::write(&temp_file, decoded_data)
            .map_err(|e| AppError::Internal(format!("Erreur création fichier temporaire: {}", e)))?;

        let path_str = temp_file.to_string_lossy().to_string();
        (path_str.clone(), true, Some(temp_file))
    } else {
        // Vérifier que le fichier d'entrée existe (pour les chemins locaux)
        let input_path = &request.sample_media_url;
        if !PathBuf::from(input_path).exists() && !input_path.starts_with("http") {
            return Err(AppError::BadRequest(format!(
                "Fichier d'entrée introuvable: {}. Vérifiez que le chemin est correct ou utilisez une URL HTTP/HTTPS.",
                input_path
            )));
        }
        (input_path.to_string(), false, None)
    };

    // Générer le nom du fichier de sortie
    let output_path = format!(
        "{}_preview_{}_{}.mp4",
        normalized_effect_name, 
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
        quality
    );

    // ✅ CORRIGÉ: Appliquer l'effet avec FFmpeg avec meilleure gestion d'erreur
    let ffmpeg_result = Command::new("ffmpeg")
        .args(&[
            "-i",
            &input_path,
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

    // ✅ CORRIGÉ 2025-12-28: Nettoyer le fichier temporaire à la fin (succès ou échec)
    let result = match ffmpeg_result {
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
                let stdout = String::from_utf8_lossy(&output.stdout);
                error!(
                    "[EffectPreview] ❌ Erreur FFmpeg pour effet '{}':\nSTDERR: {}\nSTDOUT: {}\nInput: {}",
                    normalized_effect_name, error, stdout, input_path
                );
                
                // ✅ CORRIGÉ: Messages d'erreur plus informatifs
                let error_msg = if error.contains("No such file or directory") {
                    format!(
                        "Fichier d'entrée introuvable: {}. Vérifiez que l'URL est accessible ou que le chemin local est correct.",
                        input_path
                    )
                } else if error.contains("Invalid data found") {
                    format!(
                        "Format de fichier invalide ou corrompu: {}. Vérifiez que le fichier est un média valide.",
                        input_path
                    )
                } else {
                    format!("Erreur génération preview: {}", error)
                };
                
                Err(AppError::BadRequest(error_msg))
            }
        }
        Err(e) => {
            error!(
                "[EffectPreview] ❌ Erreur commande FFmpeg pour effet '{}': {}",
                normalized_effect_name, e
            );
            Err(AppError::Internal(format!(
                "Erreur FFmpeg: {}. Vérifiez que FFmpeg est installé et accessible.",
                e
            )))
        }
    };

    // Nettoyer le fichier temporaire si nécessaire
    if is_temp_file {
        if let Some(temp_path) = temp_file_path {
            if let Err(e) = fs::remove_file(&temp_path) {
                warn!("[EffectPreview] ⚠️ Impossible de supprimer le fichier temporaire {:?}: {}", temp_path, e);
            } else {
                info!("[EffectPreview] Fichier temporaire supprimé: {:?}", temp_path);
            }
        }
    }

    result
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
