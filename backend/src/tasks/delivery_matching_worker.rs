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
        // Intervalle configurable via variable d'environnement (défaut: 30s)
        let interval_seconds: i64 = std::env::var("DELIVERY_MATCHING_WORKER_INTERVAL_SECS")
            .unwrap_or_else(|_| "30".to_string())
            .parse()
            .unwrap_or(30) as i64;
        
        // Taille de batch configurable via variable d'environnement (défaut: 10)
        let batch_size: usize = std::env::var("DELIVERY_MATCHING_WORKER_BATCH_SIZE")
            .unwrap_or_else(|_| "10".to_string())
            .parse()
            .unwrap_or(10);
        
        Self {
            batch_size,
            interval_seconds,
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
        match self
            .service
            .process_matching_backlog(self.config.batch_size)
            .await
        {
            Ok(processed) => {
                // Logger seulement si des livraisons ont été traitées
                if processed > 0 {
                    info!(
                        "[DeliveryMatchingWorker] {} livraison(s) retraitées",
                        processed
                    );
                } else {
                    log::debug!(
                        "[DeliveryMatchingWorker] Aucune livraison à traiter (batch = {})",
                        self.config.batch_size
                    );
                }
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
