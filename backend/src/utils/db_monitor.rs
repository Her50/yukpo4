//! Monitoring de santé du pool de connexions PostgreSQL
//! Détecte les problèmes de connexion et log les métriques

use sqlx::PgPool;
use std::time::Duration;
use tokio::time::interval;

/// Démarre un monitor de santé du pool de connexions
/// Vérifie la santé toutes les 30 secondes (configurable via DB_HEALTH_CHECK_INTERVAL_SECS)
pub async fn start_db_health_monitor(pool: PgPool) {
    let interval_secs: u64 = std::env::var("DB_HEALTH_CHECK_INTERVAL_SECS")
        .unwrap_or_else(|_| "30".to_string())
        .parse()
        .unwrap_or(30);
    let mut interval = interval(Duration::from_secs(interval_secs));
    
    let _log_interval_secs = interval_secs; // Pour le log dans le spawn (préfixé avec _ pour éviter le warning)
    tokio::spawn(async move {
        loop {
            interval.tick().await;
            
            // Récupérer les métriques du pool
            let pool_size = pool.size();
            let idle_connections = pool.num_idle();
            // ✅ CORRECTION: Convertir usize en u32 pour saturating_sub
            let active_connections = pool_size.saturating_sub(idle_connections as u32);
            
            // Tester une connexion avec timeout
            let test_result = tokio::time::timeout(
                Duration::from_secs(5),
                sqlx::query("SELECT 1").execute(&pool)
            ).await;
            
            match test_result {
                Ok(Ok(_)) => {
                    log::debug!(
                        "[DB Monitor] ✅ Pool healthy - Size: {}, Active: {}, Idle: {}",
                        pool_size, active_connections, idle_connections
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
                        pool_size, active_connections, idle_connections
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
                    utilization_percent, active_connections, pool_size
                );
            }
        }
    });
    
    log::info!("✅ DB Health Monitor démarré (vérification toutes les {}s)", interval_secs);
}

