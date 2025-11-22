use std::sync::Arc;

use chrono::Utc;
use reqwest::Client;
use serde_json::Value;
use sqlx::FromRow;
use uuid::Uuid;

use crate::{core::types::AppResult, state::AppState};

#[derive(FromRow)]
struct DeliverySlaRow {
    id: Uuid,
    requested_at: Option<chrono::DateTime<chrono::Utc>>,
    delivered_at: Option<chrono::DateTime<chrono::Utc>>,
    metadata: Option<Value>,
}

#[derive(Clone, Debug)]
pub struct DeliverySlaMonitorConfig {
    pub lookback_minutes: i64,
    pub threshold_ratio: f64,
    pub default_sla_minutes: i64,
    pub interval_seconds: u64,
    pub webhook: Option<String>,
}

impl DeliverySlaMonitorConfig {
    pub fn from_env() -> Self {
        Self {
            lookback_minutes: std::env::var("SLA_LOOKBACK_MINUTES")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(60),
            threshold_ratio: std::env::var("SLA_THRESHOLD_RATIO")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(1.1),
            default_sla_minutes: std::env::var("SLA_PROMISED_MINUTES")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(30),
            interval_seconds: std::env::var("SLA_MONITOR_INTERVAL_SECONDS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(300),
            webhook: std::env::var("SLA_ALERT_WEBHOOK").ok(),
        }
    }
}

pub struct DeliverySlaMonitor {
    state: Arc<AppState>,
    config: DeliverySlaMonitorConfig,
    http: Client,
}

impl DeliverySlaMonitor {
    pub fn new(state: Arc<AppState>, config: DeliverySlaMonitorConfig) -> Self {
        Self {
            state,
            config,
            http: Client::new(),
        }
    }

    pub async fn run_forever(&self) {
        let mut ticker =
            tokio::time::interval(std::time::Duration::from_secs(self.config.interval_seconds));
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        loop {
            ticker.tick().await;
            if let Err(err) = self.run_once().await {
                log::warn!("[DeliverySLA] Analyse échouée: {err:?}");
            }
        }
    }

    pub async fn run_once(&self) -> AppResult<()> {
        let rows: Vec<DeliverySlaRow> = sqlx::query_as(
            r#"
            SELECT
                id,
                requested_at,
                delivered_at,
                metadata
            FROM deliveries
            WHERE delivered_at IS NOT NULL
              AND delivered_at >= NOW() - ($1::int * INTERVAL '1 minute')
            "#
        )
        .bind(self.config.lookback_minutes as i32)
        .fetch_all(&self.state.pg)
        .await?;

        for row in rows {
            let Some(requested_at) = row.requested_at else {
                continue;
            };
            let Some(delivered_at) = row.delivered_at else {
                continue;
            };
            let actual_minutes = (delivered_at - requested_at).num_seconds().max(0) as f64 / 60.0;

            let metadata = row.metadata.unwrap_or(Value::Null);
            let promised_minutes = metadata
                .get("logistics")
                .and_then(|logistics| logistics.get("promised_sla_minutes"))
                .and_then(|value| value.as_i64())
                .unwrap_or(self.config.default_sla_minutes);

            if promised_minutes <= 0 {
                continue;
            }

            if actual_minutes > (promised_minutes as f64) * self.config.threshold_ratio {
                self.send_alert(row.id, promised_minutes, actual_minutes)
                    .await?;
            }
        }

        Ok(())
    }

    async fn send_alert(
        &self,
        delivery_id: uuid::Uuid,
        promised_minutes: i64,
        actual_minutes: f64,
    ) -> AppResult<()> {
        log::warn!(
            "[DeliverySLA] Livraison {} en dépassement (promis {} min, réalisé {:.1} min)",
            delivery_id,
            promised_minutes,
            actual_minutes
        );

        if let Some(webhook) = &self.config.webhook {
            let payload = serde_json::json!({
                "type": "delivery_sla_breach",
                "delivery_id": delivery_id,
                "promised_minutes": promised_minutes,
                "actual_minutes": actual_minutes,
                "threshold_ratio": self.config.threshold_ratio,
                "timestamp": Utc::now().to_rfc3339(),
            });

            if let Err(err) = self
                .http
                .post(webhook)
                .json(&payload)
                .send()
                .await
                .and_then(|resp| resp.error_for_status())
            {
                log::error!("[DeliverySLA] Échec envoi webhook SLA: {err:?}");
            }
        }

        Ok(())
    }
}

pub fn start_delivery_sla_monitor(state: Arc<AppState>) {
    let config = DeliverySlaMonitorConfig::from_env();
    let worker = DeliverySlaMonitor::new(state, config);

    tokio::spawn(async move {
        worker.run_forever().await;
    });
}
