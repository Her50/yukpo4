use std::sync::Arc;

use chrono::{Duration, Utc};
use log::{error, info};
use serde_json::json;

use crate::{
    core::types::{AppError, AppResult},
    state::AppState,
};

#[derive(Debug)]
pub struct WeeklyVideoSummary {
    pub week_start: chrono::DateTime<Utc>,
    pub week_end: chrono::DateTime<Utc>,
    pub total_videos: i64,
    pub total_views: i64,
    pub average_quality: f64,
    pub top_services: serde_json::Value,
}

async fn ensure_table_exists(state: &Arc<AppState>) -> AppResult<()> {
    sqlx::query!(
        r#"
        CREATE TABLE IF NOT EXISTS video_weekly_reports (
            id SERIAL PRIMARY KEY,
            week_start TIMESTAMP WITH TIME ZONE NOT NULL,
            week_end   TIMESTAMP WITH TIME ZONE NOT NULL,
            total_videos BIGINT NOT NULL,
            total_views  BIGINT NOT NULL,
            average_quality DOUBLE PRECISION NOT NULL,
            top_services JSONB NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
        "#
    )
    .execute(&state.pg)
    .await
    .map_err(|err| {
        error!(
            "[VideoWeeklyReport] Impossible de créer la table: {:?}",
            err
        );
        AppError::from(err)
    })?;

    Ok(())
}

async fn compute_summary(state: &Arc<AppState>) -> AppResult<WeeklyVideoSummary> {
    let now = Utc::now();
    let week_end = now;
    let week_start = now - Duration::days(7);

    let total_videos = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*)::BIGINT
        FROM media
        WHERE type = 'video'
          AND uploaded_at BETWEEN $1 AND $2
        "#,
        week_start,
        week_end
    )
    .fetch_one(&state.pg)
    .await
    .map_err(|err| {
        error!(
            "[VideoWeeklyReport] Impossible de compter les vidéos: {:?}",
            err
        );
        AppError::from(err)
    })?
    .unwrap_or(0);

    let total_views = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*)::BIGINT
        FROM media_engagement
        WHERE event_type = 'view'
          AND occurred_at BETWEEN $1 AND $2
        "#,
        week_start,
        week_end
    )
    .fetch_one(&state.pg)
    .await
    .map_err(|err| {
        error!(
            "[VideoWeeklyReport] Impossible de compter les vues: {:?}",
            err
        );
        AppError::from(err)
    })?
    .unwrap_or(0);

    let average_quality = sqlx::query_scalar!(
        r#"
        SELECT AVG((metadata ->> 'quality_score')::FLOAT)
        FROM media_engagement
        WHERE event_type = 'quality_score'
          AND occurred_at BETWEEN $1 AND $2
        "#,
        week_start,
        week_end
    )
    .fetch_one(&state.pg)
    .await
    .map_err(|err| {
        error!(
            "[VideoWeeklyReport] Impossible de calculer la qualité moyenne: {:?}",
            err
        );
        AppError::from(err)
    })?
    .unwrap_or(0.0);

    let top_services = sqlx::query!(
        r#"
        SELECT
            m.service_id,
            COUNT(*)::BIGINT AS videos_count,
            AVG((e.metadata ->> 'quality_score')::FLOAT) AS avg_quality
        FROM media m
        LEFT JOIN media_engagement e
          ON e.media_id = m.id
         AND e.event_type = 'quality_score'
        WHERE m.type = 'video'
          AND m.uploaded_at BETWEEN $1 AND $2
        GROUP BY m.service_id
        ORDER BY videos_count DESC
        LIMIT 5
        "#,
        week_start,
        week_end
    )
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(|record| {
        json!({
            "service_id": record.service_id,
            "videos_count": record.videos_count.unwrap_or(0),
            "average_quality": record.avg_quality.unwrap_or(0.0),
        })
    })
    .collect::<Vec<_>>();

    Ok(WeeklyVideoSummary {
        week_start,
        week_end,
        total_videos,
        total_views,
        average_quality,
        top_services: serde_json::Value::Array(top_services),
    })
}

async fn store_summary(state: &Arc<AppState>, summary: &WeeklyVideoSummary) -> AppResult<()> {
    sqlx::query!(
        r#"
        INSERT INTO video_weekly_reports (
            week_start,
            week_end,
            total_videos,
            total_views,
            average_quality,
            top_services
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        "#,
        summary.week_start,
        summary.week_end,
        summary.total_videos,
        summary.total_views,
        summary.average_quality,
        summary.top_services
    )
    .execute(&state.pg)
    .await
    .map_err(|err| {
        error!(
            "[VideoWeeklyReport] Impossible d'insérer le rapport: {:?}",
            err
        );
        AppError::from(err)
    })?;

    Ok(())
}

pub async fn generate_video_weekly_report(state: Arc<AppState>) -> AppResult<()> {
    ensure_table_exists(&state).await?;
    let summary = compute_summary(&state).await?;
    store_summary(&state, &summary).await?;

    info!(
        "[VideoWeeklyReport] Rapport enregistré: {} vidéos, score moyen {:.1}, vues {}",
        summary.total_videos, summary.average_quality, summary.total_views
    );

    Ok(())
}
