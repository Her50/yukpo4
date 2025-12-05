// ✅ NOUVEAU Phase 2.3: Service de transcodage vidéo avec support multi-formats

use crate::models::export_model::{BitrateMode, ExportCodec, ExportFormat, ExportSettings};
use crate::services::gpu_detector::GPUDetector;
use log::{error, info, warn};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tokio::fs;
use tokio::process::Command as AsyncCommand;

pub struct TranscodingService {
    gpu_detector: GPUDetector,
}

impl TranscodingService {
    pub fn new() -> Self {
        Self {
            gpu_detector: GPUDetector::new(),
        }
    }

    /// Transcode une vidéo selon les paramètres d'export
    pub async fn transcode(
        &self,
        input_path: &Path,
        output_path: &Path,
        settings: &ExportSettings,
    ) -> Result<(), String> {
        info!(
            "[TranscodingService] Début transcodage: {:?} -> {:?}",
            input_path, output_path
        );

        // Vérifier que le fichier d'entrée existe
        if !input_path.exists() {
            return Err(format!("Fichier d'entrée introuvable: {:?}", input_path));
        }

        // Construire la commande FFmpeg
        let mut cmd = self.build_ffmpeg_command(input_path, output_path, settings)?;

        // Exécuter FFmpeg
        let output = cmd.output().await.map_err(|e| {
            error!("[TranscodingService] Erreur exécution FFmpeg: {}", e);
            format!("Erreur exécution FFmpeg: {}", e)
        })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            error!("[TranscodingService] FFmpeg échoué: {}", stderr);
            return Err(format!("Erreur transcodage: {}", stderr));
        }

