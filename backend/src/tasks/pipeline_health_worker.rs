use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use reqwest::Client;
use tokio::sync::Mutex;

use crate::services::pipeline_health_service::{compute_pipeline_health, PipelineHealthStatus};
use crate::state::AppState;

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
    
    // Intervalle configurable via variable d'environnement (défaut: 300s = 5 minutes)
    let healthcheck_interval_secs: u64 = std::env::var("PIPELINE_HEALTH_CHECK_INTERVAL_SECS")
        .unwrap_or_else(|_| "300".to_string())
        .parse()
        .unwrap_or(300);

    tokio::spawn(async move {
        let mut ticker = tokio::time::interval(Duration::from_secs(healthcheck_interval_secs));
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

        loop {
            ticker.tick().await;
            
            // ✅ CORRECTION: Marquer les stale jobs comme failed avant de calculer le health
            if let Err(err) = crate::services::pipeline_health_service::mark_stale_jobs_as_failed(worker_state.clone()).await {
                log::error!(
                    "[PipelineWorker] Impossible de marquer les stale jobs comme failed: {err:?}"
                );
            }
            
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
    // Convertir stale_jobs en format compatible Slack (tableau de IDs ou nombre)
    let stale_jobs_count = status.job_queue.stale_jobs.len();

    let payload = serde_json::json!({
        "text": format!(
            "⚠️ Pipeline Alert: Status={} | Stale={} | Failed24h={}",
            status.status, stale_jobs_count, status.job_queue.failed_last_24h
        ),
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": format!(
                        "*Pipeline Health Alert*\n*Status:* {}\n*Stale Jobs:* {}\n*Failed (24h):* {}\n*Queued:* {}\n*Running:* {}",
                        status.status,
                        stale_jobs_count,
                        status.job_queue.failed_last_24h,
                        status.job_queue.queued,
                        status.job_queue.running
                    )
                }
            }
        ],
        "attachments": [
            {
                "color": if status.status == "degraded" { "warning" } else { "danger" },
                "fields": [
                    {
                        "title": "Timestamp",
                        "value": status.timestamp.to_rfc3339(),
                        "short": true
                    },
                    {
                        "title": "Completed (24h)",
                        "value": status.job_queue.completed_last_24h.to_string(),
                        "short": true
                    }
                ]
            }
        ]
    });

    let response = client
        .post(url)
        .json(&payload)
        .send()
        .await?;

    // Vérifier le statut et créer l'erreur avant de consommer la réponse
    if let Err(e) = response.error_for_status_ref() {
        let status_code = response.status();
        let body = response.text().await.unwrap_or_default();
        log::warn!(
            "[PipelineWorker] Webhook retourné {}: {}",
            status_code,
            body
        );
        return Err(e);
    }

    Ok(())
}

async fn send_recovery_webhook(
    url: &str,
    status: &PipelineHealthStatus,
    client: &Client,
) -> Result<(), reqwest::Error> {
    let payload = serde_json::json!({
        "text": "✅ Pipeline Recovery: Status retourné à OK",
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": format!(
                        "*Pipeline Recovery*\n*Status:* {}\n*Queued:* {}\n*Running:* {}\n*Completed (24h):* {}",
                        status.status,
                        status.job_queue.queued,
                        status.job_queue.running,
                        status.job_queue.completed_last_24h
                    )
                }
            }
        ],
        "attachments": [
            {
                "color": "good",
                "fields": [
                    {
                        "title": "Timestamp",
                        "value": Utc::now().to_rfc3339(),
                        "short": true
                    }
                ]
            }
        ]
    });

    let response = client
        .post(url)
        .json(&payload)
        .send()
        .await?;

    // Vérifier le statut et créer l'erreur avant de consommer la réponse
    if let Err(e) = response.error_for_status_ref() {
        let status_code = response.status();
        let body = response.text().await.unwrap_or_default();
        log::warn!(
            "[PipelineWorker] Recovery webhook retourné {}: {}",
            status_code,
            body
        );
        return Err(e);
    }

    Ok(())
}
