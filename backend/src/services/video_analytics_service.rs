use std::sync::Arc;

use chrono::Utc;
use log::{error, info};
use serde::Serialize;
use serde_json::Value;

use crate::{
    core::types::{AppError, AppResult},
    state::AppState,
};

#[derive(Debug, serde::Serialize)]
pub struct QualityScoreRecord {
    pub media_id: i32,
    pub service_id: i32,
    pub quality_score: f32,
    pub occurred_at: chrono::DateTime<Utc>,
}

pub async fn record_engagement(
    state: Arc<AppState>,
    media_id: i32,
    event_type: &str,
    channel: Option<String>,
    user_id: Option<i32>,
    session_id: Option<String>,
    metadata: Option<Value>,
) -> AppResult<()> {
    let service_id = sqlx::query_scalar!("SELECT service_id FROM media WHERE id = $1", media_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|err| {
            error!(
                "[VideoAnalytics] Erreur récupération service pour media {}: {:?}",
                media_id, err
            );
            AppError::from(err)
        })?
        .ok_or_else(|| AppError::NotFound("Média introuvable".to_string()))?;

    sqlx::query!(
        "INSERT INTO media_engagement (media_id, service_id, event_type, channel, user_id, session_id, metadata, occurred_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        media_id,
        service_id,
        event_type,
        channel,
        user_id,
        session_id,
        metadata,
        Utc::now(),
    )
    .execute(&state.pg)
    .await
    .map_err(|err| {
        error!("[VideoAnalytics] Erreur insertion media_engagement: {:?}", err);
        AppError::from(err)
    })?;

    info!(
        "[VideoAnalytics] Enregistrement engagement media_id={} event_type={}",
        media_id, event_type
    );

    Ok(())
}

pub async fn list_recent_quality_scores(
    state: Arc<AppState>,
    limit: i64,
) -> AppResult<Vec<QualityScoreRecord>> {
    let rows = sqlx::query!(
        r#"
        SELECT
            media_id,
            service_id,
            COALESCE((metadata ->> 'quality_score')::float, 0.0) AS quality_score,
            occurred_at
        FROM media_engagement
        WHERE event_type = 'quality_score'
        ORDER BY occurred_at DESC
        LIMIT $1
        "#,
        limit.max(1)
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|err| {
        error!(
            "[VideoAnalytics] Erreur récupération quality score: {:?}",
            err
        );
        AppError::from(err)
    })?;

    Ok(rows
        .into_iter()
        .map(|row| QualityScoreRecord {
            media_id: row.media_id,
            service_id: row.service_id,
            quality_score: row.quality_score.unwrap_or(0.0) as f32,
            occurred_at: row.occurred_at,
        })
        .collect())
}

pub async fn schedule_distribution_targets(
    state: &Arc<AppState>,
    media_id: i32,
    service_id: i32,
    targets: &[String],
) -> AppResult<()> {
    if targets.is_empty() {
        return Ok(());
    }

    for target in targets {
        sqlx::query!(
            "INSERT INTO media_distribution (media_id, service_id, target, status)
             VALUES ($1, $2, $3, 'scheduled')
             ON CONFLICT DO NOTHING",
            media_id,
            service_id,
            target
        )
        .execute(&state.pg)
        .await
        .map_err(|err| {
            error!(
                "[VideoAnalytics] Erreur insertion media_distribution media_id={} target={}: {:?}",
                media_id, target, err
            );
            AppError::from(err)
        })?;
    }

    Ok(())
}

pub async fn update_distribution_status(
    state: Arc<AppState>,
    media_id: i32,
    target: &str,
    status: &str,
    metadata: Option<Value>,
) -> AppResult<()> {
    sqlx::query!(
        "UPDATE media_distribution
         SET status = $1, metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE($2, '{}'::jsonb), updated_at = NOW()
         WHERE media_id = $3 AND target = $4",
        status,
        metadata,
        media_id,
        target
    )
    .execute(&state.pg)
    .await
    .map_err(|err| {
        error!(
            "[VideoAnalytics] Erreur mise à jour media_distribution media_id={} target={}: {:?}",
            media_id, target, err
        );
        AppError::from(err)
    })?;

    Ok(())
}

#[derive(Debug, Serialize)]
pub struct VideoAnalyticsOverview {
    pub horizon_days: i64,
    pub videos_generated: i64,
    pub total_views: i64,
    pub total_shares: i64,
    pub average_quality_score: f32,
    pub distribution_success: i64,
    pub distribution_pending: i64,
}

