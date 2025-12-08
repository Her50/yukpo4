use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::process::Command;

use crate::core::types::{AppError, AppResult};
use log::{error, info, warn};

/// Configuration pour le watermark Yukpo
#[derive(Debug, Clone)]
pub struct WatermarkConfig {
    /// Chemin vers le logo Yukpo (PNG avec transparence)
    pub logo_path: PathBuf,
    /// Durée d'affichage en secondes (défaut: 2-3 secondes)
    pub duration_seconds: f32,
    /// Position du watermark : "bottom-right" | "center" | "bottom-left" | "top-right"
    pub position: String,
    /// Opacité (0.0 à 1.0, défaut: 0.85)
    pub opacity: f32,
    /// Taille du watermark en pourcentage de la largeur vidéo (défaut: 10%)
    pub size_percent: f32,
    /// Activer/désactiver l'animation fade-in/fade-out
    pub enable_animation: bool,
}

impl Default for WatermarkConfig {
    fn default() -> Self {
        Self {
            logo_path: PathBuf::from("backend/assets/logo/yukpo_logo.png"),
            duration_seconds: 2.5,
            position: "bottom-right".to_string(),
            opacity: 0.85,
            size_percent: 10.0,
            enable_animation: true,
        }
    }
}

/// Service de watermark pour appliquer le branding Yukpo sur les vidéos
pub struct WatermarkService;

impl WatermarkService {
    /// Crée une nouvelle instance du service
    pub fn new() -> Self {
        Self
    }

