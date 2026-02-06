use std::sync::Arc;

use chrono::{DateTime, Utc};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::{
    core::types::{AppError, AppResult},
    services::video_generation_service::ProgressStep,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobProgressStep {
    pub key: String,
    pub label: String,
    pub status: String,
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
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

#[derive(FromRow)]
struct JobIdRow {
    job_id: Uuid,
}

#[derive(FromRow)]
struct VideoGenerationJobRow {
    job_id: Uuid,
    user_id: i32,
    service_id: Option<i32>,
    product_index: Option<i32>,
    status: String,
    progress_steps: Option<Value>,
    result_media_id: Option<i32>,
    error_message: Option<String>,
    result_payload: Option<Value>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
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
        let row: JobIdRow = sqlx::query_as(
            r#"
            INSERT INTO video_generation_jobs (user_id, service_id, product_index, status)
            VALUES ($1, $2, $3, 'queued')
            RETURNING job_id
            "#,
        )
        .bind(user_id)
        .bind(service_id)
        .bind(product_index)
        .fetch_one(&self.pool)
        .await?;

        Ok(row.job_id)
    }

    pub async fn mark_running(&self, job_id: Uuid) -> AppResult<()> {
        let result = sqlx::query(
            r#"
            UPDATE video_generation_jobs
            SET status = 'running',
                updated_at = NOW()
            WHERE job_id = $1
            "#,
        )
        .bind(job_id)
        .execute(&self.pool)
        .await?;

        // ✅ AMÉLIORÉ: Vérifier que la mise à jour a réellement affecté une ligne
        if result.rows_affected() == 0 {
            error!(
                "[VideoJobService] ❌ ERREUR SILENCIEUSE: Aucune ligne mise à jour pour mark_running job_id={}",
                job_id
            );
            return Err(AppError::NotFound(format!(
                "Job {} introuvable ou déjà terminé",
                job_id
            )));
        }

        info!("[VideoJobService] ✅ Job {} marqué comme 'running'", job_id);
        Ok(())
    }

    pub async fn store_progress(
        &self,
        job_id: Uuid,
        status: &str,
        steps: &[ProgressStep],
    ) -> AppResult<()> {
        // ✅ AMÉLIORÉ: Gestion d'erreur robuste pour la sérialisation
        let serialized_steps = match self.serialize_steps(steps) {
            Ok(steps) => steps,
            Err(err) => {
                error!(
                    "[VideoJobService] ❌ ERREUR sérialisation steps pour job {}: {}",
                    job_id, err
                );
                // Utiliser un JSON minimal en cas d'erreur de sérialisation
                serde_json::json!([])
            }
        };

        let result = sqlx::query(
            r#"
            UPDATE video_generation_jobs
            SET status = $2,
                progress_steps = $3,
                updated_at = NOW()
            WHERE job_id = $1
            "#,
        )
        .bind(job_id)
        .bind(status)
        .bind(serialized_steps)
        .execute(&self.pool)
        .await
        .map_err(|err| {
            error!(
                "[VideoJobService] ❌ ERREUR SQL lors de store_progress pour job {}: {}",
                job_id, err
            );
            err
        })?;

        // ✅ AMÉLIORÉ: Vérifier que la mise à jour a réellement affecté une ligne
        if result.rows_affected() == 0 {
            warn!(
                "[VideoJobService] ⚠️ Aucune ligne mise à jour pour store_progress job_id={}, status={}",
                job_id, status
            );
            // Ne pas retourner d'erreur pour store_progress (non critique)
            // mais logger pour diagnostic
        } else {
            info!(
                "[VideoJobService] ✅ Progression mise à jour pour job {}: status={}, steps={}",
                job_id,
                status,
                steps.len()
            );
        }

        Ok(())
    }

    pub async fn mark_completed(
        &self,
        job_id: Uuid,
        media_id: i32,
        steps: &[ProgressStep],
        result_payload: &Value,
    ) -> AppResult<()> {
        // ✅ AMÉLIORÉ: Gestion d'erreur robuste pour la sérialisation avec retry
        let serialized_steps = match self.serialize_steps(steps) {
            Ok(steps) => steps,
            Err(err) => {
                error!(
                    "[VideoJobService] ❌ ERREUR CRITIQUE sérialisation steps pour mark_completed job {}: {}",
                    job_id, err
                );
                // Utiliser un JSON minimal en cas d'erreur de sérialisation
                serde_json::json!([])
            }
        };

        // ✅ AMÉLIORÉ: Retry logic pour les erreurs de connexion/timeout
        let mut last_error = None;
        for attempt in 1..=3 {
            match sqlx::query(
                r#"
                UPDATE video_generation_jobs
                SET status = 'completed',
                    result_media_id = $2,
                    progress_steps = $3,
                    result_payload = $4,
                    updated_at = NOW()
                WHERE job_id = $1
                "#,
            )
            .bind(job_id)
            .bind(media_id)
            .bind(&serialized_steps)
            .bind(result_payload)
            .execute(&self.pool)
            .await
            {
                Ok(result) => {
                    // ✅ AMÉLIORÉ: Vérifier que la mise à jour a réellement affecté une ligne
                    if result.rows_affected() == 0 {
                        error!(
                            "[VideoJobService] ❌ ERREUR CRITIQUE: Aucune ligne mise à jour pour mark_completed job_id={}, media_id={}",
                            job_id, media_id
                        );
                        // Vérifier si le job existe
                        if let Ok(Some(existing_job)) = self.get_job(job_id).await {
                            error!(
                                "[VideoJobService] Job existe mais UPDATE a échoué - status actuel: {}, media_id actuel: {:?}",
                                existing_job.status, existing_job.result_media_id
                            );
                            return Err(AppError::Internal(format!(
                                "Impossible de mettre à jour le job {} (job existe mais UPDATE a échoué)",
                                job_id
                            )));
                        } else {
                            return Err(AppError::NotFound(format!("Job {} introuvable", job_id)));
                        }
                    }

                    info!(
                        "[VideoJobService] ✅ Job {} marqué comme 'completed' avec media_id={} (tentative {})",
                        job_id, media_id, attempt
                    );
                    return Ok(());
                }
                Err(err) => {
                    last_error = Some(err);
                    let error_str = last_error.as_ref().unwrap().to_string();

                    // Vérifier si c'est une erreur récupérable (connexion, timeout)
                    let is_recoverable = error_str.contains("connection")
                        || error_str.contains("timeout")
                        || error_str.contains("deadlock")
                        || error_str.contains("could not connect");

                    if is_recoverable && attempt < 3 {
                        warn!(
                            "[VideoJobService] ⚠️ Erreur récupérable lors de mark_completed job {} (tentative {}/3): {} - Retry...",
                            job_id, attempt, error_str
                        );
                        // Attendre avant de réessayer (backoff exponentiel)
                        tokio::time::sleep(tokio::time::Duration::from_millis(
                            100 * attempt as u64,
                        ))
                        .await;
                        continue;
                    } else {
                        error!(
                            "[VideoJobService] ❌ ERREUR CRITIQUE lors de mark_completed job {} (tentative {}/3): {}",
                            job_id, attempt, error_str
                        );
                        if attempt == 3 {
                            return Err(AppError::Internal(format!(
                                "Impossible de marquer le job {} comme terminé après 3 tentatives: {}",
                                job_id, error_str
                            )));
                        }
                    }
                }
            }
        }

        // Ne devrait jamais arriver ici, mais au cas où
        Err(AppError::Internal(format!(
            "Impossible de marquer le job {} comme terminé: {}",
            job_id,
            last_error
                .map(|e| e.to_string())
                .unwrap_or_else(|| "Erreur inconnue".to_string())
        )))
    }

    pub async fn mark_failed(
        &self,
        job_id: Uuid,
        error_message: &str,
        steps: Option<&[ProgressStep]>,
    ) -> AppResult<()> {
        // ✅ AMÉLIORÉ: Gestion d'erreur robuste pour la sérialisation
        let serialized_steps = match steps {
            Some(steps) => match self.serialize_steps(steps) {
                Ok(steps) => Some(steps),
                Err(err) => {
                    error!(
                        "[VideoJobService] ❌ ERREUR sérialisation steps pour mark_failed job {}: {}",
                        job_id, err
                    );
                    // Utiliser un JSON minimal en cas d'erreur de sérialisation
                    Some(serde_json::json!([]))
                }
            },
            None => None,
        };

        // ✅ AMÉLIORÉ: Retry logic pour les erreurs de connexion/timeout
        let mut last_error = None;
        for attempt in 1..=3 {
            match sqlx::query(
                r#"
                UPDATE video_generation_jobs
                SET status = 'failed',
                    error_message = $2,
                    progress_steps = COALESCE($3, progress_steps),
                    result_payload = NULL,
                    updated_at = NOW()
                WHERE job_id = $1
                "#,
            )
            .bind(job_id)
            .bind(error_message)
            .bind(&serialized_steps)
            .execute(&self.pool)
            .await
            {
                Ok(result) => {
                    // ✅ AMÉLIORÉ: Vérifier que la mise à jour a réellement affecté une ligne
                    if result.rows_affected() == 0 {
                        error!(
                            "[VideoJobService] ❌ ERREUR CRITIQUE: Aucune ligne mise à jour pour mark_failed job_id={}",
                            job_id
                        );
                        // Vérifier si le job existe
                        if let Ok(Some(existing_job)) = self.get_job(job_id).await {
                            error!(
                                "[VideoJobService] Job existe mais UPDATE a échoué - status actuel: {}",
                                existing_job.status
                            );
                            return Err(AppError::Internal(format!(
                                "Impossible de marquer le job {} comme échoué (job existe mais UPDATE a échoué)",
                                job_id
                            )));
                        } else {
                            return Err(AppError::NotFound(format!("Job {} introuvable", job_id)));
                        }
                    }

                    info!(
                        "[VideoJobService] ✅ Job {} marqué comme 'failed' avec message: {} (tentative {})",
                        job_id, error_message, attempt
                    );
                    return Ok(());
                }
                Err(err) => {
                    last_error = Some(err);
                    let error_str = last_error.as_ref().unwrap().to_string();

                    // Vérifier si c'est une erreur récupérable (connexion, timeout)
                    let is_recoverable = error_str.contains("connection")
                        || error_str.contains("timeout")
                        || error_str.contains("deadlock")
                        || error_str.contains("could not connect");

                    if is_recoverable && attempt < 3 {
                        warn!(
                            "[VideoJobService] ⚠️ Erreur récupérable lors de mark_failed job {} (tentative {}/3): {} - Retry...",
                            job_id, attempt, error_str
                        );
                        // Attendre avant de réessayer (backoff exponentiel)
                        tokio::time::sleep(tokio::time::Duration::from_millis(
                            100 * attempt as u64,
                        ))
                        .await;
                        continue;
                    } else {
                        error!(
                            "[VideoJobService] ❌ ERREUR CRITIQUE lors de mark_failed job {} (tentative {}/3): {}",
                            job_id, attempt, error_str
                        );
                        if attempt == 3 {
                            return Err(AppError::Internal(format!(
                                "Impossible de marquer le job {} comme échoué après 3 tentatives: {}",
                                job_id, error_str
                            )));
                        }
                    }
                }
            }
        }

        // Ne devrait jamais arriver ici, mais au cas où
        Err(AppError::Internal(format!(
            "Impossible de marquer le job {} comme échoué: {}",
            job_id,
            last_error
                .map(|e| e.to_string())
                .unwrap_or_else(|| "Erreur inconnue".to_string())
        )))
    }

    pub async fn get_job(&self, job_id: Uuid) -> AppResult<Option<VideoGenerationJob>> {
        let row: Option<VideoGenerationJobRow> = sqlx::query_as(
            r#"
            SELECT
                job_id,
                user_id,
                service_id,
                product_index,
                status,
                progress_steps,
                result_media_id,
                error_message,
                result_payload,
                created_at,
                updated_at
            FROM video_generation_jobs
            WHERE job_id = $1
            "#,
        )
        .bind(job_id)
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
                service_id: row.service_id,
                product_index: row.product_index,
                status: row.status,
                progress_steps: steps,
                result_media_id: row.result_media_id,
                error_message: row.error_message,
                result_payload: row.result_payload,
                created_at: row.created_at,
                updated_at: row.updated_at,
            }))
        } else {
            Ok(None)
        }
    }

    fn serialize_steps(&self, steps: &[ProgressStep]) -> AppResult<Value> {
        // ✅ AMÉLIORÉ: Validation et nettoyage des steps avant sérialisation
        let stored: Vec<JobProgressStep> = steps
            .iter()
            .filter_map(|step| {
                // Filtrer les steps invalides (null/undefined)
                if step.key.is_empty() && step.label.is_empty() {
                    warn!(
                        "[VideoJobService] ⚠️ Step invalide ignoré (key et label vides): {:?}",
                        step
                    );
                    return None;
                }
                Some(JobProgressStep {
                    key: step.key.to_string(),
                    label: step.label.to_string(),
                    status: step.status.to_string(),
                    detail: step.detail.clone(),
                })
            })
            .collect();

        // ✅ AMÉLIORÉ: Gestion d'erreur détaillée pour la sérialisation JSON
        serde_json::to_value(&stored).map_err(|err| {
            error!(
                "[VideoJobService] ❌ ERREUR sérialisation JSON des steps: {} - Steps: {:?}",
                err, stored
            );
            AppError::Internal(format!(
                "Erreur sérialisation des steps de progression: {}",
                err
            ))
        })
    }
}

/// ✅ AMÉLIORÉ: Retourne un Result pour permettre une meilleure gestion d'erreur
pub async fn try_store_progress(
    state: &Arc<crate::state::AppState>,
    job_id: Uuid,
    status: &str,
    steps: &[ProgressStep],
) -> Result<(), crate::core::types::AppError> {
    state.video_jobs.store_progress(job_id, status, steps).await.map_err(|err| {
        warn!(
            "[VideoJobs] ❌ Impossible de mettre à jour la progression du job {}: {}",
            job_id, err
        );
        crate::core::types::AppError::Internal(format!(
            "Impossible de mettre à jour la progression du job {}: {}",
            job_id, err
        ))
    })
}
