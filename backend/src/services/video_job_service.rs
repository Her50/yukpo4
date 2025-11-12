use std::sync::Arc;

use chrono::{DateTime, Utc};
use log::warn;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{core::types::AppResult, services::video_generation_service::ProgressStep};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobProgressStep {
    pub key: String,
    pub label: String,
    pub status: String,
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoGenerationJob {
    pub job_id: Uuid,
    pub user_id: i32,
    pub service_id: Option<i32>,
    pub product_index: Option<i32>,
    pub status: String,
    pub progress_steps: Vec<JobProgressStep>,
    pub result_media_id: Option<i32>,
    pub error_message: Option<String>,
    pub result_payload: Option<Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub struct VideoGenerationJobService {
    pool: PgPool,
}

impl VideoGenerationJobService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create_job(
        &self,
        user_id: i32,
        service_id: i32,
        product_index: i32,
    ) -> AppResult<Uuid> {
        let row = sqlx::query!(
            r#"
            INSERT INTO video_generation_jobs (user_id, service_id, product_index, status)
            VALUES ($1, $2, $3, 'queued')
            RETURNING job_id AS "job_id: Uuid"
            "#,
            user_id,
            service_id,
            product_index
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(row.job_id)
    }

    pub async fn mark_running(&self, job_id: Uuid) -> AppResult<()> {
        sqlx::query!(
            r#"
            UPDATE video_generation_jobs
            SET status = 'running',
                updated_at = NOW()
            WHERE job_id = $1
            "#,
            job_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn store_progress(
        &self,
        job_id: Uuid,
        status: &str,
        steps: &[ProgressStep],
    ) -> AppResult<()> {
        let serialized_steps = self.serialize_steps(steps)?;
        sqlx::query!(
            r#"
            UPDATE video_generation_jobs
            SET status = $2,
                progress_steps = $3,
                updated_at = NOW()
            WHERE job_id = $1
            "#,
            job_id,
            status,
            serialized_steps
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn mark_completed(
        &self,
        job_id: Uuid,
        media_id: i32,
        steps: &[ProgressStep],
        result_payload: &Value,
    ) -> AppResult<()> {
        let serialized_steps = self.serialize_steps(steps)?;
        sqlx::query!(
            r#"
            UPDATE video_generation_jobs
            SET status = 'completed',
                result_media_id = $2,
                progress_steps = $3,
                result_payload = $4,
                updated_at = NOW()
            WHERE job_id = $1
            "#,
            job_id,
            media_id,
            serialized_steps,
            result_payload
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn mark_failed(
        &self,
        job_id: Uuid,
        error_message: &str,
        steps: Option<&[ProgressStep]>,
    ) -> AppResult<()> {
        let serialized_steps = match steps {
            Some(steps) => Some(self.serialize_steps(steps)?),
            None => None,
        };

        sqlx::query!(
            r#"
            UPDATE video_generation_jobs
            SET status = 'failed',
                error_message = $2,
                progress_steps = COALESCE($3, progress_steps),
                result_payload = NULL,
                updated_at = NOW()
            WHERE job_id = $1
            "#,
            job_id,
            error_message,
            serialized_steps
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_job(&self, job_id: Uuid) -> AppResult<Option<VideoGenerationJob>> {
        let row = sqlx::query!(
            r#"
            SELECT
                job_id           AS "job_id: Uuid",
                user_id,
                service_id       AS "service_id: Option<i32>",
                product_index    AS "product_index: Option<i32>",
                status,
                progress_steps   AS "progress_steps: Option<serde_json::Value>",
                result_media_id  AS "result_media_id: Option<i32>",
                error_message    AS "error_message: Option<String>",
                result_payload   AS "result_payload: Option<serde_json::Value>",
                created_at       AS "created_at: DateTime<Utc>",
                updated_at       AS "updated_at: DateTime<Utc>"
            FROM video_generation_jobs
            WHERE job_id = $1
            "#,
            job_id
        )
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = row {
            let steps: Vec<JobProgressStep> = match row.progress_steps {
                Some(value) => serde_json::from_value(value)?,
                None => Vec::new(),
            };

            Ok(Some(VideoGenerationJob {
                job_id: row.job_id,
                user_id: row.user_id,
                service_id: row.service_id.and_then(|value| value),
                product_index: row.product_index.and_then(|value| value),
                status: row.status,
                progress_steps: steps,
                result_media_id: row.result_media_id.and_then(|value| value),
                error_message: row.error_message.and_then(|value| value),
                result_payload: row.result_payload.and_then(|value| value),
                created_at: row.created_at,
                updated_at: row.updated_at,
            }))
        } else {
            Ok(None)
        }
    }

    fn serialize_steps(&self, steps: &[ProgressStep]) -> AppResult<Value> {
        let stored: Vec<JobProgressStep> = steps
            .iter()
            .map(|step| JobProgressStep {
                key: step.key.to_string(),
                label: step.label.to_string(),
                status: step.status.to_string(),
                detail: step.detail.clone(),
            })
            .collect();

        Ok(serde_json::to_value(stored)?)
    }
}

pub async fn try_store_progress(
    state: &Arc<crate::state::AppState>,
    job_id: Uuid,
    status: &str,
    steps: &[ProgressStep],
) {
    if let Err(err) = state.video_jobs.store_progress(job_id, status, steps).await {
        warn!(
            "[VideoJobs] Impossible de mettre à jour la progression du job {}: {}",
            job_id, err
        );
    }
}
