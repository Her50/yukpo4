use std::path::{Path, PathBuf};
use std::sync::Arc;

use log::{debug, error, info, warn};
use tokio::fs;
use tokio::process::Command;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::config::video_renderer::VideoRendererConfig;
use crate::core::types::{AppError, AppResult};

use super::immersive_timeline::ImmersiveTimeline;

#[derive(Debug, Clone)]
pub struct RenderedVideo {
    pub job_id: String,
    pub output_dir: PathBuf,
    pub master_video: PathBuf,
    pub timeline_json: PathBuf,
}

#[derive(Debug)]
pub struct RemotionRendererService {
    config: VideoRendererConfig,
    build_ready: Arc<Mutex<bool>>,
}

impl RemotionRendererService {
    pub fn new(config: VideoRendererConfig) -> AppResult<Self> {
        Ok(Self {
            config,
            build_ready: Arc::new(Mutex::new(false)),
        })
    }

    pub fn project_root(&self) -> &Path {
        &self.config.project_root
    }

    async fn ensure_build(&self) -> AppResult<()> {
        let mut guard = self.build_ready.lock().await;
        if *guard {
            return Ok(());
        }

        let entry_point = self
            .config
            .project_root
            .join("dist")
            .join("src")
            .join("index.js");

        if entry_point.exists() {
            *guard = true;
            return Ok(());
        }

        if !self.config.auto_build {
            warn!("[RemotionRenderer] Aucun build trouvé et auto_build désactivé.");
            return Err(AppError::Internal(
                "Remotion renderer non compilé (dist/src/index.js absent)".to_string(),
            ));
        }

        info!("[RemotionRenderer] Compilation du worker Remotion en cours...");

        let status = Command::new("npm")
            .arg("run")
            .arg("build")
            .current_dir(&self.config.project_root)
            .status()
            .await
            .map_err(|err| {
                AppError::Internal(format!(
                    "Impossible de lancer npm run build pour Remotion: {err}"
                ))
            })?;

        if !status.success() {
            error!(
                "[RemotionRenderer] npm run build a échoué (code={:?})",
                status.code()
            );
            return Err(AppError::Internal(
                "Échec de build du worker Remotion".to_string(),
            ));
        }

        *guard = true;
        Ok(())
    }

    pub async fn render(
        &self,
        timeline: &ImmersiveTimeline,
        job_hint: Option<&str>,
    ) -> AppResult<RenderedVideo> {
        self.ensure_build().await?;

        let job_id = job_hint
            .map(|v| v.to_string())
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        let jobs_dir = self.config.jobs_root.clone();
        fs::create_dir_all(&jobs_dir).await.map_err(|err| {
            AppError::Internal(format!(
                "Impossible de créer le dossier jobs pour Remotion: {err}"
            ))
        })?;

        let job_path = jobs_dir.join(format!("{job_id}.json"));
        let json_payload = serde_json::to_string_pretty(timeline).map_err(|err| {
            AppError::Internal(format!(
                "Impossible de sérialiser la timeline immersive: {err}"
            ))
        })?;

        fs::write(&job_path, json_payload).await.map_err(|err| {
            AppError::Internal(format!(
                "Impossible d'écrire le fichier job Remotion: {err}"
            ))
        })?;

        let output_dir = self.config.renders_root.join(&job_id);
        fs::create_dir_all(&output_dir).await.map_err(|err| {
            AppError::Internal(format!("Impossible de créer le dossier rendu: {err}"))
        })?;

        let worker_entry = self
            .config
            .project_root
            .join("dist")
            .join("src")
            .join("cli")
            .join("render-worker.js");

        if !worker_entry.exists() {
            return Err(AppError::Internal(
                "Worker Remotion introuvable (dist/cli/render-worker.js)".to_string(),
            ));
        }

        info!(
            "[RemotionRenderer] Démarrage rendu Remotion job={} output={}",
            job_id,
            output_dir.display()
        );

        let mut command = Command::new(&self.config.node_bin);
        command
            .arg(worker_entry)
            .arg("--job")
            .arg(job_path.clone())
            .arg("--out-dir")
            .arg(output_dir.clone())
            .arg("--overwrite")
            .current_dir(&self.config.project_root);

        if let Some(exec) = &self.config.chromium_executable {
            command
                .env("REMOTION_BROWSER_EXECUTABLE", exec)
                .env("PUPPETEER_EXECUTABLE_PATH", exec);
        }

        if let Some(download_dir) = &self.config.browser_download_dir {
            command.env(
                "REMOTION_BROWSER_DOWNLOAD_DIR",
                download_dir.to_string_lossy().as_ref(),
            );
        }

        if self.config.enable_gpu {
            command.env("REMOTION_ENABLE_GPU", "true");
            log::info!("[RemotionRenderer] ✅ GPU activé pour le rendu vidéo (Remotion basculera automatiquement sur CPU si GPU indisponible)");
        } else {
            log::debug!("[RemotionRenderer] GPU désactivé (VIDEO_RENDERER_ENABLE_GPU=false ou non configuré)");
        }

        let output = command.output().await.map_err(|err| {
            AppError::Internal(format!("Impossible d'exécuter le worker Remotion: {err}"))
        })?;

        if !output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            
            // ✅ AMÉLIORÉ: Détecter les erreurs GPU et suggérer un fallback
            let is_gpu_error = stderr.contains("GPU") || stderr.contains("gpu") || 
                              stderr.contains("CUDA") || stderr.contains("cuda") ||
                              stderr.contains("NVIDIA") || stderr.contains("nvidia");
            
            if is_gpu_error && self.config.enable_gpu {
                warn!(
                    "[RemotionRenderer] ⚠️ Erreur GPU détectée pour job={}. Remotion devrait basculer automatiquement sur CPU.",
                    job_id
                );
            }
            
            error!(
                "[RemotionRenderer] Échec rendu Remotion job={}: status={:?}\nstdout={}\nstderr={}",
                job_id,
                output.status.code(),
                stdout,
                stderr
            );
            return Err(AppError::Internal(format!(
                "Rendu Remotion échoué: {stderr}"
            )));
        }

        debug!(
            "[RemotionRenderer] Rendu Remotion terminé job={} stdout={}",
            job_id,
            String::from_utf8_lossy(&output.stdout)
        );

        let master_video = output_dir.join("master.mp4");
        if !master_video.exists() {
            warn!(
                "[RemotionRenderer] master.mp4 introuvable pour job {} ({}).",
                job_id,
                master_video.display()
            );
        }

        Ok(RenderedVideo {
            job_id,
            output_dir,
            master_video,
            timeline_json: job_path,
        })
    }
}
