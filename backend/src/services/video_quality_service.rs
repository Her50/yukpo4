/**
 * Service de génération de qualités vidéo multiples
 * Génère plusieurs versions d'une vidéo (360p, 480p, 720p, 1080p)
 */
use crate::state::AppState;
use anyhow::{Context, Result};
use log;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;
use tokio::fs;

#[derive(Debug, Clone)]
pub struct VideoQuality {
    pub name: String, // "360p", "480p", "720p", "1080p"
    pub width: u32,
    pub height: u32,
    pub bitrate: String, // "500k", "1000k", "2500k", "5000k"
}

impl VideoQuality {
    pub fn all() -> Vec<VideoQuality> {
        vec![
            VideoQuality {
                name: "360p".to_string(),
                width: 640,
                height: 360,
                bitrate: "800k".to_string(),
            },
            VideoQuality {
                name: "480p".to_string(),
                width: 854,
                height: 480,
                bitrate: "1500k".to_string(),
            },
            VideoQuality {
                name: "720p".to_string(),
                width: 1280,
                height: 720,
                bitrate: "4000k".to_string(),
            },
            VideoQuality {
                name: "1080p".to_string(),
                width: 1920,
                height: 1080,
                bitrate: "8000k".to_string(),
            },
        ]
    }
}

pub struct VideoQualityService;

impl VideoQualityService {
    /**
     * Génère toutes les qualités d'une vidéo
     * Retourne un map de qualité -> URL
     */
    pub async fn generate_all_qualities(
        state: &Arc<AppState>,
        original_video_path: &str,
    ) -> Result<std::collections::HashMap<String, String>> {
        log::info!(
            "🎬 [VideoQuality] Génération qualités pour: {}",
            original_video_path
        );

        let qualities = VideoQuality::all();
        let mut quality_urls = std::collections::HashMap::new();

        // Télécharger la vidéo si elle est distante
        let local_video_path = if original_video_path.starts_with("http://")
            || original_video_path.starts_with("https://")
        {
            Self::download_video(state, original_video_path).await?
        } else {
            PathBuf::from(original_video_path)
        };

        // Créer le dossier de sortie
        let output_dir = Path::new("temp/video_qualities");
        fs::create_dir_all(&output_dir)
            .await
            .context("Impossible de créer le dossier de sortie")?;

        // Générer chaque qualité
        for quality in &qualities {
            log::info!("📹 [VideoQuality] Génération {}...", quality.name);

            let output_filename = format!(
                "{}_{}.mp4",
                local_video_path.file_stem().and_then(|s| s.to_str()).unwrap_or("video"),
                quality.name
            );
            let output_path = output_dir.join(&output_filename);

            // Générer la vidéo avec FFmpeg
            let scale_filter = format!(
                "scale={}:{}:force_original_aspect_ratio=decrease",
                quality.width, quality.height
            );
            let ffmpeg_args = vec![
                "-i",
                local_video_path.to_str().unwrap(),
                "-vf",
                &scale_filter,
                "-c:v",
                "libx264",
                "-b:v",
                &quality.bitrate,
                "-c:a",
                "aac",
                "-b:a",
                "128k",
                "-preset",
                "slow",
                "-crf",
                "18",
                "-y",
                output_path.to_str().unwrap(),
            ];

            let output = Command::new("ffmpeg")
                .args(&ffmpeg_args)
                .output()
                .context("Erreur exécution FFmpeg")?;

            if !output.status.success() {
                let error_msg = String::from_utf8_lossy(&output.stderr);
                log::error!(
                    "❌ [VideoQuality] Erreur FFmpeg pour {}: {}",
                    quality.name,
                    error_msg
                );
                continue; // Continuer avec les autres qualités
            }

            log::info!(
                "✅ [VideoQuality] Qualité {} générée: {}",
                quality.name,
                output_path.display()
            );

            // Upload vers le storage
            let video_url = state
                .media_storage
                .upload_file(
                    &output_path.to_str().unwrap(),
                    &format!("video_qualities/{}", output_filename),
                )
                .await?;

            quality_urls.insert(quality.name.clone(), video_url);

            // Nettoyer le fichier local
            fs::remove_file(&output_path).await.ok();
        }

        // Nettoyer la vidéo téléchargée si nécessaire
        if original_video_path.starts_with("http://") || original_video_path.starts_with("https://")
        {
            fs::remove_file(&local_video_path).await.ok();
        }

        log::info!("✅ [VideoQuality] {} qualités générées", quality_urls.len());
        Ok(quality_urls)
    }

    /**
     * Génère une qualité spécifique
     */
    pub async fn generate_quality(
        state: &Arc<AppState>,
        original_video_path: &str,
        quality: &VideoQuality,
    ) -> Result<String> {
        log::info!(
            "🎬 [VideoQuality] Génération {} pour: {}",
            quality.name,
            original_video_path
        );

        let local_video_path = if original_video_path.starts_with("http://")
            || original_video_path.starts_with("https://")
        {
            Self::download_video(state, original_video_path).await?
        } else {
            PathBuf::from(original_video_path)
        };

        let output_dir = Path::new("temp/video_qualities");
        fs::create_dir_all(&output_dir).await?;

        let output_filename = format!(
            "{}_{}.mp4",
            local_video_path.file_stem().and_then(|s| s.to_str()).unwrap_or("video"),
            quality.name
        );
        let output_path = output_dir.join(&output_filename);

        let scale_filter = format!(
            "scale={}:{}:force_original_aspect_ratio=decrease",
            quality.width, quality.height
        );
        let ffmpeg_args = vec![
            "-i",
            local_video_path.to_str().unwrap(),
            "-vf",
            &scale_filter,
            "-c:v",
            "libx264",
            "-b:v",
            &quality.bitrate,
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-preset",
            "medium",
            "-crf",
            "23",
            "-y",
            output_path.to_str().unwrap(),
        ];

        let output = Command::new("ffmpeg")
            .args(&ffmpeg_args)
            .output()
            .context("Erreur exécution FFmpeg")?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("Erreur génération qualité: {}", error_msg));
        }

        let video_url = state
            .media_storage
            .upload_file(
                &output_path.to_str().unwrap(),
                &format!("video_qualities/{}", output_filename),
            )
            .await?;

        fs::remove_file(&output_path).await.ok();
        if original_video_path.starts_with("http://") || original_video_path.starts_with("https://")
        {
            fs::remove_file(&local_video_path).await.ok();
        }

        Ok(video_url)
    }

    async fn download_video(_state: &Arc<AppState>, video_url: &str) -> Result<PathBuf> {
        let temp_dir = Path::new("temp/video_downloads");
        fs::create_dir_all(&temp_dir).await?;

        let filename = format!("video_{}.mp4", chrono::Utc::now().timestamp());
        let local_path = temp_dir.join(&filename);

        let response = reqwest::get(video_url).await?;
        let bytes = response.bytes().await?;
        fs::write(&local_path, bytes).await?;

        Ok(local_path)
    }
}
