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
        // ✅ Phase 1 - Optimisation: Intervalle réduit pour traitement plus rapide
        // Intervalle configurable via variable d'environnement (défaut: 5s au lieu de 30s)
        let interval_seconds: i64 = std::env::var("DELIVERY_MATCHING_WORKER_INTERVAL_SECS")
            .unwrap_or_else(|_| "5".to_string()) // ✅ Phase 1: 5s au lieu de 30s
            .parse()
            .unwrap_or(5) as i64;

        // ✅ Phase 1 - Optimisation: Batch size augmenté pour traiter plus de livraisons
        // Taille de batch configurable via variable d'environnement (défaut: 100 au lieu de 10)
        let batch_size: usize = std::env::var("DELIVERY_MATCHING_WORKER_BATCH_SIZE")
            .unwrap_or_else(|_| "100".to_string()) // ✅ Phase 1: 100 au lieu de 10
            .parse()
            .unwrap_or(100);

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
    /// ✅ Phase 1: Nombre de workers parallèles pour traiter plusieurs batches simultanément
    parallel_workers: usize,
}

impl DeliveryMatchingWorker {
    pub fn new(state: Arc<AppState>, config: DeliveryMatchingWorkerConfig) -> Self {
        // ✅ Phase 1: Nombre de workers parallèles configurable (défaut: 10)
        let parallel_workers: usize = std::env::var("DELIVERY_MATCHING_WORKER_PARALLEL")
            .unwrap_or_else(|_| "10".to_string())
            .parse()
            .unwrap_or(10);

        Self {
            service: state.delivery_service.clone(),
            config,
            parallel_workers,
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

    /// ✅ Phase 1: Traitement parallèle de plusieurs batches
    pub async fn run_parallel_batches(&self) -> AppResult<()> {
        use futures::future::join_all;

        let mut handles = Vec::new();

        // Lancer plusieurs workers en parallèle
        for i in 0..self.parallel_workers {
            let service = self.service.clone();
            let batch_size = self.config.batch_size;

            handles.push(tokio::spawn(async move {
                match service.process_matching_backlog(batch_size).await {
                    Ok(processed) => {
                        if processed > 0 {
                            log::info!(
                                "[DeliveryMatchingWorker] Worker {}: {} livraison(s) retraitées",
                                i,
                                processed
                            );
                        }
                        Ok(processed)
                    }
                    Err(err) => {
                        log::error!("[DeliveryMatchingWorker] Worker {}: Erreur: {}", i, err);
                        Err(err)
                    }
                }
            }));
        }

        // Attendre que tous les workers terminent
        let results = join_all(handles).await;
        let mut total_processed = 0;
        let mut errors = 0;

        for result in results {
            match result {
                Ok(Ok(processed)) => total_processed += processed,
                Ok(Err(_)) => errors += 1,
                Err(e) => {
                    log::error!("[DeliveryMatchingWorker] Erreur tokio spawn: {}", e);
                    errors += 1;
                }
            }
        }

        if total_processed > 0 {
            info!(
                "[DeliveryMatchingWorker] Total: {} livraison(s) retraitées en parallèle ({} erreurs)",
                total_processed, errors
            );
        }

        if errors > 0 {
            Err(format!("{} workers ont échoué", errors).into())
        } else {
            Ok(())
        }
    }

    /// Boucle continue (à lancer dans un tokio::spawn).
    pub async fn run_forever(&self) {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(
            self.config.interval_seconds.max(5) as u64,
        ));

        // ✅ Phase 1: Utiliser le traitement parallèle
        let use_parallel = std::env::var("DELIVERY_MATCHING_WORKER_USE_PARALLEL")
            .unwrap_or_else(|_| "true".to_string())
            .parse()
            .unwrap_or(true);

        loop {
            interval.tick().await;

            let result = if use_parallel {
                self.run_parallel_batches().await
            } else {
                self.run_once().await
            };

            if let Err(err) = result {
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
    let _ = tokio::spawn(async move {
        worker.run_forever().await;
    });
}
