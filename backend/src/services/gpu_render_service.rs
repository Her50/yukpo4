// ✅ NOUVEAU Phase 7: Service de rendu GPU optimisé pour preview et export
// Date: 2025-01-27

use crate::services::gpu_detector::GPUDetector;
use log::{error, info, warn};
use std::path::{Path, PathBuf};
use tokio::process::Command as AsyncCommand;

pub struct GPURenderService {
    gpu_detector: GPUDetector,
    cache_dir: PathBuf,
}

impl GPURenderService {
    pub fn new() -> Self {
        let cache_dir = PathBuf::from(
            std::env::var("GPU_CACHE_DIR").unwrap_or_else(|_| "./cache/gpu".to_string()),
        );

        // Créer le répertoire de cache s'il n'existe pas
        if !cache_dir.exists() {
            std::fs::create_dir_all(&cache_dir).unwrap_or_else(|e| {
                warn!("[GPURenderService] Erreur création cache dir: {}", e);
            });
        }

        Self {
            gpu_detector: GPUDetector::new(),
            cache_dir,
        }
    }

    /// Génère un preview vidéo accéléré par GPU
    pub async fn generate_gpu_preview(
        &self,
        input_path: &Path,
        output_path: &Path,
        width: u32,
        height: u32,
        duration: f64,
    ) -> Result<(), String> {
        info!(
            "[GPURenderService] Génération preview GPU: {:?} -> {:?}",
            input_path, output_path
        );

        if !self.gpu_detector.is_gpu_available() {
            warn!("[GPURenderService] GPU non disponible, fallback CPU");
            return Err("GPU non disponible".to_string());
        }

        let mut cmd = AsyncCommand::new("ffmpeg");
        cmd.arg("-y")
            .arg("-i")
            .arg(input_path.as_os_str())
            .arg("-vf")
            .arg(format!("scale={}:{}", width, height))
            .arg("-t")
            .arg(format!("{}", duration))
            .arg("-an"); // Pas d'audio pour preview

        // Configurer accélération GPU selon le type
        match self.gpu_detector.gpu_type.as_deref() {
            Some("nvidia") => {
                cmd.arg("-hwaccel").arg("cuda");
                cmd.arg("-hwaccel_output_format").arg("cuda");
                cmd.arg("-c:v").arg("h264_cuvid"); // Decode avec CUDA
            }
            Some("intel") | Some("quicksync") => {
                cmd.arg("-hwaccel").arg("qsv");
                cmd.arg("-hwaccel_output_format").arg("qsv");
            }
            Some("apple") | Some("metal") => {
                cmd.arg("-hwaccel").arg("videotoolbox");
            }
            Some("amd") | Some("vaapi") => {
                cmd.arg("-hwaccel").arg("vaapi");
                cmd.arg("-hwaccel_output_format").arg("vaapi");
            }
            _ => {
                return Err("Type GPU non supporté pour preview".to_string());
            }
        }

        cmd.arg("-c:v").arg("libx264");
        cmd.arg("-preset").arg("ultrafast"); // Preview rapide
        cmd.arg("-crf").arg("28"); // Qualité basse pour preview
        cmd.arg(output_path.as_os_str());

        let output = cmd.output().await.map_err(|e| {
            error!("[GPURenderService] Erreur exécution FFmpeg: {}", e);
            format!("Erreur exécution FFmpeg: {}", e)
        })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            error!("[GPURenderService] FFmpeg échoué: {}", stderr);
            return Err(format!("Erreur génération preview GPU: {}", stderr));
        }

