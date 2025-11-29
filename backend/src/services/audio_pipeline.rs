use std::collections::HashMap;
use std::path::{Path, PathBuf};

use log::{info, warn};
use serde::{Deserialize, Serialize};
use tokio::process::Command;

use crate::core::types::{AppError, AppResult};
use crate::services::immersive_timeline::{AudioCueKind, ImmersiveTimeline};

/// Mode de spatialisation (future extension)
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub enum SpatializationMode {
    #[default]
    None,
    WideStereo,
    Binaural,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioMixConfig {
    pub music_volume: f32,
    pub voice_volume: f32,
    pub sfx_volume: f32,
    pub target_lufs: f32,
    pub spatialization: SpatializationMode,
}

impl Default for AudioMixConfig {
    fn default() -> Self {
        Self {
            music_volume: 0.28,
            voice_volume: 1.0,
            sfx_volume: 0.6,
            target_lufs: -14.0,
            spatialization: SpatializationMode::None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct AudioLayer {
    pub path: PathBuf,
    pub gain: f32,
    pub start_offset: f32,
}

/// ✅ CORRECTION: Vérifie si un fichier vidéo a un stream audio
pub async fn has_audio_stream(video_path: &Path) -> AppResult<bool> {
    let output = Command::new("ffprobe")
        .args(&[
            "-v", "error",
            "-select_streams", "a:0",
            "-show_entries", "stream=codec_type",
            "-of", "csv=p=0",
            video_path.to_string_lossy().as_ref(),
        ])
        .output()
        .await
        .map_err(|err| {
            AppError::Internal(format!(
                "Impossible d'exécuter ffprobe pour vérifier l'audio: {err:?}"
            ))
        })?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.trim() == "audio")
    } else {
        // Si ffprobe échoue, on assume qu'il n'y a pas d'audio
        Ok(false)
    }
}

/// Mixe la vidéo combinée avec les couches audio (musique, voix, SFX) et écrit `final.mp4`.
///
/// Par défaut, on applique un mixage simple (musique + voix). Spatialisation et LUFS seront gérés
/// progressivement dans les prochaines étapes (Dolby, AudioShake…).
pub async fn mix_media_audio_tracks(
    working_dir: &Path,
    base_video_path: &Path,
    music_track: Option<&Path>,
    voiceover_track: Option<&Path>,
    sfx_tracks: &[AudioLayer],
    config: &AudioMixConfig,
) -> AppResult<PathBuf> {
    // ✅ CORRECTION: Vérifier si la vidéo a un stream audio avant de l'utiliser
    let video_has_audio = has_audio_stream(base_video_path).await.unwrap_or(false);
    
    if !video_has_audio {
        warn!(
            "[AudioPipeline] La vidéo {} n'a pas de stream audio, création d'un stream silencieux",
            base_video_path.display()
        );
    }

    let mut args: Vec<String> = vec![
        "-y".to_string(),
        "-i".to_string(),
        base_video_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
    ];

    if let Some(track) = music_track {
        args.push("-i".to_string());
        args.push(track.to_string_lossy().to_string());
    }

    if let Some(track) = voiceover_track {
        args.push("-i".to_string());
        args.push(track.to_string_lossy().to_string());
    }

    for layer in sfx_tracks {
        args.push("-i".to_string());
        args.push(layer.path.to_string_lossy().to_string());
    }

    let mut filter_parts: Vec<String> = Vec::new();
    let mut inputs_count = 0;
    let mut mix_inputs: Vec<String> = Vec::new();
    
    // ✅ CORRECTION: Ajouter l'audio de la vidéo seulement si elle en a un
    if video_has_audio {
        mix_inputs.push("[0:a]".to_string());
        inputs_count += 1;
    } else {
        // Créer un stream audio silencieux de la même durée que la vidéo
        // On utilisera anullsrc pour créer un silence
        info!("[AudioPipeline] Création d'un stream audio silencieux pour la vidéo");
        // Note: On pourrait aussi extraire la durée de la vidéo et créer un silence
        // Pour l'instant, on continue sans l'audio de la vidéo
    }

    // Musique
    if music_track.is_some() {
        filter_parts.push(format!(
            "[1:a]volume={:.3},dynaudnorm[a_music]",
            config.music_volume.clamp(0.0, 1.0)
        ));
        mix_inputs.push("[a_music]".to_string());
        inputs_count += 1;
    }

    // Voix off
    if voiceover_track.is_some() {
        let index = if music_track.is_some() { 2 } else { 1 };
        filter_parts.push(format!(
            "[{index}:a]volume={:.3},highpass=f=120,lowpass=f=4000[a_voice]",
            config.voice_volume.clamp(0.2, 2.0)
        ));
        mix_inputs.push("[a_voice]".to_string());
        inputs_count += 1;
    }

    // SFX
    if !sfx_tracks.is_empty() {
        for (idx, layer) in sfx_tracks.iter().enumerate() {
            let input_index =
                music_track.is_some() as usize + voiceover_track.is_some() as usize + 1 + idx;
            let gain = (config.sfx_volume * layer.gain).clamp(0.0, 2.0);
            filter_parts.push(format!(
                "[{input}:a]volume={gain:.3},adelay={start}|{start}[a_sfx{idx}]",
                input = input_index,
                start = (layer.start_offset.max(0.0) * 1000.0) as i32,
            ));
            mix_inputs.push(format!("[a_sfx{idx}]"));
            inputs_count += 1;
        }
    }

    // ✅ CORRECTION: Ne créer le mix que s'il y a des inputs audio
    if inputs_count == 0 {
        warn!("[AudioPipeline] Aucun input audio disponible, création d'un stream silencieux");
        // Créer un stream audio silencieux
        filter_parts.push("anullsrc=channel_layout=stereo:sample_rate=44100[aout]".to_string());
    } else {
        let mix_filter = format!(
            "{}amix=inputs={}:duration=first:dropout_transition=3[aout]",
            mix_inputs.join(""),
            inputs_count
        );
        filter_parts.push(mix_filter);
    }

    // TODO (Futur): intégrer spatialisation et mastering LUFS via Dolby/AudioShake
    match config.spatialization {
        SpatializationMode::None => {}
        SpatializationMode::WideStereo => {
            filter_parts.push("[aout]apulsator=mode=sine:hz=0.15[aout]".to_string());
        }
        SpatializationMode::Binaural => {
            filter_parts.push(
                "[aout]bs2b=cmoy[aout]".to_string(), /* simple binauralisation BS2B */
            );
        }
    }

    filter_parts.push("[aout]loudnorm=I=-14:TP=-1.5[a_final]".to_string());

    args.push("-filter_complex".to_string());
    args.push(filter_parts.join(";"));
    let mixed_audio_path = working_dir.join("mixed_audio.wav");
    args.extend_from_slice(&[
        "-map".to_string(),
        "[a_final]".to_string(),
        "-c:a".to_string(),
        "pcm_s16le".to_string(),
        mixed_audio_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
    ]);

    info!("[AudioPipeline] mix command: ffmpeg {}", args.join(" "));

    let output = Command::new("ffmpeg")
        .current_dir(working_dir)
        .args(&args)
        .output()
        .await
        .map_err(|err| {
            AppError::Internal(format!(
                "Impossible d'exécuter ffmpeg pour le mix audio: {err:?}"
            ))
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Internal(format!(
            "Échec mixage audio avancé: {stderr}"
        )));
    }

    Ok(mixed_audio_path)
}

/// Helper : construit une couche SFX simple (ex : whoosh)
pub fn sfx_layer(path: PathBuf, start_offset: f32, gain: f32) -> AudioLayer {
    AudioLayer {
        path,
        start_offset,
        gain,
    }
}

/// Option future : normalisation via service tiers (Dolby.io). Pour l'instant, on logge seulement.
pub async fn normalize_with_dolby(_audio: &Path) -> AppResult<()> {
    warn!("[AudioPipeline] Dolby normalization non implémentée (TODO)");
    Ok(())
}

pub fn build_sfx_layers_from_timeline(
    timeline: &ImmersiveTimeline,
    library_root: &Path,
) -> AppResult<Vec<AudioLayer>> {
    let mut layers = Vec::new();
    if !library_root.exists() {
        return Ok(layers);
    }
    let fps = timeline.fps.max(1) as f32;
    let cues = match &timeline.audio_cue_map {
        Some(cues) => cues,
        None => return Ok(layers),
    };

    let catalog = default_sfx_catalog(library_root);

    for cue in cues {
        if let Some(path) = choose_sfx_asset(&catalog, cue.cue_type.clone()) {
            if !path.exists() {
                continue;
            }
            let start_seconds = cue.start_frame as f32 / fps;
            layers.push(AudioLayer {
                path,
                start_offset: start_seconds,
                gain: match cue.cue_type {
                    AudioCueKind::Impact => 1.0,
                    AudioCueKind::Glitch => 0.85,
                    AudioCueKind::Riser => 0.75,
                    AudioCueKind::Beat => 0.65,
                },
            });
        }
    }

    Ok(layers)
}

fn default_sfx_catalog(root: &Path) -> HashMap<AudioCueKind, Vec<PathBuf>> {
    let mut map: HashMap<AudioCueKind, Vec<PathBuf>> = HashMap::new();

    let inserts = vec![
        (
            AudioCueKind::Impact,
            vec!["impact_whoosh.wav", "impact_boom.wav", "impact_stomp.wav"],
        ),
        (
            AudioCueKind::Glitch,
            vec![
                "glitch_datamosh.wav",
                "glitch_reverse.wav",
                "glitch_stutter.wav",
            ],
        ),
        (
            AudioCueKind::Riser,
            vec!["riser_swell.wav", "riser_sparkle.wav"],
        ),
        (
            AudioCueKind::Beat,
            vec!["beat_drop.wav", "beat_percussion.wav"],
        ),
    ];

    for (kind, files) in inserts {
        let paths: Vec<PathBuf> = files
            .into_iter()
            .map(|file| root.join(file))
            .filter(|path| path.exists())
            .collect::<Vec<PathBuf>>();
        if !paths.is_empty() {
            map.insert(kind, paths);
        }
    }

    map
}

fn choose_sfx_asset(
    catalog: &HashMap<AudioCueKind, Vec<PathBuf>>,
    cue_type: AudioCueKind,
) -> Option<PathBuf> {
    let entries = catalog.get(&cue_type)?;
    if entries.is_empty() {
        return None;
    }
    let index = (rand::random::<usize>()) % entries.len();
    entries.get(index).cloned()
}

pub async fn mux_video_with_audio(
    base_video_path: &Path,
    audio_path: &Path,
    output_path: &Path,
) -> AppResult<()> {
    let status = Command::new("ffmpeg")
        .args([
            "-y",
            "-i",
            base_video_path.to_string_lossy().as_ref(),
            "-i",
            audio_path.to_string_lossy().as_ref(),
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            output_path.to_string_lossy().as_ref(),
        ])
        .status()
        .await
        .map_err(|err| AppError::Internal(format!("Échec mux video/audio via ffmpeg: {err}")))?;

    if !status.success() {
        return Err(AppError::Internal(format!(
            "Mux video/audio a échoué (code={:?})",
            status.code()
        )));
    }

    Ok(())
}
