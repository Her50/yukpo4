//! Worker asynchrone dédié au matching temps réel.
//!
//! Ce module est pensé pour être déclenché par un scheduler (cron, tokio task,
//! ou service externe) afin de dépiler la file `delivery_matching_queue` et de
//! relancer les tentatives d'affectation lorsque la recherche automatique n'a
//! pas trouvé de coursier immédiatement.

use std::sync::Arc;

use log::{error, info, warn};

use crate::{core::types::AppResult, services::delivery_service::DeliveryService, state::AppState};

/// Paramétrage simple pour le worker.
#[derive(Debug, Clone)]
pub struct DeliveryMatchingWorkerConfig {
    /// Nombre maximum d'éléments dépilés par itération.
    pub batch_size: usize,
    /// Intervalle entre deux balayages (informations utiles pour un scheduler externe).
    pub interval_seconds: i64,
}

impl Default for DeliveryMatchingWorkerConfig {
    fn default() -> Self {
        Self {
            batch_size: 10,
            interval_seconds: 30,
        }
    }
}

/// Worker principal. À brancher sur un cron interne.
pub struct DeliveryMatchingWorker {
    service: Arc<DeliveryService>,
    config: DeliveryMatchingWorkerConfig,
}

impl DeliveryMatchingWorker {
    pub fn new(state: Arc<AppState>, config: DeliveryMatchingWorkerConfig) -> Self {
        Self {
            service: state.delivery_service.clone(),
            config,
        }
    }

    /// Balayage unique de la file.
    pub async fn run_once(&self) -> AppResult<()> {
        info!(
            "[DeliveryMatchingWorker] Démarrage du lot (batch = {})",
            self.config.batch_size
        );
        match self
            .service
            .process_matching_backlog(self.config.batch_size)
            .await
        {
            Ok(processed) => {
                info!(
                    "[DeliveryMatchingWorker] Lot terminé, {} livraison(s) retraitées",
                    processed
                );
                Ok(())
            }
            Err(err) => {
                error!(
                    "[DeliveryMatchingWorker] Erreur pendant le traitement: {}",
                    err
                );
                Err(err)
            }
        }
    }

    /// Boucle continue (à lancer dans un tokio::spawn).
    pub async fn run_forever(&self) {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(
            self.config.interval_seconds.max(5) as u64,
        ));

        loop {
            interval.tick().await;
            if let Err(err) = self.run_once().await {
                warn!(
                    "[DeliveryMatchingWorker] Itération échouée: {}. Nouvelle tentative programmée.",
                    err
                );
            }
        }
    }
}

pub fn start_delivery_matching_worker(state: Arc<AppState>) {
    let config = DeliveryMatchingWorkerConfig::default();
    let worker = DeliveryMatchingWorker::new(state, config);
    tokio::spawn(async move {
        worker.run_forever().await;
    });
}
