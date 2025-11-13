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
        SELECT status AS "status: String", COUNT(*)::bigint AS "count!: i64"
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
        let status = row.status.as_str();
        let count = row.count;
        match status {
            "queued" => queued = count,
            "running" => running = count,
            "failed" => failed_total = count,
            _ => {}
        }
    }

    let failed_last_24h = sqlx::query!(
        r#"
        SELECT COUNT(*)::bigint AS "count!: i64"
        FROM video_generation_jobs
        WHERE status = 'failed'
          AND updated_at >= NOW() - INTERVAL '24 hours'
        "#
    )
    .fetch_one(&state.pg)
    .await
    .map_err(AppError::from)?
    .count;

    let completed_last_24h = sqlx::query!(
        r#"
        SELECT COUNT(*)::bigint AS "count!: i64"
        FROM video_generation_jobs
        WHERE status = 'completed'
          AND updated_at >= NOW() - INTERVAL '24 hours'
        "#
    )
    .fetch_one(&state.pg)
    .await
    .map_err(AppError::from)?
    .count;

    let last_completed_row = sqlx::query!(
        r#"
        SELECT MAX(updated_at) AS "last_completed: Option<chrono::DateTime<Utc>>"
        FROM video_generation_jobs
        WHERE status = 'completed'
        "#
    )
    .fetch_one(&state.pg)
    .await
    .map_err(AppError::from)?;

    let last_completed_at = last_completed_row.last_completed.flatten();

    let stale_jobs_rows = sqlx::query!(
        r#"
        SELECT job_id AS "job_id: Option<uuid::Uuid>", status AS "status: Option<String>", updated_at AS "updated_at: Option<chrono::DateTime<Utc>>"
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
        .filter_map(|row| match (row.job_id, row.status, row.updated_at) {
            (Some(job_id), Some(status), Some(updated_at)) => Some(StaleJob {
                job_id: job_id.to_string(),
                status,
                updated_at,
            }),
            _ => None,
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
        remotion_renderer_ready: state.video_renderer.is_some()
            || state.remotion_renderer.is_some(),
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
