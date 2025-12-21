//! Monitoring de santé du pool de connexions PostgreSQL
//! Détecte les problèmes de connexion et log les métriques

use sqlx::PgPool;
use std::time::Duration;
use tokio::time::interval;

/// Démarre un monitor de santé du pool de connexions
/// Vérifie la santé toutes les 60 secondes (configurable via DB_HEALTH_CHECK_INTERVAL_SECS)
/// ✅ OPTIMISÉ 2025-12-20: Réduit la fréquence pour éviter les health checks lents qui polluent les logs
pub async fn start_db_health_monitor(pool: PgPool) {
    let interval_secs: u64 = std::env::var("DB_HEALTH_CHECK_INTERVAL_SECS")
        .unwrap_or_else(|_| "60".to_string())  // ✅ OPTIMISÉ: 60s au lieu de 30s pour réduire le bruit
        .parse()
        .unwrap_or(60);
    let mut interval = interval(Duration::from_secs(interval_secs));

    let _log_interval_secs = interval_secs; // Pour le log dans le spawn (préfixé avec _ pour éviter le warning)
    let _ = tokio::spawn(async move {
        loop {
            interval.tick().await;

            // Récupérer les métriques du pool
            let pool_size = pool.size();
            let idle_connections = pool.num_idle();
            // ✅ CORRECTION: Convertir usize en u32 pour saturating_sub
            let active_connections = pool_size.saturating_sub(idle_connections as u32);

            // ✅ OPTIMISÉ 2025-12-20: Timeout réduit à 2s pour éviter les logs de "slow statement"
            // Le pool utilise déjà test_before_acquire pour tester les connexions avant acquisition
            // Le health check séparé est optionnel et peut être moins fréquent
            let test_result = tokio::time::timeout(
                Duration::from_secs(2),  // ✅ OPTIMISÉ: 2s au lieu de 5s
                sqlx::query("SELECT 1").execute(&pool),
            )
            .await;

            match test_result {
                Ok(Ok(_)) => {
                    log::debug!(
                        "[DB Monitor] ✅ Pool healthy - Size: {}, Active: {}, Idle: {}",
                        pool_size,
                        active_connections,
                        idle_connections
                    );
                }
                Ok(Err(e)) => {
                    log::warn!(
                        "[DB Monitor] ⚠️ Pool unhealthy - Error: {}, Size: {}, Active: {}, Idle: {}",
                        e, pool_size, active_connections, idle_connections
                    );
                }
                Err(_) => {
                    log::warn!(
                        "[DB Monitor] ⚠️ Pool test timeout (5s) - Size: {}, Active: {}, Idle: {}",
                        pool_size,
                        active_connections,
                        idle_connections
                    );
                }
            }

            // Alerter si le pool est saturé (>80% utilisation)
            let utilization_percent = if pool_size > 0 {
                (active_connections as f64 / pool_size as f64) * 100.0
            } else {
                0.0
            };

            if utilization_percent > 80.0 {
                log::warn!(
                    "[DB Monitor] 🔴 Pool saturé: {:.1}% utilisé ({}/{})",
                    utilization_percent,
                    active_connections,
                    pool_size
                );
            }
        }
    });

    log::info!(
        "✅ DB Health Monitor démarré (vérification toutes les {}s)",
        interval_secs
    );
}
