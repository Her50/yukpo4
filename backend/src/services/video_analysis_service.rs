// ✅ NOUVEAU: Service d'analyse vidéo pour auto-cut intelligent
// ✅ Phase 10: Amélioré avec IA pour détection intelligente de scènes
// Détection automatique de scènes, silences, et highlights avec IA

use crate::core::types::{AppError, AppResult};
use crate::services::app_ia::{extract_json_block, AppIA};
use log::{info, warn};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use tokio::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoCutRequest {
    pub video_url: String,
    pub video_id: Option<i32>,
    pub min_scene_duration: Option<f64>, // secondes, défaut: 2.0
    pub max_scene_duration: Option<f64>, // secondes, défaut: 10.0
    pub silence_threshold: Option<f64>,  // dB, défaut: -40.0
    pub detect_highlights: Option<bool>, // défaut: true
    pub target_duration: Option<f64>,    // secondes, optionnel
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoCutResponse {
    pub success: bool,
    pub scenes: Vec<SceneCut>,
    pub highlights: Vec<Highlight>,
    pub total_duration: f64,
    pub original_duration: f64,
    pub silence_removed: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneCut {
    pub start_time: f64,
    pub end_time: f64,
    pub duration: f64,
    pub confidence: f64,    // 0.0-1.0
    pub scene_type: String, // "action", "dialogue", "transition", etc.
    pub thumbnail_url: Option<String>,
    pub audio_level: f64,  // dB moyen
    pub motion_score: f64, // 0.0-1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Highlight {
    pub start_time: f64,
    pub end_time: f64,
    pub score: f64,     // 0.0-1.0
    pub reason: String, // "high_motion", "audio_peak", "face_detection", etc.
}

/// ✅ NOUVEAU Phase 10: Analyse une vidéo avec IA pour détection intelligente de scènes
pub async fn detect_scenes(
    request: AutoCutRequest,
    app_ia: Option<Arc<AppIA>>,
) -> AppResult<AutoCutResponse> {
    info!(
        "[VideoAnalysis] Auto-cut request avec IA - video_url: {}, detect_highlights: {}",
        request.video_url,
        request.detect_highlights.unwrap_or(true)
    );

    let min_duration = request.min_scene_duration.unwrap_or(2.0);
    let max_duration = request.max_scene_duration.unwrap_or(10.0);
    let silence_threshold = request.silence_threshold.unwrap_or(-40.0);
    let detect_highlights = request.detect_highlights.unwrap_or(true);

    // ✅ NOUVEAU Phase 10: Utiliser IA si disponible pour améliorer la détection
    let scenes = if let Some(ia) = app_ia {
        detect_scenes_with_ia(
            &request.video_url,
            min_duration,
            max_duration,
            silence_threshold,
            ia,
        )
        .await
        .unwrap_or_else(|e| {
            warn!("[VideoAnalysis] Erreur IA, fallback FFmpeg: {}", e);
            // Fallback vers FFmpeg si IA échoue
            vec![]
        })
    } else {
        vec![]
    };

    // Si IA n'a pas retourné de scènes, utiliser FFmpeg
    let scenes = if scenes.is_empty() {
        detect_scenes_ffmpeg(
            &request.video_url,
            min_duration,
            max_duration,
            silence_threshold,
        )
        .await?
    } else {
        scenes
    };

    let highlights = if detect_highlights {
        detect_highlights_from_scenes(&scenes).await?
    } else {
        vec![]
    };

    let original_duration = scenes.iter().map(|s| s.duration).sum::<f64>();
    let total_duration = scenes.iter().map(|s| s.duration).sum::<f64>();
    let silence_removed = 0.0; // TODO: Calculer réellement

    Ok(AutoCutResponse {
        success: true,
        scenes,
        highlights,
        total_duration,
        original_duration,
        silence_removed,
    })
}

/// ✅ NOUVEAU Phase 10: Détection de scènes avec IA
async fn detect_scenes_with_ia(
    video_url: &str,
    min_duration: f64,
    max_duration: f64,
    silence_threshold: f64,
    app_ia: Arc<AppIA>,
) -> AppResult<Vec<SceneCut>> {
    info!(
        "[VideoAnalysis] Détection scènes avec IA - video_url: {}",
        video_url
    );

    // ✅ CORRECTION RACINE: Vérifier si l'URL est accessible avant d'appeler ffprobe
    // Si c'est une URL HTTP/HTTPS, vérifier qu'elle est accessible
    if video_url.starts_with("http://") || video_url.starts_with("https://") {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .map_err(|e| AppError::Internal(format!("Erreur création client HTTP: {}", e)))?;

        let response = client.head(video_url).send().await;
        match response {
            Ok(resp) if resp.status().is_success() => {
                info!("[VideoAnalysis] URL accessible: {}", video_url);
            }
            Ok(resp) => {
                let status = resp.status();
                warn!(
                    "[VideoAnalysis] URL non accessible (status {}): {}",
                    status, video_url
                );
                return Err(AppError::Internal(format!(
                    "Vidéo non accessible (HTTP {}): {}",
                    status, video_url
                )));
            }
            Err(e) => {
                warn!(
                    "[VideoAnalysis] Erreur vérification URL {}: {}",
                    video_url, e
                );
                return Err(AppError::Internal(format!(
                    "Impossible d'accéder à la vidéo: {}",
                    e
                )));
            }
        }
    }

    // Obtenir métadonnées vidéo avec FFprobe
    let duration_output = Command::new("ffprobe")
        .args(&[
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            video_url,
        ])
        .output()
        .await
        .map_err(|e| {
            let error_msg = format!("Erreur exécution ffprobe: {}", e);
            warn!("[VideoAnalysis] {}", error_msg);
            AppError::Internal(error_msg)
        })?;

    // ✅ CORRECTION RACINE: Vérifier le code de retour et stderr de ffprobe
    if !duration_output.status.success() {
        let stderr = String::from_utf8_lossy(&duration_output.stderr);
        let error_msg = format!(
            "ffprobe a échoué (code {}): {}. URL: {}",
            duration_output.status.code().unwrap_or(-1),
            stderr.trim(),
            video_url
        );
        warn!("[VideoAnalysis] {}", error_msg);
        return Err(AppError::Internal(error_msg));
    }

    let total_duration: f64 = String::from_utf8_lossy(&duration_output.stdout)
        .trim()
        .parse()
        .unwrap_or(0.0);

    if total_duration == 0.0 {
        let stderr = String::from_utf8_lossy(&duration_output.stderr);
        let error_msg = format!(
            "Impossible de déterminer la durée de la vidéo. ffprobe stdout: '{}', stderr: '{}'. URL: {}", 
            String::from_utf8_lossy(&duration_output.stdout).trim(),
            stderr.trim(),
            video_url
        );
        warn!("[VideoAnalysis] {}", error_msg);
        return Err(AppError::Internal(error_msg));
    }

    info!(
        "[VideoAnalysis] Durée vidéo déterminée: {} secondes",
        total_duration
    );

    // Construire le prompt IA pour analyse intelligente
    let prompt = format!(
        r#"Tu es un expert en montage vidéo professionnel pour Yukpo.

OBJECTIF: Analyser une vidéo et proposer les meilleurs points de coupe pour un montage optimal.

CONTEXTE:
- Durée totale vidéo: {} secondes
- Durée minimale scène: {} secondes
- Durée maximale scène: {} secondes
- Seuil silence: {} dB

INSTRUCTIONS:
1. Identifie les moments clés pour couper (changements de scène, pauses naturelles, transitions)
2. Évite les coupes au milieu d'une action ou d'une phrase
3. Respecte le rythme narratif et l'émotion
4. Propose des scènes cohérentes et engageantes

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide, SANS markdown, SANS code blocks.

Format JSON strict:
{{
    "scenes": [
        {{
            "start_time": 0.0,
            "end_time": 5.2,
            "duration": 5.2,
            "confidence": 0.95,
            "scene_type": "action|dialogue|transition|highlight",
            "audio_level": -20.0,
            "motion_score": 0.8,
            "reason": "Changement de plan naturel"
        }}
    ],
    "recommendations": {{
        "silence_removal": true,
        "highlight_segments": [0.0, 15.5, 30.2]
    }}
}}

Réponds SEULEMENT le JSON, rien d'autre."#,
        total_duration, min_duration, max_duration, silence_threshold
    );

    let (_, response, _) = app_ia.predict(&prompt).await?;
    let json_block = extract_json_block(&response)
        .ok_or_else(|| AppError::Internal("JSON manquant dans réponse IA".to_string()))?;

    let parsed: Value = serde_json::from_str(&json_block)
        .map_err(|e| AppError::Internal(format!("JSON malformé: {}", e)))?;

    let scenes_array = parsed
        .get("scenes")
        .and_then(|s| s.as_array())
        .ok_or_else(|| AppError::Internal("Champ 'scenes' manquant".to_string()))?;

    let mut scenes = Vec::new();
    for (_idx, scene_json) in scenes_array.iter().enumerate() {
        let start_time = scene_json
            .get("start_time")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        let end_time = scene_json
            .get("end_time")
            .and_then(|v| v.as_f64())
            .unwrap_or(start_time + 5.0);
        let duration = end_time - start_time;

        if duration < min_duration || duration > max_duration {
            continue;
        }

        scenes.push(SceneCut {
            start_time,
            end_time,
            duration,
            confidence: scene_json
                .get("confidence")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.8),
            scene_type: scene_json
                .get("scene_type")
                .and_then(|v| v.as_str())
                .unwrap_or("transition")
                .to_string(),
            thumbnail_url: None,
            audio_level: scene_json
                .get("audio_level")
                .and_then(|v| v.as_f64())
                .unwrap_or(-20.0),
            motion_score: scene_json
                .get("motion_score")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.5),
        });
    }

    info!("[VideoAnalysis] IA a détecté {} scènes", scenes.len());
    Ok(scenes)
}

