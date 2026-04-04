use std::sync::Arc;

use chrono::{DateTime, Utc};
use log::{error, info, warn};
use reqwest::Client;
use serde_json::Value;
use sqlx::{FromRow, Row};

use crate::{
    core::types::{AppError, AppResult},
    services::{facebook_publisher_service, instagram_publisher_service},
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

    // Récupérer caption, image_url, hashtags depuis le payload
    let caption_raw = job.payload["caption"].as_str().unwrap_or("").to_string();
    let hashtags: Vec<String> = job.payload["hashtags"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| format!("#{}", s))).collect())
        .unwrap_or_default();
    let hashtag_str = if hashtags.is_empty() {
        String::new()
    } else {
        format!("\n\n{}", hashtags.join(" "))
    };
    let full_caption = format!("{}{}", caption_raw, hashtag_str);

    // Récupérer les informations du média (image_url)
    let media_row = sqlx::query("SELECT file_url, media_type FROM media WHERE id = $1")
        .bind(job.media_id)
        .fetch_optional(&state.pg)
        .await
        .unwrap_or(None);

    let image_url: Option<String> = media_row
        .as_ref()
        .and_then(|r| r.try_get::<Option<String>, _>("file_url").ok().flatten());

    // Récupérer le token d'accès du partenaire pour cette plateforme
    let (platform_base, page_id_opt) = parse_platform(&job.platform);
    let account_row = sqlx::query(
        r#"SELECT access_token, metadata
           FROM social_accounts
           WHERE user_id = (
               SELECT m.user_id FROM media m WHERE m.id = $1 LIMIT 1
           )
           AND platform = $2
           AND (expires_at IS NULL OR expires_at > NOW())
           ORDER BY updated_at DESC LIMIT 1"#,
    )
    .bind(job.media_id)
    .bind(platform_base)
    .fetch_optional(&state.pg)
    .await
    .unwrap_or(None);

    let access_token = account_row
        .as_ref()
        .and_then(|r| r.try_get::<Option<String>, _>("access_token").ok().flatten())
        .unwrap_or_default();

    let metadata_json: serde_json::Value = account_row
        .as_ref()
        .and_then(|r| r.try_get::<Option<serde_json::Value>, _>("metadata").ok().flatten())
        .unwrap_or(serde_json::json!({}));

    if access_token.is_empty() {
        let err = format!("Pas de token d'accès pour la plateforme {}", job.platform);
        warn!("[SocialDistribution] Job {} : {}", job.id, err);
        return mark_job_failed(state, job.id, &err).await;
    }

    let http = Client::new();
    let yukpo_link = format!(
        "https://yukpomnang.com?utm_source=auto_post&utm_medium={}",
        platform_base
    );

    let result = match platform_base {
        "facebook" => {
            let page_id = page_id_opt
                .or_else(|| metadata_json["page_id"].as_str().map(|s| s.to_string()))
                .unwrap_or_default();
            if page_id.is_empty() {
                Err(AppError::Internal("page_id Facebook manquant".into()))
            } else {
                facebook_publisher_service::post_product_to_page(
                    &http,
                    &access_token,
                    &page_id,
                    &full_caption,
                    &yukpo_link,
                    image_url.as_deref(),
                )
                .await
            }
        }
        "instagram" => {
            let ig_user_id = page_id_opt
                .or_else(|| metadata_json["ig_user_id"].as_str().map(|s| s.to_string()))
                .unwrap_or_default();
            if ig_user_id.is_empty() {
                Err(AppError::Internal("ig_user_id Instagram manquant".into()))
            } else if let Some(ref img) = image_url {
                instagram_publisher_service::publish_product_image(
                    &http,
                    &ig_user_id,
                    &access_token,
                    img,
                    &full_caption,
                )
                .await
            } else {
                Err(AppError::Internal(
                    "Instagram nécessite une image — post ignoré".into(),
                ))
            }
        }
        // TikTok, Twitter, YouTube : délégué aux publishers dédiés (voir services respectifs)
        "tiktok" => {
            use crate::services::tiktok_publisher_service;
            let video_url = image_url.as_deref().unwrap_or("");
            if video_url.is_empty() {
                Err(AppError::Internal("TikTok nécessite une vidéo".into()))
            } else {
                tiktok_publisher_service::publish_video(
                    &http,
                    &access_token,
                    video_url,
                    &full_caption,
                )
                .await
            }
        }
        "twitter" | "x" => {
            use crate::services::twitter_publisher_service;
            twitter_publisher_service::post_tweet(
                &access_token,
                &full_caption,
                image_url.as_deref(),
            )
            .await
        }
        "youtube" => {
            use crate::services::youtube_publisher_service;
            let video_url = image_url.as_deref().unwrap_or("");
            if video_url.is_empty() {
                Err(AppError::Internal("YouTube nécessite une vidéo".into()))
            } else {
                let title = job.payload["title"]
                    .as_str()
                    .unwrap_or(&caption_raw[..caption_raw.len().min(100)]);
                youtube_publisher_service::upload_video(
                    &access_token,
                    video_url,
                    title,
                    &full_caption,
                )
                .await
            }
        }
        other => Err(AppError::Internal(format!(
            "Plateforme non supportée: {}",
            other
        ))),
    };

    match result {
        Ok(external_id) => {
            let metadata = serde_json::json!({
                "platform": job.platform,
                "caption_length": full_caption.len(),
                "has_image": image_url.is_some(),
                "hashtags": hashtags,
            });
            info!(
                "[SocialDistribution] ✅ Job {} publié sur {} — external_id={}",
                job.id, job.platform, external_id
            );
            mark_job_done(state, &job, &external_id, metadata).await
        }
        Err(e) => {
            let err_str = e.to_string();
            warn!(
                "[SocialDistribution] ❌ Job {} échec sur {}: {}",
                job.id, job.platform, err_str
            );
            // Retry si < 3 tentatives, sinon marquer failed
            if job.attempt < 3 {
                sqlx::query(
                    "UPDATE social_publication_jobs SET status = 'queued', last_error = $1,
                     scheduled_for = NOW() + INTERVAL '10 minutes', updated_at = NOW()
                     WHERE id = $2",
                )
                .bind(&err_str)
                .bind(job.id)
                .execute(&state.pg)
                .await
                .ok();
                Ok(())
            } else {
                mark_job_failed(state, job.id, &err_str).await
            }
        }
    }
}

/// Décompose "facebook:page_123" → ("facebook", Some("page_123"))
fn parse_platform(platform: &str) -> (&str, Option<String>) {
    if let Some((base, id)) = platform.split_once(':') {
        (base, Some(id.to_string()))
    } else {
        (platform, None)
    }
}
