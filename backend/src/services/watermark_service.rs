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
    /// Durée d'affichage en secondes — **uniquement en fin de vidéo** (signature Yukpo)
    pub duration_seconds: f32,
    /// Position du logo sur la séquence de signature : "bottom-right" | "center" | "bottom-left" | "top-right"
    /// Pour une vraie « carte » de fin, utiliser **center** (défaut).
    pub position: String,
    /// Opacité (0.0 à 1.0, défaut: 0.92)
    pub opacity: f32,
    /// Largeur du logo en % de la **largeur de la vidéo** (via `scale2ref`, pas l’ancienne échelle erronée sur le PNG)
    pub size_percent: f32,
    /// Activer/désactiver l'animation fade-in/fade-out sur le logo
    pub enable_animation: bool,
    /// Bandeau sombre en bas pendant la signature (lisibilité du logo + aspect « fin de spot »)
    pub signature_bottom_band: bool,
}

impl Default for WatermarkConfig {
    fn default() -> Self {
        Self {
            logo_path: PathBuf::from("backend/assets/logo/yukpo_logo.png"),
            duration_seconds: 2.8,
            position: "center".to_string(),
            opacity: 0.92,
            size_percent: 28.0,
            enable_animation: true,
            signature_bottom_band: true,
        }
    }
}

/// Service de watermark : **signature Yukpo en fin de vidéo** (dernières secondes) avec logo,
/// lisible et centrée par défaut — pas un logo discret sur tout le métrage.
pub struct WatermarkService;

impl WatermarkService {
    /// Crée une nouvelle instance du service
    pub fn new() -> Self {
        Self
    }

    /// Applique la **signature vidéo Yukpo** : sur les **dernières** `duration_seconds`,
    /// affichage du **logo Yukpo** (centré par défaut, bandeau optionnel pour le contraste).
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
        let mut config = config.unwrap_or_default();

        // Vérifier que la vidéo source existe
        if !input_video.exists() {
            return Err(AppError::Internal(format!(
                "Vidéo source introuvable: {}",
                input_video.display()
            )));
        }

        // Vérifier que le logo existe (essayer plusieurs chemins possibles)
        // En monorepo, l’icône Expo (`mobile/assets/icon.png`, voir app.config.js) peut servir de repli
        // si `yukpo_logo.png` n’est pas encore déployé côté serveur.
        let possible_paths = vec![
            config.logo_path.clone(),
            PathBuf::from("backend/assets/logo/yukpo_logo.png"),
            PathBuf::from("assets/logo/yukpo_logo.png"),
            PathBuf::from("../assets/logo/yukpo_logo.png"),
            PathBuf::from("../mobile/assets/icon.png"),
            PathBuf::from("mobile/assets/icon.png"),
        ];

        let mut logo_found = false;
        for path in &possible_paths {
            if path.exists() {
                config.logo_path = path.clone();
                logo_found = true;
                break;
            }
        }