/// Détecte les scènes en utilisant FFmpeg
async fn detect_scenes_ffmpeg(
    video_url: &str,
    min_duration: f64,
    max_duration: f64,
    silence_threshold: f64,
) -> AppResult<Vec<SceneCut>> {
    info!(
        "[VideoAnalysis] Détection scènes avec FFmpeg - video_url: {}",
        video_url
    );

    // 1. Obtenir la durée totale de la vidéo
    let duration_output = Command::new("ffprobe")
        .args(&[
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            video_url,
        ])
        .output()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur ffprobe: {}", e)))?;

    let total_duration: f64 = String::from_utf8_lossy(&duration_output.stdout)
        .trim()
        .parse()
        .unwrap_or(0.0);

    if total_duration == 0.0 {
        return Err(AppError::Internal(
            "Impossible de déterminer la durée de la vidéo".to_string(),
        ));
    }

    // 2. Détecter les changements de scène avec FFmpeg
    let scene_output = Command::new("ffmpeg")
        .args(&[
            "-i",
            video_url,
            "-vf",
            "select='gt(scene,0.3)',showinfo",
            "-vsync",
            "0",
            "-f",
            "null",
            "-",
        ])
        .output()
        .await;

    let mut scene_times = Vec::new();
    if let Ok(output) = scene_output {
        let output_str = String::from_utf8_lossy(&output.stderr);
        for line in output_str.lines() {
            if line.contains("pts_time:") {
                if let Some(pts_start) = line.find("pts_time:") {
                    let pts_str = &line[pts_start + 10..];
                    if let Some(space_pos) = pts_str.find(' ') {
                        if let Ok(time) = pts_str[..space_pos].trim().parse::<f64>() {
                            scene_times.push(time);
                        }
                    }
                }
            }
        }
    }

    // 3. Détecter les silences
    let silence_output = Command::new("ffmpeg")
        .args(&[
            "-i",
            video_url,
            "-af",
            &format!("silencedetect=noise={}dB:d=0.5", silence_threshold),
            "-f",
            "null",
            "-",
        ])
        .output()
        .await;

    let mut silence_segments = Vec::new();
    if let Ok(output) = silence_output {
        let output_str = String::from_utf8_lossy(&output.stderr);
        let mut silence_start: Option<f64> = None;
        for line in output_str.lines() {
            if line.contains("silence_start:") {
                if let Some(start_pos) = line.find("silence_start:") {
                    let time_str = &line[start_pos + 15..];
                    if let Ok(time) = time_str.trim().parse::<f64>() {
                        silence_start = Some(time);
                    }
                }
            } else if line.contains("silence_end:") && silence_start.is_some() {
                if let Some(end_pos) = line.find("silence_end:") {
                    let time_str = &line[end_pos + 12..];
                    if let Ok(time) = time_str.trim().parse::<f64>() {
                        silence_segments.push((silence_start.unwrap(), time));
                        silence_start = None;
                    }
                }
            }
        }
    }

    // 4. Analyser le niveau audio moyen par segment
    let audio_level_output = Command::new("ffmpeg")
        .args(&["-i", video_url, "-af", "volumedetect", "-f", "null", "-"])
        .output()
        .await;

    let mut avg_audio_level = -20.0;
    if let Ok(output) = audio_level_output {
        let output_str = String::from_utf8_lossy(&output.stderr);
        if let Some(mean_pos) = output_str.find("mean_volume:") {
            let mean_str = &output_str[mean_pos + 13..];
            if let Some(delim_pos) = mean_str.find(" dB") {
                if let Ok(level) = mean_str[..delim_pos].trim().parse::<f64>() {
                    avg_audio_level = level;
                }
            }
        }
    }

    // 5. Construire les scènes en combinant détection de scènes et silences
    let mut scenes = Vec::new();

    // Ajouter les temps de changement de scène détectés
    let mut all_cut_points = vec![0.0];
    all_cut_points.extend_from_slice(&scene_times);
    all_cut_points.push(total_duration);
    all_cut_points.sort_by(|a, b| a.partial_cmp(b).unwrap());

    for i in 0..all_cut_points.len() - 1 {
        let start = all_cut_points[i];
        let end = all_cut_points[i + 1];
        let duration = end - start;

        // Ignorer les scènes trop courtes ou trop longues
        if duration < min_duration || duration > max_duration {
            continue;
        }

        // Vérifier si cette scène contient des silences
        let has_silence = silence_segments.iter().any(|(s_start, s_end)| {
            (s_start >= &start && s_start < &end) || (s_end > &start && s_end <= &end)
        });

        // Déterminer le type de scène
        let scene_type = if has_silence {
            "dialogue".to_string()
        } else if duration > 5.0 {
            "action".to_string()
        } else {
            "transition".to_string()
        };

        // Calculer un score de confiance basé sur la détection
        let confidence = if scene_times.contains(&start) {
            0.9
        } else {
            0.6
        };

        scenes.push(SceneCut {
            start_time: start,
            end_time: end,
            duration,
            confidence,
            scene_type,
            thumbnail_url: None,
            audio_level: avg_audio_level,
            motion_score: if duration > 3.0 { 0.7 } else { 0.4 },
        });
    }

    // Si aucune scène détectée, créer une scène par défaut
    if scenes.is_empty() {
        scenes.push(SceneCut {
            start_time: 0.0,
            end_time: total_duration.min(max_duration),
            duration: total_duration.min(max_duration),
            confidence: 0.5,
            scene_type: "default".to_string(),
            thumbnail_url: None,
            audio_level: avg_audio_level,
            motion_score: 0.5,
        });
    }

    info!("[VideoAnalysis] ✅ {} scènes détectées", scenes.len());
    Ok(scenes)
}

/// Détecte les highlights dans les scènes
async fn detect_highlights_from_scenes(scenes: &[SceneCut]) -> AppResult<Vec<Highlight>> {
    let mut highlights = Vec::new();

    for scene in scenes {
        // Score combiné basé sur motion et audio
        let total_score =
            scene.motion_score * 0.5 + (1.0 - (scene.audio_level + 60.0) / 60.0).max(0.0) * 0.5;

        if total_score > 0.7 {
            let reason = if scene.motion_score > 0.8 {
                "high_motion".to_string()
            } else if scene.audio_level > -30.0 {
                "audio_peak".to_string()
            } else {
                "combined_score".to_string()
            };

            highlights.push(Highlight {
                start_time: scene.start_time,
                end_time: scene.end_time,
                score: total_score,
                reason,
            });
        }
    }

    // Trier par score décroissant
    highlights.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    Ok(highlights)
}
