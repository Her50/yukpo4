/**
 * Service de génération HLS/DASH pour qualité adaptative serveur
 * Génère les variantes de qualité (360p, 720p, 1080p) et les playlists
 */
use crate::core::types::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoQuality {
    pub resolution: String, // "360p", "720p", "1080p"
    pub bitrate: String,    // "500k", "2500k", "5000k"
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HLSManifest {
    pub master_playlist_url: String,
    pub variant_playlists: Vec<VariantPlaylist>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VariantPlaylist {
    pub quality: String,
    pub playlist_url: String,
    pub bandwidth: u32,
    pub resolution: String,
}

pub struct HLSDashService {
    output_dir: PathBuf,
    ffmpeg_path: String,
}

impl HLSDashService {
    pub fn new(output_dir: impl AsRef<Path>) -> Self {
        Self {
            output_dir: output_dir.as_ref().to_path_buf(),
            ffmpeg_path: "ffmpeg".to_string(), // Peut être configuré via env var
        }
    }

    /// Qualités supportées
    pub fn get_quality_profiles() -> Vec<VideoQuality> {
        vec![
            VideoQuality {
                resolution: "360p".to_string(),
                bitrate: "500k".to_string(),
                width: 640,
                height: 360,
            },
            VideoQuality {
                resolution: "720p".to_string(),
                bitrate: "2500k".to_string(),
                width: 1280,
                height: 720,
            },
            VideoQuality {
                resolution: "1080p".to_string(),
                bitrate: "5000k".to_string(),
                width: 1920,
                height: 1080,
            },
        ]
    }

    /// Génère les variantes HLS pour une vidéo
    pub async fn generate_hls_variants(
        &self,
        input_video_path: &str,
        video_id: &str,
    ) -> AppResult<HLSManifest> {
        let video_dir = self.output_dir.join(video_id);
        fs::create_dir_all(&video_dir)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur création dossier HLS: {}", e)))?;

        let qualities = Self::get_quality_profiles();
        let mut variant_playlists = Vec::new();

        // Générer chaque variante
        for quality in &qualities {
            let variant_dir = video_dir.join(&quality.resolution);
            fs::create_dir_all(&variant_dir).await.map_err(|e| {
                AppError::Internal(format!("Erreur création dossier variante: {}", e))
            })?;

            let playlist_path = variant_dir.join("playlist.m3u8");
            let segment_pattern = variant_dir.join("segment_%03d.ts");

            // Commande FFmpeg pour générer HLS
            let output = Command::new(&self.ffmpeg_path)
                .arg("-i")
                .arg(input_video_path)
                .arg("-c:v")
                .arg("libx264")
                .arg("-c:a")
                .arg("aac")
                .arg("-b:v")
                .arg(&quality.bitrate)
                .arg("-b:a")
                .arg("128k")
                .arg("-s")
                .arg(format!("{}x{}", quality.width, quality.height))
                .arg("-hls_time")
                .arg("10")
                .arg("-hls_list_size")
                .arg("0")
                .arg("-hls_segment_filename")
                .arg(segment_pattern.to_string_lossy().as_ref())
                .arg("-f")
                .arg("hls")
                .arg(playlist_path.to_string_lossy().as_ref())
                .output()
                .await
                .map_err(|e| AppError::Internal(format!("Erreur FFmpeg: {}", e)))?;

            if !output.status.success() {
                let error = String::from_utf8_lossy(&output.stderr);
                return Err(AppError::Internal(format!(
                    "Erreur génération HLS {}: {}",
                    quality.resolution, error
                )));
            }

            // Calculer bandwidth (bitrate vidéo + audio)
            let bandwidth =
                quality.bitrate.trim_end_matches('k').parse::<u32>().unwrap_or(500) + 128; // + audio bitrate

            variant_playlists.push(VariantPlaylist {
                quality: quality.resolution.clone(),
                playlist_url: format!(
                    "/api/videos/{}/{}/playlist.m3u8",
                    video_id, quality.resolution
                ),
                bandwidth,
                resolution: format!("{}x{}", quality.width, quality.height),
            });
        }

        // Générer master playlist
        let master_playlist = self.generate_master_playlist(&variant_playlists, video_id).await?;
        let master_playlist_path = video_dir.join("master.m3u8");
        fs::write(&master_playlist_path, master_playlist)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur écriture master playlist: {}", e)))?;

        Ok(HLSManifest {
            master_playlist_url: format!("/api/videos/{}/master.m3u8", video_id),
            variant_playlists,
        })
    }

    /// Génère le master playlist HLS
    async fn generate_master_playlist(
        &self,
        variants: &[VariantPlaylist],
        _video_id: &str,
    ) -> AppResult<String> {
        let mut playlist = "#EXTM3U\n#EXT-X-VERSION:3\n\n".to_string();

        for variant in variants {
            playlist.push_str(&format!(
                "#EXT-X-STREAM-INF:BANDWIDTH={},RESOLUTION={}\n",
                variant.bandwidth * 1000, // Convertir en bps
                variant.resolution
            ));
            playlist.push_str(&format!("{}/playlist.m3u8\n\n", variant.quality));
        }

        Ok(playlist)
    }

    /// Génère les variantes DASH (alternative à HLS)
    pub async fn generate_dash_variants(
        &self,
        input_video_path: &str,
        video_id: &str,
    ) -> AppResult<String> {
        let video_dir = self.output_dir.join(video_id);
        fs::create_dir_all(&video_dir)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur création dossier DASH: {}", e)))?;

        let mpd_path = video_dir.join("manifest.mpd");
        let qualities = Self::get_quality_profiles();

        // Construire commande FFmpeg pour DASH
        let mut cmd = Command::new(&self.ffmpeg_path);
        cmd.arg("-i").arg(input_video_path);

        // Ajouter chaque adaptation set
        for quality in &qualities {
            cmd.arg("-map")
                .arg("0:v:0")
                .arg("-map")
                .arg("0:a:0")
                .arg("-b:v")
                .arg(&quality.bitrate)
                .arg("-s")
                .arg(format!("{}x{}", quality.width, quality.height))
                .arg("-adaptation_sets")
                .arg(format!("id=0,streams=v id=1,streams=a"));
        }

        cmd.arg("-f")
            .arg("dash")
            .arg("-use_timeline")
            .arg("1")
            .arg("-use_template")
            .arg("1")
            .arg("-init_seg_name")
            .arg("init_$RepresentationID$.m4s")
            .arg("-media_seg_name")
            .arg("chunk_$RepresentationID$_$Number$.m4s")
            .arg(mpd_path.to_string_lossy().as_ref());

        let output = cmd
            .output()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur FFmpeg DASH: {}", e)))?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Internal(format!(
                "Erreur génération DASH: {}",
                error
            )));
        }

        Ok(format!("/api/videos/{}/manifest.mpd", video_id))
    }

    /// Vérifie si les variantes HLS existent déjà
    pub async fn hls_variants_exist(&self, video_id: &str) -> bool {
        let video_dir = self.output_dir.join(video_id);
        let master_playlist = video_dir.join("master.m3u8");
        master_playlist.exists()
    }

    /// Récupère l'URL du master playlist si existe
    pub fn get_master_playlist_url(&self, video_id: &str) -> Option<String> {
        let video_dir = self.output_dir.join(video_id);
        let master_playlist = video_dir.join("master.m3u8");
        if master_playlist.exists() {
            Some(format!("/api/videos/{}/master.m3u8", video_id))
        } else {
            None
        }
    }
}
