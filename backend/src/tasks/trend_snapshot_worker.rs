// TrendPulse Snapshot Worker — Yukpo
// Cron toutes les heures :
//   1. Collecte les tendances globales par région
//   2. Persiste un snapshot en DB (historique)
//   3. Calcule score_delta vs snapshot précédent
//   4. Émet des alertes push si opportunity_score >= 85 pour des prestataires actifs

use chrono::Utc;
use std::sync::Arc;
use tokio::time::{interval, Duration};

use crate::{
    services::{push_notification_service, trend_aggregator_service::get_trend_pulse},
    state::AppState,
};
use sqlx::Row;

const REGIONS: &[&str] = &["CM", "SN", "CI", "NG"];
const ALERT_THRESHOLD: f32 = 85.0;
const CRON_INTERVAL_SECS: u64 = 3600; // toutes les heures

pub async fn start_trend_snapshot_worker(state: Arc<AppState>) {
    log::info!(
        "📈 [TrendSnapshot] Worker démarré — snapshots toutes les {}s",
        CRON_INTERVAL_SECS
    );

    // ✅ Premier snapshot immédiat au démarrage (pas d'attente 1h)
    log::info!(
        "[TrendSnapshot] ⏰ Collecte initiale snapshots pour {} régions...",
        REGIONS.len()
    );
    for region in REGIONS {
        if let Err(e) = run_snapshot_for_region(&state, region).await {
            log::error!("[TrendSnapshot] ❌ Erreur région {}: {}", region, e);
        }
    }

    // Puis toutes les heures
    let mut ticker = interval(Duration::from_secs(CRON_INTERVAL_SECS));
    ticker.tick().await; // consomme le tick immédiat du ticker

    loop {
        ticker.tick().await;

        log::info!(
            "[TrendSnapshot] ⏰ Collecte snapshots pour {} régions...",
            REGIONS.len()
        );

        for region in REGIONS {
            if let Err(e) = run_snapshot_for_region(&state, region).await {
                log::error!("[TrendSnapshot] ❌ Erreur région {}: {}", region, e);
            }
        }
    }
}

async fn run_snapshot_for_region(state: &Arc<AppState>, region: &str) -> Result<(), String> {
    let result = get_trend_pulse(state, region, "24h", None).await;
    let now = Utc::now();
    let mut inserted = 0usize;
    let mut alerts_sent = 0usize;

    for trend in &result.trends {
        // 1. Récupérer le score précédent pour calculer le delta
        let prev_score: Option<f32> = sqlx::query_scalar(
            r#"SELECT opportunity_score::float4
               FROM trend_snapshots
               WHERE region = $1 AND topic = $2
               ORDER BY snapshot_at DESC
               LIMIT 1"#,
        )
        .bind(region)
        .bind(&trend.topic)
        .fetch_optional(&state.pg)
        .await
        .unwrap_or(None);

        // 2. Insérer le snapshot
        sqlx::query(
            r#"INSERT INTO trend_snapshots
               (region, period, topic, social_score, commerce_score, opportunity_score,
                momentum_pct, categories, sources, snapshot_at, prev_opportunity_score)
               VALUES ($1, '24h', $2, $3, $4, $5, $6, $7, $8, $9, $10)"#,
        )
        .bind(region)
        .bind(&trend.topic)
        .bind(trend.social_score as f64)
        .bind(trend.commerce_score as f64)
        .bind(trend.opportunity_score as f64)
        .bind(trend.momentum_pct as f64)
        .bind(&trend.categories)
        .bind(&trend.sources)
        .bind(now)
        .bind(prev_score.map(|v| v as f64))
        .execute(&state.pg)
        .await
        .map_err(|e| e.to_string())?;

        inserted += 1;

        // 3. Alertes push si score >= ALERT_THRESHOLD
        if trend.opportunity_score >= ALERT_THRESHOLD {
            alerts_sent += send_trend_alerts(state, region, trend).await;
        }
    }

    // 4. Nettoyage : supprimer les snapshots de plus de 30 jours
    let _ = sqlx::query(
        "DELETE FROM trend_snapshots WHERE region = $1 AND snapshot_at < NOW() - INTERVAL '30 days'",
    )
    .bind(region)
    .execute(&state.pg)
    .await;

    // 5. Nettoyage : supprimer les alertes de plus de 24h (reset quota)
    let _ =
        sqlx::query("DELETE FROM trend_alerts_sent WHERE sent_at < NOW() - INTERVAL '24 hours'")
            .execute(&state.pg)
            .await;

    log::info!(
        "[TrendSnapshot] ✅ {} {} snapshots insérés, {} alertes push envoyées",
        region,
        inserted,
        alerts_sent
    );

    Ok(())
}

