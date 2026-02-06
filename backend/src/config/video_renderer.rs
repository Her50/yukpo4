use log;
use std::env;
use std::path::PathBuf;
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct VideoRendererConfig {
    pub enabled: bool,
    pub project_root: PathBuf,
    pub node_bin: String,
    pub auto_build: bool,
    pub enable_gpu: bool,
    pub chromium_executable: Option<String>,
    pub browser_download_dir: Option<PathBuf>,
    pub rpc_endpoint: Option<String>,
    pub rpc_token: Option<String>,
    pub timeout: Duration,
    pub max_retries: u32,
    pub shared_volume_root: Option<PathBuf>,
    pub jobs_root: PathBuf,
    pub renders_root: PathBuf,
}

impl VideoRendererConfig {
    pub fn from_env() -> Option<Self> {
        // ✅ CORRIGÉ: Accepter aussi la variable mal orthographiée pour compatibilité
        let project_root = env::var("VIDEO_RENDERER_PROJECT_ROOT")
            .or_else(|_| env::var("VIDEO_RENDER_PROJET_ROOT")) // Compatibilité avec faute de frappe
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("video-renderer"));

        // ✅ AMÉLIORÉ: Vérifier si on a un RPC endpoint - si oui, PROJECT_ROOT n'est pas obligatoire
        let rpc_endpoint = env::var("VIDEO_RENDERER_RPC_URL")
            .ok()
            .map(|s| s.trim().to_string()) // ✅ CORRIGÉ: Supprimer les espaces
            .filter(|value| !value.is_empty());

        // ✅ NOUVEAU: Récupérer le token RPC si configuré
        let rpc_token = env::var("VIDEO_RENDERER_RPC_TOKEN")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|value| !value.is_empty());

        // Si on a un RPC endpoint, on n'a pas besoin que PROJECT_ROOT existe
        // Sinon, on vérifie que PROJECT_ROOT existe
        if rpc_endpoint.is_none() && !project_root.exists() {
            log::warn!(
                "[VideoRendererConfig] PROJECT_ROOT n'existe pas ({:?}) et aucun RPC_URL configuré",
                project_root
            );
            return None;
        }

        let enabled = env::var("VIDEO_RENDERER_ENABLED")
            .ok()
            .and_then(|raw| raw.parse::<bool>().ok())
            .unwrap_or(true);

        if !enabled {
            return None;
        }

        let node_bin = env::var("VIDEO_RENDERER_NODE_BIN").unwrap_or_else(|_| "node".to_string());

        // ✅ AMÉLIORÉ: Désactiver auto_build par défaut en production (sur Render.com, npm n'est pas disponible)
        // En production, le worker doit être précompilé ou utiliser un renderer RPC distant
        let env_prod = env::var("ENVIRONMENT")
            .ok()
            .map(|v| v.to_lowercase())
            .filter(|v| v == "production" || v == "prod")
            .is_some();

        let auto_build = env::var("VIDEO_RENDERER_AUTO_BUILD")
            .ok()
            .and_then(|raw| raw.parse::<bool>().ok())
            .unwrap_or(if env_prod { false } else { true }); // false en prod par défaut, true en dev

        let enable_gpu = env::var("VIDEO_RENDERER_ENABLE_GPU")
            .ok()
            .and_then(|raw| raw.parse::<bool>().ok())
            .unwrap_or(false);

        let chromium_executable = env::var("VIDEO_RENDERER_CHROMIUM_EXECUTABLE")
            .ok()
            .filter(|value| !value.trim().is_empty());

        let browser_download_dir =
            env::var("VIDEO_RENDERER_BROWSER_DOWNLOAD_DIR").ok().map(PathBuf::from);

        // ✅ DÉJÀ CORRIGÉ: rpc_endpoint est défini plus haut avec trim

        let timeout = env::var("VIDEO_RENDERER_TIMEOUT_SECS")
            .ok()
            .and_then(|raw| raw.parse::<u64>().ok())
            .map(Duration::from_secs)
            .unwrap_or_else(|| Duration::from_secs(600));

        let max_retries = env::var("VIDEO_RENDERER_MAX_RETRIES")
            .ok()
            .and_then(|raw| raw.parse::<u32>().ok())
            .unwrap_or(2);

        let shared_volume_root = env::var("VIDEO_RENDERER_SHARED_VOLUME")
            .ok()
            .map(PathBuf::from)
            .filter(|path| path.exists());

        let (jobs_root, renders_root) = if let Some(shared_root) = shared_volume_root.clone() {
            (shared_root.join("jobs"), shared_root.join("renders"))
        } else {
            (project_root.join("jobs"), project_root.join("renders"))
        };

        Some(Self {
            enabled,
            project_root,
            node_bin,
            auto_build,
            enable_gpu,
            chromium_executable,
            browser_download_dir,
            rpc_endpoint,
            rpc_token,
            timeout,
            max_retries,
            shared_volume_root,
            jobs_root,
            renders_root,
        })
    }
}
