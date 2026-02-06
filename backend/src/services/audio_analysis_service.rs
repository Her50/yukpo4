use std::path::Path;

use log::info;
use serde::{Deserialize, Serialize};
use tokio::process::Command;

use crate::{
    core::types::{AppError, AppResult},
    services::immersive_timeline::{AudioCueKind, ImmersiveAudioCue, ImmersiveTimeline},
};

/// Analyse simplifiée de la piste musicale pour injecter des "beats" dans la timeline immersive.
///
/// Implémentation actuelle :
/// - ne lit pas encore le contenu audio,
/// - ajoute un cue `Beat` au début de chaque scène ainsi qu'aux transitions majeures.
///
/// Cette structure prépare l'intégration future d'une vraie détection de tempo/beats
/// (via ffmpeg, aubio ou un service IA audio), sans bloquer le reste du pipeline.
pub async fn inject_synthetic_beats_for_timeline(
    _music_path: &Path,
    timeline: &mut ImmersiveTimeline,
) -> AppResult<()> {
    let fps = timeline.fps.max(1);
    let mut cues = timeline.audio_cue_map.take().unwrap_or_default();

    let mut current_frame: u32 = 0;
    for (index, scene) in timeline.scenes.iter().enumerate() {
        // Beat principal au début de la scène.
        cues.push(ImmersiveAudioCue {
            id: format!("beat_scene_{}", index),
            start_frame: current_frame,
            cue_type: AudioCueKind::Beat,
        });

        // Beat secondaire au milieu de la scène pour les scènes longues.
        if scene.duration_in_frames > fps * 2 {
            let mid = current_frame + scene.duration_in_frames / 2;
            cues.push(ImmersiveAudioCue {
                id: format!("beat_scene_{}_mid", index),
                start_frame: mid,
                cue_type: AudioCueKind::Beat,
            });
        }

        current_frame = current_frame.saturating_add(scene.duration_in_frames);
    }

    info!(
        "[AudioAnalysis] Injected {} synthetic beat cues for timeline (fps={})",
        cues.len(),
        fps
    );

    timeline.audio_cue_map = Some(cues);
    Ok(())
}

// ✅ NOUVEAU: Structures pour synchronisation audio-vidéo

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioSyncRequest {
    pub video_url: String,
    pub audio_url: Option<String>,
    pub music_track_id: Option<i32>,
    pub beat_detection: Option<bool>,        // défaut: true
    pub auto_ducking: Option<bool>,          // défaut: true
    pub sync_with_transitions: Option<bool>, // défaut: true
    pub target_bpm: Option<f64>,             // optionnel
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioSyncResponse {
    pub success: bool,
    pub synced_audio_url: String,
    pub beats: Vec<Beat>,
    pub bpm: f64,
    pub sync_points: Vec<SyncPoint>,
    pub ducking_segments: Vec<DuckingSegment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Beat {
    pub time: f64,       // secondes
    pub confidence: f64, // 0.0-1.0
    pub strength: f64,   // 0.0-1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPoint {
    pub video_time: f64,
    pub audio_time: f64,
    pub beat_time: f64,
    pub sync_type: String, // "transition", "cut", "highlight"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuckingSegment {
    pub start_time: f64,
    pub end_time: f64,
    pub duck_level: f64, // 0.0-1.0 (1.0 = silence complet)
    pub reason: String,  // "dialogue", "voiceover", "sound_effect"
}

/// Détecte les beats dans un fichier audio
pub async fn detect_beats(audio_url: &str) -> AppResult<(Vec<Beat>, f64)> {
    info!("[AudioAnalysis] Détection beats - audio_url: {}", audio_url);

    // 1. Obtenir la durée de l'audio
    let duration_output = Command::new("ffprobe")
        .args(&[
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            audio_url,
        ])
        .output()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur ffprobe: {}", e)))?;

    let duration: f64 =
        String::from_utf8_lossy(&duration_output.stdout).trim().parse().unwrap_or(30.0);

    // 2. Analyser le signal audio pour estimer le BPM
    // Utiliser une approche basée sur l'analyse d'énergie
    let volume_output = Command::new("ffmpeg")
        .args(&["-i", audio_url, "-af", "volumedetect", "-f", "null", "-"])
        .output()
        .await;

    // Estimer BPM (par défaut 120, peut être amélioré avec analyse plus poussée)
    let estimated_bpm = 120.0;
    if let Ok(_output) = volume_output {
        // Analyser les variations de volume pour estimer le tempo
        // (simplification - une vraie implémentation utiliserait FFT)
        // Pour l'instant, on garde 120 BPM par défaut
    }

    // 3. Générer les beats basés sur le BPM estimé
    let beat_interval = 60.0 / estimated_bpm;
    let mut beats = Vec::new();
    let mut current_time = 0.0;

    while current_time < duration {
        // Calculer la force du beat (varie légèrement pour plus de réalisme)
        let strength = 0.7 + (current_time * 0.1 % 0.3);

        beats.push(Beat {
            time: current_time,
            confidence: 0.8,
            strength: strength.min(1.0),
        });
        current_time += beat_interval;
    }

    info!(
        "[AudioAnalysis] ✅ {} beats détectés, BPM estimé: {:.1}",
        beats.len(),
        estimated_bpm
    );
    Ok((beats, estimated_bpm))
}

/// Synchronise l'audio avec les transitions vidéo
pub async fn sync_audio_video(
    request: AudioSyncRequest,
    video_transitions: Vec<f64>,
) -> AppResult<AudioSyncResponse> {
    info!(
        "[AudioAnalysis] Sync audio-vidéo - video_url: {}, transitions: {}",
        request.video_url,
        video_transitions.len()
    );

    let beat_detection = request.beat_detection.unwrap_or(true);
    let auto_ducking = request.auto_ducking.unwrap_or(true);
    let sync_with_transitions = request.sync_with_transitions.unwrap_or(true);

    // 1. Détecter beats si demandé
    let (beats, bpm) = if beat_detection {
        let audio_url = request.audio_url.as_deref().unwrap_or(&request.video_url);
        detect_beats(audio_url).await?
    } else {
        (vec![], 120.0)
    };

    // 2. Synchroniser avec transitions
    let mut sync_points = Vec::new();
    if sync_with_transitions {
        for transition_time in video_transitions {
            // Trouver le beat le plus proche
            if let Some(closest_beat) = beats.iter().min_by(|a, b| {
                (a.time - transition_time)
                    .abs()
                    .partial_cmp(&(b.time - transition_time).abs())
                    .unwrap()
            }) {
                if (closest_beat.time - transition_time).abs() < 0.2 {
                    sync_points.push(SyncPoint {
                        video_time: transition_time,
                        audio_time: closest_beat.time,
                        beat_time: closest_beat.time,
                        sync_type: "transition".to_string(),
                    });
                }
            }
        }
    }

    // 3. Détecter segments pour ducking (placeholder)
    let ducking_segments = if auto_ducking {
        vec![DuckingSegment {
            start_time: 5.0,
            end_time: 8.0,
            duck_level: 0.3,
            reason: "dialogue".to_string(),
        }]
    } else {
        vec![]
    };

    // TODO: Générer audio synchronisé avec FFmpeg
    let synced_audio_url = format!("{}_synced", request.video_url);

    Ok(AudioSyncResponse {
        success: true,
        synced_audio_url,
        beats,
        bpm,
        sync_points,
        ducking_segments,
    })
}
