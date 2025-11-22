use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use bigdecimal::{BigDecimal, FromPrimitive};
use reqwest::{Client, StatusCode};
use sqlx::{types::Uuid, FromRow, PgConnection, PgPool};

#[derive(FromRow)]
struct LiveSessionUpdateRow {
    #[sqlx(rename = "id")]
    id: Uuid,
    #[sqlx(rename = "peak_viewers")]
    peak_viewers: i32,
    #[sqlx(rename = "total_watch_time_seconds")]
    total_watch_time_seconds: i64,
}

use crate::{
    config::live_streaming::LiveStreamingConfig, state::AppState,
    utils::livekit::generate_server_access_token,
};

const SYNC_INTERVAL_SECS: u64 = 60;

/// Lance un worker périodique qui synchronise les métriques LiveKit vers Postgres.
pub fn start_live_analytics_task(state: Arc<AppState>) {
    let worker_state = state.clone();
    tokio::spawn(async move {
        let mut ticker = tokio::time::interval(Duration::from_secs(SYNC_INTERVAL_SECS));
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        
        // Flag partagé pour limiter la verbosité des logs de connexion
        let connection_error_logged = Arc::new(AtomicBool::new(false));

        loop {
            ticker.tick().await;
            if let Err(err) = sync_live_analytics(worker_state.clone()).await {
                // Logger une seule fois si c'est une erreur de connexion (service non disponible)
                let err_str = format!("{err:?}").to_lowercase();
                if err_str.contains("connection refused") 
                    || err_str.contains("connexion refusée")
                    || err_str.contains("tcp connect error")
                    || err_str.contains("service non disponible")
                    || err_str.contains("manquant") {
                    if !connection_error_logged.swap(true, Ordering::Relaxed) {
                        let config = worker_state.live_streaming.clone();
                        let api_url = config.livekit_api_url.as_ref()
                            .map(|u| format!("{}...", u.chars().take(30).collect::<String>()))
                            .unwrap_or_else(|| "NON DÉFINIE".to_string());
                        
                        if err_str.contains("manquant") {
                            log::warn!("⚠️ LiveKit: Variables d'environnement manquantes. Vérifiez LIVEKIT_API_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET sur Render.com");
                        } else {
                            log::warn!("⚠️ LiveKit: Connexion impossible - URL: {}. Vérifiez que LIVEKIT_API_URL est correcte sur Render.com", api_url);
                            log::info!("ℹ️ LiveKit non disponible (service optionnel). Synchronisation analytics désactivée.");
                        }
                    }
                    // Ignorer les erreurs de connexion répétées
                    continue;
                } else {
                    log::warn!("Live analytics sync failed: {err:?}");
                }
            } else {
                // Si la connexion réussit après une erreur, réinitialiser le flag
                if connection_error_logged.swap(false, Ordering::Relaxed) {
                    log::info!("✅ LiveKit disponible. Synchronisation analytics activée.");
                }
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
    let token = generate_server_access_token(api_key, api_secret).map_err(|err| anyhow!(err))?;

    let response = client
        .post(&list_endpoint)
        .bearer_auth(token)
        .json(&serde_json::json!({}))
        .timeout(Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| {
            // Améliorer le message d'erreur pour les connexions refusées
            let err_msg = format!("{}", e);
            if err_msg.contains("Connection refused") || err_msg.contains("tcp connect error") {
                anyhow::anyhow!("LiveKit service non disponible: connexion refusée")
            } else {
                anyhow::anyhow!(e).context("appel ListRooms")
            }
        })?;

    let status = response.status();
    if status == StatusCode::UNAUTHORIZED {
        log::info!(
            "LiveKit ListRooms a renvoyé 401 Unauthorized. Synchronisation LiveKit désactivée."
        );
        return Ok(vec![]);
    }

    if !status.is_success() {
        log::warn!("LiveKit ListRooms statut inattendu: {}", status);
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

    let record: Option<LiveSessionUpdateRow> = sqlx::query_as(
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
        "#
    )
    .bind(room_name)
    .bind(viewers)
    .bind(interval_secs)
    .fetch_optional(&mut *tx)
    .await?;

    if let Some(record) = record {
        upsert_analytics(
            &mut *tx,
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
    conn: &mut PgConnection,
    session_id: Uuid,
    webrtc_viewers: i32,
    peak_viewers: i32,
    interval_secs: i64,
    total_watch_time_seconds: i64,
) -> Result<()> {
    let _watch_increment = (webrtc_viewers as i64).max(0) * interval_secs.max(0);
    let total_watch = total_watch_time_seconds.max(0);
    let max_viewers = peak_viewers.max(webrtc_viewers).max(1) as f64;
    let average_watch = if max_viewers > 0.0 {
        total_watch as f64 / max_viewers
    } else {
        0.0
    };
    let conversions = 0;
    let revenue_cfa = 0.0f64;

    let average_watch_bd =
        BigDecimal::from_f64(average_watch).unwrap_or_else(|| BigDecimal::from(0));
    let revenue_cfa_bd = BigDecimal::from_f64(revenue_cfa).unwrap_or_else(|| BigDecimal::from(0));

    sqlx::query(
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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (live_session_id)
        DO UPDATE SET
            total_viewers = EXCLUDED.total_viewers,
            hls_viewers = EXCLUDED.hls_viewers,
            webrtc_viewers = EXCLUDED.webrtc_viewers,
            total_watch_time_seconds = EXCLUDED.total_watch_time_seconds,
            average_watch_time_seconds = EXCLUDED.average_watch_time_seconds,
            conversions = EXCLUDED.conversions,
            revenue_cfa = EXCLUDED.revenue_cfa,
            last_synced_at = NOW()
        "#
    )
    .bind(session_id)
    .bind(webrtc_viewers)
    .bind(peak_viewers)
    .bind(webrtc_viewers)
    .bind(total_watch)
    .bind(average_watch_bd)
    .bind(conversions)
    .bind(revenue_cfa_bd)
    .execute(conn)
    .await?;

    Ok(())
}
