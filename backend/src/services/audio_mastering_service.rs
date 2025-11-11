use std::path::{Path, PathBuf};

use log::{debug, error, info, warn};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use reqwest::multipart::{Form, Part};
use tokio::process::Command;

use crate::config::premium_audio::{PremiumAudioConfig, PremiumAudioProvider};
use crate::core::types::{AppError, AppResult};

#[derive(Debug)]
pub struct AudioMasteringService {
    client: reqwest::Client,
    config: PremiumAudioConfig,
}

#[derive(Debug)]
pub struct MasteringResult {
    pub mastered_path: PathBuf,
    pub provider: String,
    pub metadata: serde_json::Value,
}

impl AudioMasteringService {
    pub fn new(config: PremiumAudioConfig) -> AppResult<Self> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .map_err(|err| {
                AppError::Internal(format!("Erreur init client audio premium: {err}"))
            })?;

        Ok(Self { client, config })
    }

    pub async fn master_audio(
        &self,
        input: &Path,
        output_dir: &Path,
    ) -> AppResult<MasteringResult> {
        if let Err(err) = tokio::fs::create_dir_all(output_dir).await {
            return Err(AppError::Internal(format!(
                "Impossible de créer le dossier sortie audio premium: {err}"
            )));
        }

        match self.try_external_master(input, output_dir).await {
            Ok(result) => Ok(result),
            Err(err) => {
                warn!("[AudioMastering] Fallback local (erreur service premium): {err}");
                self.local_master(input, output_dir).await
            }
        }
    }

    async fn try_external_master(
        &self,
        input: &Path,
        output_dir: &Path,
    ) -> AppResult<MasteringResult> {
        info!(
            "[AudioMastering] Envoi mastering premium provider={:?}",
            self.config.provider
        );

        let file_part = Part::file(input)
            .map_err(|err| AppError::Internal(format!("Impossible de lire audio source: {err}")))?;

        let mut form = Form::new().part("file", file_part);

        match self.config.provider {
            PremiumAudioProvider::Dolby => {
                form = form.text("preset", "music");
            }
            PremiumAudioProvider::AudioShake => {
                form = form.text("analysis", "stem_mastering");
            }
            PremiumAudioProvider::Custom => {
                // laisser tel quel
            }
        }

        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", self.config.api_key))
                .map_err(|err| AppError::Internal(format!("API key invalide: {err}")))?,
        );

        let response = self
            .client
            .post(self.config.endpoint.clone())
            .headers(headers)
            .multipart(form)
            .send()
            .await
            .map_err(|err| {
                AppError::Internal(format!(
                    "Échec appel API mastering premium (POST {}): {err}",
                    self.config.endpoint
                ))
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "API mastering premium a renvoyé un statut invalide ({status}): {text}"
            )));
        }

        #[derive(serde::Deserialize)]
        struct ProviderResponse {
            #[serde(default)]
            result_url: Option<String>,
            #[serde(default)]
            download_url: Option<String>,
            #[serde(default)]
            job_id: Option<String>,
            #[serde(default)]
            status: Option<String>,
            #[serde(default)]
            metadata: Option<serde_json::Value>,
        }

        let provider_response: ProviderResponse = response
            .json()
            .await
            .map_err(|err| AppError::Internal(format!("Réponse JSON mastering invalide: {err}")))?;

        let download_url = provider_response
            .result_url
            .or(provider_response.download_url);

        if let Some(url) = download_url {
            let mastered_path = output_dir.join("mastered_premium.wav");
            let mut headers = HeaderMap::new();
            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(&format!("Bearer {}", self.config.api_key))
                    .map_err(|err| AppError::Internal(format!("API key invalide: {err}")))?,
            );

            let mut request = self.client.get(url);
            if let PremiumAudioProvider::Dolby = self.config.provider {
                request = request.header(CONTENT_TYPE, "application/octet-stream");
            }

            let bytes = request
                .headers(headers)
                .send()
                .await
                .map_err(|err| {
                    AppError::Internal(format!("Téléchargement mastering premium: {err}"))
                })?
                .bytes()
                .await
                .map_err(|err| {
                    AppError::Internal(format!("Lecture flux mastering premium: {err}"))
                })?;

            tokio::fs::write(&mastered_path, &bytes)
                .await
                .map_err(|err| AppError::Internal(format!("Écriture mastering premium: {err}")))?;

            debug!(
                "[AudioMastering] Mastering premium reçu ({:?}) -> {}",
                self.config.provider,
                mastered_path.display()
            );

            return Ok(MasteringResult {
                mastered_path,
                provider: format!("{:?}", self.config.provider),
                metadata: provider_response
                    .metadata
                    .unwrap_or_else(|| serde_json::json!({ "status": provider_response.status })),
            });
        }

        if let Some(job_id) = provider_response.job_id {
            self.poll_until_ready(&job_id, output_dir).await
        } else {
            Err(AppError::Internal(
                "Réponse mastering premium sans URL ni job_id".to_string(),
            ))
        }
    }

    async fn poll_until_ready(
        &self,
        job_id: &str,
        output_dir: &Path,
    ) -> AppResult<MasteringResult> {
        let status_url = format!("{}/{}", self.config.endpoint.trim_end_matches('/'), job_id);
        let mut attempt = 0;
        loop {
            attempt += 1;
            let response = self
                .client
                .get(&status_url)
                .header(
                    AUTHORIZATION,
                    HeaderValue::from_str(&format!("Bearer {}", self.config.api_key))
                        .map_err(|err| AppError::Internal(format!("API key invalide: {err}")))?,
                )
                .send()
                .await
                .map_err(|err| {
                    AppError::Internal(format!(
                        "Impossible de récupérer le statut mastering premium: {err}"
                    ))
                })?;

            if !response.status().is_success() {
                let status = response.status();
                let body = response.text().await.unwrap_or_default();
                return Err(AppError::Internal(format!(
                    "Statut mastering premium invalide ({status}): {body}"
                )));
            }

            #[derive(serde::Deserialize)]
            struct StatusResponse {
                status: String,
                #[serde(default)]
                result_url: Option<String>,
                #[serde(default)]
                download_url: Option<String>,
                #[serde(default)]
                metadata: Option<serde_json::Value>,
            }

            let status_payload: StatusResponse = response.json().await.map_err(|err| {
                AppError::Internal(format!("Statut JSON mastering invalide: {err}"))
            })?;

            match status_payload.status.as_str() {
                "completed" | "finished" => {
                    if let Some(url) = status_payload.result_url.or(status_payload.download_url) {
                        let mastered_path = output_dir.join("mastered_premium.wav");
                        let bytes = self
                            .client
                            .get(url)
                            .header(
                                AUTHORIZATION,
                                HeaderValue::from_str(&format!("Bearer {}", self.config.api_key))
                                    .map_err(|err| {
                                    AppError::Internal(format!("API key invalide: {err}"))
                                })?,
                            )
                            .send()
                            .await
                            .map_err(|err| {
                                AppError::Internal(format!(
                                    "Téléchargement résultat mastering premium: {err}"
                                ))
                            })?
                            .bytes()
                            .await
                            .map_err(|err| {
                                AppError::Internal(format!(
                                    "Lecture résultat mastering premium: {err}"
                                ))
                            })?;

                        tokio::fs::write(&mastered_path, &bytes)
                            .await
                            .map_err(|err| {
                                AppError::Internal(format!("Écriture mastering premium: {err}"))
                            })?;

                        return Ok(MasteringResult {
                            mastered_path,
                            provider: format!("{:?}", self.config.provider),
                            metadata: status_payload
                                .metadata
                                .unwrap_or_else(|| serde_json::json!({ "attempts": attempt })),
                        });
                    } else {
                        return Err(AppError::Internal(
                            "Statut mastering premium terminé sans URL téléchargeable".to_string(),
                        ));
                    }
                }
                "failed" | "error" => {
                    return Err(AppError::Internal(format!(
                        "Mastering premium en erreur (job_id={}): {:?}",
                        job_id, status_payload.metadata
                    )));
                }
                _ => {
                    tokio::time::sleep(std::time::Duration::from_millis(
                        self.config.poll_interval_ms,
                    ))
                    .await;
                }
            }
        }
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
            metadata: serde_json::json!({ "filters": filters }),
        })
    }
}
