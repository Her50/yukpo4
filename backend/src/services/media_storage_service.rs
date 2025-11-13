use std::path::{Path, PathBuf};

use aws_sdk_s3::{
    config::{Builder as S3ConfigBuilder, Credentials, Region},
    primitives::ByteStream,
    Client,
};
use log::{debug, info, warn};
use tokio::fs;

use crate::{
    config::storage::MediaStorageConfig,
    core::types::{AppError, AppResult},
};

const STORAGE_PREFIX: &str = "uploads";

#[derive(Debug, Clone)]
pub struct StoredMediaLocation {
    pub storage_path: String,
    pub public_url: String,
    pub content_length: Option<u64>,
}

#[derive(Debug)]
pub struct MediaStorageService {
    config: MediaStorageConfig,
    client: Option<Client>,
    bucket: Option<String>,
}

impl MediaStorageService {
    pub fn new(config: MediaStorageConfig) -> Self {
        let bucket = config.bucket.clone();
        let client = Self::build_client(&config);

        if client.is_some() {
            if let Some(bucket) = &bucket {
                info!(
                    "[MediaStorage] Stockage distant activé (bucket={}, endpoint={:?})",
                    bucket, config.endpoint
                );
            } else {
                info!("[MediaStorage] Stockage distant activé sans bucket explicite.");
            }
        } else if config.has_remote_backend() {
            warn!("[MediaStorage] Configuration S3 incomplète - fallback stockage local.");
        } else {
            info!("[MediaStorage] Stockage local utilisé (UPLOAD_STORAGE_PATH).");
        }

        Self {
            config,
            client,
            bucket,
        }
    }

    pub fn upload_root(&self) -> &Path {
        &self.config.upload_root
    }

    pub fn local_path_for(&self, storage_key: &str) -> PathBuf {
        self.config
            .upload_root
            .join(storage_key.trim_start_matches('/'))
    }

    pub fn storage_path_for(&self, storage_key: &str) -> String {
        format!(
            "{}/{storage}",
            STORAGE_PREFIX,
            storage = storage_key.trim_start_matches('/').replace('\\', "/")
        )
    }

    pub fn is_remote(&self) -> bool {
        self.client.is_some()
    }

    pub async fn store_file<P: AsRef<Path>>(
        &self,
        local_path: P,
        storage_key: &str,
        content_type: Option<&str>,
    ) -> AppResult<StoredMediaLocation> {
        let local_path = local_path.as_ref();
        let normalized_key = storage_key.trim_start_matches('/');
        let storage_path = self.storage_path_for(normalized_key);

        let metadata = fs::metadata(local_path).await.map_err(|err| {
            AppError::Internal(format!(
                "Impossible de lire les métadonnées du fichier à stocker ({:?}): {err}",
                local_path
            ))
        })?;
        let mut content_length = metadata.len();

        let mut source_for_upload = local_path.to_path_buf();

        if self.client.is_none() || self.config.keep_local_copy {
            let local_target = self.local_path_for(normalized_key);
            if local_target != local_path {
                self.persist_local(local_path, &local_target).await?;
                source_for_upload = local_target;
            }
            if let Ok(meta) = fs::metadata(&source_for_upload).await {
                content_length = meta.len();
            }
        }

        if let Some(client) = &self.client {
            let object_key = storage_path.clone();
            self.upload_to_s3(client, &source_for_upload, &object_key, content_type)
                .await?;

            if !self.config.keep_local_copy && self.config.remove_source_after_upload {
                if let Err(err) = fs::remove_file(&source_for_upload).await {
                    warn!(
                        "[MediaStorage] Impossible de supprimer le fichier local après upload ({:?}): {err}",
                        source_for_upload
                    );
                } else {
                    debug!(
                        "[MediaStorage] Fichier source supprimé après upload ({:?})",
                        source_for_upload
                    );
                }
            }
        }

        let public_url = self.build_public_url(&storage_path);

        Ok(StoredMediaLocation {
            storage_path,
            public_url,
            content_length: Some(content_length),
        })
    }

    async fn persist_local(&self, source: &Path, target: &Path) -> AppResult<()> {
        if source == target {
            return Ok(());
        }

        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).await.map_err(|err| {
                AppError::Internal(format!(
                    "Impossible de créer le dossier de stockage {:?}: {err}",
                    parent
                ))
            })?;
        }

        if let Err(err) = fs::rename(source, target).await {
            debug!(
                "[MediaStorage] rename {:?} -> {:?} impossible ({err}), tentative copie.",
                source, target
            );
            fs::copy(source, target).await.map_err(|copy_err| {
                AppError::Internal(format!(
                    "Impossible de copier le fichier vers {:?}: {copy_err}",
                    target
                ))
            })?;
            fs::remove_file(source).await.ok();
        }
        Ok(())
    }

    async fn upload_to_s3(
        &self,
        client: &Client,
        path: &Path,
        object_key: &str,
        content_type: Option<&str>,
    ) -> AppResult<()> {
        let bucket = match &self.bucket {
            Some(bucket) => bucket,
            None => {
                return Err(AppError::Internal(
                    "Bucket S3 non configuré pour le stockage distant.".to_string(),
                ))
            }
        };

        let body = ByteStream::from_path(path).await.map_err(|err| {
            AppError::Internal(format!("Lecture fichier pour S3 impossible: {err}"))
        })?;

        let mut request = client
            .put_object()
            .bucket(bucket)
            .key(object_key.to_string())
            .body(body);

        if let Some(ct) = content_type {
            request = request.content_type(ct.to_string());
        }

        request
            .send()
            .await
            .map_err(|err| AppError::Internal(format!("Upload S3 échoué: {err}")))?;

        debug!(
            "[MediaStorage] Fichier uploadé vers S3 (bucket={}, key={})",
            bucket, object_key
        );

        Ok(())
    }

    fn build_public_url(&self, storage_path: &str) -> String {
        let candidate_base = self
            .config
            .upload_base_url
            .as_deref()
            .filter(|value| !value.is_empty())
            .or_else(|| {
                self.config
                    .public_base_url
                    .as_deref()
                    .filter(|value| !value.is_empty())
            });

        if let Some(base) = candidate_base {
            format!(
                "{}/{}",
                base.trim_end_matches('/'),
                storage_path.trim_start_matches('/')
            )
        } else {
            storage_path.to_string()
        }
    }

    fn build_client(config: &MediaStorageConfig) -> Option<Client> {
        if !(config.has_remote_backend()) {
            return None;
        }

        let _ = config.bucket.as_ref()?;
        let access_key = config.access_key.as_ref()?.clone();
        let secret_key = config.secret_key.as_ref()?.clone();

        let mut builder = S3ConfigBuilder::new();

        if let Some(region) = config.region.as_ref() {
            builder = builder.region(Region::new(region.clone()));
        }
        if let Some(endpoint) = config.endpoint.as_ref() {
            builder = builder.endpoint_url(endpoint.clone());
        }

        let credentials = Credentials::new(
            &access_key,
            &secret_key,
            config.session_token.clone(),
            None,
            "media-storage",
        );
        builder = builder.credentials_provider(credentials);

        if config.force_path_style {
            builder = builder.force_path_style(true);
        }

        let conf = builder.build();
        let client = Client::from_conf(conf);

        Some(client)
    }
}
