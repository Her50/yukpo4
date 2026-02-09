use std::sync::Arc;

use chrono::{DateTime, Utc};
use log::{error, info, warn};
use serde_json::Value;
use sqlx::FromRow;

use crate::{
    core::types::{AppError, AppResult},
    state::AppState,
    utils::db_retry::retry_query,
};

#[derive(Debug, serde::Deserialize, serde::Serialize)]
pub struct DistributionJobPayload {
    pub caption: Option<String>,
    pub hashtags: Vec<String>,
    pub call_to_action: Option<String>,
    pub schedule_time: Option<DateTime<Utc>>,
}

pub async fn enqueue_distribution_job(
    state: Arc<AppState>,
    media_id: i32,
    platform: &str,
    payload: &DistributionJobPayload,
) -> AppResult<()> {
    let payload_value = serde_json::to_value(payload).unwrap_or(Value::Null);
    sqlx::query(
        "INSERT INTO social_publication_jobs (media_id, platform, payload, scheduled_for)
         VALUES ($1, $2, $3, COALESCE($4, NOW()))",
    )
    .bind(media_id)
    .bind(platform)
    .bind(payload_value)
    .bind(payload.schedule_time)
    .execute(&state.pg)
    .await
    .map_err(AppError::from)?;

    info!(
        "[SocialDistribution] Job ajouté pour media_id={} platform={}",
        media_id, platform
    );
    Ok(())
}

pub async fn fetch_due_jobs(
    state: Arc<AppState>,
    limit: i64,
) -> AppResult<Vec<SocialPublicationJob>> {
    // ✅ CORRIGÉ 2025-12-11: Utiliser retry_query pour gérer les erreurs de connexion TLS
    let pool = state.pg.clone();
    let rows: Vec<SocialPublicationJob> = retry_query(
        &pool,
        || {
            let pool = pool.clone();
            let limit = limit;
            Box::pin(async move {
                sqlx::query_as(
                    r#"SELECT id,
                             media_id,
                             platform,
                             payload,
                             status,
                             attempt,
                             last_error,
                             scheduled_for,
                             created_at,
                             updated_at
                     FROM social_publication_jobs
                     WHERE status = 'queued' AND scheduled_for <= NOW()
                     ORDER BY scheduled_for ASC
                     LIMIT $1"#,
                )
                .bind(limit)
                .fetch_all(&pool)
                .await
            })
        },
        3, // 3 tentatives avec backoff exponentiel
    )
    .await
    .map_err(AppError::from)?;

    Ok(rows)
}

pub async fn mark_job_processing(state: Arc<AppState>, job_id: i32) -> AppResult<()> {
    sqlx::query(
        "UPDATE social_publication_jobs SET status = 'processing', attempt = attempt + 1, updated_at = NOW() WHERE id = $1"
    )
    .bind(job_id)
    .execute(&state.pg)
    .await
    .map_err(AppError::from)?;
    Ok(())
}

pub async fn mark_job_done(
    state: Arc<AppState>,
    job: &SocialPublicationJob,
    external_post_id: &str,
    metadata: Value,
) -> AppResult<()> {
    let mut tx = state.pg.begin().await.map_err(AppError::from)?;

    sqlx::query(
        "UPDATE social_publication_jobs SET status = 'completed', updated_at = NOW() WHERE id = $1",
    )
    .bind(job.id)
    .execute(&mut *tx)
    .await
    .map_err(AppError::from)?;

    sqlx::query(
        "INSERT INTO social_publications (media_id, platform, external_post_id, status, published_at, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, 'published', NOW(), $4, NOW(), NOW())"
    )
    .bind(job.media_id)
    .bind(&job.platform)
    .bind(external_post_id)
    .bind(metadata)
    .execute(&mut *tx)
    .await
    .map_err(AppError::from)?;

    tx.commit().await.map_err(AppError::from)
}

pub async fn mark_job_failed(
    state: Arc<AppState>,
    job_id: i32,
    error_message: &str,
) -> AppResult<()> {
    sqlx::query(
        "UPDATE social_publication_jobs SET status = 'failed', last_error = $1, updated_at = NOW() WHERE id = $2"
    )
    .bind(error_message)
    .bind(job_id)
    .execute(&state.pg)
    .await
    .map_err(AppError::from)?;

    warn!(
        "[SocialDistribution] Job {} failed: {}",
        job_id, error_message
    );
    Ok(())
}

#[derive(Debug, FromRow, serde::Deserialize, serde::Serialize)]
pub struct SocialPublicationJob {
    pub id: i32,
    pub media_id: i32,
    pub platform: String,
    pub payload: Value,
    pub status: String,
    pub attempt: i32,
    pub last_error: Option<String>,
    pub scheduled_for: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub fn start_distribution_worker(state: Arc<AppState>) {
    let _ = tokio::spawn(async move {
        let interval = tokio::time::Duration::from_secs(60);
        loop {
            tokio::time::sleep(interval).await;

            match fetch_due_jobs(state.clone(), 10).await {
                Ok(jobs) => {
                    for job in jobs {
                        if let Err(err) = execute_job(state.clone(), job).await {
                            error!("[SocialDistribution] Job execution error: {err:?}");
                        }
                    }
                }
                Err(err) => error!("[SocialDistribution] Fetch jobs error: {err:?}"),
            }
        }
    });
}

async fn execute_job(state: Arc<AppState>, job: SocialPublicationJob) -> AppResult<()> {
    mark_job_processing(state.clone(), job.id).await?;

    // Placeholder implementation – replace with actual API calls
    let external_id = format!(
        "{}_{}_{}",
        job.platform,
        job.media_id,
        Utc::now().timestamp()
    );
    let metadata = serde_json::json!({
        "note": "Publication simulée (connecteur réel à implémenter)",
        "payload": job.payload,
    });

    mark_job_done(state, &job, &external_id, metadata).await
}