        info!("[TranscodingService] Transcodage réussi: {:?}", output_path);
        Ok(())
    }

    /// Construit la commande FFmpeg pour le transcodage
    fn build_ffmpeg_command(
        &self,
        input_path: &Path,
        output_path: &Path,
        settings: &ExportSettings,
    ) -> Result<AsyncCommand, String> {
        let (width, height) = settings.get_dimensions();
        let bitrate = settings.get_bitrate();
        let audio_bitrate = settings.get_audio_bitrate();
        let fps = settings.get_fps();

        let mut cmd = AsyncCommand::new("ffmpeg");
        cmd.arg("-y") // Overwrite output
            .arg("-i")
            .arg(input_path.as_os_str())
            .arg("-vf")
            .arg(format!("scale={}:{}", width, height));

        // Ajouter watermark si demandé
        if settings.watermark.unwrap_or(true) {
            // TODO: Implémenter l'ajout de watermark
            // Pour l'instant, on skip
        }

        // ✅ NOUVEAU Phase 2: Utiliser GPU si disponible
        let use_gpu = self.gpu_detector.is_gpu_available();

        if use_gpu {
            info!(
                "[TranscodingService] GPU disponible: {}",
                self.gpu_detector.get_gpu_info()
            );
        }

        // Configurer codec vidéo
        match (&settings.format, &settings.codec) {
            (ExportFormat::Mp4, ExportCodec::H264) => {
                if use_gpu {
                    // Utiliser GPU encoding selon le type de GPU
                    match self.gpu_detector.gpu_type.as_deref() {
                        Some("nvidia") => {
                            cmd.arg("-c:v").arg("h264_nvenc");
                            cmd.arg("-preset").arg("p4"); // Fast preset pour GPU
                            cmd.arg("-crf").arg("23");
                        }
                        Some("intel") | Some("quicksync") => {
                            cmd.arg("-c:v").arg("h264_qsv"); // QuickSync Video
                            cmd.arg("-preset").arg("fast");
                            cmd.arg("-global_quality").arg("23");
                        }
                        Some("apple") | Some("metal") => {
                            cmd.arg("-c:v").arg("h264_videotoolbox"); // VideoToolbox (macOS)
                            cmd.arg("-b:v").arg(format!("{}k", bitrate));
                        }
                        Some("amd") | Some("vaapi") => {
                            cmd.arg("-c:v").arg("h264_vaapi"); // VAAPI (Linux)
                            cmd.arg("-b:v").arg(format!("{}k", bitrate));
                        }
                        _ => {
                            // Fallback CPU
                            cmd.arg("-c:v").arg("libx264");
                            cmd.arg("-preset").arg("medium");
                            cmd.arg("-crf").arg("23");
                        }
                    }
                } else {
                    cmd.arg("-c:v").arg("libx264");
                    cmd.arg("-preset").arg("medium");
                    cmd.arg("-crf").arg("23"); // Quality setting
                }
            }
            (ExportFormat::Mp4, ExportCodec::H265) => {
                if use_gpu {
                    // Utiliser GPU encoding HEVC selon le type de GPU
                    match self.gpu_detector.gpu_type.as_deref() {
                        Some("nvidia") => {
                            cmd.arg("-c:v").arg("hevc_nvenc");
                            cmd.arg("-preset").arg("p4");
                            cmd.arg("-crf").arg("28");
                        }
                        Some("intel") | Some("quicksync") => {
                            cmd.arg("-c:v").arg("hevc_qsv"); // QuickSync HEVC
                            cmd.arg("-preset").arg("fast");
                            cmd.arg("-global_quality").arg("28");
                        }
                        Some("apple") | Some("metal") => {
                            cmd.arg("-c:v").arg("hevc_videotoolbox"); // VideoToolbox HEVC (macOS)
                            cmd.arg("-b:v").arg(format!("{}k", bitrate));
                        }
                        Some("amd") | Some("vaapi") => {
                            cmd.arg("-c:v").arg("hevc_vaapi"); // VAAPI HEVC (Linux)
                            cmd.arg("-b:v").arg(format!("{}k", bitrate));
                        }
                        _ => {
                            // Fallback CPU
                            cmd.arg("-c:v").arg("libx265");
                            cmd.arg("-preset").arg("medium");
                            cmd.arg("-crf").arg("28");
                        }
                    }
                } else {
                    cmd.arg("-c:v").arg("libx265");
                    cmd.arg("-preset").arg("medium");
                    cmd.arg("-crf").arg("28");
                }
            }
            (ExportFormat::Mov, ExportCodec::Prores) => {
                cmd.arg("-c:v").arg("prores_ks");
                cmd.arg("-profile:v").arg("3"); // HQ profile
            }
            (ExportFormat::Mov, ExportCodec::H264) => {
                cmd.arg("-c:v").arg("libx264");
                cmd.arg("-preset").arg("medium");
            }
            (ExportFormat::Webm, ExportCodec::Vp9) => {
                cmd.arg("-c:v").arg("libvpx-vp9");
                cmd.arg("-b:v").arg(format!("{}k", bitrate));
            }
            (ExportFormat::Mov, ExportCodec::DNxHD) => {
                cmd.arg("-c:v").arg("dnxhd");
                cmd.arg("-b:v").arg(format!("{}M", bitrate / 1000)); // DNxHD utilise Mbit/s
                cmd.arg("-pix_fmt").arg("yuv422p"); // Format requis pour DNxHD
            }
            (ExportFormat::Mp4, ExportCodec::HDR10) => {
                cmd.arg("-c:v").arg("libx265");
                cmd.arg("-preset").arg("medium");
                cmd.arg("-crf").arg("23");
                cmd.arg("-x265-params").arg("hdr-opt=1:repeat-headers=1:colorprim=bt2020:transfer=smpte2084:colormatrix=bt2020nc");
                cmd.arg("-pix_fmt").arg("yuv420p10le"); // 10-bit pour HDR10
            }
            (ExportFormat::Mp4, ExportCodec::DolbyVision) => {
                cmd.arg("-c:v").arg("libx265");
                cmd.arg("-preset").arg("medium");
                cmd.arg("-crf").arg("23");
                cmd.arg("-x265-params").arg("hdr-opt=1:repeat-headers=1:colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc:dolby-vision-profile=5");
                cmd.arg("-pix_fmt").arg("yuv420p10le");
            }
            (ExportFormat::Mp4, ExportCodec::HLG) => {
                cmd.arg("-c:v").arg("libx265");
                cmd.arg("-preset").arg("medium");
                cmd.arg("-crf").arg("23");
                cmd.arg("-x265-params").arg("hdr-opt=1:repeat-headers=1:colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc");
                cmd.arg("-pix_fmt").arg("yuv420p10le");
            }
            (ExportFormat::Gif, _) => {
                // Pour GIF, on utilise une palette puis conversion
                cmd.arg("-vf").arg(format!(
                    "scale={}:{}:flags=lanczos,fps={},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
                    width, height, fps
                ));
            }
            _ => {
                warn!(
                    "[TranscodingService] Format/codec non supporté: {:?}/{:?}",
                    settings.format, settings.codec
                );
                return Err(format!(
                    "Combinaison format/codec non supportée: {:?}/{:?}",
                    settings.format, settings.codec
                ));
            }
        }

        // Configurer codec audio
        match settings.format {
            ExportFormat::Gif => {
                // Pas d'audio pour GIF
            }
            _ => {
                cmd.arg("-c:a").arg("aac");
                cmd.arg("-b:a").arg(format!("{}k", audio_bitrate));
            }
        }

        // FPS
        cmd.arg("-r").arg(format!("{}", fps));

        // ✅ NOUVEAU Phase 3: Configurer mode de bitrate (CBR, VBR, ABR)
        let bitrate_mode = settings.get_bitrate_mode();

        match bitrate_mode {
            BitrateMode::CBR => {
                // Constant Bitrate: bitrate fixe avec buffer size
                let buffer_size = bitrate * 2; // Buffer size = 2x bitrate pour stabilité
                cmd.arg("-b:v").arg(format!("{}k", bitrate));
                cmd.arg("-minrate").arg(format!("{}k", bitrate));
                cmd.arg("-maxrate").arg(format!("{}k", bitrate));
                cmd.arg("-bufsize").arg(format!("{}k", buffer_size));
            }
            BitrateMode::VBR => {
                // Variable Bitrate: utilise CRF (Constant Rate Factor) pour qualité optimale
                // CRF est déjà configuré dans les codecs H.264/H.265 ci-dessus
                // Pour les codecs qui n'utilisent pas CRF, utiliser bitrate variable
                if !matches!(settings.codec, ExportCodec::H264 | ExportCodec::H265) {
                    cmd.arg("-b:v").arg(format!("{}k", bitrate));
                }
            }
            BitrateMode::ABR => {
                // Adaptive Bitrate: bitrate cible avec variation autorisée
                let max_bitrate = (bitrate as f32 * 1.5) as u32; // Max 150% du bitrate cible
                let buffer_size = bitrate * 2;
                cmd.arg("-b:v").arg(format!("{}k", bitrate));
                cmd.arg("-maxrate").arg(format!("{}k", max_bitrate));
                cmd.arg("-bufsize").arg(format!("{}k", buffer_size));
            }
        }

        cmd.arg(output_path.as_os_str());

        info!(
            "[TranscodingService] Commande FFmpeg construite pour format: {:?}, codec: {:?}",
            settings.format, settings.codec
        );

        Ok(cmd)
    }

    /// Vérifie si FFmpeg est disponible
    pub async fn check_ffmpeg_available() -> bool {
        match Command::new("ffmpeg").arg("-version").output() {
            Ok(output) => output.status.success(),
            Err(_) => false,
        }
    }

    /// Obtient les informations d'une vidéo (duration, resolution, etc.)
    pub async fn get_video_info(input_path: &Path) -> Result<VideoInfo, String> {
        let output = Command::new("ffprobe")
            .arg("-v")
            .arg("error")
            .arg("-show_entries")
            .arg("format=duration")
            .arg("-show_entries")
            .arg("stream=width,height,r_frame_rate")
            .arg("-of")
            .arg("json")
            .arg(input_path.as_os_str())
            .output()
            .map_err(|e| format!("Erreur ffprobe: {}", e))?;

        if !output.status.success() {
            return Err("ffprobe a échoué".to_string());
        }

        let json: Value = serde_json::from_slice(&output.stdout)
            .map_err(|e| format!("Erreur parsing JSON: {}", e))?;

        // Extraire les infos (simplifié)
        Ok(VideoInfo {
            duration: json["format"]["duration"]
                .as_str()
                .and_then(|s| s.parse().ok())
                .unwrap_or(0.0),
            width: 0, // TODO: parser correctement
            height: 0,
            fps: 30.0,
        })
    }
}

#[derive(Debug, Clone)]
pub struct VideoInfo {
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub fps: f32,
}

impl Default for TranscodingService {
    fn default() -> Self {
        Self::new()
    }
}
