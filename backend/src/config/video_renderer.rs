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
    pub timeout: Duration,
    pub max_retries: u32,
    pub shared_volume_root: Option<PathBuf>,
    pub jobs_root: PathBuf,
    pub renders_root: PathBuf,
}

impl VideoRendererConfig {
    pub fn from_env() -> Option<Self> {
        let project_root = env::var("VIDEO_RENDERER_PROJECT_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("video-renderer"));

        if !project_root.exists() {
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

        let auto_build = env::var("VIDEO_RENDERER_AUTO_BUILD")
            .ok()
            .and_then(|raw| raw.parse::<bool>().ok())
            .unwrap_or(true);

        let enable_gpu = env::var("VIDEO_RENDERER_ENABLE_GPU")
            .ok()
            .and_then(|raw| raw.parse::<bool>().ok())
            .unwrap_or(false);

        let chromium_executable = env::var("VIDEO_RENDERER_CHROMIUM_EXECUTABLE")
            .ok()
            .filter(|value| !value.trim().is_empty());

        let browser_download_dir = env::var("VIDEO_RENDERER_BROWSER_DOWNLOAD_DIR")
            .ok()
            .map(PathBuf::from);

        let rpc_endpoint = env::var("VIDEO_RENDERER_RPC_URL")
            .ok()
            .filter(|value| !value.trim().is_empty());

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
            timeout,
            max_retries,
            shared_volume_root,
            jobs_root,
            renders_root,
        })
    }
}
