use std::sync::Arc;

use chrono::{DateTime, Duration, Utc};
use serde::Serialize;

use crate::{
    core::types::{AppError, AppResult},
    services::video_analytics_service::{self, VideoAnalyticsOverview},
    state::AppState,
};

#[derive(Debug, Serialize)]
pub struct PipelineHealthStatus {
    pub status: String,
    pub timestamp: DateTime<Utc>,
    pub job_queue: JobQueueHealth,
    pub analytics_overview: Option<VideoAnalyticsOverview>,
    pub components: PipelineComponents,
}

#[derive(Debug, Serialize)]
pub struct JobQueueHealth {
    pub queued: i64,
    pub running: i64,
    pub completed_last_24h: i64,
    pub failed_last_24h: i64,
    pub last_completed_at: Option<DateTime<Utc>>,
    pub stale_jobs: Vec<StaleJob>,
}

#[derive(Debug, Serialize)]
pub struct StaleJob {
    pub job_id: String,
    pub status: String,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct PipelineComponents {
    pub remotion_renderer_ready: bool,
    pub audio_mastering_ready: bool,
}

pub async fn compute_pipeline_health(state: Arc<AppState>) -> AppResult<PipelineHealthStatus> {
    let job_counts = sqlx::query!(
        r#"
        SELECT status, COUNT(*)::bigint AS count
        FROM video_generation_jobs
        GROUP BY status
        "#
    )
    .fetch_all(&state.pg)
    .await
    .map_err(AppError::from)?;

    let mut queued = 0_i64;
    let mut running = 0_i64;
    let mut failed_total = 0_i64;
    for row in job_counts {
        let status = row.status.unwrap_or_default();
        let count = row.count.unwrap_or(0);
        match status.as_str() {
            "queued" => queued = count,
            "running" => running = count,
            "failed" => failed_total = count,
            _ => {}
        }
    }

    let failed_last_24h = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*)::bigint
        FROM video_generation_jobs
        WHERE status = 'failed'
          AND updated_at >= NOW() - INTERVAL '24 hours'
        "#
    )
    .fetch_one(&state.pg)
    .await
    .map_err(AppError::from)?
    .unwrap_or(0);

    let completed_last_24h = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*)::bigint
        FROM video_generation_jobs
        WHERE status = 'completed'
          AND updated_at >= NOW() - INTERVAL '24 hours'
        "#
    )
    .fetch_one(&state.pg)
    .await
    .map_err(AppError::from)?
    .unwrap_or(0);

    let last_completed_row = sqlx::query!(
        r#"
        SELECT MAX(updated_at) AS last_completed
        FROM video_generation_jobs
        WHERE status = 'completed'
        "#
    )
    .fetch_one(&state.pg)
    .await
    .map_err(AppError::from)?;

    let last_completed_at = last_completed_row.last_completed;

    let stale_jobs_rows = sqlx::query!(
        r#"
        SELECT job_id, status, updated_at
        FROM video_generation_jobs
        WHERE status IN ('queued', 'running')
          AND updated_at < NOW() - INTERVAL '30 minutes'
        ORDER BY updated_at ASC
        LIMIT 10
        "#
    )
    .fetch_all(&state.pg)
    .await
    .map_err(AppError::from)?;

    let stale_jobs = stale_jobs_rows
        .into_iter()
        .filter_map(|row| {
            Some(StaleJob {
                job_id: row.job_id?.to_string(),
                status: row.status?,
                updated_at: row.updated_at?,
            })
        })
        .collect::<Vec<_>>();

    let analytics_overview =
        match video_analytics_service::video_analytics_overview(state.clone(), 7).await {
            Ok(data) => Some(data),
            Err(err) => {
                log::warn!("[PipelineHealth] Impossible de récupérer la synthèse vidéo: {err:?}");
                None
            }
        };

    let components = PipelineComponents {
        remotion_renderer_ready: state.remotion_renderer.is_some(),
        audio_mastering_ready: state.audio_mastering.is_some(),
    };

    let mut status = "ok".to_string();
    if !stale_jobs.is_empty() || failed_last_24h > 0 {
        status = "degraded".to_string();
    }
    if stale_jobs
        .iter()
        .any(|job| job.updated_at < Utc::now() - Duration::hours(2))
        || failed_total > 10
    {
        status = "critical".to_string();
    }

    Ok(PipelineHealthStatus {
        status,
        timestamp: Utc::now(),
        job_queue: JobQueueHealth {
            queued,
            running,
            completed_last_24h,
            failed_last_24h,
            last_completed_at,
            stale_jobs,
        },
        analytics_overview,
        components,
    })
}
