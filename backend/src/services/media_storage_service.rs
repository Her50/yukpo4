use std::path::{Path, PathBuf};

use aws_sdk_s3::{
    config::{Builder as S3ConfigBuilder, Credentials, Region},
    presigning::PresigningConfig,
    primitives::ByteStream,
    Client,
};
use log::{debug, info, warn};
use std::time::Duration;
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

    /// ✅ OPTIMISÉ 2025-12-30: Uploader directement depuis des bytes en mémoire vers S3
    /// Évite la double écriture sur disque (gain de temps significatif)
    pub async fn store_bytes(
        &self,
        data: &[u8],
        storage_key: &str,
        content_type: Option<&str>,
    ) -> AppResult<StoredMediaLocation> {
        let normalized_key = storage_key.trim_start_matches('/');
        let storage_path = self.storage_path_for(normalized_key);
        let content_length = data.len() as u64;

        // Si stockage local uniquement, sauvegarder directement
        if self.client.is_none() {
            let local_target = self.local_path_for(normalized_key);
            if let Some(parent) = local_target.parent() {
                fs::create_dir_all(parent).await.map_err(|e| {
                    AppError::Internal(format!("Erreur création répertoire: {}", e))
                })?;
            }
            fs::write(&local_target, data).await.map_err(|e| {
                AppError::Internal(format!("Erreur écriture locale: {}", e))
            })?;

            let public_url = self.build_public_url(&storage_path);
            return Ok(StoredMediaLocation {
                storage_path,
                public_url,
                content_length: Some(content_length),
            });
        }

        // ✅ OPTIMISÉ: Upload directement depuis les bytes en mémoire vers S3 (pas de fichier temporaire)
        if let Some(client) = &self.client {
            let object_key = storage_path.clone();
            
            // Sauvegarder localement si keep_local_copy est activé
            if self.config.keep_local_copy {
                let local_target = self.local_path_for(normalized_key);
                if let Some(parent) = local_target.parent() {
                    fs::create_dir_all(parent).await.map_err(|e| {
                        AppError::Internal(format!("Erreur création répertoire local: {}", e))
                    })?;
                }
                // Écrire en parallèle avec l'upload S3 (ne bloque pas)
                let local_target_clone = local_target.clone();
                let data_clone = data.to_vec();
                tokio::spawn(async move {
                    if let Err(e) = fs::write(&local_target_clone, &data_clone).await {
                        warn!("[MediaStorage] Erreur sauvegarde locale: {}", e);
                    }
                });
            }

            // Upload directement depuis les bytes vers S3
            self.upload_bytes_to_s3(client, data, &object_key, content_type).await?;
        }

        let public_url = self.build_public_url(&storage_path);

        Ok(StoredMediaLocation {
            storage_path,
            public_url,
            content_length: Some(content_length),
        })
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

    pub fn remote_location_from_path(
        &self,
        storage_path: String,
        public_url: Option<String>,
        content_length: Option<u64>,
    ) -> StoredMediaLocation {
        let resolved_public_url = public_url
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| self.build_public_url(&storage_path));

        StoredMediaLocation {
            storage_path,
            public_url: resolved_public_url,
            content_length,
        }
    }

    pub fn remote_location_from_key(
        &self,
        storage_key: &str,
        public_url: Option<String>,
        content_length: Option<u64>,
    ) -> StoredMediaLocation {
        let normalized_key = storage_key.trim_start_matches('/');
        let storage_path = self.storage_path_for(normalized_key);
        self.remote_location_from_path(storage_path, public_url, content_length)
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

    /// ✅ NOUVEAU 2025-12-30: Upload directement depuis les bytes en mémoire vers S3
    /// Évite l'écriture/lecture sur disque (gain de temps significatif)
    async fn upload_bytes_to_s3(
        &self,
        client: &Client,
        data: &[u8],
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

        // ✅ OPTIMISÉ: Utiliser ByteStream::from directement depuis les bytes (pas de fichier)
        let body = ByteStream::from(data.to_vec());

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
            "[MediaStorage] Bytes uploadés vers S3 (bucket={}, key={}, size={} bytes)",
            bucket, object_key, data.len()
        );

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

    /// ✅ Construit l'URL publique pour un fichier stocké (S3/Wasabi ou local)
    /// ✅ Alias pour upload_file - utilise store_file en interne
    pub async fn upload_file<P: AsRef<Path>>(
        &self,
        local_path: P,
        storage_key: &str,
    ) -> AppResult<String> {
        let result = self.store_file(local_path, storage_key, None).await?;
        Ok(result.public_url)
    }

    /// ✅ Construit l'URL publique pour un fichier stocké (S3/Wasabi ou local)
    pub fn build_public_url(&self, storage_path: &str) -> String {
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

    /// ✅ Génère une URL pré-signée pour un objet Wasabi/S3
    /// Permet un accès temporaire sécurisé sans nécessiter d'accès public sur le bucket
    ///
    /// # Arguments
    /// * `storage_path` - Chemin de l'objet dans le bucket (ex: "uploads/delivery/proof_123.mp4")
    /// * `expires_in_seconds` - Durée de validité de l'URL en secondes (ex: 48 * 3600 pour 48 heures)
    ///
    /// # Returns
    /// URL pré-signée complète avec signature AWS
    ///
    /// # Erreurs
    /// Retourne une erreur si le client S3 n'est pas configuré ou si la génération échoue
    pub async fn generate_presigned_url(
        &self,
        storage_path: &str,
        expires_in_seconds: u64,
    ) -> AppResult<String> {
        let client = self.client.as_ref().ok_or_else(|| {
            AppError::Internal(
                "Client S3 non configuré pour génération d'URL pré-signée".to_string(),
            )
        })?;

        let bucket = self.bucket.as_ref().ok_or_else(|| {
            AppError::Internal(
                "Bucket S3 non configuré pour génération d'URL pré-signée".to_string(),
            )
        })?;

        // Normaliser le chemin (enlever le préfixe "uploads/" si présent car il est déjà dans storage_path)
        let object_key = storage_path.trim_start_matches('/');

        // Créer la configuration de présignature
        let presigning_config =
            PresigningConfig::expires_in(Duration::from_secs(expires_in_seconds)).map_err(|e| {
                AppError::Internal(format!("Erreur configuration présignature: {}", e))
            })?;

        // Générer l'URL pré-signée
        let presigned_request = client
            .get_object()
            .bucket(bucket)
            .key(object_key)
            .presigned(presigning_config)
            .await
            .map_err(|e| {
                AppError::Internal(format!(
                    "Erreur génération URL pré-signée pour {}: {}",
                    object_key, e
                ))
            })?;

        let presigned_url = presigned_request.uri().to_string();

        debug!(
            "[MediaStorage] URL pré-signée générée pour {} (expire dans {}s)",
            object_key, expires_in_seconds
        );

        Ok(presigned_url)
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
