// ✅ NOUVEAU 2025-12-02: Tâche de rafraîchissement automatique de la vue matérialisée
// Exécutée toutes les 2 minutes pour maintenir les performances de recherche

use crate::core::types::AppResult;
use crate::utils::log::log_info;
use sqlx::PgPool;
use std::time::Duration;
use tokio::time::interval;

/// Démarre la tâche de rafraîchissement automatique de la vue matérialisée
pub async fn start_search_cache_refresh_task(pool: PgPool) {
    log_info("[SearchCacheRefresh] 🚀 Démarrage de la tâche de rafraîchissement automatique");

    // Intervalle de 2 minutes
    let mut interval_timer = interval(Duration::from_secs(120));

    let _ = tokio::spawn(async move {
        loop {
            interval_timer.tick().await;

            match refresh_materialized_view(&pool).await {
                Ok(_) => {
                    log_info("[SearchCacheRefresh] ✅ Vue matérialisée rafraîchie avec succès");
                }
                Err(e) => {
                    log::error!(
                        "[SearchCacheRefresh] ❌ Erreur lors du rafraîchissement: {}",
                        e
                    );
                }
            }
        }
    });
}

/// Rafraîchit la vue matérialisée services_search_optimized
async fn refresh_materialized_view(pool: &PgPool) -> AppResult<()> {
    let start = std::time::Instant::now();

    sqlx::query("SELECT refresh_services_search_optimized()")
        .execute(pool)
        .await
        .map_err(|e| {
            crate::core::types::AppError::Internal(format!(
                "Erreur rafraîchissement vue matérialisée: {}",
                e
            ))
        })?;

    let duration = start.elapsed();
    log_info(&format!(
        "[SearchCacheRefresh] ⏱️ Rafraîchissement terminé en {:?}",
        duration
    ));

    Ok(())
}
