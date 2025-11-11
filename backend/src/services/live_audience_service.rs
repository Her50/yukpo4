use std::collections::HashSet;

use chrono::{DateTime, Utc};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use crate::services::{
    notification_service::{self, NotificationType},
    push_notification_service,
};

const AUDIENCE_LOOKBACK_DAYS: i64 = 45;
const AUDIENCE_LIMIT: i64 = 50;

async fn fetch_recent_audience(
    pool: &PgPool,
    service_id: i32,
    exclude_user_id: i32,
) -> anyhow::Result<Vec<i32>> {
    let lookback_days: i32 = AUDIENCE_LOOKBACK_DAYS as i32;
    let rows = sqlx::query!(
        r#"
        SELECT user_id AS "user_id!", MAX(created_at) AS last_interaction
        FROM service_interactions_tracking
        WHERE service_id = $1
          AND user_id IS NOT NULL
          AND user_id <> $2
          AND created_at >= NOW() - ($3::int * INTERVAL '1 day')
        GROUP BY user_id
        ORDER BY last_interaction DESC
        LIMIT $4
        "#,
        service_id,
        exclude_user_id,
        lookback_days,
        AUDIENCE_LIMIT
    )
    .fetch_all(pool)
    .await?;

    let audience: Vec<i32> = rows.into_iter().map(|row| row.user_id).collect();

    Ok(audience)
}

async fn notify_users(
    pool: &PgPool,
    user_ids: &[i32],
    notification_type: NotificationType,
    title: &str,
    body: &str,
    metadata: serde_json::Value,
) {
    let mut notified: HashSet<i32> = HashSet::new();

    for &user_id in user_ids {
        if notified.contains(&user_id) {
            continue;
        }

        if let Err(err) = notification_service::create_notification(
            pool,
            user_id,
            notification_type.clone(),
            title.to_string(),
            body.to_string(),
            Some(metadata.clone()),
        )
        .await
        {
            log::warn!(
                "Live audience notification DB failed for user {}: {:?}",
                user_id,
                err
            );
        }

        if let Err(err) = push_notification_service::send_push_notification(
            pool,
            user_id,
            title.to_string(),
            body.to_string(),
            Some(metadata.clone()),
            Some("default".into()),
        )
        .await
        {
            log::warn!("Live audience push failed for user {}: {:?}", user_id, err);
        }

        notified.insert(user_id);
    }
}

fn collect_audience_union(
    existing: &mut HashSet<i32>,
    new_entries: Vec<i32>,
    output: &mut Vec<i32>,
) {
    for user_id in new_entries {
        if existing.insert(user_id) {
            output.push(user_id);
        }
    }
}

async fn collect_audience_for_services(
    pool: &PgPool,
    service_ids: &[i32],
    exclude_user_id: i32,
) -> anyhow::Result<Vec<i32>> {
    let mut seen = HashSet::new();
    let mut audience = Vec::new();

    for service_id in service_ids {
        let users = fetch_recent_audience(pool, *service_id, exclude_user_id).await?;
        collect_audience_union(&mut seen, users, &mut audience);
    }

    Ok(audience)
}

pub async fn notify_live_scheduled(
    pool: &PgPool,
    host_user_id: i32,
    service_ids: &[i32],
    session_id: Uuid,
    session_title: &str,
    scheduled_start: DateTime<Utc>,
) -> anyhow::Result<()> {
    let audience = collect_audience_for_services(pool, service_ids, host_user_id).await?;

    if audience.is_empty() {
        return Ok(());
    }

    let body = format!(
        "Le live \"{}\" commencera le {}.",
        session_title,
        scheduled_start
            .with_timezone(&chrono::Local)
            .format("%d/%m %H:%M")
    );

    let primary_service_id = service_ids.first().copied();
    let metadata = json!({
        "live_session_id": session_id,
        "service_ids": service_ids,
        "primary_service_id": primary_service_id,
        "scheduled_start": scheduled_start,
        "event": "live_scheduled"
    });

    notify_users(
        pool,
        &audience,
        NotificationType::LiveScheduled,
        "🎥 Nouveau live à venir",
        &body,
        metadata,
    )
    .await;

    Ok(())
}

pub async fn notify_live_replay_ready(
    pool: &PgPool,
    host_user_id: i32,
    service_ids: &[i32],
    session_id: Uuid,
    session_title: &str,
    replay_url: &str,
) -> anyhow::Result<()> {
    if service_ids.is_empty() {
        return Ok(());
    }

    let audience = collect_audience_for_services(pool, service_ids, host_user_id).await?;

    if audience.is_empty() {
        return Ok(());
    }

    let primary_service_id = service_ids.first().copied();
    let metadata = json!({
        "live_session_id": session_id,
        "service_ids": service_ids,
        "primary_service_id": primary_service_id,
        "replay_url": replay_url,
        "event": "live_replay_ready"
    });

    let body = format!(
        "Le replay du live \"{}\" est disponible. Cliquez pour le visionner.",
        session_title
    );

    notify_users(
        pool,
        &audience,
        NotificationType::LiveReplayReady,
        "🎬 Replay disponible",
        &body,
        metadata,
    )
    .await;

    Ok(())
}

