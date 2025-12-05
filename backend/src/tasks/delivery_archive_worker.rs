//! ✅ Phase 2 - Worker d'archivage automatique des livraisons complétées
//! Archive les livraisons complétées depuis plus de 90 jours

use crate::state::AppState;
use chrono::Timelike;
use log::{error, info, warn};
use std::sync::Arc;
use std::time::Duration;

/// Démarre le worker d'archivage automatique
/// Exécute l'archivage quotidiennement à 2h du matin
pub fn start_delivery_archive_worker(state: Arc<AppState>) {
    tokio::spawn(async move {
        info!("🔄 [DeliveryArchive] Worker d'archivage démarré");

        // Attendre jusqu'à 2h du matin pour la première exécution
        let now = chrono::Utc::now();
        let next_run = if now.hour() < 2 {
            // Si avant 2h, exécuter aujourd'hui à 2h
            now.date_naive().and_hms_opt(2, 0, 0).unwrap().and_utc()
        } else {
            // Sinon, exécuter demain à 2h
            (now.date_naive() + chrono::Days::new(1))
                .and_hms_opt(2, 0, 0)
                .unwrap()
                .and_utc()
        };

        let wait_duration = (next_run - now).to_std().unwrap_or(Duration::from_secs(0));
        tokio::time::sleep(wait_duration).await;

        // Boucle principale: exécution quotidienne
        let mut interval = tokio::time::interval(Duration::from_secs(24 * 60 * 60)); // 24h
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        loop {
            interval.tick().await;

            match archive_old_deliveries(&state).await {
                Ok((archived, deleted)) => {
                    if archived > 0 || deleted > 0 {
                        info!(
                            "✅ [DeliveryArchive] Archivage terminé: {} archivées, {} supprimées",
                            archived, deleted
                        );
                    } else {
                        info!("ℹ️ [DeliveryArchive] Aucune livraison à archiver");
                    }
                }
                Err(e) => {
                    error!("❌ [DeliveryArchive] Erreur lors de l'archivage: {}", e);
                }
            }

            // Créer les partitions futures (mensuel)
            match create_future_partitions(&state).await {
                Ok(_) => {
                    info!("✅ [DeliveryArchive] Partitions futures créées/mises à jour");
                }
                Err(e) => {
                    warn!("⚠️ [DeliveryArchive] Erreur création partitions: {}", e);
                }
            }
        }
    });
}

/// Archive les livraisons complétées depuis plus de 90 jours
async fn archive_old_deliveries(state: &Arc<AppState>) -> Result<(i64, i64), sqlx::Error> {
    info!("🔄 [DeliveryArchive] Démarrage archivage...");

    // Appeler la fonction SQL d'archivage
    #[derive(sqlx::FromRow)]
    struct ArchiveResult {
        archived_count: i64,
        deleted_count: i64,
    }

    let result: ArchiveResult =
        sqlx::query_as("SELECT archived_count, deleted_count FROM archive_old_deliveries()")
            .fetch_one(&state.pg)
            .await?;

    Ok((result.archived_count, result.deleted_count))
}

/// Crée les partitions futures pour la table deliveries
async fn create_future_partitions(state: &Arc<AppState>) -> Result<(), sqlx::Error> {
    sqlx::query("SELECT create_future_delivery_partitions()")
        .execute(&state.pg)
        .await?;

    Ok(())
}
