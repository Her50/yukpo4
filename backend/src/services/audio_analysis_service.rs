use std::path::Path;

use log::info;

use crate::{
    core::types::AppResult,
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


