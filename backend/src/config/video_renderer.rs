use std::env;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct VideoRendererConfig {
    pub enabled: bool,
    pub project_root: PathBuf,
    pub node_bin: String,
    pub auto_build: bool,
    pub enable_gpu: bool,
    pub chromium_executable: Option<String>,
    pub browser_download_dir: Option<PathBuf>,
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

        Some(Self {
            enabled,
            project_root,
            node_bin,
            auto_build,
            enable_gpu,
            chromium_executable,
            browser_download_dir,
        })
    }
}
