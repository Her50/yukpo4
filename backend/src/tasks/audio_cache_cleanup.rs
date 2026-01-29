// 🧹 Tâche périodique pour nettoyer le cache de transcriptions audio
// S'exécute tous les jours à 2h du matin

use log;
use sqlx::{PgPool, Row};
use std::sync::Arc;
use tokio::time::{interval, Duration};

/// Tâche périodique pour nettoyer le cache de transcriptions audio
/// S'exécute tous les jours à 2h du matin (ou toutes les 24h)
pub async fn start_audio_cache_cleanup_task(pool: Arc<PgPool>) {
    log::info!("🕐 [Cron] Démarrage de la tâche de nettoyage du cache audio");

    // Exécuter immédiatement au démarrage (optionnel)
    log::info!("⏰ [Cron] Premier nettoyage du cache audio...");
    match run_cleanup(&pool).await {
        Ok(_) => log::info!("✅ [Cron] Premier nettoyage terminé"),
        Err(e) => log::error!("❌ [Cron] Erreur premier nettoyage: {:?}", e),
    }

    // Puis exécuter toutes les 24 heures (86400 secondes)
    let mut interval_timer = interval(Duration::from_secs(86400));

    loop {
        interval_timer.tick().await;

        log::info!("⏰ [Cron] Nettoyage du cache audio...");

        match run_cleanup(&pool).await {
            Ok(_) => log::info!("✅ [Cron] Nettoyage du cache audio terminé"),
            Err(e) => log::error!("❌ [Cron] Erreur nettoyage cache audio: {:?}", e),
        }
    }
}

/// Exécute le nettoyage du cache audio
async fn run_cleanup(pool: &PgPool) -> Result<(), sqlx::Error> {
    let result = sqlx::query(
        r#"
        SELECT * FROM run_audio_cache_cleanup()
        "#,
    )
    .fetch_one(pool)
    .await?;

    // Gérer les valeurs NULL avec Option<i32> puis unwrap_or(0)
    let deleted_count: i32 = result.get::<Option<i32>, _>("deleted_count").unwrap_or(0);
    let kept_count: i32 = result.get::<Option<i32>, _>("kept_count").unwrap_or(0);
    let total_before: i32 = result.get::<Option<i32>, _>("total_before").unwrap_or(0);
    let total_after: i32 = result.get::<Option<i32>, _>("total_after").unwrap_or(0);

    log::info!(
        "📊 [Cron] Cache audio nettoyé: {} supprimés, {} gardés, total: {} -> {}",
        deleted_count,
        kept_count,
        total_before,
        total_after
    );

    Ok(())
}
