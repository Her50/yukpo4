// ✅ Tâche planifiée : synchronisation automatique des liens Drive partenaires
//
// Tourne toutes les heures et vérifie quels liens sont dus selon leur schedule :
//   - hourly  : toutes les heures
//   - daily   : une fois par jour à sync_hour UTC
//   - weekly  : une fois par semaine (sync_day_of_week + sync_hour UTC)
//
// Lance run_import_for_link() pour chaque lien dû.

use crate::controllers::drive_import_controller::run_import_for_link;
use crate::state::AppState;
use sqlx::Row;
use std::sync::Arc;
use tokio::time::{interval, Duration};

pub fn start_drive_sync_scheduler(state: Arc<AppState>) {
    let _ = tokio::spawn(async move {
        // Interval de vérification : toutes les heures
        let mut ticker = interval(Duration::from_secs(3_600));
        loop {
            ticker.tick().await;
            run_due_imports(state.clone()).await;
        }
    });

    log::info!("[drive_sync_scheduler] Démarré — vérification toutes les heures");
}

async fn run_due_imports(state: Arc<AppState>) {
    let now = chrono::Utc::now();
    let current_hour = now.hour();
    let current_dow = now.weekday().num_days_from_sunday(); // 0=dim, 6=sam

    // Récupérer tous les liens actifs non-manuels
    let rows = match sqlx::query(
        r#"
        SELECT id, download_url, service_type, service_id,
               sync_schedule, sync_hour, sync_day_of_week,
               last_sync_at
        FROM partner_import_links
        WHERE is_active = true
          AND sync_schedule != 'manual'
        "#,
    )
    .fetch_all(&state.pg)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            log::error!("[drive_sync_scheduler] Erreur lecture liens: {}", e);
            return;
        }
    };

    for row in &rows {
        let link_id: i32 = row.get("id");
        let download_url: String = row.get("download_url");
        let service_type: String = row.get("service_type");
        let service_id: i32 = row.get("service_id");
        let sync_schedule: String = row.get("sync_schedule");
        let sync_hour: i32 = row.get("sync_hour");
        let sync_dow: Option<i32> = row.get("sync_day_of_week");
        let last_sync_at: Option<chrono::DateTime<chrono::Utc>> = row.get("last_sync_at");

        let is_due = match sync_schedule.as_str() {
            "hourly" => {
                // Dû si pas encore synchronisé cette heure-ci
                match last_sync_at {
                    None => true,
                    Some(last) => now.signed_duration_since(last).num_minutes() >= 60,
                }
            }
            "daily" => {
                // Dû si l'heure courante = sync_hour ET pas encore sync aujourd'hui
                if current_hour as i32 != sync_hour {
                    false
                } else {
                    match last_sync_at {
                        None => true,
                        Some(last) => now.signed_duration_since(last).num_hours() >= 20,
                    }
                }
            }
            "weekly" => {
                // Dû si le jour courant + heure correspondent ET pas sync cette semaine
                let expected_dow = sync_dow.unwrap_or(1) as u32;
                if current_dow != expected_dow || current_hour as i32 != sync_hour {
                    false
                } else {
                    match last_sync_at {
                        None => true,
                        Some(last) => now.signed_duration_since(last).num_hours() >= 24 * 6,
                    }
                }
            }
            _ => false,
        };

        if is_due {
            log::info!(
                "[drive_sync_scheduler] Link #{} dû ({}) — lancement import service_type={} service_id={}",
                link_id, sync_schedule, service_type, service_id
            );
            let pg = state.pg.clone();
            let dl = download_url.clone();
            let st = service_type.clone();
            tokio::spawn(async move {
                match run_import_for_link(&pg, link_id, &dl, &st, service_id).await {
                    Ok(count) => log::info!(
                        "[drive_sync_scheduler] Link #{}: {} produits importés",
                        link_id,
                        count
                    ),
                    Err(e) => log::error!("[drive_sync_scheduler] Link #{} erreur: {}", link_id, e),
                }
            });
        }
    }
}
