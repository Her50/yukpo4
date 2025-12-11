//! Worker asynchrone dédié au matching temps réel.
//!
//! Ce module est pensé pour être déclenché par un scheduler (cron, tokio task,
//! ou service externe) afin de dépiler la file `delivery_matching_queue` et de
//! relancer les tentatives d'affectation lorsque la recherche automatique n'a
//! pas trouvé de coursier immédiatement.

use std::sync::Arc;
use std::time::{Duration, Instant};

use log::{error, info, warn};
use tokio::sync::RwLock;

use crate::{
    core::types::AppResult, services::delivery_service::DeliveryService, state::AppState,
    utils::db_retry::retry_service_operation,
};

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
        // ✅ OPTIMISÉ 2025-12-09: Intervalle augmenté pour réduire charge DB
        // Intervalle configurable via variable d'environnement (défaut: 10s au lieu de 5s)
        let interval_seconds: i64 = std::env::var("DELIVERY_MATCHING_WORKER_INTERVAL_SECS")
            .unwrap_or_else(|_| "10".to_string()) // ✅ OPTIMISÉ: 10s au lieu de 5s
            .parse()
            .unwrap_or(10) as i64;

        // ✅ OPTIMISÉ 2025-12-09: Batch size réduit pour éviter surcharge
        // Taille de batch configurable via variable d'environnement (défaut: 50 au lieu de 100)
        let batch_size: usize = std::env::var("DELIVERY_MATCHING_WORKER_BATCH_SIZE")
            .unwrap_or_else(|_| "50".to_string()) // ✅ OPTIMISÉ: 50 au lieu de 100
            .parse()
            .unwrap_or(50);

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
    /// ✅ OPTIMISÉ 2025-12-09: Cache pour éviter requêtes vides répétées
    last_empty_result: Arc<RwLock<Option<Instant>>>,
}

impl DeliveryMatchingWorker {
    pub fn new(state: Arc<AppState>, config: DeliveryMatchingWorkerConfig) -> Self {
        // ✅ OPTIMISÉ 2025-12-09: Nombre de workers parallèles réduit (défaut: 3 au lieu de 10)
        let parallel_workers: usize = std::env::var("DELIVERY_MATCHING_WORKER_PARALLEL")
            .unwrap_or_else(|_| "3".to_string()) // ✅ OPTIMISÉ: 3 au lieu de 10
            .parse()
            .unwrap_or(3);

        Self {
            service: state.delivery_service.clone(),
            config,
            parallel_workers,
            last_empty_result: Arc::new(RwLock::new(None)),
        }
    }

    /// Balayage unique de la file.
    pub async fn run_once(&self) -> AppResult<()> {
        // ✅ OPTIMISÉ 2025-12-09: Vérifier le cache avant de requêter
        let cache_ttl_seconds: u64 = std::env::var("DELIVERY_MATCHING_EMPTY_CACHE_TTL_SECS")
            .unwrap_or_else(|_| "30".to_string())
            .parse()
            .unwrap_or(30);

        {
            let last_empty = self.last_empty_result.read().await;
            if let Some(last_time) = *last_empty {
                if last_time.elapsed() < Duration::from_secs(cache_ttl_seconds) {
                    log::debug!(
                        "[DeliveryMatchingWorker] Cache actif: skip requête (dernier résultat vide il y a {:?})",
                        last_time.elapsed()
                    );
                    return Ok(());
                }
            }
        }

        // ✅ CORRIGÉ 2025-12-11: Ajouter retry pour gérer les erreurs de connexion DB
        match retry_service_operation(
            || {
                let service = self.service.clone();
                let batch_size = self.config.batch_size;
                Box::pin(async move { service.process_matching_backlog(batch_size).await })
            },
            3, // 3 tentatives avec backoff exponentiel
        )
        .await
        {
            Ok(processed) => {
                // Logger seulement si des livraisons ont été traitées
                if processed > 0 {
                    info!(
                        "[DeliveryMatchingWorker] {} livraison(s) retraitées",
                        processed
                    );
                    // Réinitialiser le cache si on a traité quelque chose
                    let mut cache = self.last_empty_result.write().await;
                    *cache = None;
                } else {
                    log::debug!(
                        "[DeliveryMatchingWorker] Aucune livraison à traiter (batch = {})",
                        self.config.batch_size
                    );
                    // Mettre à jour le cache avec timestamp actuel
                    let mut cache = self.last_empty_result.write().await;
                    *cache = Some(Instant::now());
                }
                Ok(())
            }
            Err(err) => {
                error!("[DeliveryMatchingWorker] Erreur après retries: {}", err);
                Err(err)
            }
        }
    }

    /// ✅ Phase 1: Traitement parallèle de plusieurs batches
    pub async fn run_parallel_batches(&self) -> AppResult<()> {
        use futures::future::join_all;

        // ✅ OPTIMISÉ 2025-12-09: Vérifier le cache avant de requêter
        let cache_ttl_seconds: u64 = std::env::var("DELIVERY_MATCHING_EMPTY_CACHE_TTL_SECS")
            .unwrap_or_else(|_| "30".to_string())
            .parse()
            .unwrap_or(30);

        {
            let last_empty = self.last_empty_result.read().await;
            if let Some(last_time) = *last_empty {
                if last_time.elapsed() < Duration::from_secs(cache_ttl_seconds) {
                    log::debug!(
                        "[DeliveryMatchingWorker] Cache actif: skip requête parallèle (dernier résultat vide il y a {:?})",
                        last_time.elapsed()
                    );
                    return Ok(());
                }
            }
        }

        let mut handles = Vec::new();

        // Lancer plusieurs workers en parallèle
        for i in 0..self.parallel_workers {
            let service = self.service.clone();
            let batch_size = self.config.batch_size;

            handles.push(tokio::spawn(async move {
                // ✅ CORRIGÉ 2025-12-11: Ajouter retry pour gérer les erreurs de connexion DB
                match retry_service_operation(
                    || {
                        let service = service.clone();
                        let batch_size = batch_size;
                        Box::pin(async move { service.process_matching_backlog(batch_size).await })
                    },
                    3, // 3 tentatives avec backoff exponentiel
                )
                .await
                {
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
                        log::error!(
                            "[DeliveryMatchingWorker] Worker {}: Erreur après retries: {}",
                            i,
                            err
                        );
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

        // ✅ OPTIMISÉ 2025-12-09: Mettre à jour le cache selon le résultat
        {
            let mut cache = self.last_empty_result.write().await;
            if total_processed > 0 {
                // Réinitialiser le cache si on a traité quelque chose
                *cache = None;
            } else {
                // Mettre à jour le cache avec timestamp actuel
                *cache = Some(Instant::now());
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