/// Envoie des alertes push aux prestataires Yukpo dont le secteur correspond à la tendance.
/// Limite : une seule alerte par (user, topic, region) toutes les 24h.
async fn send_trend_alerts(
    state: &Arc<AppState>,
    region: &str,
    trend: &crate::services::trend_aggregator_service::TrendItem,
) -> usize {
    // Trouver les prestataires actifs dans la région dont les produits matchent le topic
    let topic_pattern = format!(
        "%{}%",
        &trend.topic.to_lowercase()[..trend.topic.len().min(20)]
    );

    let candidates = sqlx::query(
        r#"SELECT DISTINCT s.user_id
           FROM services s
           JOIN service_products sp ON sp.service_id = s.id
           WHERE s.is_active = true
             AND (
               s.data->>'ville' ILIKE $1
               OR $2 = 'ALL'
             )
             AND (
               LOWER(sp.product_name) ILIKE $3
               OR LOWER(sp.product_type) ILIKE $3
               OR LOWER(COALESCE(s.category, '')) ILIKE $3
             )
             AND sp.is_active = true
           LIMIT 50"#,
    )
    .bind(format!("%{}%", region))
    .bind(region)
    .bind(&topic_pattern)
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    let mut sent = 0usize;

    for row in &candidates {
        let user_id: i32 = row.try_get("user_id").unwrap_or(0);

        // Vérifier que l'alerte n'a pas déjà été envoyée dans les 24h
        let already_sent: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM trend_alerts_sent WHERE user_id = $1 AND topic = $2 AND region = $3",
        )
        .bind(user_id)
        .bind(&trend.topic)
        .bind(region)
        .fetch_one(&state.pg)
        .await
        .unwrap_or(0);

        if already_sent > 0 {
            continue;
        }

        // Construire le message push
        let title = format!("📈 Opportunité détectée : {}", trend.topic);
        let body = format!(
            "Score {:.0}/100 — Cette tendance correspond à vos produits. Agissez maintenant.",
            trend.opportunity_score
        );
        let data = Some(serde_json::json!({
            "screen": "TrendPulseDashboard",
            "topic": trend.topic,
            "region": region,
            "opportunity_score": trend.opportunity_score,
        }));

        // Convertir l'erreur en String avant le match pour que le future soit Send
        let push_count = push_notification_service::send_push_notification(
            &state.pg,
            user_id,
            title,
            body,
            data,
            Some("default".to_string()),
        )
        .await
        .map(|c| c > 0)
        .unwrap_or(false);

        if push_count {
            // Tracer l'alerte envoyée
            let _ = sqlx::query(
                r#"INSERT INTO trend_alerts_sent (user_id, topic, region, opportunity_score)
                   VALUES ($1, $2, $3, $4)
                   ON CONFLICT (user_id, topic, region) DO UPDATE
                   SET sent_at = NOW(), opportunity_score = EXCLUDED.opportunity_score"#,
            )
            .bind(user_id)
            .bind(&trend.topic)
            .bind(region)
            .bind(trend.opportunity_score as f64)
            .execute(&state.pg)
            .await;
            sent += 1;
        }
    }

    sent
}
