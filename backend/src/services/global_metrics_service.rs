// ✅ NOUVEAU 2025-12-01: Service de métriques globales pour toutes les fonctionnalités
// Extension de SearchMetricsService pour monitoring complet

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

/// Métriques globales de l'application
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GlobalMetrics {
    // Métriques par fonctionnalité
    pub searches: FunctionMetrics,
    pub product_creation: FunctionMetrics,
    pub video_creation: FunctionMetrics,
    pub delivery_ordering: FunctionMetrics,
    pub other_operations: FunctionMetrics,

    // Métriques globales
    pub total_requests: u64,
    pub total_successful: u64,
    pub total_failed: u64,
    pub average_response_time_ms: f64,
    pub cache_hit_rate: f64,

    // Métriques système
    pub db_pool_active: u32,
    pub db_pool_idle: u32,
    pub redis_pool_active: u32,
    pub redis_pool_idle: u32,
}

/// Métriques par fonctionnalité
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FunctionMetrics {
    pub total: u64,
    pub successful: u64,
    pub failed: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub average_time_ms: f64,
    pub last_24h: u64,
    pub last_hour: u64,
}

/// Service de métriques globales
pub struct GlobalMetricsService {
    metrics: Arc<RwLock<GlobalMetrics>>,
    operation_history: Arc<RwLock<Vec<(String, String, Instant)>>>, // (function, operation_id, time)
    response_times: Arc<RwLock<Vec<Duration>>>,
}

impl GlobalMetricsService {
    pub fn new() -> Self {
        Self {
            metrics: Arc::new(RwLock::new(GlobalMetrics::default())),
            operation_history: Arc::new(RwLock::new(Vec::new())),
            response_times: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Enregistre une opération réussie
    pub async fn record_operation(
        &self,
        function: &str, // "search", "product_creation", "video_creation", "delivery_ordering"
        operation_id: &str,
        response_time: Duration,
        cache_hit: bool,
    ) {
        let mut metrics = self.metrics.write().await;

        // Mettre à jour les métriques globales
        metrics.total_requests += 1;
        metrics.total_successful += 1;

        // Mettre à jour les métriques de la fonctionnalité
        let function_metrics = match function {
            "search" => &mut metrics.searches,
            "product_creation" => &mut metrics.product_creation,
            "video_creation" => &mut metrics.video_creation,
            "delivery_ordering" => &mut metrics.delivery_ordering,
            _ => &mut metrics.other_operations,
        };

        function_metrics.total += 1;
        function_metrics.successful += 1;

        if cache_hit {
            function_metrics.cache_hits += 1;
            metrics.cache_hit_rate = self.calculate_cache_hit_rate().await;
        } else {
            function_metrics.cache_misses += 1;
        }

        // Enregistrer l'historique
        let mut history = self.operation_history.write().await;
        history.push((
            function.to_string(),
            operation_id.to_string(),
            Instant::now(),
        ));

        // Nettoyer l'historique (garder seulement 24h)
        let cutoff = Instant::now() - Duration::from_secs(86400);
        history.retain(|(_, _, time)| *time > cutoff);

        // Enregistrer le temps de réponse
        let mut response_times = self.response_times.write().await;
        response_times.push(response_time);
        if response_times.len() > 2000 {
            response_times.remove(0);
        }

        // Calculer les moyennes
        if !response_times.is_empty() {
            let total: Duration = response_times.iter().sum();
            metrics.average_response_time_ms =
                total.as_millis() as f64 / response_times.len() as f64;
        }

        // Calculer moyenne par fonctionnalité (simplifié - utiliser response_time actuel)
        // Note: Pour une moyenne précise, il faudrait stocker les temps par fonctionnalité
        // Pour l'instant, on utilise une approximation
        let function_count = history
            .iter()
            .filter(|(f, _, time)| *f == function && *time > cutoff)
            .count();

        if function_count > 0 {
            // Approximation: utiliser le temps actuel pour mettre à jour la moyenne
            let current_avg = function_metrics.average_time_ms;
            let new_avg = if current_avg == 0.0 {
                response_time.as_millis() as f64
            } else {
                (current_avg * (function_count - 1) as f64 + response_time.as_millis() as f64)
                    / function_count as f64
            };
            function_metrics.average_time_ms = new_avg;
        } else {
            function_metrics.average_time_ms = response_time.as_millis() as f64;
        }

        // Calculer dernières 24h et dernière heure
        let now = Instant::now();
        function_metrics.last_24h = history
            .iter()
            .filter(|(f, _, time)| {
                *f == function && now.duration_since(*time) < Duration::from_secs(86400)
            })
            .count() as u64;
        function_metrics.last_hour = history
            .iter()
            .filter(|(f, _, time)| {
                *f == function && now.duration_since(*time) < Duration::from_secs(3600)
            })
            .count() as u64;
    }

    /// Enregistre une opération échouée
    pub async fn record_failed_operation(&self, function: &str) {
        let mut metrics = self.metrics.write().await;
        metrics.total_requests += 1;
        metrics.total_failed += 1;

        let function_metrics = match function {
            "search" => &mut metrics.searches,
            "product_creation" => &mut metrics.product_creation,
            "video_creation" => &mut metrics.video_creation,
            "delivery_ordering" => &mut metrics.delivery_ordering,
            _ => &mut metrics.other_operations,
        };

        function_metrics.total += 1;
        function_metrics.failed += 1;
    }

    /// Met à jour les informations des pools
    pub async fn update_pool_info(
        &self,
        db_active: u32,
        db_idle: u32,
        redis_active: u32,
        redis_idle: u32,
    ) {
        let mut metrics = self.metrics.write().await;
        metrics.db_pool_active = db_active;
        metrics.db_pool_idle = db_idle;
        metrics.redis_pool_active = redis_active;
        metrics.redis_pool_idle = redis_idle;
    }

    /// Récupère les métriques actuelles
    pub async fn get_metrics(&self) -> GlobalMetrics {
        self.metrics.read().await.clone()
    }

    /// Calcule le taux de cache hit global
    async fn calculate_cache_hit_rate(&self) -> f64 {
        let metrics = self.metrics.read().await;
        let total_hits = metrics.searches.cache_hits
            + metrics.product_creation.cache_hits
            + metrics.video_creation.cache_hits
            + metrics.delivery_ordering.cache_hits
            + metrics.other_operations.cache_hits;
        let total_misses = metrics.searches.cache_misses
            + metrics.product_creation.cache_misses
            + metrics.video_creation.cache_misses
            + metrics.delivery_ordering.cache_misses
            + metrics.other_operations.cache_misses;

        let total = total_hits + total_misses;
        if total == 0 {
            return 0.0;
        }
        (total_hits as f64 / total as f64) * 100.0
    }

    /// Récupère le taux de cache hit
    pub async fn cache_hit_rate(&self) -> f64 {
        self.calculate_cache_hit_rate().await
    }
}

impl Default for GlobalMetricsService {
    fn default() -> Self {
        Self::new()
    }
}
