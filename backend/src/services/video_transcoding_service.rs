// 🎯 Service de transcodage vidéo vers HLS/DASH
// Génère des streams adaptatifs comme TikTok/Reels

use crate::core::types::{AppError, AppResult};
use crate::utils::log::{log_error, log_info};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;
use tokio::fs;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoQuality {
    pub resolution: String, // "1920x1080"
    pub bitrate: u32,       // kbps
    pub fps: u32,           // frames per second
    pub label: String,      // "1080p", "720p", etc.
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscodedVideo {
    pub original_path: String,
    pub hls_path: String,  // .m3u8
    pub dash_path: String, // .mpd
    pub qualities: Vec<VideoQuality>,
    pub thumbnail_path: String,
    pub duration_seconds: f64,
    pub file_size_mb: f64,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Clone)]
pub struct VideoTranscodingService {
    pool: Arc<PgPool>,
    output_dir: PathBuf,
    ffmpeg_path: String,
    active_jobs: Arc<RwLock<Vec<String>>>,
}

impl VideoTranscodingService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        let output_dir = PathBuf::from("/tmp/video_transcoding"); // Ou GCP Storage
        let ffmpeg_path = std::env::var("FFMPEG_PATH").unwrap_or_else(|_| "ffmpeg".to_string());

        Self {
            pool,
            output_dir,
            ffmpeg_path,
            active_jobs: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Initialise le service de transcodage
    pub async fn initialize(&self) -> AppResult<()> {
        // Créer le répertoire de sortie
        fs::create_dir_all(&self.output_dir).await.map_err(|e| {
            AppError::Internal(format!("Erreur création dossier transcodage: {}", e))
        })?;

        // Vérifier FFmpeg disponible
        let output = Command::new(&self.ffmpeg_path)
            .arg("-version")
            .output()
            .map_err(|e| AppError::Internal(format!("FFmpeg non trouvé: {}", e)))?;

        if !output.status.success() {
            return Err(AppError::Internal("FFmpeg non fonctionnel".to_string()));
        }

        log_info("[VideoTranscoding] Service initialisé avec succès");
        Ok(())
    }

    /// Transcode une vidéo vers HLS + DASH avec multiples qualités
    pub async fn transcode_video(
        &self,
        video_path: &str,
        video_id: i32,
    ) -> AppResult<TranscodedVideo> {
        let job_id = format!("transcode_{}", video_id);

        // Vérifier si le travail est déjà en cours
        {
            let jobs = self.active_jobs.read().await;
            if jobs.contains(&job_id) {
                return Err(AppError::Internal("Transcodage déjà en cours".to_string()));
            }
        }

        // Ajouter le travail à la liste des actifs
        {
            let mut jobs = self.active_jobs.write().await;
            jobs.push(job_id.clone());
        }

        let result = self.do_transcode(video_path, video_id).await;

        // Retirer le travail de la liste des actifs
        {
            let mut jobs = self.active_jobs.write().await;
            jobs.retain(|j| j != &job_id);
        }

        result
    }

    async fn do_transcode(&self, video_path: &str, video_id: i32) -> AppResult<TranscodedVideo> {
        log_info(&format!(
            "[VideoTranscoding] Début transcodage vidéo ID: {}",
            video_id
        ));

        let video_filename = format!("video_{}", video_id);
        let output_base = self.output_dir.join(&video_filename);

        // Qualités à générer (comme TikTok)
        let qualities = vec![
            VideoQuality {
                resolution: "1920x1080".to_string(),
                bitrate: 5000,
                fps: 30,
                label: "1080p".to_string(),
            },
            VideoQuality {
                resolution: "1280x720".to_string(),
                bitrate: 2500,
                fps: 30,
                label: "720p".to_string(),
            },
            VideoQuality {
                resolution: "854x480".to_string(),
                bitrate: 1000,
                fps: 30,
                label: "480p".to_string(),
            },
            VideoQuality {
                resolution: "640x360".to_string(),
                bitrate: 500,
                fps: 30,
                label: "360p".to_string(),
            },
        ];

        // 1️⃣ Générer thumbnail
        let thumbnail_path = self.generate_thumbnail(video_path, &output_base).await?;

        // 2️⃣ Transcoder vers HLS (prioritaire pour mobile)
        let hls_path = self.transcode_to_hls(video_path, &output_base, &qualities).await?;

        // 3️⃣ Transcoder vers DASH (pour web/desktop)
        let dash_path = self.transcode_to_dash(video_path, &output_base, &qualities).await?;

        // 4️⃣ Obtenir les métadonnées vidéo
        let metadata = self.get_video_metadata(video_path).await?;

        let transcoded = TranscodedVideo {
            original_path: video_path.to_string(),
            hls_path: hls_path,
            dash_path: dash_path,
            qualities: qualities.clone(),
            thumbnail_path,
            duration_seconds: metadata.duration,
            file_size_mb: metadata.size_mb,
            created_at: chrono::Utc::now(),
        };

        // 5️⃣ Sauvegarder en base de données
        self.save_transcoded_metadata(video_id, &transcoded).await?;

        log_info(&format!(
            "[VideoTranscoding] Transcodage terminé pour vidéo ID: {}",
            video_id
        ));
        Ok(transcoded)
    }

    /// Génère un thumbnail à 1 seconde
    async fn generate_thumbnail(&self, video_path: &str, output_base: &Path) -> AppResult<String> {
        let thumbnail_path = output_base.join("thumbnail.jpg");

        let output = Command::new(&self.ffmpeg_path)
            .args(&[
                "-i",
                video_path,
                "-ss",
                "00:00:01.000",
                "-vframes",
                "1",
                "-vf",
                "scale=320:240",
                "-y",
                thumbnail_path.to_str().unwrap(),
            ])
            .output()
            .map_err(|e| AppError::Internal(format!("Erreur génération thumbnail: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Internal(format!(
                "FFmpeg thumbnail error: {}",
                stderr
            )));
        }

        Ok(thumbnail_path.to_string_lossy().to_string())
    }

    /// Transcode vers HLS avec playlist maître et variantes
    async fn transcode_to_hls(
        &self,
        video_path: &str,
        output_base: &Path,
        qualities: &[VideoQuality],
    ) -> AppResult<String> {
        let master_playlist = output_base.join("playlist.m3u8");

        // Créer la playlist maître
        let mut master_content = String::new();
        master_content.push_str("#EXTM3U\n");
        master_content.push_str("#EXT-X-VERSION:6\n");

        for quality in qualities {
            let video_path_buf = PathBuf::from(video_path);
            let quality_name = format!(
                "{}_{}",
                video_path_buf.file_stem().unwrap().to_str().unwrap(),
                quality.label
            );
            let variant_path = output_base.join(&quality_name);
            fs::create_dir_all(&variant_path).await.map_err(|e| {
                AppError::Internal(format!("Erreur création dossier qualité: {}", e))
            })?;

            let segment_filename = format!("{}_segment%%03d.ts", quality_name);
            let playlist_path = variant_path.join("playlist.m3u8");

            // Commander FFmpeg pour cette qualité
            let output = Command::new(&self.ffmpeg_path)
                .args(&[
                    "-i",
                    video_path,
                    "-vf",
                    &format!(
                        "scale={}:force_original_aspect_ratio=decrease",
                        quality.resolution
                    ),
                    "-b:v",
                    &format!("{}k", quality.bitrate),
                    "-r",
                    &quality.fps.to_string(),
                    "-c:v",
                    "libx264",
                    "-c:a",
                    "aac",
                    "-b:a",
                    "128k",
                    "-f",
                    "hls",
                    "-hls_time",
                    "6",
                    "-hls_list_size",
                    "0",
                    "-hls_segment_filename",
                    &variant_path.join(&segment_filename).to_str().unwrap(),
                    "-y",
                    playlist_path.to_str().unwrap(),
                ])
                .output()
                .map_err(|e| {
                    AppError::Internal(format!("Erreur transcodage HLS {}: {}", quality.label, e))
                })?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                log_error(&format!(
                    "[VideoTranscoding] Erreur HLS {}: {}",
                    quality.label, stderr
                ));
                continue;
            }

            // Ajouter à la playlist maître
            master_content.push_str(&format!(
                "#EXT-X-STREAM-INF:BANDWIDTH={},RESOLUTION={},FRAME-RATE={}\n{}.m3u8\n",
                quality.bitrate * 1000, // Convertir kbps -> bps
                quality.resolution,
                quality.fps,
                quality_name
            ));
        }

        // Écrire la playlist maître
        fs::write(&master_playlist, master_content)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur écriture playlist maître: {}", e)))?;

        Ok(master_playlist.to_string_lossy().to_string())
    }

    /// Transcode vers DASH avec manifest MPD
    async fn transcode_to_dash(
        &self,
        video_path: &str,
        output_base: &Path,
        qualities: &[VideoQuality],
    ) -> AppResult<String> {
        let dash_path = output_base.join("manifest.mpd");

        // Préparer les arguments pour FFmpeg DASH
        let mut args = vec![
            "-i".to_string(),
            video_path.to_string(),
            "-f".to_string(),
            "dash".to_string(),
            "-seg_duration".to_string(),
            "6".to_string(),
            "-adaptation_sets".to_string(),
            "id=0,streams=v".to_string(),
            "-y".to_string(),
        ];

        // Ajouter les maps pour chaque qualité
        for (_i, quality) in qualities.iter().enumerate() {
            args.extend(vec![
                "-map".to_string(),
                "0:v".to_string(),
                "-b:v:0".to_string(),
                format!("{}k", quality.bitrate),
                "-vf:0".to_string(),
                format!(
                    "scale={}:force_original_aspect_ratio=decrease",
                    quality.resolution
                ),
            ]);
        }

        args.push(dash_path.to_string_lossy().to_string());

        let output = Command::new(&self.ffmpeg_path)
            .args(&args)
            .output()
            .map_err(|e| AppError::Internal(format!("Erreur transcoding HLS: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Internal(format!("FFmpeg DASH error: {}", stderr)));
        }

        Ok(dash_path.to_string_lossy().to_string())
    }

    /// Extrait les métadonnées vidéo avec ffprobe
    async fn get_video_metadata(&self, video_path: &str) -> AppResult<VideoMetadata> {
        let output = Command::new("ffprobe")
            .args(&[
                "-v",
                "quiet",
                "-print_format",
                "json",
                "-show_format",
                "-show_streams",
                video_path,
            ])
            .output()
            .map_err(|e| AppError::Internal(format!("Erreur FFprobe: {}", e)))?;

        if !output.status.success() {
            return Err(AppError::Internal(
                "Impossible d'extraire les métadonnées vidéo".to_string(),
            ));
        }

        let json_str = String::from_utf8_lossy(&output.stdout);
        let metadata: serde_json::Value = serde_json::from_str(&json_str)
            .map_err(|e| AppError::Internal(format!("Erreur parsing métadonnées: {}", e)))?;

        // Extraire durée et taille
        let duration = metadata["format"]["duration"]
            .as_f64()
            .ok_or_else(|| AppError::Internal("Durée non trouvée".to_string()))?;

        let size_bytes = metadata["format"]["size"]
            .as_u64()
            .ok_or_else(|| AppError::Internal("Taille non trouvée".to_string()))?;

        let size_mb = size_bytes as f64 / (1024.0 * 1024.0);

        Ok(VideoMetadata { duration, size_mb })
    }

    /// Sauvegarde les métadonnées en base de données
    async fn save_transcoded_metadata(
        &self,
        video_id: i32,
        transcoded: &TranscodedVideo,
    ) -> AppResult<()> {
        let qualities_json = serde_json::to_string(&transcoded.qualities)
            .map_err(|e| AppError::Internal(format!("Erreur sérialisation qualités: {}", e)))?;

        sqlx::query(
            r#"
            INSERT INTO video_transcoding (
                video_id, original_path, hls_path, dash_path, 
                qualities, thumbnail_path, duration_seconds, 
                file_size_mb, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (video_id) DO UPDATE SET
                hls_path = EXCLUDED.hls_path,
                dash_path = EXCLUDED.dash_path,
                qualities = EXCLUDED.qualities,
                thumbnail_path = EXCLUDED.thumbnail_path,
                duration_seconds = EXCLUDED.duration_seconds,
                file_size_mb = EXCLUDED.file_size_mb,
                updated_at = NOW()
            "#,
        )
        .bind(video_id)
        .bind(&transcoded.original_path)
        .bind(&transcoded.hls_path)
        .bind(&transcoded.dash_path)
        .bind(&qualities_json)
        .bind(&transcoded.thumbnail_path)
        .bind(transcoded.duration_seconds)
        .bind(transcoded.file_size_mb)
        .bind(transcoded.created_at)
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Database(format!("Erreur sauvegarde transcodage: {}", e)))?;

        Ok(())
    }

    /// Vérifie si une vidéo est déjà transcodée
    pub async fn is_transcoded(&self, video_id: i32) -> AppResult<bool> {
        let result: Option<sqlx::postgres::PgRow> =
            sqlx::query("SELECT video_id FROM video_transcoding WHERE video_id = $1")
                .bind(video_id)
                .fetch_optional(&*self.pool)
                .await
                .map_err(|e| {
                    AppError::Database(format!("Erreur vérification transcodage: {}", e))
                })?;

        Ok(result.is_some())
    }

    /// Obtient les URLs transcoded pour une vidéo
    pub async fn get_transcoded_urls(&self, video_id: i32) -> AppResult<Option<TranscodedVideo>> {
        let row: Option<sqlx::postgres::PgRow> = sqlx::query(
            r#"
            SELECT original_path, hls_path, dash_path, qualities, 
                   thumbnail_path, duration_seconds, file_size_mb, 
                   created_at, updated_at
            FROM video_transcoding 
            WHERE video_id = $1
            "#,
        )
        .bind(video_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Database(format!("Erreur récupération URLs transcodées: {}", e)))?;

        if let Some(row) = row {
            let qualities_str: &str = row.try_get("qualities").unwrap_or("[]");
            let qualities: Vec<VideoQuality> =
                serde_json::from_str(qualities_str).map_err(|e| {
                    AppError::Internal(format!("Erreur désérialisation qualités: {}", e))
                })?;

            Ok(Some(TranscodedVideo {
                original_path: row
                    .try_get::<&str, _>("original_path")
                    .unwrap_or_default()
                    .to_string(),
                hls_path: row.try_get::<&str, _>("hls_path").unwrap_or_default().to_string(),
                dash_path: row.try_get::<&str, _>("dash_path").unwrap_or_default().to_string(),
                qualities,
                thumbnail_path: row
                    .try_get::<&str, _>("thumbnail_path")
                    .unwrap_or_default()
                    .to_string(),
                duration_seconds: row.try_get("duration_seconds").unwrap_or(0.0) as i32,
                file_size_mb: row.try_get("file_size_mb").unwrap_or(0.0),
                created_at: row.try_get("created_at").unwrap_or_else(|_| chrono::Utc::now()),
            }))
        } else {
            Ok(None)
        }
    }

    /// Liste des travaux de transcodage actifs
    pub async fn get_active_jobs(&self) -> Vec<String> {
        self.active_jobs.read().await.clone()
    }
}

#[derive(Debug)]
struct VideoMetadata {
    duration: f64,
    size_mb: f64,
}

// Singleton global
lazy_static::lazy_static! {
    pub static ref VIDEO_TRANSCODING_SERVICE: std::sync::Arc<tokio::sync::Mutex<Option<VideoTranscodingService>>> =
        std::sync::Arc::new(tokio::sync::Mutex::new(None));
}

pub async fn get_transcoding_service(pool: Arc<PgPool>) -> Arc<VideoTranscodingService> {
    let mut service = VIDEO_TRANSCODING_SERVICE.lock().await;
    if service.is_none() {
        let new_service = VideoTranscodingService::new(pool);
        new_service.initialize().await.unwrap();
        *service = Some(new_service);
    }
    Arc::new(service.as_ref().unwrap().clone())
}