    /// Applique le watermark Yukpo sur une vidéo
    ///
    /// # Arguments
    /// * `input_video` - Chemin vers la vidéo source
    /// * `output_video` - Chemin vers la vidéo de sortie avec watermark
    /// * `config` - Configuration du watermark (optionnel, utilise les valeurs par défaut si None)
    ///
    /// # Returns
    /// Retourne le chemin vers la vidéo avec watermark ou une erreur
    pub async fn apply_watermark(
        &self,
        input_video: &Path,
        output_video: &Path,
        config: Option<WatermarkConfig>,
    ) -> AppResult<PathBuf> {
        let config = config.unwrap_or_else(WatermarkConfig::default);

        // Vérifier que la vidéo source existe
        if !input_video.exists() {
            return Err(AppError::Internal(format!(
                "Vidéo source introuvable: {}",
                input_video.display()
            )));
        }

        // Vérifier que le logo existe
        if !config.logo_path.exists() {
            warn!(
                "[WatermarkService] Logo introuvable: {}. Watermark désactivé.",
                config.logo_path.display()
            );
            // Si le logo n'existe pas, copier la vidéo source sans watermark
            fs::copy(input_video, output_video).await.map_err(|err| {
                AppError::Internal(format!(
                    "Impossible de copier la vidéo sans watermark: {}",
                    err
                ))
            })?;
            return Ok(output_video.to_path_buf());
        }

        info!(
            "[WatermarkService] Application du watermark Yukpo sur {} -> {}",
            input_video.display(),
            output_video.display()
        );

        // Obtenir la durée de la vidéo
        let video_duration = self.get_video_duration(input_video).await?;

        // Calculer les paramètres du watermark
        let watermark_duration = config.duration_seconds.min(video_duration);
        let start_time = (video_duration - watermark_duration).max(0.0);

        // Créer le répertoire de sortie si nécessaire
        if let Some(parent) = output_video.parent() {
            fs::create_dir_all(parent).await.map_err(|err| {
                AppError::Internal(format!(
                    "Impossible de créer le répertoire de sortie: {}",
                    err
                ))
            })?;
        }

        // Construire la commande FFmpeg
        let mut ffmpeg_args = vec!["-y".to_string()]; // Overwrite output

        // Input vidéo
        ffmpeg_args.push("-i".to_string());
        ffmpeg_args.push(input_video.to_string_lossy().to_string());

        // Input logo
        ffmpeg_args.push("-i".to_string());
        ffmpeg_args.push(config.logo_path.to_string_lossy().to_string());

        // Construire le filtre complexe pour overlay + animation
        let filter_complex =
            self.build_filter_complex(&config, start_time, watermark_duration, video_duration)?;

        ffmpeg_args.push("-filter_complex".to_string());
        ffmpeg_args.push(filter_complex);

        // Codec vidéo (copier pour éviter la ré-encodage si possible)
        // Mais on doit ré-encoder car on ajoute un overlay
        ffmpeg_args.push("-c:v".to_string());
        ffmpeg_args.push("libx264".to_string());
        ffmpeg_args.push("-preset".to_string());
        ffmpeg_args.push("fast".to_string()); // Fast encoding pour performance
        ffmpeg_args.push("-crf".to_string());
        ffmpeg_args.push("23".to_string()); // Qualité bonne

        // Copier l'audio
        ffmpeg_args.push("-c:a".to_string());
        ffmpeg_args.push("copy".to_string());

        // Output
        ffmpeg_args.push(output_video.to_string_lossy().to_string());

        // Exécuter FFmpeg
        let output = Command::new("ffmpeg")
            .args(&ffmpeg_args)
            .output()
            .await
            .map_err(|err| {
                AppError::Internal(format!(
                    "Impossible d'exécuter FFmpeg pour watermark: {}",
                    err
                ))
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            error!(
                "[WatermarkService] Échec FFmpeg: {}\nStderr: {}",
                output.status, stderr
            );
            return Err(AppError::Internal(format!(
                "Échec d'application du watermark: {}",
                stderr
            )));
        }

        // Vérifier que la vidéo de sortie a été créée
        if !output_video.exists() {
            return Err(AppError::Internal(format!(
                "Vidéo avec watermark non créée: {}",
                output_video.display()
            )));
        }

        info!(
            "[WatermarkService] ✅ Watermark appliqué avec succès: {}",
            output_video.display()
        );

        Ok(output_video.to_path_buf())
    }

    /// Obtient la durée d'une vidéo en secondes
    async fn get_video_duration(&self, video_path: &Path) -> AppResult<f32> {
        let output = Command::new("ffprobe")
            .args(&[
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                &video_path.to_string_lossy(),
            ])
            .output()
            .await
            .map_err(|err| {
                AppError::Internal(format!(
                    "Impossible d'exécuter ffprobe pour obtenir la durée: {}",
                    err
                ))
            })?;

        if !output.status.success() {
            return Err(AppError::Internal(
                "Impossible d'obtenir la durée de la vidéo".to_string(),
            ));
        }

        let duration_str = String::from_utf8_lossy(&output.stdout);
        duration_str
            .trim()
            .parse::<f32>()
            .map_err(|_| AppError::Internal("Durée vidéo invalide".to_string()))
    }

    /// Construit le filtre complexe FFmpeg pour le watermark avec animation
    fn build_filter_complex(
        &self,
        config: &WatermarkConfig,
        start_time: f32,
        duration: f32,
        _video_duration: f32,
    ) -> AppResult<String> {
        // Redimensionner le logo (size_percent% de la largeur vidéo)
        let scale_filter = format!(
            "scale=iw*{}:ih*{}",
            config.size_percent / 100.0,
            config.size_percent / 100.0
        );

        // Position du watermark
        let overlay_position = match config.position.as_str() {
            "center" => "overlay=(W-w)/2:(H-h)/2",
            "bottom-left" => "overlay=20:H-h-20",
            "top-right" => "overlay=W-w-20:20",
            "top-left" => "overlay=20:20",
            _ => "overlay=W-w-20:H-h-20", // bottom-right par défaut
        };

        // Animation fade-in/fade-out
        let fade_duration: f32 = if config.enable_animation { 0.5 } else { 0.0 };
        let fade_in_start = start_time;
        let fade_in_end = start_time + fade_duration.min((duration / 2.0) as f32);
        let fade_out_start = (start_time + duration - fade_duration).max(fade_in_end);
        let _fade_out_end = start_time + duration;

        // Construire le filtre complexe
        // [1:v] = logo, [0:v] = vidéo
        let mut filters = Vec::new();

        // Redimensionner le logo
        filters.push(format!("[1:v]{}[logo_scaled]", scale_filter));

        // Appliquer l'opacité
        filters.push(format!(
            "[logo_scaled]format=rgba,colorchannelmixer=aa={}[logo_alpha]",
            config.opacity
        ));

        // Animation fade-in/fade-out avec enable conditionnel
        if config.enable_animation && fade_duration > 0.0 {
            filters.push(format!(
                "[logo_alpha]fade=t=in:st={}:d={}:alpha=1[logo_fade_in]",
                fade_in_start, fade_duration
            ));
            filters.push(format!(
                "[logo_fade_in]fade=t=out:st={}:d={}:alpha=1[logo_ready]",
                fade_out_start, fade_duration
            ));
        } else {
            filters.push("[logo_alpha]copy[logo_ready]".to_string());
        }

        // Overlay avec enable conditionnel pour n'afficher que pendant la durée spécifiée
        filters.push(format!(
            "[0:v][logo_ready]{}:enable='between(t,{},{})'[v]",
            overlay_position,
            start_time,
            start_time + duration
        ));

        Ok(filters.join(";"))
    }

    /// Vérifie si FFmpeg est disponible sur le système
    pub async fn check_ffmpeg_available(&self) -> bool {
        Command::new("ffmpeg")
            .arg("-version")
            .output()
            .await
            .map(|output| output.status.success())
            .unwrap_or(false)
    }

    /// Vérifie si le logo existe
    pub fn check_logo_exists(config: &WatermarkConfig) -> bool {
        config.logo_path.exists()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_default_config() {
        let config = WatermarkConfig::default();
        assert_eq!(config.duration_seconds, 2.5);
        assert_eq!(config.position, "bottom-right");
        assert_eq!(config.opacity, 0.85);
        assert_eq!(config.size_percent, 10.0);
        assert!(config.enable_animation);
    }

    #[tokio::test]
    async fn test_check_ffmpeg() {
        let service = WatermarkService::new();
        let available = service.check_ffmpeg_available().await;
        // FFmpeg peut être disponible ou non selon l'environnement de test
        println!("FFmpeg available: {}", available);
    }
}
