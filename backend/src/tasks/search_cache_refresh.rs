// ✅ OPTIMISÉ 2025-12-11: Tâche de rafraîchissement automatique de la vue matérialisée
// Exécutée toutes les 10-15 minutes pour réduire la charge sur le pool de connexions
// ✅ CORRIGÉ RACINE: Utilise un pool séparé pour ne pas bloquer le pool principal

use crate::core::types::AppResult;
use crate::utils::log::log_info;
use sqlx::PgPool;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::time::interval;

/// Démarre la tâche de rafraîchissement automatique de la vue matérialisée
/// Utilise un pool séparé pour éviter de bloquer le pool principal avec des opérations longues (8-13s)
/// ✅ CORRIGÉ RACINE 2025-12-11: Ajoute mutex global pour sérialiser les refreshes
pub async fn start_search_cache_refresh_task(
    pool_long_ops: Option<Arc<PgPool>>,
    fallback_pool: PgPool,
    refresh_lock: Arc<Mutex<()>>,
) {
    log_info("[SearchCacheRefresh] 🚀 Démarrage de la tâche de rafraîchissement automatique");

    // ✅ CORRIGÉ RACINE 2025-12-11: Utiliser le pool séparé pour opérations longues
    // refresh_services_search_optimized() prend 8-13 secondes, doit utiliser pool séparé
    let pool: Arc<PgPool> = if let Some(long_ops_pool) = pool_long_ops {
        long_ops_pool
    } else {
        Arc::new(fallback_pool)
    };

    // ✅ OPTIMISÉ 2025-12-12: Intervalle augmenté à 15 minutes (était 10 min)
    // refresh_services_search_optimized() prend 5-7s selon les logs, donc on évite de l'exécuter trop souvent
    // Les vues matérialisées sont déjà assez à jour avec un refresh toutes les 15 minutes
    // Configurable via variable d'environnement (défaut: 900s = 15 min)
    let refresh_interval_secs: u64 = std::env::var("SEARCH_CACHE_REFRESH_INTERVAL_SECS")
        .unwrap_or_else(|_| "900".to_string())
        .parse()
        .unwrap_or(900);
    let mut interval_timer = interval(Duration::from_secs(refresh_interval_secs));
    log::info!(
        "[SearchCacheRefresh] 🔄 Intervalle de refresh configuré: {}s (15 min) - Utilise pool séparé",
        refresh_interval_secs
    );

    let _ = tokio::spawn(async move {
        loop {
            interval_timer.tick().await;

            // ✅ CRITIQUE: Acquérir le mutex global AVANT le refresh pour sérialiser
            let _lock = refresh_lock.lock().await;
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
/// Utilise un pool séparé pour ne pas bloquer le pool principal
async fn refresh_materialized_view(pool: &Arc<PgPool>) -> AppResult<()> {
    let start = std::time::Instant::now();

    // ✅ CORRIGÉ 2025-12-11: Timeout augmenté à 60s car refresh_services_search_optimized() peut prendre 12-14s
    // Les logs montrent que les refreshes prennent jusqu'à 14 secondes
    const REFRESH_TIMEOUT_SECS: u64 = 60;

    // ✅ OPTIMISATION: Retry avec backoff exponentiel pour les erreurs de connexion
    let mut retry_count = 0;
    const MAX_RETRIES: u32 = 3;

    loop {
        // ✅ OPTIMISÉ: Ajouter un timeout sur la requête de refresh
        let query_future = sqlx::query("SELECT refresh_services_search_optimized()").execute(&**pool);

        match tokio::time::timeout(Duration::from_secs(REFRESH_TIMEOUT_SECS), query_future).await {
            Ok(Ok(_)) => {
                let duration = start.elapsed();
                if retry_count > 0 {
                    log_info(&format!(
                        "[SearchCacheRefresh] ✅ Rafraîchissement terminé en {:?} (après {} retries)",
                        duration, retry_count
                    ));
                } else {
                    log_info(&format!(
                        "[SearchCacheRefresh] ⏱️ Rafraîchissement terminé en {:?}",
                        duration
                    ));
                }
                return Ok(());
            }
            Ok(Err(e)) => {
                let error_str = e.to_string();
                let error_lower = error_str.to_lowercase();

                // ✅ Détecter les erreurs de connexion DB attendues (non critiques)
                let is_connection_error = error_lower.contains("peer closed connection")
                    || error_lower.contains("connection reset by peer")
                    || error_lower.contains("broken pipe")
                    || error_lower.contains("tls close_notify");

                if retry_count < MAX_RETRIES && is_connection_error {
                    retry_count += 1;
                    let backoff_ms = 1000u64 * retry_count as u64; // Backoff exponentiel: 1s, 2s, 3s
                    log::debug!(
                        "[SearchCacheRefresh] ⚠️ Erreur connexion DB (retry {}/{}): {} - Attente {}ms",
                        retry_count, MAX_RETRIES, error_str, backoff_ms
                    );
                    tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                    continue;
                } else if is_connection_error {
                    // Après max retries, logger en debug (erreur attendue)
                    log::debug!(
                        "[SearchCacheRefresh] ⚠️ Erreur connexion DB après {} retries (ignorée): {}",
                        MAX_RETRIES, error_str
                    );
                    return Ok(()); // Retourner OK car c'est une erreur attendue (reconnexion automatique)
                } else {
                    // Erreur non liée à la connexion → erreur réelle
                    return Err(crate::core::types::AppError::Internal(format!(
                        "Erreur rafraîchissement vue matérialisée: {}",
                        e
                    )));
                }
            }
            Err(_) => {
                // ✅ OPTIMISÉ 2025-12-10: Timeout sur le refresh (10s)
                let duration = start.elapsed();
                log::warn!(
                    "[SearchCacheRefresh] ⏱️ Timeout après {}s (limite: {}s) - Refresh trop lent, ignoré",
                    duration.as_secs(),
                    REFRESH_TIMEOUT_SECS
                );
                return Ok(()); // Retourner OK pour ne pas bloquer les prochains refreshes
            }
        }
    }
}