        if !logo_found {
            warn!(
                "[WatermarkService] Logo introuvable aux emplacements suivants: {:?}. Watermark désactivé.",
                possible_paths.iter().map(|p| p.display().to_string()).collect::<Vec<_>>()
            );
            warn!(
                "[WatermarkService] 💡 Déposez yukpo_logo.png dans backend/assets/logo/ (prod), ou réutilisez l’icône app mobile/mobile/assets/icon.png si le backend tourne dans le monorepo. WatermarkConfig peut aussi fixer logo_path."
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

        // PNG / image : boucler les frames pour couvrir toute la durée (overlay + fades)
        ffmpeg_args.push("-loop".to_string());
        ffmpeg_args.push("1".to_string());
        ffmpeg_args.push("-i".to_string());
        ffmpeg_args.push(config.logo_path.to_string_lossy().to_string());

        // Construire le filtre complexe pour overlay + animation
        // Utiliser le logo_path trouvé (config est déjà utilisé avec le bon logo_path)
        let filter_complex =
            self.build_filter_complex(&config, start_time, watermark_duration, video_duration)?;

        ffmpeg_args.push("-filter_complex".to_string());
        ffmpeg_args.push(filter_complex);

        // Sortie vidéo = graphe [v] ; audio = piste 0 si la source en a une
        ffmpeg_args.push("-map".to_string());
        ffmpeg_args.push("[v]".to_string());
        let has_audio = self.has_audio_stream(input_video).await.unwrap_or(false);
        if has_audio {
            ffmpeg_args.push("-map".to_string());
            ffmpeg_args.push("0:a:0".to_string());
        }

        // Codec vidéo (copier pour éviter la ré-encodage si possible)
        // Mais on doit ré-encoder car on ajoute un overlay
        ffmpeg_args.push("-c:v".to_string());
        ffmpeg_args.push("libx264".to_string());
        ffmpeg_args.push("-preset".to_string());
        ffmpeg_args.push("fast".to_string()); // Fast encoding pour performance
        ffmpeg_args.push("-crf".to_string());
        ffmpeg_args.push("23".to_string()); // Qualité bonne

        if has_audio {
            ffmpeg_args.push("-c:a".to_string());
            ffmpeg_args.push("copy".to_string());
        }

        // Output
        ffmpeg_args.push(output_video.to_string_lossy().to_string());

        // Exécuter FFmpeg
        let output = Command::new("ffmpeg").args(&ffmpeg_args).output().await.map_err(|err| {
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

    /// Indique si le conteneur contient au moins une piste audio (ffprobe).
    async fn has_audio_stream(&self, video_path: &Path) -> AppResult<bool> {
        let output = Command::new("ffprobe")
            .args([
                "-v",
                "error",
                "-select_streams",
                "a",
                "-show_entries",
                "stream=index",
                "-of",
                "csv=p=0",
                &video_path.to_string_lossy(),
            ])
            .output()
            .await
            .map_err(|err| {
                AppError::Internal(format!("Impossible d'exécuter ffprobe (audio): {}", err))
            })?;

        if !output.status.success() {
            return Ok(false);
        }

        Ok(!String::from_utf8_lossy(&output.stdout).trim().is_empty())
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

    /// Construit le filtre complexe FFmpeg : bandeau optionnel, `scale2ref` (logo = % largeur vidéo), overlay.
    fn build_filter_complex(
        &self,
        config: &WatermarkConfig,
        start_time: f32,
        duration: f32,
        _video_duration: f32,
    ) -> AppResult<String> {
        let end_t = start_time + duration;
        let pct = config.size_percent / 100.0;

        // Position du logo (signature)
        let overlay_position = match config.position.as_str() {
            "center" => "overlay=(W-w)/2:(H-h)/2",
            "bottom-left" => "overlay=24:H-h-24",
            "top-right" => "overlay=W-w-24:24",
            "top-left" => "overlay=24:24",
            _ => "overlay=W-w-24:H-h-24", // bottom-right
        };

        let fade_duration: f32 = if config.enable_animation { 0.45 } else { 0.0 };
        let fade_out_start = (start_time + duration - fade_duration).max(start_time);

        let mut filters: Vec<String> = Vec::new();

        // Fond lisible pour la signature (bas de frame), uniquement sur la fenêtre de fin
        if config.signature_bottom_band {
            filters.push(format!(
                "[0:v]drawbox=x=0:y=ih*0.52:w=iw:h=ih*0.48:color=black@0.38:t=fill:enable='between(t\\,{st}\\,{en})'[v0]",
                st = start_time,
                en = end_t
            ));
        } else {
            filters.push("[0:v]format=yuv420p[v0]".to_string());
        }

        // scale2ref : iw/ih = dimensions de la **vidéo** de référence [v0], pas du PNG
        filters.push(format!(
            "[v0][1:v]scale2ref=w=iw*{pct}:h=-1[base][logo_scaled]",
            pct = pct
        ));

        filters.push(format!(
            "[logo_scaled]format=rgba,colorchannelmixer=aa={}[logo_alpha]",
            config.opacity
        ));

        if config.enable_animation && fade_duration > 0.0 {
            filters.push(format!(
                "[logo_alpha]fade=t=in:st={}:d={}:alpha=1[logo_fade_in]",
                start_time, fade_duration
            ));
            filters.push(format!(
                "[logo_fade_in]fade=t=out:st={}:d={}:alpha=1[logo_ready]",
                fade_out_start, fade_duration
            ));
        } else {
            filters.push("[logo_alpha]format=rgba[logo_ready]".to_string());
        }

        filters.push(format!(
            "[base][logo_ready]{op}:enable='between(t\\,{st}\\,{en})'[v]",
            op = overlay_position,
            st = start_time,
            en = end_t
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

    #[test]
    fn test_default_config() {
        let config = WatermarkConfig::default();
        assert_eq!(config.duration_seconds, 2.8);
        assert_eq!(config.position, "center");
        assert_eq!(config.opacity, 0.92);
        assert_eq!(config.size_percent, 28.0);
        assert!(config.enable_animation);
        assert!(config.signature_bottom_band);
    }

    #[tokio::test]
    async fn test_check_ffmpeg() {
        let service = WatermarkService::new();
        let available = service.check_ffmpeg_available().await;
        // FFmpeg peut être disponible ou non selon l'environnement de test
        println!("FFmpeg available: {}", available);
    }
}