pub async fn video_analytics_overview(
    state: Arc<AppState>,
    horizon_days: i64,
) -> AppResult<VideoAnalyticsOverview> {
    let days = horizon_days.clamp(1, 30);

    let media_row = sqlx::query!(
        r#"
        SELECT COUNT(*) AS total
        FROM media
        WHERE media_type = 'video'
          AND uploaded_at >= NOW() - ($1 || ' days')::interval
        "#,
        days
    )
    .fetch_one(&state.pg)
    .await
    .map_err(AppError::from)?;

    let engagement_row = sqlx::query!(
        r#"
        SELECT
            COUNT(*) FILTER (WHERE event_type = 'view') AS views,
            COUNT(*) FILTER (WHERE event_type = 'share') AS shares,
            COALESCE(AVG((metadata ->> 'quality_score')::float), 0.0) AS avg_quality
        FROM media_engagement
        WHERE occurred_at >= NOW() - ($1 || ' days')::interval
          AND event_type IN ('view', 'share', 'quality_score')
        "#,
        days
    )
    .fetch_one(&state.pg)
    .await
    .map_err(AppError::from)?;

    let distribution_row = sqlx::query!(
        r#"
        SELECT
            COUNT(*) FILTER (WHERE status = 'completed') AS completed,
            COUNT(*) FILTER (WHERE status IN ('scheduled', 'processing')) AS pending
        FROM media_distribution
        WHERE updated_at >= NOW() - ($1 || ' days')::interval
        "#,
        days
    )
    .fetch_one(&state.pg)
    .await
    .map_err(AppError::from)?;

    Ok(VideoAnalyticsOverview {
        horizon_days: days,
        videos_generated: media_row.total.unwrap_or(0),
        total_views: engagement_row.views.unwrap_or(0),
        total_shares: engagement_row.shares.unwrap_or(0),
        average_quality_score: engagement_row.avg_quality.unwrap_or(0.0) as f32,
        distribution_success: distribution_row.completed.unwrap_or(0),
        distribution_pending: distribution_row.pending.unwrap_or(0),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::{backend_test_db_lock, setup_backend_test_context};
    use serde_json::json;
    use sqlx::Row;

    #[tokio::test]
    async fn video_analytics_overview_aggregates_metrics() {
        let _lock = backend_test_db_lock().await;

        let Some(ctx) = setup_backend_test_context().await else {
            eprintln!("[tests] ⚠️ Contexte de test indisponible, test ignoré.");
            return;
        };

        let pool = ctx.pool.clone();

        let service_row = sqlx::query(
            r#"
            INSERT INTO services (user_id, data, is_active, created_at, updated_at)
            VALUES ($1, '{}'::jsonb, TRUE, NOW(), NOW())
            RETURNING id
            "#,
        )
        .bind(ctx.user_id)
        .fetch_one(&pool)
        .await
        .expect("insert service");
        let service_id: i32 = service_row.get("id");

        let media_row = sqlx::query(
            r#"
            INSERT INTO media (service_id, type, path, media_type, uploaded_at)
            VALUES ($1, 'video', '/tmp/test.mp4', 'video', NOW())
            RETURNING id
            "#,
        )
        .bind(service_id)
        .fetch_one(&pool)
        .await
        .expect("insert media");
        let media_id: i32 = media_row.get("id");

        // Deux vues
        for session in ["sess-view-1", "sess-view-2"] {
            sqlx::query(
                r#"
                INSERT INTO media_engagement (media_id, service_id, event_type, channel, user_id, session_id, metadata)
                VALUES ($1, $2, 'view', $3, $4, $5, $6)
                "#,
            )
            .bind(media_id)
            .bind(service_id)
            .bind(Some("web"))
            .bind(Some(ctx.user_id))
            .bind(Some(session))
            .bind(json!({}))
            .execute(&pool)
            .await
            .expect("insert view engagement");
        }

        // Un partage
        sqlx::query(
            r#"
            INSERT INTO media_engagement (media_id, service_id, event_type, channel, user_id, session_id, metadata)
            VALUES ($1, $2, 'share', $3, $4, $5, $6)
            "#,
        )
        .bind(media_id)
        .bind(service_id)
        .bind(Some("mobile"))
        .bind(Some(ctx.user_id))
        .bind(Some("sess-share"))
        .bind(json!({}))
        .execute(&pool)
        .await
        .expect("insert share engagement");

        // Deux scores qualité
        for (score, session) in [(4.0_f64, "sess-quality-1"), (3.0_f64, "sess-quality-2")] {
            sqlx::query(
                r#"
                INSERT INTO media_engagement (media_id, service_id, event_type, channel, user_id, session_id, metadata)
                VALUES ($1, $2, 'quality_score', $3, $4, $5, $6)
                "#,
            )
            .bind(media_id)
            .bind(service_id)
            .bind(Some("analytics"))
            .bind(Some(ctx.user_id))
            .bind(Some(session))
            .bind(json!({ "quality_score": score }))
            .execute(&pool)
            .await
            .expect("insert quality engagement");
        }

        // Distribution : 1 complété, 1 en attente
        sqlx::query(
            r#"
            INSERT INTO media_distribution (media_id, service_id, target, status)
            VALUES ($1, $2, 'instagram', 'completed')
            "#,
        )
        .bind(media_id)
        .bind(service_id)
        .execute(&pool)
        .await
        .expect("insert completed distribution");

        sqlx::query(
            r#"
            INSERT INTO media_distribution (media_id, service_id, target, status)
            VALUES ($1, $2, 'tiktok', 'scheduled')
            "#,
        )
        .bind(media_id)
        .bind(service_id)
        .execute(&pool)
        .await
        .expect("insert pending distribution");

        let overview = video_analytics_overview(ctx.state.clone(), 7)
            .await
            .expect("overview should succeed");

        assert_eq!(overview.horizon_days, 7);
        assert_eq!(overview.videos_generated, 1);
        assert_eq!(overview.total_views, 2);
        assert_eq!(overview.total_shares, 1);
        assert!(
            (overview.average_quality_score - 3.5).abs() < 0.01,
            "Le score moyen devrait être 3.5"
        );
        assert_eq!(overview.distribution_success, 1);
        assert_eq!(overview.distribution_pending, 1);
    }
}
