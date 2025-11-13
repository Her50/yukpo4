use std::path::{Path, PathBuf};
use std::sync::Arc;

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use log::{debug, info, warn};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use reqwest::multipart::{Form, Part};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::{types::Json, PgPool};
use tokio::process::Command;
use tokio::time::{sleep, Duration};
use uuid::Uuid;

use crate::{
    config::premium_audio::{
        AudioShakeConfig, AuphonicConfig, DolbyConfig, PremiumAudioConfig, PremiumAudioProvider,
    },
    core::types::{AppError, AppResult},
    services::media_storage_service::MediaStorageService,
};

#[derive(Debug)]
pub struct AudioMasteringService {
    client: reqwest::Client,
    config: PremiumAudioConfig,
    pool: PgPool,
    storage: Arc<MediaStorageService>,
}

#[derive(Debug)]
pub struct MasteringResult {
    pub mastered_path: PathBuf,
    pub provider: String,
    pub metadata: serde_json::Value,
}

#[derive(Debug)]
pub enum AudioMasteringOutcome {
    Completed(MasteringResult),
    Pending { job_id: Uuid },
}

#[derive(Debug, Deserialize)]
pub struct AudioPremiumWebhookPayload {
    pub job_id: Option<Uuid>,
    pub provider_job_id: Option<String>,
    pub status: Option<String>,
    pub download_url: Option<String>,
    pub metadata: Option<Value>,
    pub error_message: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct PremiumAudioJobRecord {
    job_id: Uuid,
    provider: String,
    provider_job_id: Option<String>,
    video_job_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
struct AuphonicResponse {
    data: AuphonicProduction,
}

#[derive(Debug, Deserialize)]
struct AuphonicProduction {
    uuid: String,
    status: Option<String>,
    output_files: Option<Vec<AuphonicOutputFile>>,
    metadata: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct AuphonicOutputFile {
    download_url: Option<String>,
    format: Option<String>,
}

impl AudioMasteringService {
    pub fn new(
        config: PremiumAudioConfig,
        pool: PgPool,
        storage: Arc<MediaStorageService>,
    ) -> AppResult<Self> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(180))
            .build()
            .map_err(|err| {
                AppError::Internal(format!("Erreur init client audio premium: {err}"))
            })?;

        Ok(Self {
            client,
            config,
            pool,
            storage,
        })
    }

    pub async fn master_audio(
        &self,
        input: &Path,
        output_dir: &Path,
        video_job_id: Option<Uuid>,
    ) -> AppResult<AudioMasteringOutcome> {
        if let Err(err) = tokio::fs::create_dir_all(output_dir).await {
            return Err(AppError::Internal(format!(
                "Impossible de créer le dossier sortie audio premium: {err}"
            )));
        }

        let job_id = Uuid::new_v4();
        let provider_label = match self.config.provider {
            PremiumAudioProvider::Dolby => "dolby",
            PremiumAudioProvider::AudioShake => "audioshake",
            PremiumAudioProvider::Auphonic => "auphonic",
            PremiumAudioProvider::Dual => "dual",
        }
        .to_string();

        self.insert_job(job_id, &provider_label, input, video_job_id)
            .await?;
        if let Some(video_job_id) = video_job_id {
            self.set_video_job_audio_status(
                video_job_id,
                Some(job_id),
                "processing",
                Some(&json!({ "provider": provider_label })),
            )
            .await?;
        }

        let result = match self.config.provider {
            PremiumAudioProvider::Dolby => {
                if let Some(cfg) = &self.config.dolby {
                    self.master_with_dolby(job_id, cfg, input, output_dir).await
                } else {
                    Err(AppError::Internal(
                        "Configuration Dolby manquante pour premium audio.".to_string(),
                    ))
                }
            }
            PremiumAudioProvider::AudioShake => {
                if let Some(cfg) = &self.config.audioshake {
                    self.master_with_audioshake(job_id, cfg, input, output_dir)
                        .await
                } else {
                    Err(AppError::Internal(
                        "Configuration AudioShake manquante pour premium audio.".to_string(),
                    ))
                }
            }
            PremiumAudioProvider::Auphonic => {
                if let Some(cfg) = &self.config.auphonic {
                    self.master_with_auphonic(job_id, cfg, input, output_dir)
                        .await
                } else {
                    Err(AppError::Internal(
                        "Configuration Auphonic manquante pour premium audio.".to_string(),
                    ))
                }
            }
            PremiumAudioProvider::Dual => {
                let mut last_error: Option<AppError> = None;

                if let Some(cfg) = &self.config.dolby {
                    match self.master_with_dolby(job_id, cfg, input, output_dir).await {
                        Ok(res) => return Ok(res),
                        Err(err) => {
                            warn!("[AudioMastering] Dolby a échoué ({err}), tentative Auphonic...");
                            last_error = Some(err);
                        }
                    }
                }

                if let Some(cfg) = &self.config.auphonic {
                    match self
                        .master_with_auphonic(job_id, cfg, input, output_dir)
                        .await
                    {
                        Ok(res) => return Ok(res),
                        Err(err) => {
                            warn!(
                                "[AudioMastering] Auphonic a échoué ({err}), tentative AudioShake..."
                            );
                            last_error = Some(err);
                        }
                    }
                }

                if let Some(cfg) = &self.config.audioshake {
                    return self
                        .master_with_audioshake(job_id, cfg, input, output_dir)
                        .await;
                }

                Err(last_error.unwrap_or_else(|| {
                    AppError::Internal("Audio premium indisponible.".to_string())
                }))
            }
        };

        match result {
            Ok(AudioMasteringOutcome::Completed(res)) => {
                self.update_job_completed(job_id, "completed", &res).await?;
                if let Some(video_job_id) = video_job_id {
                    self.set_video_job_audio_status(
                        video_job_id,
                        Some(job_id),
                        "completed",
                        Some(&res.metadata),
                    )
                    .await?;
                }
                Ok(AudioMasteringOutcome::Completed(res))
            }
            Ok(AudioMasteringOutcome::Pending { job_id: pending_id }) => {
                if let Some(video_job_id) = video_job_id {
                    self.set_video_job_audio_status(
                        video_job_id,
                        Some(pending_id),
                        "processing",
                        None,
                    )
                    .await?;
                }
                Ok(AudioMasteringOutcome::Pending { job_id: pending_id })
            }
            Err(err) => {
                warn!("[AudioMastering] Fallback local (service premium indisponible): {err}");
                self.update_job_failed(job_id, &err.to_string()).await?;
                let local_result = self.local_master(input, output_dir).await?;
                self.update_job_completed(job_id, "completed_local", &local_result)
                    .await?;
                if let Some(video_job_id) = video_job_id {
                    self.set_video_job_audio_status(
                        video_job_id,
                        Some(job_id),
                        "completed_local",
                        Some(&local_result.metadata),
                    )
                    .await?;
                }
                Ok(AudioMasteringOutcome::Completed(local_result))
            }
        }
    }

    pub async fn process_webhook(
        &self,
        provider: &str,
        payload: AudioPremiumWebhookPayload,
    ) -> AppResult<()> {
        let provider = provider.to_lowercase();
        let job_record = self
            .load_job_for_webhook(
                &provider,
                payload.job_id,
                payload.provider_job_id.as_deref(),
            )
            .await?;

        if let Some(ref provider_job_id) = payload.provider_job_id {
            if job_record.provider_job_id.as_deref() != Some(provider_job_id.as_str()) {
                self.set_provider_job_id(job_record.job_id, provider_job_id)
                    .await?;
            }
        }

        let status = payload
            .status
            .unwrap_or_else(|| "completed".to_string())
            .to_lowercase();

        match status.as_str() {
            "completed" | "finished" | "success" => {
                let download_url = payload.download_url.ok_or_else(|| {
                    AppError::BadRequest(
                        "download_url requis pour un webhook audio 'completed'".to_string(),
                    )
                })?;

                let result = self
                    .download_and_store_master(&provider, &download_url, payload.metadata.clone())
                    .await?;

                self.update_job_completed(job_record.job_id, "completed", &result)
                    .await?;

                if let Some(video_job_id) = job_record.video_job_id {
                    self.set_video_job_audio_status(
                        video_job_id,
                        Some(job_record.job_id),
                        "completed",
                        Some(&result.metadata),
                    )
                    .await?;
                }
            }
            "failed" | "error" => {
                let error_message = payload
                    .error_message
                    .unwrap_or_else(|| "Audio mastering failed".to_string());
                self.update_job_failed(job_record.job_id, &error_message)
                    .await?;

                if let Some(video_job_id) = job_record.video_job_id {
                    self.set_video_job_audio_status(
                        video_job_id,
                        Some(job_record.job_id),
                        "failed",
                        payload.metadata.as_ref(),
                    )
                    .await?;
                }
            }
            "processing" | "pending" => {
                self.mark_job_pending(job_record.job_id, &provider, payload.metadata.clone())
                    .await?;
                if let Some(video_job_id) = job_record.video_job_id {
                    self.set_video_job_audio_status(
                        video_job_id,
                        Some(job_record.job_id),
                        "processing",
                        payload.metadata.as_ref(),
                    )
                    .await?;
                }
            }
            _ => {
                self.mark_job_pending(job_record.job_id, &provider, payload.metadata.clone())
                    .await?;
                if let Some(video_job_id) = job_record.video_job_id {
                    self.set_video_job_audio_status(
                        video_job_id,
                        Some(job_record.job_id),
                        "processing",
                        payload.metadata.as_ref(),
                    )
                    .await?;
                }
            }
        }

        Ok(())
    }

    pub fn webhook_secret(&self) -> Option<&String> {
        self.config.webhook_secret.as_ref()
    }

    async fn insert_job(
        &self,
        job_id: Uuid,
        provider: &str,
        input: &Path,
        video_job_id: Option<Uuid>,
    ) -> AppResult<()> {
        let source_path = input.to_string_lossy().to_string();
        sqlx::query(
            r#"
            INSERT INTO premium_audio_jobs (job_id, provider, source_path, status, metadata, video_job_id)
            VALUES ($1, $2, $3, 'processing', $4, $5)
            "#,
        )
        .bind(job_id)
        .bind(provider)
        .bind(&source_path)
        .bind(Json(json!({
            "created_via": "audio_mastering_service"
        })))
        .bind(video_job_id)
        .execute(&self.pool)
        .await
        .map_err(|err| {
            AppError::Internal(format!(
                "Impossible d'insérer premium_audio_jobs (job_id={}): {err}",
                job_id
            ))
        })?;
        Ok(())
    }

    async fn update_job_completed(
        &self,
        job_id: Uuid,
        status: &str,
        result: &MasteringResult,
    ) -> AppResult<()> {
        let output_path = result.mastered_path.to_string_lossy().to_string();
        let metadata_json = Json(result.metadata.clone());
        sqlx::query(
            r#"
            UPDATE premium_audio_jobs
            SET status = $1,
                output_path = $2,
                metadata = $3,
                completed_at = NOW(),
                updated_at = NOW()
            WHERE job_id = $4
            "#,
        )
        .bind(status)
        .bind(&output_path)
        .bind(metadata_json)
        .bind(job_id)
        .execute(&self.pool)
        .await
        .map_err(|err| {
            AppError::Internal(format!(
                "Impossible de mettre à jour premium_audio_jobs (job_id={}): {err}",
                job_id
            ))
        })?;
        Ok(())
    }

    async fn update_job_failed(&self, job_id: Uuid, error_message: &str) -> AppResult<()> {
        sqlx::query(
            r#"
            UPDATE premium_audio_jobs
            SET status = 'failed',
                error_message = $2,
                updated_at = NOW()
            WHERE job_id = $1
            "#,
        )
        .bind(job_id)
        .bind(error_message)
        .execute(&self.pool)
        .await
        .map_err(|err| {
            AppError::Internal(format!(
                "Impossible de marquer l'échec premium_audio_jobs (job_id={}): {err}",
                job_id
            ))
        })?;
        Ok(())
    }

    async fn mark_job_pending(
        &self,
        job_id: Uuid,
        provider: &str,
        metadata: Option<serde_json::Value>,
    ) -> AppResult<()> {
        let metadata_json = metadata.map(Json);
        sqlx::query(
            r#"
            UPDATE premium_audio_jobs
            SET status = 'pending',
                metadata = COALESCE($2::jsonb, metadata),
                updated_at = NOW()
            WHERE job_id = $1
            "#,
        )
        .bind(job_id)
        .bind(metadata_json)
        .execute(&self.pool)
        .await
        .map_err(|err| {
            AppError::Internal(format!(
                "Impossible de marquer le job audio {} ({}) comme pending: {err}",
                job_id, provider
            ))
        })?;
        Ok(())
    }

    async fn load_job_for_webhook(
        &self,
        provider: &str,
        job_id: Option<Uuid>,
        provider_job_id: Option<&str>,
    ) -> AppResult<PremiumAudioJobRecord> {
        if let Some(job_id) = job_id {
            let row = sqlx::query_as::<_, PremiumAudioJobRecord>(
                r#"
                SELECT job_id,
                       provider,
                       provider_job_id,
                       video_job_id
                FROM premium_audio_jobs
                WHERE job_id = $1
                "#,
            )
            .bind(job_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|err| {
                AppError::Internal(format!(
                    "Erreur récupération premium_audio_job {}: {err}",
                    job_id
                ))
            })?
            .ok_or_else(|| {
                AppError::NotFound("Job audio premium introuvable pour webhook".to_string())
            })?;

            return Ok(row);
        }

        if let Some(provider_job_id) = provider_job_id {
            let row = sqlx::query_as::<_, PremiumAudioJobRecord>(
                r#"
                SELECT job_id,
                       provider,
                       provider_job_id,
                       video_job_id
                FROM premium_audio_jobs
                WHERE provider = $1
                  AND provider_job_id = $2
                "#,
            )
            .bind(provider)
            .bind(provider_job_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|err| {
                AppError::Internal(format!(
                    "Erreur récupération premium_audio_job provider={} provider_job_id={}: {err}",
                    provider, provider_job_id
                ))
            })?
            .ok_or_else(|| {
                AppError::NotFound("Job audio premium introuvable pour provider_job_id".to_string())
            })?;

            return Ok(row);
        }

        Err(AppError::BadRequest(
            "job_id ou provider_job_id requis dans le webhook audio".to_string(),
        ))
    }

    async fn set_provider_job_id(&self, job_id: Uuid, provider_job_id: &str) -> AppResult<()> {
        sqlx::query(
            r#"
            UPDATE premium_audio_jobs
            SET provider_job_id = $2,
                updated_at = NOW()
            WHERE job_id = $1
            "#,
        )
        .bind(job_id)
        .bind(provider_job_id)
        .execute(&self.pool)
        .await
        .map_err(|err| {
            AppError::Internal(format!(
                "Impossible de mettre à jour provider_job_id pour {}: {err}",
                job_id
            ))
        })?;
        Ok(())
    }

    async fn download_and_store_master(
        &self,
        provider: &str,
        download_url: &str,
        metadata: Option<Value>,
    ) -> AppResult<MasteringResult> {
        let mut request = self.client.get(download_url);
        if provider == "auphonic" {
            if let Some(cfg) = &self.config.auphonic {
                request = request.basic_auth(&cfg.username, Some(&cfg.api_key));
            }
        }
        let response = request.send().await.map_err(|err| {
            AppError::Internal(format!(
                "Téléchargement du master audio ({download_url}) impossible: {err}"
            ))
        })?;

        if !response.status().is_success() {
            let status = response.status();
            return Err(AppError::Internal(format!(
                "Téléchargement du master audio a échoué (status={status})"
            )));
        }

        let bytes = response.bytes().await.map_err(|err| {
            AppError::Internal(format!(
                "Lecture du master audio téléchargé impossible: {err}"
            ))
        })?;

        let temp_path =
            std::env::temp_dir().join(format!("premium_audio_{}_{}.tmp", provider, Uuid::new_v4()));

        tokio::fs::write(&temp_path, &bytes).await.map_err(|err| {
            AppError::Internal(format!("Écriture fichier temporaire audio: {err}"))
        })?;

        let storage_prefix = self.config.storage_prefix.trim_start_matches('/');
        let storage_key = format!("{}/{}.wav", storage_prefix, Uuid::new_v4());

        let location = self
            .storage
            .store_file(&temp_path, &storage_key, Some("audio/wav"))
            .await?;

        if !self.config.keep_local_copy {
            let _ = tokio::fs::remove_file(&temp_path).await;
        }

        let local_path = self.storage.local_path_for(&location.storage_path);

        let mut merged_metadata = metadata.unwrap_or_else(|| json!({}));
        if let Some(obj) = merged_metadata.as_object_mut() {
            obj.entry("provider".to_string()).or_insert(json!(provider));
            obj.insert("public_url".to_string(), json!(location.public_url.clone()));
            obj.insert(
                "storage_path".to_string(),
                json!(location.storage_path.clone()),
            );
        } else {
            merged_metadata = json!({
                "provider": provider,
                "public_url": location.public_url.clone(),
                "storage_path": location.storage_path.clone(),
            });
        }

        Ok(MasteringResult {
            mastered_path: local_path,
            provider: provider.to_string(),
            metadata: merged_metadata,
        })
    }

    async fn master_with_dolby(
        &self,
        job_id: Uuid,
        config: &DolbyConfig,
        input: &Path,
        output_dir: &Path,
    ) -> AppResult<AudioMasteringOutcome> {
        info!(
            "[AudioMastering] Envoi mastering Dolby.io (job_id={})",
            job_id
        );

        let endpoint = format!("{}/media/enhance", config.base_url.trim_end_matches('/'));

        let file_bytes = tokio::fs::read(input)
            .await
            .map_err(|err| AppError::Internal(format!("Impossible de lire audio source: {err}")))?;
        let file_name = input
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("source_audio.wav");

        let file_part = Part::bytes(file_bytes).file_name(file_name.to_string());

        let mut form = Form::new().part("file", file_part);
        if let Some(preset) = &config.preset {
            form = form.text("preset", preset.clone());
        } else {
                form = form.text("preset", "music");
        }

        let auth_header = dolby_auth_header(config)?;

        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, auth_header);

        let response = self
            .client
            .post(endpoint.clone())
            .headers(headers)
            .multipart(form)
            .send()
            .await
            .map_err(|err| {
                AppError::Internal(format!(
                    "Échec appel API Dolby.io (POST {}): {err}",
                    endpoint
                ))
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "Dolby.io a renvoyé un statut invalide ({status}): {text}"
            )));
        }

        #[derive(serde::Deserialize)]
        struct DolbyResponse {
            #[serde(default)]
            result_url: Option<String>,
            #[serde(default)]
            download_url: Option<String>,
            #[serde(default)]
            metadata: Option<serde_json::Value>,
        }

        let payload: DolbyResponse = response
            .json()
            .await
            .map_err(|err| AppError::Internal(format!("Réponse JSON Dolby.io invalide: {err}")))?;

        if let Some(url) = payload.result_url.or(payload.download_url) {
            let mastered_path = output_dir.join("mastered_premium.wav");
            let auth_header = dolby_auth_header(config)?;

            let bytes = self
                .client
                .get(url)
                .header(AUTHORIZATION, auth_header)
                .header(CONTENT_TYPE, "application/octet-stream")
                .send()
                .await
                .map_err(|err| {
                    AppError::Internal(format!("Téléchargement mastering Dolby.io: {err}"))
                })?
                .bytes()
                .await
                .map_err(|err| {
                    AppError::Internal(format!("Lecture flux mastering Dolby.io: {err}"))
                })?;

            tokio::fs::write(&mastered_path, &bytes)
                .await
                .map_err(|err| AppError::Internal(format!("Écriture mastering premium: {err}")))?;

            debug!(
                "[AudioMastering] Mastering Dolby.io terminé (job_id={}) -> {}",
                job_id,
                mastered_path.display()
            );

            Ok(AudioMasteringOutcome::Completed(MasteringResult {
                mastered_path,
                provider: "dolby".to_string(),
                metadata: payload
                    .metadata
                    .unwrap_or_else(|| json!({ "provider": "dolby" })),
            }))
        } else {
            self.mark_job_pending(job_id, "dolby", payload.metadata.clone())
                .await?;
            Ok(AudioMasteringOutcome::Pending { job_id })
        }
    }

    async fn master_with_auphonic(
        &self,
        job_id: Uuid,
        config: &AuphonicConfig,
        input: &Path,
        _output_dir: &Path,
    ) -> AppResult<AudioMasteringOutcome> {
        info!(
            "[AudioMastering] Envoi mastering Auphonic (job_id={})",
            job_id
        );

        let file_bytes = tokio::fs::read(input)
            .await
            .map_err(|err| AppError::Internal(format!("Impossible de lire audio source: {err}")))?;
        let file_name = input
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("source_audio.wav");

        let mut form = Form::new().part(
            "input_file",
            Part::bytes(file_bytes).file_name(file_name.to_string()),
        );

        if let Some(preset) = &config.preset {
            form = form.text("preset", preset.clone());
        }
        if let Some(format) = &config.format {
            form = form.text("output_file_extension", format.clone());
        }

        form = form
            .text("action", "start")
            .text("title", format!("Premium audio job {}", job_id));

        let create_url = format!("{}/production/", config.base_url.trim_end_matches('/'));
            let response = self
                .client
            .post(create_url)
            .basic_auth(&config.username, Some(&config.api_key))
            .multipart(form)
                .send()
                .await
                .map_err(|err| {
                AppError::Internal(format!("Échec appel API Auphonic (create): {err}"))
                })?;

            if !response.status().is_success() {
                let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "Auphonic a renvoyé un statut invalide ({status}): {text}"
            )));
        }

        let create_payload: AuphonicResponse = response
            .json()
            .await
            .map_err(|err| AppError::Internal(format!("Réponse JSON Auphonic invalide: {err}")))?;

        let uuid = create_payload.data.uuid.clone();
        self.set_provider_job_id(job_id, &uuid).await?;

        let start_url = format!(
            "{}/production/{}/start",
            config.base_url.trim_end_matches('/'),
            uuid
        );
        let start_resp = self
            .client
            .post(start_url)
            .basic_auth(&config.username, Some(&config.api_key))
            .send()
            .await
            .map_err(|err| AppError::Internal(format!("Auphonic start failed: {err}")))?;

        if !start_resp.status().is_success() {
            let status = start_resp.status();
            let body = start_resp.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "Auphonic start a renvoyé un statut invalide ({status}): {body}"
            )));
        }

        let poll_interval = Duration::from_secs(config.poll_interval_secs.max(1));
        let mut elapsed = 0_u64;

        loop {
            let status_url = format!(
                "{}/production/{}.json",
                config.base_url.trim_end_matches('/'),
                uuid
            );
            let status_resp = self
                .client
                .get(status_url)
                .basic_auth(&config.username, Some(&config.api_key))
                .send()
                .await
                .map_err(|err| AppError::Internal(format!("Auphonic status failed: {err}")))?;

            if !status_resp.status().is_success() {
                let status = status_resp.status();
                let body = status_resp.text().await.unwrap_or_default();
                return Err(AppError::Internal(format!(
                    "Auphonic status a renvoyé un statut invalide ({status}): {body}"
                )));
            }

            let status_payload: AuphonicResponse = status_resp.json().await.map_err(|err| {
                AppError::Internal(format!("Auphonic status JSON invalide: {err}"))
            })?;

            match status_payload.data.status.as_deref() {
                Some("Done") | Some("Warnings") | Some("Warning") => {
                    if let Some(files) = status_payload.data.output_files.as_ref() {
                        if let Some(file) = files.iter().find(|f| f.download_url.is_some()) {
                            let download_url = file.download_url.as_ref().unwrap().clone();
                            let result = self
                                .download_and_store_master(
                                    "auphonic",
                                    &download_url,
                                    status_payload.data.metadata.clone(),
                                )
                                .await?;

                            return Ok(AudioMasteringOutcome::Completed(result));
                        }
                    }

                    return Err(AppError::Internal(
                        "Auphonic terminé mais aucun fichier de sortie disponible.".to_string(),
                    ));
                }
                Some("Error") | Some("Failed") => {
                    return Err(AppError::Internal(
                        "Auphonic a échoué (statut Error)".to_string(),
                    ));
                }
                _ => {
                    elapsed += config.poll_interval_secs;
                    if elapsed >= self.config.timeout_secs {
                        self.mark_job_pending(job_id, "auphonic", status_payload.data.metadata)
                            .await?;
                        return Ok(AudioMasteringOutcome::Pending { job_id });
                    }
                    sleep(poll_interval).await;
                }
            }
        }
    }

    async fn master_with_audioshake(
        &self,
        job_id: Uuid,
        _config: &AudioShakeConfig,
        _input: &Path,
        _output_dir: &Path,
    ) -> AppResult<AudioMasteringOutcome> {
        info!(
            "[AudioMastering] Envoi mastering AudioShake (job_id={})",
            job_id
        );

        warn!(
            "[AudioMastering] AudioShake mastering direct non implémenté, fallback local immédiat."
        );
        Err(AppError::Internal(
            "Mastering AudioShake non implémenté (TODO)".to_string(),
        ))
    }

    async fn local_master(&self, input: &Path, output_dir: &Path) -> AppResult<MasteringResult> {
        let mastered_path = output_dir.join("mastered_local.wav");

        let filters = vec![
            "loudnorm=I=-14:TP=-1.5:LRA=11",
            "acompressor=threshold=-24dB:ratio=3:attack=25:release=280",
            "aexciter=amount=0.2",
            "stereotools=soft",
            "highpass=f=40",
        ]
        .join(",");

        let status = Command::new("ffmpeg")
            .args([
                "-y",
                "-i",
                input.to_string_lossy().as_ref(),
                "-af",
                &filters,
                "-ar",
                "48000",
                mastered_path.to_string_lossy().as_ref(),
            ])
            .status()
            .await
            .map_err(|err| {
                AppError::Internal(format!("ffmpeg mastering local impossible: {err}"))
            })?;

        if !status.success() {
            return Err(AppError::Internal(format!(
                "ffmpeg mastering local a échoué (code={:?})",
                status.code()
            )));
        }

        Ok(MasteringResult {
            mastered_path,
            provider: "ffmpeg-local".to_string(),
            metadata: json!({ "filters": filters }),
        })
    }

    async fn set_video_job_audio_status(
        &self,
        video_job_id: Uuid,
        audio_job_id: Option<Uuid>,
        status: &str,
        metadata: Option<&serde_json::Value>,
    ) -> AppResult<()> {
        let metadata_json = metadata.cloned().map(Json);
        sqlx::query(
            r#"
            UPDATE video_generation_jobs
            SET audio_job_id = COALESCE($2, audio_job_id),
                audio_status = $3,
                audio_metadata = COALESCE($4::jsonb, audio_metadata),
                updated_at = NOW()
            WHERE job_id = $1
            "#,
        )
        .bind(video_job_id)
        .bind(audio_job_id)
        .bind(status)
        .bind(metadata_json)
        .execute(&self.pool)
        .await
        .map_err(|err| {
            AppError::Internal(format!(
                "Impossible de mettre à jour audio_status du job vidéo {}: {err}",
                video_job_id
            ))
        })?;
        Ok(())
    }
}

fn dolby_auth_header(config: &DolbyConfig) -> AppResult<HeaderValue> {
    let token = format!("{}:{}", config.api_key, config.api_secret);
    let encoded = BASE64.encode(token.as_bytes());
    HeaderValue::from_str(&format!("Basic {}", encoded))
        .map_err(|err| AppError::Internal(format!("Dolby.io API key invalide: {err}")))
}
