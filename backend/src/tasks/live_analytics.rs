use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result};
use reqwest::Client;
use sqlx::{types::Uuid, PgPool};

use crate::{config::live_streaming::LiveStreamingConfig, state::AppState};

const SYNC_INTERVAL_SECS: u64 = 60;

/// Lance un worker périodique qui synchronise les métriques LiveKit vers Postgres.
pub fn start_live_analytics_task(state: Arc<AppState>) {
    let worker_state = state.clone();
    tokio::spawn(async move {
        let mut ticker = tokio::time::interval(Duration::from_secs(SYNC_INTERVAL_SECS));
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

        loop {
            ticker.tick().await;
            if let Err(err) = sync_live_analytics(worker_state.clone()).await {
                log::warn!("Live analytics sync failed: {err:?}");
            }
        }
    });
}

async fn sync_live_analytics(state: Arc<AppState>) -> Result<()> {
    let config = state.live_streaming.clone();
    if !config.is_livekit_enabled() {
        return Ok(()); // LiveKit désactivé.
    }

    let client = Client::new();
    let rooms = list_livekit_rooms(&client, &config).await?;
    if rooms.is_empty() {
        return Ok(());
    }

    let pool = state.pg.clone();
    let interval_secs = SYNC_INTERVAL_SECS as i64;

    for room in rooms {
        if let Some(room_name) = room.name {
            update_session_metrics(&pool, &room_name, room.num_participants, interval_secs).await?;
        }
    }

    Ok(())
}

struct LiveKitRoom {
    name: Option<String>,
    num_participants: i32,
}

async fn list_livekit_rooms(
    client: &Client,
    config: &LiveStreamingConfig,
) -> Result<Vec<LiveKitRoom>> {
    let base_url = config
        .livekit_api_url
        .as_ref()
        .map(|url| url.trim_end_matches('/').to_string())
        .context("LIVEKIT_API_URL manquant")?;
    let api_key = config
        .livekit_api_key
        .as_ref()
        .context("LIVEKIT_API_KEY manquant")?;
    let api_secret = config
        .livekit_api_secret
        .as_ref()
        .context("LIVEKIT_API_SECRET manquant")?;

    let list_endpoint = format!("{}/twirp/livekit.RoomService/ListRooms", base_url);
    let response = client
        .post(list_endpoint)
        .basic_auth(api_key, Some(api_secret))
        .json(&serde_json::json!({}))
        .send()
        .await
        .context("appel ListRooms")?;

    if !response.status().is_success() {
        log::warn!("LiveKit ListRooms statut inattendu: {}", response.status());
        return Ok(vec![]);
    }

    let payload: serde_json::Value = response.json().await.context("parse ListRooms")?;
    let rooms = payload
        .get("rooms")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let result = rooms
        .into_iter()
        .map(|room| {
            let name = room
                .get("name")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let num_participants = room
                .get("num_participants")
                .and_then(|v| v.as_i64())
                .unwrap_or_default() as i32;

            LiveKitRoom {
                name,
                num_participants: num_participants.max(0),
            }
        })
        .collect();

    Ok(result)
}

async fn update_session_metrics(
    pool: &PgPool,
    room_name: &str,
    viewers: i32,
    interval_secs: i64,
) -> Result<()> {
    let mut tx = pool.begin().await?;

    let record = sqlx::query!(
        r#"
        UPDATE live_sessions
        SET
            current_viewers = $2,
            peak_viewers = GREATEST(peak_viewers, $2),
            total_watch_time_seconds = total_watch_time_seconds + ($2::BIGINT * $3),
            status = CASE
                WHEN $2 > 0 THEN 'live'
                ELSE status
            END,
            updated_at = NOW()
        WHERE livekit_room_name = $1
        RETURNING id, peak_viewers, total_watch_time_seconds
        "#,
        room_name,
        viewers,
        interval_secs
    )
    .fetch_optional(&mut tx)
    .await?;

    if let Some(record) = record {
        upsert_analytics(
            &mut tx,
            record.id,
            viewers,
            record.peak_viewers,
            interval_secs,
            record.total_watch_time_seconds,
        )
        .await?;
    }

    tx.commit().await?;

    Ok(())
}

async fn upsert_analytics(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    session_id: Uuid,
    webrtc_viewers: i32,
    peak_viewers: i32,
    interval_secs: i64,
    total_watch_time_seconds: i64,
) -> Result<()> {
    let watch_increment = (webrtc_viewers as i64).max(0) * interval_secs.max(0);
    let total_watch = total_watch_time_seconds.max(0);
    let max_viewers = peak_viewers.max(webrtc_viewers).max(1) as f64;
    let average_watch = (total_watch as f64).max(0.0) / max_viewers.max(1.0);

    sqlx::query!(
        r#"
        INSERT INTO live_session_analytics (
            live_session_id,
            total_viewers,
            hls_viewers,
            webrtc_viewers,
            total_watch_time_seconds,
            average_watch_time_seconds,
            conversions,
            revenue_cfa,
            last_synced_at
        )
        VALUES ($1, $2, 0, $3, $4, $5, 0, 0, NOW())
        ON CONFLICT (live_session_id) DO UPDATE SET
            total_viewers = GREATEST(live_session_analytics.total_viewers, $2),
            webrtc_viewers = $3,
            total_watch_time_seconds = live_session_analytics.total_watch_time_seconds + $6,
            average_watch_time_seconds = CASE
                WHEN GREATEST(live_session_analytics.total_viewers, $2) > 0
                THEN (live_session_analytics.total_watch_time_seconds + $6)::NUMERIC
                    / GREATEST(GREATEST(live_session_analytics.total_viewers, $2), 1)
                ELSE 0
            END,
            last_synced_at = NOW()
        "#,
        session_id,
        peak_viewers,
        webrtc_viewers,
        total_watch_time_seconds + watch_increment,
        average_watch,
        watch_increment
    )
    .execute(&mut *tx)
    .await?;

    Ok(())
}