pub async fn notify_live_starting(
    pool: &PgPool,
    host_user_id: i32,
    service_ids: &[i32],
    session_id: Uuid,
    session_title: &str,
) -> anyhow::Result<()> {
    if service_ids.is_empty() {
        return Ok(());
    }

    let audience = collect_audience_for_services(pool, service_ids, host_user_id).await?;

    if audience.is_empty() {
        return Ok(());
    }

    let primary_service_id = service_ids.first().copied();
    let metadata = json!({
        "live_session_id": session_id,
        "service_ids": service_ids,
        "primary_service_id": primary_service_id,
        "event": "live_live_now"
    });

    let body = format!(
        "Le live \"{}\" est en cours. Rejoignez-nous maintenant !",
        session_title
    );

    notify_users(
        pool,
        &audience,
        NotificationType::LiveLiveNow,
        "🔴 Live en direct",
        &body,
        metadata,
    )
    .await;

    Ok(())
}

pub async fn notify_flash_sale_scheduled(
    pool: &PgPool,
    host_user_id: i32,
    service_ids: &[i32],
    session_id: Uuid,
    flash_sale_id: Uuid,
    product_title: &str,
    start_at: DateTime<Utc>,
    promo_price_cfa: f64,
) -> anyhow::Result<()> {
    let audience = collect_audience_for_services(pool, service_ids, host_user_id).await?;

    if audience.is_empty() {
        return Ok(());
    }

    let body = format!(
        "Vente flash \"{}\" prévue le {} à {}. Prix promo: {:.0} CFA.",
        product_title,
        start_at.with_timezone(&chrono::Local).format("%d/%m"),
        start_at.with_timezone(&chrono::Local).format("%H:%M"),
        promo_price_cfa
    );

    let primary_service_id = service_ids.first().copied();
    let metadata = json!({
        "live_session_id": session_id,
        "flash_sale_id": flash_sale_id,
        "service_ids": service_ids,
        "primary_service_id": primary_service_id,
        "promo_price_cfa": promo_price_cfa,
        "start_at": start_at,
        "event": "live_flash_sale_scheduled"
    });

    notify_users(
        pool,
        &audience,
        NotificationType::LiveFlashSaleScheduled,
        "🗓️ Vente flash programmée",
        &body,
        metadata,
    )
    .await;

    Ok(())
}

pub async fn notify_flash_sale_live(
    pool: &PgPool,
    host_user_id: i32,
    service_ids: &[i32],
    session_id: Uuid,
    flash_sale_id: Uuid,
    product_title: &str,
    promo_price_cfa: f64,
) -> anyhow::Result<()> {
    let audience = collect_audience_for_services(pool, service_ids, host_user_id).await?;

    if audience.is_empty() {
        return Ok(());
    }

    let body = format!(
        "La vente flash \"{}\" est en cours ! Promo: {:.0} CFA. Places limitées.",
        product_title, promo_price_cfa
    );

    let primary_service_id = service_ids.first().copied();
    let metadata = json!({
        "live_session_id": session_id,
        "flash_sale_id": flash_sale_id,
        "service_ids": service_ids,
        "primary_service_id": primary_service_id,
        "promo_price_cfa": promo_price_cfa,
        "event": "live_flash_sale_live"
    });

    notify_users(
        pool,
        &audience,
        NotificationType::LiveFlashSaleLive,
        "⚡ Vente flash en direct",
        &body,
        metadata,
    )
    .await;

    Ok(())
}

pub async fn notify_flash_sale_ending(
    pool: &PgPool,
    host_user_id: i32,
    service_ids: &[i32],
    session_id: Uuid,
    flash_sale_id: Uuid,
    product_title: &str,
    remaining_minutes: i64,
) -> anyhow::Result<()> {
    let audience = collect_audience_for_services(pool, service_ids, host_user_id).await?;

    if audience.is_empty() {
        return Ok(());
    }

    let body = format!(
        "Plus que {} minute(s) pour la vente flash \"{}\" !",
        remaining_minutes.max(1),
        product_title
    );

    let primary_service_id = service_ids.first().copied();
    let metadata = json!({
        "live_session_id": session_id,
        "flash_sale_id": flash_sale_id,
        "service_ids": service_ids,
        "primary_service_id": primary_service_id,
        "remaining_minutes": remaining_minutes,
        "event": "live_flash_sale_ending"
    });

    notify_users(
        pool,
        &audience,
        NotificationType::LiveFlashSaleEndingSoon,
        "⏰ Vente flash presque terminée",
        &body,
        metadata,
    )
    .await;

    Ok(())
}

pub async fn notify_flash_sale_commentary(
    pool: &PgPool,
    host_user_id: i32,
    service_ids: &[i32],
    session_id: Uuid,
    flash_sale_id: Uuid,
    session_title: &str,
    message: &str,
) -> anyhow::Result<()> {
    if service_ids.is_empty() {
        return Ok(());
    }

    let audience = collect_audience_for_services(pool, service_ids, host_user_id).await?;

    if audience.is_empty() {
        return Ok(());
    }

    let metadata = json!({
        "live_session_id": session_id,
        "flash_sale_id": flash_sale_id,
        "event": "live_flash_sale_commentary"
    });

    notify_users(
        pool,
        &audience,
        NotificationType::LiveFlashSaleCommentary,
        &format!("🎙️ {session_title}"),
        message,
        metadata,
    )
    .await;

    Ok(())
}
