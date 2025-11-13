use std::{path::PathBuf, sync::Arc, time::Duration};

use async_trait::async_trait;
use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use tokio::time::{sleep, timeout};
use uuid::Uuid;

use crate::{
    config::video_renderer::VideoRendererConfig,
    services::{
        immersive_timeline::ImmersiveTimeline,
        remotion_renderer_service::{RemotionRendererService, RenderedVideo},
    },
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RenderExecutionMode {
    GpuRpc,
    Offline,
}

#[derive(Debug, Clone)]
pub struct RenderJobRequest {
    pub job_id: Option<Uuid>,
    pub timeline: Arc<ImmersiveTimeline>,
}

#[derive(Debug, Clone)]
pub struct RenderJobResponse {
    pub job_id: String,
    pub mode: RenderExecutionMode,
    pub master_video: PathBuf,
    pub timeline_json: PathBuf,
    pub output_dir: PathBuf,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct RenderError {
    pub mode: RenderExecutionMode,
    pub message: String,
    pub retryable: bool,
}

impl RenderError {
    pub fn new<M: Into<String>>(mode: RenderExecutionMode, message: M, retryable: bool) -> Self {
        Self {
            mode,
            message: message.into(),
            retryable,
        }
    }

    pub fn retryable(&self) -> bool {
        self.retryable
    }
}

#[async_trait]
pub trait VideoRenderExecutor: Send + Sync {
    fn label(&self) -> &'static str;
    fn mode(&self) -> RenderExecutionMode;
    async fn render(
        &self,
        request: &RenderJobRequest,
        timeout: Duration,
    ) -> Result<RenderJobResponse, RenderError>;
}

pub struct LocalRenderExecutor {
    service: Arc<RemotionRendererService>,
}

impl LocalRenderExecutor {
    pub fn new(service: Arc<RemotionRendererService>) -> Self {
        Self { service }
    }
}

#[async_trait]
impl VideoRenderExecutor for LocalRenderExecutor {
    fn label(&self) -> &'static str {
        "remotion_local"
    }

    fn mode(&self) -> RenderExecutionMode {
        RenderExecutionMode::Offline
    }

    async fn render(
        &self,
        request: &RenderJobRequest,
        _timeout: Duration,
    ) -> Result<RenderJobResponse, RenderError> {
        let job_hint = request.job_id.as_ref().map(|value| value.to_string());

        match self
            .service
            .render(&request.timeline, job_hint.as_deref())
            .await
        {
            Ok(rendered) => Ok(convert_rendered_video(
                rendered,
                RenderExecutionMode::Offline,
                vec![],
            )),
            Err(err) => {
                error!("[VideoRenderer][offline] Échec rendu Remotion local: {err}");
                Err(RenderError::new(
                    RenderExecutionMode::Offline,
                    err.to_string(),
                    false,
                ))
            }
        }
    }
}

pub struct RpcRenderExecutor {
    client: reqwest::Client,
    endpoint: String,
}

impl RpcRenderExecutor {
    pub fn new(endpoint: String) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .expect("Impossible de construire le client HTTP pour le renderer RPC");
        Self { client, endpoint }
    }
}

#[async_trait]
impl VideoRenderExecutor for RpcRenderExecutor {
    fn label(&self) -> &'static str {
        "remotion_rpc"
    }

    fn mode(&self) -> RenderExecutionMode {
        RenderExecutionMode::GpuRpc
    }

    async fn render(
        &self,
        request: &RenderJobRequest,
        timeout_duration: Duration,
    ) -> Result<RenderJobResponse, RenderError> {
        #[derive(Serialize)]
        struct RpcRenderRequest<'a> {
            #[serde(skip_serializing_if = "Option::is_none")]
            job_id: Option<String>,
            timeline: &'a ImmersiveTimeline,
        }

        #[derive(Debug, Deserialize)]
        struct RpcRenderResponse {
            pub job_id: String,
            pub master_video: String,
            pub timeline_json: Option<String>,
            pub output_dir: Option<String>,
            #[serde(default)]
            pub warnings: Vec<String>,
        }

        let job_id_string = request.job_id.as_ref().map(|value| value.to_string());
        let payload = RpcRenderRequest {
            job_id: job_id_string.clone(),
            timeline: &request.timeline,
        };

        let endpoint = format!("{}/render", self.endpoint.trim_end_matches('/'));
        let send_future = self.client.post(endpoint).json(&payload).send();

        let response = match timeout(timeout_duration, send_future).await {
            Ok(result) => result,
            Err(_) => {
                warn!(
                    "[VideoRenderer][rpc] Timeout rendu (>{:?})",
                    timeout_duration
                );
                return Err(RenderError::new(
                    RenderExecutionMode::GpuRpc,
                    "Timeout rendu GPU".to_string(),
                    true,
                ));
            }
        };

        let response = match response {
            Ok(resp) => resp,
            Err(err) => {
                warn!("[VideoRenderer][rpc] Erreur transport HTTP: {err}");
                let retryable = err.is_timeout() || err.is_connect() || err.is_request();
                return Err(RenderError::new(
                    RenderExecutionMode::GpuRpc,
                    err.to_string(),
                    retryable,
                ));
            }
        };

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            error!(
                "[VideoRenderer][rpc] Statut HTTP inattendu {}: {}",
                status, body
            );
            return Err(RenderError::new(
                RenderExecutionMode::GpuRpc,
                format!("Statut HTTP inattendu: {}", status),
                status.is_server_error(),
            ));
        }

        let parsed: RpcRenderResponse = match response.json().await {
            Ok(value) => value,
            Err(err) => {
                error!("[VideoRenderer][rpc] Réponse JSON invalide: {err}");
                return Err(RenderError::new(
                    RenderExecutionMode::GpuRpc,
                    format!("Réponse JSON invalide: {err}"),
                    false,
                ));
            }
        };

        let master_video = PathBuf::from(parsed.master_video.clone());
        let timeline_json = parsed
            .timeline_json
            .map(PathBuf::from)
            .unwrap_or_else(|| {
                warn!(
                    "[VideoRenderer][rpc] timeline_json absent dans la réponse, déduction basée sur job_id"
                );
                master_video
                    .parent()
                    .map(PathBuf::from)
                    .unwrap_or_else(|| PathBuf::from("renders"))
                    .join(format!("{}.json", parsed.job_id))
            });

        let output_dir = parsed.output_dir.map(PathBuf::from).unwrap_or_else(|| {
            master_video
                .parent()
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("renders"))
        });

        Ok(RenderJobResponse {
            job_id: parsed.job_id,
            mode: RenderExecutionMode::GpuRpc,
            master_video,
            timeline_json,
            output_dir,
            warnings: parsed.warnings,
        })
    }
}

