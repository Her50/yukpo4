use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use reqwest::Client;
use tokio::sync::Mutex;

use crate::services::pipeline_health_service::{compute_pipeline_health, PipelineHealthStatus};
use crate::state::AppState;

const HEALTHCHECK_INTERVAL_SECS: u64 = 300; // 5 minutes

#[derive(Clone, Debug, PartialEq, Eq)]
struct LastSnapshot {
    status: String,
    stale_jobs: usize,
    failed_last_24h: i64,
}

pub fn start_pipeline_health_worker(state: Arc<AppState>) {
    let worker_state = state.clone();
    let last_snapshot = Arc::new(Mutex::new(None::<LastSnapshot>));
    let webhook_url = std::env::var("PIPELINE_ALERT_WEBHOOK").ok();
    let http_client = Arc::new(Client::new());

    tokio::spawn(async move {
        let mut ticker = tokio::time::interval(Duration::from_secs(HEALTHCHECK_INTERVAL_SECS));
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

        loop {
            ticker.tick().await;
            match compute_pipeline_health(worker_state.clone()).await {
                Ok(status) => {
                    handle_status(
                        &status,
                        last_snapshot.clone(),
                        webhook_url.as_deref(),
                        http_client.clone(),
                    )
                    .await;
                }
                Err(err) => {
                    log::error!(
                        "[PipelineWorker] Impossible de calculer le health pipeline: {err:?}"
                    );
                }
            }
        }
    });
}

async fn handle_status(
    status: &PipelineHealthStatus,
    last_snapshot: Arc<Mutex<Option<LastSnapshot>>>,
    webhook: Option<&str>,
    http_client: Arc<Client>,
) {
    let snapshot = LastSnapshot {
        status: status.status.clone(),
        stale_jobs: status.job_queue.stale_jobs.len(),
        failed_last_24h: status.job_queue.failed_last_24h,
    };

    let mut guard = last_snapshot.lock().await;
    let should_alert = match &*guard {
        Some(prev) => {
            prev.status != snapshot.status
                || (snapshot.status != "ok" && snapshot.stale_jobs > 0 && prev.stale_jobs == 0)
                || (snapshot.status != "ok" && snapshot.failed_last_24h > prev.failed_last_24h)
        }
        None => true,
    };

    if snapshot.status != "ok" && should_alert {
        log::warn!(
            "[PipelineWorker] Statut pipeline {:?} | stale_jobs={} | failed24h={} | timestamp={}",
            snapshot.status,
            snapshot.stale_jobs,
            snapshot.failed_last_24h,
            status.timestamp
        );
        if let Some(url) = webhook {
            if let Err(err) = send_webhook(url, status, &http_client).await {
                log::error!("[PipelineWorker] Échec envoi webhook pipeline: {err:?}");
            }
        }
    } else if snapshot.status == "ok" {
        if guard.as_ref().map(|prev| prev.status.as_str()) == Some("ok") {
            // rien à faire
        } else {
            log::info!(
                "[PipelineWorker] Pipeline revenu à OK | queued={} running={} completed24h={} | {}",
                status.job_queue.queued,
                status.job_queue.running,
                status.job_queue.completed_last_24h,
                status.timestamp
            );
            if let Some(url) = webhook {
                let _ = send_recovery_webhook(url, status, &http_client).await;
            }
        }
    }

    *guard = Some(snapshot);
}

async fn send_webhook(
    url: &str,
    status: &PipelineHealthStatus,
    client: &Client,
) -> Result<(), reqwest::Error> {
    let payload = serde_json::json!({
        "type": "pipeline-alert",
        "status": status.status,
        "timestamp": status.timestamp.to_rfc3339(),
        "job_queue": {
            "queued": status.job_queue.queued,
            "running": status.job_queue.running,
            "completed_last_24h": status.job_queue.completed_last_24h,
            "failed_last_24h": status.job_queue.failed_last_24h,
            "stale_jobs": status.job_queue.stale_jobs,
        },
        "components": status.components,
    });

    client
        .post(url)
        .json(&payload)
        .send()
        .await?
        .error_for_status()?;

    Ok(())
}

async fn send_recovery_webhook(
    url: &str,
    status: &PipelineHealthStatus,
    client: &Client,
) -> Result<(), reqwest::Error> {
    let payload = serde_json::json!({
        "type": "pipeline-recovery",
        "status": status.status,
        "timestamp": Utc::now().to_rfc3339(),
        "queued": status.job_queue.queued,
        "running": status.job_queue.running,
    });

    client
        .post(url)
        .json(&payload)
        .send()
        .await?
        .error_for_status()?;

    Ok(())
}

