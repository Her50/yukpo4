//! Phase B2.2 — Worker rappels de prise (medication_intake_reminders).
//!
//! Polle la table toutes les 60 s. Pour chaque rappel actif :
//!   - convertit l'heure courante UTC vers la timezone du user
//!   - matche si l'heure locale courante (HH:MM) correspond à une entrée
//!     dans times_of_day (à ±1 min près)
//!   - vérifie last_sent_at ≠ même minute (anti-doublon)
//!   - envoie une push notification via push_notification_service
//!   - met à jour last_sent_at
//!
//! Une cure expirée (end_at < today) est automatiquement désactivée.
//!
//! Lancement : `intake_reminder_worker::spawn_worker(state)` dans main.rs.

use crate::services::push_notification_service::send_push_notification;
use crate::state::AppState;
use chrono::{Datelike, FixedOffset, Timelike, Utc};
use log::{info, warn};
use serde_json::{json, Value as JsonValue};
use sqlx::Row;
use std::sync::Arc;
use std::time::Duration;

/// Conversion timezone name → offset secondes. Volontairement minimaliste :
/// la majorité des utilisateurs sont au Cameroun (UTC+1, pas de DST). On
/// supporte les principales TZ africaines + UTC pour le reste. Tout ce qui
/// n'est pas reconnu retombe sur UTC+1.
fn tz_to_offset_seconds(tz: &str) -> i32 {
    match tz {
        "UTC" | "Etc/UTC" => 0,
        // UTC+0 (Africa de l'Ouest sans DST)
        "Africa/Abidjan" | "Africa/Accra" | "Africa/Dakar" | "Africa/Bamako" => 0,
        // UTC+1 (CEMAC, Afrique centrale, pas de DST)
        "Africa/Douala" | "Africa/Lagos" | "Africa/Brazzaville" | "Africa/Bangui"
        | "Africa/Libreville" | "Africa/Kinshasa" | "Africa/Niamey" | "Africa/Tunis"
        | "Africa/Algiers" => 3600,
        // UTC+2 (Afrique du sud-est, RD Congo Est)
        "Africa/Cairo"
        | "Africa/Johannesburg"
        | "Africa/Kigali"
        | "Africa/Lubumbashi"
        | "Africa/Maputo" => 7200,
        // UTC+3 (Afrique de l'Est)
        "Africa/Nairobi" | "Africa/Addis_Ababa" | "Africa/Khartoum" => 10800,
        // Europe (CEMAC clients depuis l'Europe, etc.) — sans DST géré ici
        "Europe/Paris" | "Europe/Brussels" | "Europe/Madrid" => 3600,
        // Défaut : UTC+1 (cas dominant Cameroun)
        _ => 3600,
    }
}

const POLL_INTERVAL_S: u64 = 60;

pub fn spawn_worker(state: Arc<AppState>) {
    tokio::spawn(async move {
        info!(
            "[intake-reminder-worker] démarrage (poll {}s)",
            POLL_INTERVAL_S
        );
        // Laisser le temps aux autres systèmes de démarrer
        tokio::time::sleep(Duration::from_secs(20)).await;
        loop {
            match run_one_tick(&*state).await {
                Ok(n) if n > 0 => info!("[intake-reminder-worker] {} rappels envoyés", n),
                Ok(_) => {}
                Err(e) => warn!("[intake-reminder-worker] erreur: {}", e),
            }
            tokio::time::sleep(Duration::from_secs(POLL_INTERVAL_S)).await;
        }
    });
}

async fn run_one_tick(state: &AppState) -> Result<u32, sqlx::Error> {
    // 1. Désactive les cures expirées
    sqlx::query(
        "UPDATE medication_intake_reminders \
         SET is_active = FALSE, updated_at = NOW() \
         WHERE is_active = TRUE AND end_at IS NOT NULL AND end_at < CURRENT_DATE",
    )
    .execute(&state.pg)
    .await?;

    // 2. Récupère tous les rappels actifs
    let rows = sqlx::query(
        "SELECT id, user_id, medication_name, posology, times_of_day, timezone, \
                last_sent_at \
         FROM medication_intake_reminders \
         WHERE is_active = TRUE",
    )
    .fetch_all(&state.pg)
    .await?;

    if rows.is_empty() {
        return Ok(0);
    }

    let now_utc = Utc::now();
    let mut sent = 0u32;

    for row in rows {
        let id: i64 = row.try_get("id").unwrap_or_default();
        let user_id: i32 = row.try_get("user_id").unwrap_or_default();
        let med: String = row.try_get("medication_name").unwrap_or_default();
        let posology: Option<String> = row.try_get("posology").ok();
        let times_json: JsonValue = row.try_get("times_of_day").unwrap_or(json!([]));
        let tz_name: String =
            row.try_get("timezone").unwrap_or_else(|_| "Africa/Douala".to_string());
        let last_sent_at: Option<chrono::DateTime<Utc>> = row.try_get("last_sent_at").ok();

        let offset = FixedOffset::east_opt(tz_to_offset_seconds(&tz_name))
            .unwrap_or_else(|| FixedOffset::east_opt(3600).unwrap());
        let now_local = now_utc.with_timezone(&offset);
        let current_hm = format!("{:02}:{:02}", now_local.hour(), now_local.minute());

        let times: Vec<String> = times_json
            .as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default();

        // Match exact HH:MM dans la minute courante
        let matched = times.iter().any(|t| t == &current_hm);
        if !matched {
            continue;
        }

        // Anti-doublon : si last_sent_at est dans la même minute (timezone-aware),
        // on saute pour éviter d'envoyer 2 fois la même notification.
        if let Some(prev) = last_sent_at {
            let prev_local = prev.with_timezone(&offset);
            if prev_local.year() == now_local.year()
                && prev_local.month() == now_local.month()
                && prev_local.day() == now_local.day()
                && prev_local.hour() == now_local.hour()
                && prev_local.minute() == now_local.minute()
            {
                continue;
            }
        }

        // Envoie la notification
        let title = format!("💊 {}", med);
        let body = match &posology {
            Some(p) if !p.is_empty() => format!("Heure de votre prise — {}", p),
            _ => "Heure de votre prise.".to_string(),
        };
        let data = json!({
            "type": "intake_reminder",
            "reminder_id": id,
            "medication": med,
        });

        match send_push_notification(
            &state.pg,
            user_id,
            title.clone(),
            body.clone(),
            Some(data),
            Some("default".to_string()),
        )
        .await
        {
            Ok(n) => {
                info!(
                    "[intake-reminder-worker] rappel #{} envoyé à user {} ({} push)",
                    id, user_id, n
                );
                sent += 1;
            }
            Err(e) => warn!("[intake-reminder-worker] échec push rappel #{}: {}", id, e),
        }

        // Marque last_sent_at même si push KO (l'utilisateur n'a peut-être
        // pas de token actif — pas grave, on garde l'historique).
        let _ = sqlx::query(
            "UPDATE medication_intake_reminders SET last_sent_at = NOW() WHERE id = $1",
        )
        .bind(id)
        .execute(&state.pg)
        .await;
    }

    Ok(sent)
}
