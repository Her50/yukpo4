/**
 * Service d'extraction audio depuis vidéos
 * Utilise FFmpeg pour extraire l'audio d'une vidéo
 */
use crate::state::AppState;
use anyhow::{Context, Result};
use log;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;
use tokio::fs;

pub struct AudioExtractionService;

impl AudioExtractionService {
    /**
     * Extrait l'audio d'une vidéo et le sauvegarde
     * Retourne le chemin du fichier audio extrait
     */
    pub async fn extract_audio(
        state: &Arc<AppState>,
        video_path: &str,
        output_format: &str, // "mp3", "m4a", "aac"
    ) -> Result<String> {
        log::info!("🎵 [AudioExtraction] Extraction audio de: {}", video_path);

        // Télécharger la vidéo si elle est distante
        let local_video_path =
            if video_path.starts_with("http://") || video_path.starts_with("https://") {
                Self::download_video(state, video_path).await?
            } else {
                PathBuf::from(video_path)
            };

        // Créer le dossier de sortie
        let output_dir = Path::new("temp/audio_extractions");
        fs::create_dir_all(&output_dir)
            .await
            .context("Impossible de créer le dossier de sortie")?;

        // Générer le nom du fichier de sortie
        let video_name = local_video_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("audio");
        let output_filename = format!(
            "{}_{}.{}",
            video_name,
            chrono::Utc::now().timestamp(),
            output_format
        );
        let output_path = output_dir.join(&output_filename);

        // Extraire l'audio avec FFmpeg
        let ffmpeg_args = vec![
            "-i",
            local_video_path.to_str().unwrap(),
            "-vn", // Pas de vidéo
            "-acodec",
            match output_format {
                "mp3" => "libmp3lame",
                "m4a" | "aac" => "aac",
                _ => "libmp3lame",
            },
            "-ab",
            "192k", // Bitrate audio
            "-ar",
            "44100", // Sample rate
            "-y",    // Overwrite
            output_path.to_str().unwrap(),
        ];

        let output = Command::new("ffmpeg")
            .args(&ffmpeg_args)
            .output()
            .context("Erreur exécution FFmpeg")?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            log::error!("❌ [AudioExtraction] Erreur FFmpeg: {}", error_msg);
            return Err(anyhow::anyhow!("Erreur extraction audio: {}", error_msg));
        }

        log::info!(
            "✅ [AudioExtraction] Audio extrait: {}",
            output_path.display()
        );

        // Upload vers le storage (S3/Wasabi)
        let stored = state
            .media_storage
            .store_file(
                &output_path.to_str().unwrap(),
                &format!("audio_extractions/{}", output_filename),
                Some("audio/mpeg"),
            )
            .await?;
        let audio_url = stored.public_url;

        // Nettoyer le fichier local
        fs::remove_file(&output_path).await.ok(); // Ignorer erreurs de nettoyage

        Ok(audio_url)
    }

    /**
     * Télécharge une vidéo depuis une URL
     */
    async fn download_video(state: &Arc<AppState>, video_url: &str) -> Result<PathBuf> {
        log::info!("📥 [AudioExtraction] Téléchargement vidéo: {}", video_url);

        let temp_dir = Path::new("temp/video_downloads");
        fs::create_dir_all(&temp_dir)
            .await
            .context("Impossible de créer le dossier temporaire")?;

        let filename = format!("video_{}.mp4", chrono::Utc::now().timestamp());
        let local_path = temp_dir.join(&filename);

        // Télécharger avec reqwest
        let response = reqwest::get(video_url).await?;
        let bytes = response.bytes().await?;
        fs::write(&local_path, bytes).await?;

        log::info!(
            "✅ [AudioExtraction] Vidéo téléchargée: {}",
            local_path.display()
        );
        Ok(local_path)
    }

    /**
     * Extrait l'audio et retourne l'URL publique
     */
    pub async fn extract_and_upload(state: &Arc<AppState>, video_path: &str) -> Result<String> {
        Self::extract_audio(state, video_path, "mp3").await
    }
}
