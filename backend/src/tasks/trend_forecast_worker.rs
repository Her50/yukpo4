// Trend Forecast Worker — Yukpo
// Calcule les prévisions ML pour les tendances actives dans toutes les régions.
// Fréquence : toutes les 6 heures (peut être ajusté à quotidien si ressources limitées).

use std::sync::Arc;
use tokio::time::{interval, Duration};

use crate::{services::trend_aggregator_service::compute_trend_forecast, state::AppState};

pub fn start_trend_forecast_worker(state: Arc<AppState>) {
    tokio::spawn(async move {
        log::info!("[TrendForecast] 📈 Démarrage du worker de forecasting");

        // Calcul toutes les 6 heures
        let mut ticker = interval(Duration::from_secs(21600));

        loop {
            ticker.tick().await;
            run_forecast_cycle(&state).await;
        }
    });
}

async fn run_forecast_cycle(state: &Arc<AppState>) {
    use sqlx::Row;

    // Récupérer les topics actifs des 3 derniers jours (ont au moins 3 snapshots)
    let active_topics = sqlx::query(
        r#"SELECT region, LOWER(topic) as topic, COUNT(*) as snap_count
           FROM trend_snapshots
           WHERE snapshot_at >= NOW() - INTERVAL '3 days'
           GROUP BY region, LOWER(topic)
           HAVING COUNT(*) >= 3
           ORDER BY snap_count DESC
           LIMIT 200"#,
    )
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    log::info!(
        "[TrendForecast] Calcul forecasting pour {} topics actifs",
        active_topics.len()
    );

    let mut computed = 0_usize;
    let mut errors = 0_usize;

    for row in &active_topics {
        let region: String = row.try_get("region").unwrap_or_default();
        let topic: String = row.try_get("topic").unwrap_or_default();

        if region.is_empty() || topic.is_empty() {
            continue;
        }

        match compute_trend_forecast(&state.pg, &region, &topic).await {
            Some(forecast) => {
                computed += 1;
                log::debug!(
                    "[TrendForecast] {} / {} → J+7: {:.1} ({})",
                    region,
                    topic,
                    forecast.forecast_day7,
                    forecast.trend_direction
                );
            }
            None => {
                errors += 1;
            }
        }

        // Pause courte entre calculs pour ne pas surcharger la DB
        tokio::time::sleep(Duration::from_millis(50)).await;
    }

    // Notifier les partenaires abonnés aux tendances "rising" avec forecast élevé
    notify_rising_trends(state).await;

    log::info!(
        "[TrendForecast] ✅ Cycle terminé — {} forecasts calculés, {} erreurs",
        computed,
        errors
    );
}

/// Envoie des notifications push aux partenaires dont les topics trending
/// ont un forecast J+3 > 70 et une direction "rising".
async fn notify_rising_trends(state: &Arc<AppState>) {
    use sqlx::Row;

    let rising = sqlx::query(
        r#"SELECT f.region, f.topic, f.forecast_day3, f.confidence,
                  sub.user_id, sub.webhook_url
           FROM trend_forecasts f
           JOIN trend_webhook_subscriptions sub ON sub.region = f.region
           WHERE f.trend_direction = 'rising'
             AND f.forecast_day3 > 70
             AND f.confidence > 0.5
             AND f.computed_at >= NOW() - INTERVAL '6 hours'
             AND (sub.last_notified_at IS NULL
                  OR sub.last_notified_at < NOW() - INTERVAL '12 hours')"#,
    )
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    for row in &rising {
        let user_id: i32 = row.try_get("user_id").unwrap_or(0);
        let region: String = row.try_get("region").unwrap_or_default();
        let topic: String = row.try_get("topic").unwrap_or_default();
        let forecast: f64 = row.try_get::<f64, _>("forecast_day3").unwrap_or(0.0);
        let webhook_url: Option<String> = row.try_get("webhook_url").ok().flatten();

        // Notifier via webhook si configuré
        if let Some(ref url) = webhook_url {
            if !url.is_empty() {
                let payload = serde_json::json!({
                    "event": "trend_rising",
                    "region": region,
                    "topic": topic,
                    "forecast_day3": forecast,
                    "message": format!("La tendance '{}' est en hausse dans la région {} — prévision J+3: {:.0}/100", topic, region, forecast),
                    "generated_at": chrono::Utc::now().to_rfc3339(),
                });
                let client = reqwest::Client::new();
                let _ = client
                    .post(url)
                    .json(&payload)
                    .timeout(std::time::Duration::from_secs(5))
                    .send()
                    .await;
            }
        }

        // Mettre à jour last_notified_at
        let _ = sqlx::query(
            "UPDATE trend_webhook_subscriptions SET last_notified_at = NOW() WHERE user_id = $1 AND region = $2",
        )
        .bind(user_id)
        .bind(&region)
        .execute(&state.pg)
        .await;
    }
}

use chrono;
