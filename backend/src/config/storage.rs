use std::env;
use std::path::PathBuf;

fn env_bool(name: &str, default: bool) -> bool {
    env::var(name)
        .ok()
        .and_then(|value| {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                trimmed.parse::<bool>().ok()
            }
        })
        .unwrap_or(default)
}

fn env_string(name: &str) -> Option<String> {
    env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|v| !v.is_empty())
}

#[derive(Debug, Clone)]
pub struct MediaStorageConfig {
    pub upload_root: PathBuf,
    pub upload_base_url: Option<String>,
    pub public_base_url: Option<String>,
    pub bucket: Option<String>,
    pub region: Option<String>,
    pub endpoint: Option<String>,
    pub access_key: Option<String>,
    pub secret_key: Option<String>,
    pub session_token: Option<String>,
    pub force_path_style: bool,
    pub keep_local_copy: bool,
    pub remove_source_after_upload: bool,
}

impl MediaStorageConfig {
    pub fn from_env() -> Self {
        let upload_root = env::var("UPLOAD_STORAGE_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("uploads"));

        let upload_base_url = env_string("UPLOAD_BASE_URL");
        let public_base_url = env_string("PUBLIC_BASE_URL");

        let bucket = env_string("S3_BUCKET").or_else(|| env_string("AWS_S3_BUCKET"));
        let region = env_string("S3_REGION").or_else(|| env_string("AWS_REGION"));
        let endpoint = env_string("S3_ENDPOINT").or_else(|| env_string("AWS_S3_ENDPOINT"));

        let access_key = env_string("S3_ACCESS_KEY").or_else(|| env_string("AWS_ACCESS_KEY_ID"));
        let secret_key =
            env_string("S3_SECRET_KEY").or_else(|| env_string("AWS_SECRET_ACCESS_KEY"));
        let session_token =
            env_string("S3_SESSION_TOKEN").or_else(|| env_string("AWS_SESSION_TOKEN"));

        let force_path_style = env_bool("S3_FORCE_PATH_STYLE", endpoint.is_some());
        let keep_local_copy = env_bool("S3_KEEP_LOCAL_COPY", true);
        let remove_source_after_upload = env_bool("S3_REMOVE_SOURCE_AFTER_UPLOAD", true);

        Self {
            upload_root,
            upload_base_url,
            public_base_url,
            bucket,
            region,
            endpoint,
            access_key,
            secret_key,
            session_token,
            force_path_style,
            keep_local_copy,
            remove_source_after_upload,
        }
    }

    pub fn has_remote_backend(&self) -> bool {
        self.bucket.is_some() && self.access_key.is_some() && self.secret_key.is_some()
    }
}
