//! Worker : consomme `yukpo_ia:chat:queue` (Redis) et exécute le même pipeline que `POST /ai/chat`.

use crate::routes::ai_chat_routes::yukpo_ia_chat_core_inner;
use crate::services::yukpo_ia_job_queue::YukpoIaJobStatus;
use crate::state::AppState;
use log::{error, info, warn};
use std::sync::Arc;
use std::time::Instant;

pub fn start_yukpo_ia_queue_worker(state: Arc<AppState>) {
    if std::env::var("YUKPO_IA_QUEUE_WORKER_ENABLED")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(true)
        == false
    {
        info!("[YukpoIA worker] désactivé (YUKPO_IA_QUEUE_WORKER_ENABLED=false)");
        return;
    }

    let queue = state.yukpo_ia_job_queue.clone();
    let metrics = state.yukpo_ia_metrics.clone();

    tokio::spawn(async move {
        info!("[YukpoIA worker] démarré (BRPOP Redis)");
        loop {
            let pop = queue.blocking_pop_job_id(5.0).await;
            let job_id = match pop {
                Ok(Some(id)) => id,
                Ok(None) => continue,
                Err(e) => {
                    warn!("[YukpoIA worker] Redis BRPOP: {} — retry 2s", e);
                    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                    continue;
                }
            };

            let mut record = match queue.get_job(&job_id).await {
                Ok(Some(r)) => r,
                Ok(None) => {
                    warn!(
                        "[YukpoIA worker] job {} introuvable (clé expirée ?)",
                        job_id
                    );
                    continue;
                }
                Err(e) => {
                    error!("[YukpoIA worker] get_job {}: {}", job_id, e);
                    continue;
                }
            };

            record.status = YukpoIaJobStatus::Processing;
            if let Err(e) = queue.update_job(&record).await {
                error!("[YukpoIA worker] update_job processing {}: {}", job_id, e);
            }

            let payload: crate::routes::ai_chat_routes::ChatRequest =
                match serde_json::from_value(record.request.clone()) {
                    Ok(p) => p,
                    Err(e) => {
                        record.status = YukpoIaJobStatus::Failed;
                        record.error = Some(format!("parse ChatRequest: {}", e));
                        record.http_status = Some(400);
                        let _ = queue.update_job(&record).await;
                        metrics.record_worker_job(false);
                        continue;
                    }
                };

            let started = Instant::now();
            let res = yukpo_ia_chat_core_inner(state.clone(), record.user_id, payload).await;
            let elapsed = started.elapsed();
            match res {
                Ok(body) => {
                    record.status = YukpoIaJobStatus::Completed;
                    record.result = Some(body.0);
                    record.http_status = Some(200);
                    record.error = None;
                    metrics.record("yukpo_ia.worker.chat_job", record.user_id, elapsed, true);
                    metrics.record_worker_job(true);
                }
                Err(status) => {
                    record.status = YukpoIaJobStatus::Failed;
                    record.result = None;
                    record.http_status = Some(status.as_u16());
                    record.error = Some(format!("HTTP {}", status.as_u16()));
                    metrics.record("yukpo_ia.worker.chat_job", record.user_id, elapsed, false);
                    metrics.record_worker_job(false);
                }
            }
            if let Err(e) = queue.update_job(&record).await {
                error!("[YukpoIA worker] update_job final {}: {}", job_id, e);
            } else {
                info!(
                    "[YukpoIA worker] job terminé job_id={} status={:?}",
                    job_id, record.status
                );
            }
        }
    });
}