pub struct VideoRenderDispatcher {
    config: VideoRendererConfig,
    primary: Option<Arc<dyn VideoRenderExecutor>>,
    fallback: Option<Arc<dyn VideoRenderExecutor>>,
}

impl VideoRenderDispatcher {
    pub fn new(
        config: VideoRendererConfig,
        primary: Option<Arc<dyn VideoRenderExecutor>>,
        fallback: Option<Arc<dyn VideoRenderExecutor>>,
    ) -> Self {
        Self {
            config,
            primary,
            fallback,
        }
    }

    pub fn from_state_config(
        config: VideoRendererConfig,
        remotion_service: Option<Arc<RemotionRendererService>>,
    ) -> Option<Self> {
        let mut primary: Option<Arc<dyn VideoRenderExecutor>> = None;
        let mut fallback: Option<Arc<dyn VideoRenderExecutor>> = None;

        if let Some(endpoint) = config.rpc_endpoint.clone() {
            let rpc_executor =
                Arc::new(RpcRenderExecutor::new(endpoint)) as Arc<dyn VideoRenderExecutor>;
            primary = Some(rpc_executor);
        }

        if let Some(service) = remotion_service {
            let local_executor =
                Arc::new(LocalRenderExecutor::new(service)) as Arc<dyn VideoRenderExecutor>;
            match primary {
                Some(_) => fallback = Some(local_executor),
                None => primary = Some(local_executor),
            }
        }

        if primary.is_none() {
            return None;
        }

        Some(Self::new(config, primary, fallback))
    }

    pub fn timeout(&self) -> Duration {
        self.config.timeout
    }

    pub fn max_retries(&self) -> u32 {
        self.config.max_retries
    }

    pub async fn render(
        &self,
        request: &RenderJobRequest,
    ) -> Result<RenderJobResponse, RenderError> {
        let timeout = self.timeout();
        let max_retries = self.max_retries();

        if let Some(primary) = &self.primary {
            let result = self
                .attempt_with_retries(primary.clone(), request, timeout, max_retries)
                .await;
            match result {
                Ok(response) => return Ok(response),
                Err(err) => {
                    warn!(
                        "[VideoRenderer] Échec du renderer principal {} (mode={:?}): {}",
                        primary.label(),
                        err.mode,
                        err.message
                    );
                    if err.retryable() || self.fallback.is_some() {
                        if let Some(fallback) = &self.fallback {
                            info!(
                                "[VideoRenderer] Tentative fallback via {} (mode={:?})",
                                fallback.label(),
                                fallback.mode()
                            );
                            return self
                                .attempt_with_retries(fallback.clone(), request, timeout, 1)
                                .await;
                        }
                    }
                    return Err(err);
                }
            }
        }

        Err(RenderError::new(
            RenderExecutionMode::Offline,
            "Aucun renderer disponible",
            false,
        ))
    }

    async fn attempt_with_retries(
        &self,
        executor: Arc<dyn VideoRenderExecutor>,
        request: &RenderJobRequest,
        timeout: Duration,
        max_retries: u32,
    ) -> Result<RenderJobResponse, RenderError> {
        let mut attempt: u32 = 0;
        loop {
            attempt += 1;
            let label = executor.label();
            debug!(
                "[VideoRenderer] Tentative {} via {} (mode={:?})",
                attempt,
                label,
                executor.mode()
            );

            match executor.render(request, timeout).await {
                Ok(response) => {
                    info!(
                        "[VideoRenderer] Rendu réussi via {} (job_id={}, mode={:?})",
                        label, response.job_id, response.mode
                    );
                    return Ok(response);
                }
                Err(err) => {
                    let retryable = err.retryable() && attempt <= max_retries;
                    warn!(
                        "[VideoRenderer] Échec tentative {} via {} (mode={:?}): {} (retryable={})",
                        attempt,
                        label,
                        err.mode,
                        err.message,
                        err.retryable()
                    );
                    if retryable {
                        let backoff_ms =
                            500_u64.saturating_mul(2_u64.pow(attempt.saturating_sub(1)));
                        sleep(Duration::from_millis(backoff_ms)).await;
                        continue;
                    } else {
                        return Err(err);
                    }
                }
            }
        }
    }
}

fn convert_rendered_video(
    rendered: RenderedVideo,
    mode: RenderExecutionMode,
    warnings: Vec<String>,
) -> RenderJobResponse {
    RenderJobResponse {
        job_id: rendered.job_id,
        mode,
        master_video: rendered.master_video,
        timeline_json: rendered.timeline_json,
        output_dir: rendered.output_dir,
        warnings,
    }
}
