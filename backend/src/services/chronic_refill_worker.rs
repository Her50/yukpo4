//! Phase C4 (2026-05-15) — Worker renouvellement chronique automatique.
//!
//! Polle la table medication_intake_reminders toutes les 10 min. Pour chaque
//! rappel actif avec auto_refill=TRUE et next_refill_at <= NOW() :
//!   1. Crée une nouvelle alerte RFQ dans medication_alerts avec le
//!      médicament concerné. Position GPS = celle du dernier retrait
//!      validé ou, à défaut, celle du dernier alerte du patient.
//!   2. Lie la nouvelle alerte au rappel (last_refill_alert_id).
//!   3. Avance next_refill_at de refill_interval_days.
//!   4. Envoie une push au patient pour qu'il vienne suivre l'alerte.
//!
//! Lancement : `chronic_refill_worker::spawn_worker(state)` dans main.rs.

use crate::services::push_notification_service::send_push_notification;
use crate::state::AppState;
use log::{info, warn};
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;
use std::time::Duration;

const POLL_INTERVAL_S: u64 = 600; // 10 min — pas besoin de plus précis
const DEFAULT_RADIUS_KM: f64 = 10.0;

pub fn spawn_worker(state: Arc<AppState>) {
    tokio::spawn(async move {
        info!(
            "[chronic-refill-worker] démarrage (poll {}s)",
            POLL_INTERVAL_S
        );
        // Laisse le temps au reste de démarrer
        tokio::time::sleep(Duration::from_secs(45)).await;

        let mut interval = tokio::time::interval(Duration::from_secs(POLL_INTERVAL_S));
        loop {
            interval.tick().await;
            if let Err(e) = tick(&state).await {
                warn!("[chronic-refill-worker] tick error: {}", e);
            }
        }
    });
}

async fn tick(state: &Arc<AppState>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Récupère tous les rappels en attente de renouvellement.
    // On limite à 50 par tick pour éviter une rafale d'alertes en cas
    // de migration ou catch-up après downtime.
    let rows = sqlx::query(
        r#"
        SELECT id, user_id, medication_name, posology, refill_interval_days,
               refill_lead_days, next_refill_at, last_refill_alert_id, end_at
        FROM medication_intake_reminders
        WHERE auto_refill = TRUE
          AND is_active = TRUE
          AND (next_refill_at IS NULL OR next_refill_at <= NOW())
          AND (end_at IS NULL OR end_at >= CURRENT_DATE)
        LIMIT 50
        "#,
    )
    .fetch_all(&state.pg)
    .await?;

    if rows.is_empty() {
        return Ok(());
    }

    info!(
        "[chronic-refill-worker] {} rappel(s) à renouveler",
        rows.len()
    );

    for r in rows {
        let reminder_id: i64 = r.try_get("id").unwrap_or_default();
        let user_id: i32 = r.try_get("user_id").unwrap_or_default();
        let medication: String = r.try_get("medication_name").unwrap_or_default();
        let interval: i32 = r.try_get("refill_interval_days").unwrap_or(28);
        let lead: i32 = r.try_get("refill_lead_days").unwrap_or(3);
        let next_at: Option<chrono::DateTime<chrono::Utc>> = r.try_get("next_refill_at").ok();

        if medication.trim().is_empty() {
            continue;
        }

        // Cas premier passage : next_refill_at NULL → on programme dans
        // (interval - lead) jours et on ne crée pas d'alerte tout de suite
        // (sinon l'activation déclencherait une RFQ instantanée).
        if next_at.is_none() {
            let _ = sqlx::query(
                r#"
                UPDATE medication_intake_reminders
                SET next_refill_at = NOW() + ($1 - $2) * INTERVAL '1 day'
                WHERE id = $3
                "#,
            )
            .bind(interval as i64)
            .bind(lead as i64)
            .bind(reminder_id)
            .execute(&state.pg)
            .await;
            info!(
                "[chronic-refill-worker] reminder {} premier passage → programmé à J+{}",
                reminder_id,
                interval - lead
            );
            continue;
        }

        // Récupère le GPS de la dernière alerte du patient
        let last_gps = sqlx::query(
            r#"
            SELECT gps_lat, gps_lng
            FROM medication_alerts
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 1
            "#,
        )
        .bind(user_id)
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten();

        let (lat, lng) = match last_gps {
            Some(g) => (
                g.try_get::<f64, _>("gps_lat").unwrap_or(4.0511),
                g.try_get::<f64, _>("gps_lng").unwrap_or(9.7679),
            ),
            None => {
                // Pas de GPS connu → on défère, mais on avance quand même
                // next_refill_at pour ne pas spammer ce reminder à chaque tick.
                warn!(
                    "[chronic-refill-worker] user {} sans GPS connu → skip reminder {}",
                    user_id, reminder_id
                );
                let _ = sqlx::query(
                    r#"
                    UPDATE medication_intake_reminders
                    SET next_refill_at = next_refill_at + $1 * INTERVAL '1 day'
                    WHERE id = $2
                    "#,
                )
                .bind(interval as i64)
                .bind(reminder_id)
                .execute(&state.pg)
                .await;
                continue;
            }
        };

        // Crée la nouvelle alerte
        let query_items = json!([{ "name": medication }]);
        let alert_row = sqlx::query(
            r#"
            INSERT INTO medication_alerts
                (user_id, query_items, total_items, gps_lat, gps_lng,
                 radius_km, status, expires_at, notified_pharmacies_count)
            VALUES ($1, $2, 1, $3, $4, $5, 'open',
                    NOW() + INTERVAL '15 minutes', 0)
            RETURNING id
            "#,
        )
        .bind(user_id)
        .bind(&query_items)
        .bind(lat)
        .bind(lng)
        .bind(DEFAULT_RADIUS_KM)
        .fetch_one(&state.pg)
        .await;

        let alert_id: i64 = match alert_row {
            Ok(row) => row.try_get("id").unwrap_or(0),
            Err(e) => {
                warn!(
                    "[chronic-refill-worker] échec création alerte reminder {} : {}",
                    reminder_id, e
                );
                continue;
            }
        };

        // Met à jour le rappel : avance next_refill_at de interval jours
        let _ = sqlx::query(
            r#"
            UPDATE medication_intake_reminders
            SET next_refill_at = next_refill_at + $1 * INTERVAL '1 day',
                last_refill_alert_id = $2,
                updated_at = NOW()
            WHERE id = $3
            "#,
        )
        .bind(interval as i64)
        .bind(alert_id)
        .bind(reminder_id)
        .execute(&state.pg)
        .await;

        // Push notification au patient pour qu'il suive l'alerte
        let title = "Renouvellement automatique".to_string();
        let body = format!(
            "Yukpo recherche {} dans les pharmacies de votre quartier",
            medication
        );
        let data = json!({
            "type": "chronic_refill",
            "alert_id": alert_id,
            "medication": medication,
            "url": format!("/alerts/{}", alert_id),
        });
        if let Err(e) =
            send_push_notification(&state.pg, user_id, title, body, Some(data), None).await
        {
            warn!(
                "[chronic-refill-worker] push échouée user {} : {}",
                user_id, e
            );
        }

        info!(
            "[chronic-refill-worker] reminder {} renouvelé → alerte {} ({})",
            reminder_id, alert_id, medication
        );
    }

    Ok(())
}
