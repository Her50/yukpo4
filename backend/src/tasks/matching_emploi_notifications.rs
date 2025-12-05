// ✅ Tâche cron pour vérifier et notifier les nouveaux matchings d'emploi
use crate::services::notifications_matching_emploi;
use log::{error, info};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::time::{interval, Duration};

/// Démarre la tâche périodique de vérification des nouveaux matchings
/// S'exécute toutes les 6 heures
pub async fn start_matching_notifications_task(pool: Arc<PgPool>) {
    info!("🕐 [Cron] Démarrage de la tâche de notifications de matchings emploi");

    let mut interval_timer = interval(Duration::from_secs(21600)); // Toutes les 6 heures

    loop {
        interval_timer.tick().await;

        info!("⏰ [Cron] Vérification des nouveaux matchings emploi...");

        match notifications_matching_emploi::check_and_notify_new_matchings(&pool).await {
            Ok(count) => {
                if count > 0 {
                    info!("✅ [Cron] {} notification(s) de matching envoyée(s)", count);
                } else {
                    log::debug!("✓ [Cron] Aucun nouveau matching à notifier");
                }
            }
            Err(e) => {
                error!(
                    "❌ [Cron] Erreur lors de la vérification des matchings: {:?}",
                    e
                );
            }
        }
    }
}
