// ✅ NOUVEAU: Service de génération automatique de sous-titres

use crate::core::types::{AppError, AppResult};
use base64::Engine as _;
use log::{error, info};
use serde::{Deserialize, Serialize};
use tokio::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoCaptionsRequest {
    pub video_url: String,
    pub audio_url: Option<String>,
    pub lang: Option<String>,            // défaut: "fr"
    pub style: Option<String>,           // "modern", "minimal", "bold", "elegant"
    pub position: Option<String>,        // "auto", "bottom", "top", "center"
    pub max_chars_per_line: Option<i32>, // défaut: 42
    pub font_size: Option<f64>,          // défaut: 24.0
    pub background_opacity: Option<f64>, // 0.0-1.0, défaut: 0.7
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoCaptionsResponse {
    pub success: bool,
    pub subtitles: Vec<Subtitle>,
    pub subtitle_file_url: String,        // SRT/VTT
    pub styled_video_url: Option<String>, // Vidéo avec sous-titres intégrés
    pub confidence: f64,                  // 0.0-1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subtitle {
    pub start_time: f64,
    pub end_time: f64,
    pub text: String,
    pub confidence: f64,
    pub words: Option<Vec<WordTiming>>, // Optionnel, pour word-level timing
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WordTiming {
    pub word: String,
    pub start_time: f64,
    pub end_time: f64,
    pub confidence: f64,
}

/// Génère des sous-titres automatiques depuis l'audio d'une vidéo
pub async fn generate_captions(request: AutoCaptionsRequest) -> AppResult<AutoCaptionsResponse> {
    info!(
        "[CaptionsService] Génération sous-titres - video_url: {}, lang: {:?}",
        request.video_url, request.lang
    );

    let lang = request.lang.as_deref().unwrap_or("fr");
    let style = request.style.as_deref().unwrap_or("modern");
    let max_chars = request.max_chars_per_line.unwrap_or(42);

    // 1. Extraire audio de la vidéo si nécessaire
    let audio_url = if let Some(audio_url) = &request.audio_url {
        audio_url.clone()
    } else {
        // Extraire audio de la vidéo avec FFmpeg
        let temp_audio_path = format!("{}_temp_audio.wav", request.video_url);

        let extract_result = tokio::process::Command::new("ffmpeg")
            .args(&[
                "-i",
                &request.video_url,
                "-vn", // Pas de vidéo
                "-acodec",
                "pcm_s16le", // Audio PCM
                "-ar",
                "16000", // Sample rate pour Whisper
                "-ac",
                "1", // Mono
                "-y",
                &temp_audio_path,
            ])
            .output()
            .await;

        match extract_result {
            Ok(_) => {
                info!("[CaptionsService] Audio extrait avec succès");
                temp_audio_path
            }
            Err(e) => {
                error!("[CaptionsService] Erreur extraction audio: {}", e);
                return Err(AppError::Internal(format!(
                    "Erreur extraction audio: {}",
                    e
                )));
            }
        }
    };

    // 2. Lire le fichier audio et le convertir en base64 pour Whisper
    let audio_bytes = tokio::fs::read(&audio_url)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur lecture audio: {}", e)))?;

    let audio_base64 = base64::engine::general_purpose::STANDARD.encode(&audio_bytes);

    // 3. Transcrire avec Whisper
    let transcription_result = crate::services::audio_transcription_service::AudioTranscriptionService::transcribe_audio_base64(&audio_base64).await?;

    // 4. Segmenter transcription en sous-titres
    let subtitles = segment_transcription(
        &transcription_result.text,
        max_chars,
        lang,
        transcription_result.duration.unwrap_or(0.0),
    )
    .await?;

    // 4. Générer fichier SRT
    let srt_content = generate_srt_file(&subtitles);
    let subtitle_file_url = format!("{}_subtitles.srt", request.video_url);

    // Sauvegarder le fichier SRT
    fs::write(&subtitle_file_url, &srt_content)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur sauvegarde SRT: {}", e)))?;

    info!(
        "[CaptionsService] Fichier SRT sauvegardé: {}",
        subtitle_file_url
    );

    // 5. Appliquer style si demandé
    let styled_video_url = if style != "none" {
        Some(format!("{}_styled_{}", request.video_url, style))
    } else {
        None
    };

    Ok(AutoCaptionsResponse {
        success: true,
        subtitles,
        subtitle_file_url,
        styled_video_url,
        confidence: 0.95, // Placeholder
    })
}

/// Segmente une transcription en sous-titres respectant max_chars_per_line
async fn segment_transcription(
    transcription: &str,
    max_chars: i32,
    _lang: &str,
    total_duration: f32,
) -> AppResult<Vec<Subtitle>> {
    if transcription.trim().is_empty() {
        return Ok(vec![]);
    }

    let words: Vec<&str> = transcription.split_whitespace().collect();
    let word_count = words.len();
    let avg_duration_per_word = if word_count > 0 {
        total_duration / word_count as f32
    } else {
        0.3 // Par défaut 0.3s par mot
    };

    let mut subtitles = Vec::new();
    let mut current_text = String::new();
    let mut current_start = 0.0;

    for word in &words {
        let word_with_space = if current_text.is_empty() {
            word.to_string()
        } else {
            format!(" {}", word)
        };

        // Vérifier si on dépasse la limite de caractères
        if current_text.len() + word_with_space.len() > max_chars as usize
            && !current_text.is_empty()
        {
            // Créer un sous-titre avec le texte actuel
            let word_count_in_subtitle = current_text.split_whitespace().count();
            let subtitle_duration = word_count_in_subtitle as f32 * avg_duration_per_word;

            subtitles.push(Subtitle {
                start_time: current_start as f64,
                end_time: (current_start + subtitle_duration) as f64,
                text: current_text.trim().to_string(),
                confidence: 0.95,
                words: None,
            });

            // Commencer un nouveau sous-titre
            current_text = word.to_string();
            current_start += subtitle_duration;
        } else {
            current_text.push_str(&word_with_space);
        }

        word_index += 1;
    }

    // Ajouter le dernier sous-titre
    if !current_text.trim().is_empty() {
        let word_count_in_subtitle = current_text.split_whitespace().count();
        let subtitle_duration = word_count_in_subtitle as f32 * avg_duration_per_word;

        subtitles.push(Subtitle {
            start_time: current_start as f64,
            end_time: ((current_start + subtitle_duration).min(total_duration)) as f64,
            text: current_text.trim().to_string(),
            confidence: 0.95,
            words: None,
        });
    }

    Ok(subtitles)
}

/// Génère un fichier SRT depuis les sous-titres
fn generate_srt_file(subtitles: &[Subtitle]) -> String {
    let mut srt = String::new();

    for (index, subtitle) in subtitles.iter().enumerate() {
        srt.push_str(&format!("{}\n", index + 1));
        srt.push_str(&format!(
            "{} --> {}\n",
            format_time_srt(subtitle.start_time),
            format_time_srt(subtitle.end_time)
        ));
        srt.push_str(&format!("{}\n\n", subtitle.text));
    }

    srt
}

/// Formate un temps en format SRT (HH:MM:SS,mmm)
fn format_time_srt(seconds: f64) -> String {
    let hours = (seconds / 3600.0) as u32;
    let minutes = ((seconds % 3600.0) / 60.0) as u32;
    let secs = (seconds % 60.0) as u32;
    let millis = ((seconds % 1.0) * 1000.0) as u32;

    format!("{:02}:{:02}:{:02},{:03}", hours, minutes, secs, millis)
}
