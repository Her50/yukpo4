// Reputation Monitor Worker — Yukpo
// Surveille les mentions et réputation des partenaires/personnalités publiques
// Toutes les 30 minutes : collecte, analyse sentiment, alerte si crise.

use std::sync::Arc;
use tokio::time::{interval, Duration};

use crate::{
    services::reputation_monitoring_service::{load_active_monitor_configs, run_monitoring_cycle},
    state::AppState,
};

pub fn start_reputation_monitor_worker(state: Arc<AppState>) {
    tokio::spawn(async move {
        log::info!("[ReputationMonitor] 🔍 Démarrage du worker de monitoring");

        // Cycle toutes les 30 minutes
        let mut ticker = interval(Duration::from_secs(1800));

        loop {
            ticker.tick().await;

            // Charger toutes les configs actives
            let configs = load_active_monitor_configs(&state.pg).await;

            if configs.is_empty() {
                log::debug!("[ReputationMonitor] Aucune config active — pause");
                continue;
            }

            log::info!(
                "[ReputationMonitor] Cycle de monitoring pour {} partenaires",
                configs.len()
            );

            for config in &configs {
                match run_monitoring_cycle(&state, config).await {
                    Ok(ids) if !ids.is_empty() => {
                        log::info!(
                            "[ReputationMonitor] ✅ {} nouvelles mentions pour user={}",
                            ids.len(),
                            config.user_id
                        );
                    }
                    Ok(_) => {} // Aucune nouvelle mention
                    Err(e) => {
                        log::warn!("[ReputationMonitor] Erreur user={}: {}", config.user_id, e);
                    }
                }
            }
        }
    });
}