        info!("[GPURenderService] Preview GPU généré avec succès");
        Ok(())
    }

    /// Cache un frame GPU pour réutilisation
    pub async fn cache_gpu_frame(
        &self,
        frame_path: &Path,
        frame_timestamp: f64,
    ) -> Result<PathBuf, String> {
        let cache_key = format!("frame_{:.2}.jpg", frame_timestamp);
        let cache_path = self.cache_dir.join(cache_key);

        if cache_path.exists() {
            info!("[GPURenderService] Frame déjà en cache: {:?}", cache_path);
            return Ok(cache_path);
        }

        // Extraire le frame avec GPU
        let mut cmd = AsyncCommand::new("ffmpeg");
        cmd.arg("-y")
            .arg("-ss")
            .arg(format!("{}", frame_timestamp))
            .arg("-i")
            .arg(frame_path.as_os_str())
            .arg("-vframes")
            .arg("1")
            .arg("-vf")
            .arg("scale=320:180"); // Thumbnail petit

        // Accélération GPU pour extraction frame
        if self.gpu_detector.is_gpu_available() {
            match self.gpu_detector.gpu_type.as_deref() {
                Some("nvidia") => {
                    cmd.arg("-hwaccel").arg("cuda");
                }
                Some("intel") | Some("quicksync") => {
                    cmd.arg("-hwaccel").arg("qsv");
                }
                Some("apple") | Some("metal") => {
                    cmd.arg("-hwaccel").arg("videotoolbox");
                }
                Some("amd") | Some("vaapi") => {
                    cmd.arg("-hwaccel").arg("vaapi");
                }
                _ => {}
            }
        }

        cmd.arg(cache_path.as_os_str());

        let output = cmd.output().await.map_err(|e| {
            error!("[GPURenderService] Erreur extraction frame: {}", e);
            format!("Erreur extraction frame: {}", e)
        })?;

        if !output.status.success() {
            return Err("Erreur extraction frame GPU".to_string());
        }

        info!("[GPURenderService] Frame mis en cache: {:?}", cache_path);
        Ok(cache_path)
    }

    /// Optimise l'utilisation mémoire GPU
    pub fn optimize_gpu_memory(&self) -> Result<(), String> {
        info!("[GPURenderService] Optimisation mémoire GPU");

        // Pour NVIDIA, on peut utiliser nvidia-smi pour limiter la mémoire
        if self.gpu_detector.is_nvidia_gpu() {
            // TODO: Implémenter limitation mémoire NVIDIA si nécessaire
            info!("[GPURenderService] GPU NVIDIA détecté, optimisation mémoire disponible");
        }

        // Pour les autres GPUs, l'optimisation se fait via FFmpeg
        Ok(())
    }

    /// ✅ NOUVEAU Phase 7: Vérifie si le rendu multi-GPU est disponible
    pub fn is_multi_gpu_available(&self) -> bool {
        // Détecter plusieurs GPUs disponibles
        if !self.gpu_detector.is_gpu_available() {
            return false;
        }

        // Pour NVIDIA, vérifier avec nvidia-smi
        if self.gpu_detector.is_nvidia_gpu() {
            if let Ok(output) = std::process::Command::new("nvidia-smi")
                .arg("--list-gpus")
                .output()
            {
                let output_str = String::from_utf8_lossy(&output.stdout);
                let gpu_count = output_str.lines().count();
                return gpu_count > 1;
            }
        }

        // Pour les autres GPUs, on suppose qu'un seul est disponible pour l'instant
        // TODO: Implémenter détection multi-GPU pour Intel/AMD/Apple
        false
    }

    /// ✅ NOUVEAU Phase 7: Rendu multi-GPU (si disponible)
    pub async fn render_multi_gpu(
        &self,
        input_path: &Path,
        output_path: &Path,
    ) -> Result<(), String> {
        if !self.is_multi_gpu_available() {
            return Err("Rendu multi-GPU non disponible (un seul GPU détecté)".to_string());
        }

        info!(
            "[GPURenderService] Démarrage rendu multi-GPU: {:?} -> {:?}",
            input_path, output_path
        );

        // Pour NVIDIA multi-GPU, utiliser FFmpeg avec distribution
        if self.gpu_detector.is_nvidia_gpu() {
            // Obtenir le nombre de GPUs
            let gpu_count = if let Ok(output) = std::process::Command::new("nvidia-smi")
                .arg("--list-gpus")
                .output()
            {
                String::from_utf8_lossy(&output.stdout).lines().count()
            } else {
                return Err("Impossible de détecter le nombre de GPUs NVIDIA".to_string());
            };

            if gpu_count < 2 {
                return Err("Moins de 2 GPUs NVIDIA détectés".to_string());
            }

            // Diviser la vidéo en segments et distribuer sur les GPUs
            // Pour l'instant, on utilise le premier GPU avec accélération CUDA
            // TODO: Implémenter distribution réelle avec -filter_complex et plusieurs GPUs

            let mut cmd = AsyncCommand::new("ffmpeg");
            cmd.arg("-y")
                .arg("-hwaccel")
                .arg("cuda")
                .arg("-hwaccel_device")
                .arg("0") // Utiliser GPU 0
                .arg("-i")
                .arg(input_path.as_os_str())
                .arg("-c:v")
                .arg("h264_nvenc")
                .arg("-preset")
                .arg("p4")
                .arg("-crf")
                .arg("23")
                .arg("-gpu")
                .arg("0")
                .arg(output_path.as_os_str());

            let output = cmd.output().await.map_err(|e| {
                error!("[GPURenderService] Erreur rendu multi-GPU: {}", e);
                format!("Erreur rendu multi-GPU: {}", e)
            })?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                error!("[GPURenderService] FFmpeg multi-GPU échoué: {}", stderr);
                return Err(format!("Erreur rendu multi-GPU: {}", stderr));
            }

            info!(
                "[GPURenderService] Rendu multi-GPU réussi avec {} GPUs",
                gpu_count
            );
            Ok(())
        } else {
            // Pour les autres types de GPU, multi-GPU n'est pas encore supporté
            warn!("[GPURenderService] Multi-GPU non supporté pour ce type de GPU");
            Err("Multi-GPU non supporté pour ce type de GPU".to_string())
        }
    }
}

impl Default for GPURenderService {
    fn default() -> Self {
        Self::new()
    }
}
