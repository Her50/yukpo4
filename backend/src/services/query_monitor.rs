// Service de monitoring avancé des requêtes SQL
// Détecte les requêtes lentes et collecte des métriques de performance

use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

/// Métriques d'une requête SQL
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryMetrics {
    pub query_hash: String,
    pub query_summary: String,
    pub execution_count: u64,
    pub total_duration_ms: f64,
    pub avg_duration_ms: f64,
    pub min_duration_ms: f64,
    pub max_duration_ms: f64,
    pub last_executed: chrono::DateTime<chrono::Utc>,
    pub slow_count: u64, // Nombre de fois où la requête a été lente
}

/// Statistiques globales de performance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceStats {
    pub total_queries: u64,
    pub slow_queries: u64,
    pub avg_query_time_ms: f64,
    pub slowest_query: Option<QueryMetrics>,
    pub queries_by_endpoint: HashMap<String, u64>,
    pub pool_stats: PoolStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolStats {
    pub size: u32,
    pub idle: u32,
    pub active: u32,
}

/// Service de monitoring des requêtes
pub struct QueryMonitor {
    metrics: Arc<RwLock<HashMap<String, QueryMetrics>>>,
    slow_query_threshold_ms: u64,
    #[allow(dead_code)] // Pour usage futur (stats du pool)
    pool: Arc<PgPool>,
}

impl QueryMonitor {
    pub fn new(pool: Arc<PgPool>) -> Self {
        let slow_query_threshold = std::env::var("DB_SLOW_QUERY_THRESHOLD")
            .unwrap_or_else(|_| "1000".to_string())
            .parse()
            .unwrap_or(1000);

        Self {
            metrics: Arc::new(RwLock::new(HashMap::new())),
            slow_query_threshold_ms: slow_query_threshold,
            pool,
        }
    }

    /// Enregistrer une requête exécutée
    pub async fn record_query(
        &self,
        query_summary: &str,
        duration: Duration,
        endpoint: Option<&str>,
    ) {
        let duration_ms = duration.as_millis() as f64;
        let query_hash = self.hash_query(query_summary);

        let mut metrics_map = self.metrics.write().await;
        let metrics = metrics_map
            .entry(query_hash.clone())
            .or_insert_with(|| QueryMetrics {
                query_hash: query_hash.clone(),
                query_summary: query_summary.to_string(),
                execution_count: 0,
                total_duration_ms: 0.0,
                avg_duration_ms: 0.0,
                min_duration_ms: f64::MAX,
                max_duration_ms: 0.0,
                last_executed: chrono::Utc::now(),
                slow_count: 0,
            });

        metrics.execution_count += 1;
        metrics.total_duration_ms += duration_ms;
        metrics.avg_duration_ms = metrics.total_duration_ms / metrics.execution_count as f64;
        metrics.min_duration_ms = metrics.min_duration_ms.min(duration_ms);
        metrics.max_duration_ms = metrics.max_duration_ms.max(duration_ms);
        metrics.last_executed = chrono::Utc::now();

        // Détecter requête lente
        if duration_ms >= self.slow_query_threshold_ms as f64 {
            metrics.slow_count += 1;
            log::warn!(
                "🐌 [SlowQuery] {}ms - {} (endpoint: {:?})",
                duration_ms,
                query_summary.chars().take(100).collect::<String>(),
                endpoint
            );

            // Log le plan d'exécution pour les requêtes très lentes (>3s)
            if duration_ms >= 3000.0 {
                self.log_explain_analyze(query_summary).await;
            }
        }
    }

    /// Obtenir les statistiques de performance
    pub async fn get_stats(&self) -> PerformanceStats {
        let metrics_map = self.metrics.read().await;

        let mut total_queries = 0u64;
        let mut slow_queries = 0u64;
        let mut total_duration = 0.0;
        let mut slowest_query: Option<QueryMetrics> = None;
        let queries_by_endpoint = HashMap::new();

        for metrics in metrics_map.values() {
            total_queries += metrics.execution_count;
            slow_queries += metrics.slow_count;
            total_duration += metrics.total_duration_ms;

            if let Some(ref slowest) = slowest_query {
                if metrics.max_duration_ms > slowest.max_duration_ms {
                    slowest_query = Some(metrics.clone());
                }
            } else {
                slowest_query = Some(metrics.clone());
            }
        }

        let avg_query_time = if total_queries > 0 {
            total_duration / total_queries as f64
        } else {
            0.0
        };

        // Pool stats (approximatif)
        let pool_stats = PoolStats {
            size: 30, // Valeur par défaut, devrait être récupérée du pool
            idle: 0,
            active: 0,
        };

        PerformanceStats {
            total_queries,
            slow_queries,
            avg_query_time_ms: avg_query_time,
            slowest_query,
            queries_by_endpoint,
            pool_stats,
        }
    }

    /// Obtenir les requêtes les plus lentes
    pub async fn get_slow_queries(&self, limit: usize) -> Vec<QueryMetrics> {
        let metrics_map = self.metrics.read().await;
        let mut queries: Vec<QueryMetrics> = metrics_map
            .values()
            .filter(|m| m.slow_count > 0)
            .cloned()
            .collect();

        queries.sort_by(|a, b| {
            b.max_duration_ms
                .partial_cmp(&a.max_duration_ms)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        queries.truncate(limit);
        queries
    }

    /// Hash d'une requête pour l'identifier
    fn hash_query(&self, query: &str) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        // Normaliser la requête (enlever les valeurs pour avoir un hash stable)
        let normalized = query
            .replace(r"\$\d+", "$N") // Remplacer $1, $2, etc. par $N
            .replace(r"'\d+'", "'N'") // Remplacer les nombres entre quotes
            .to_lowercase();
        normalized.hash(&mut hasher);
        format!("{:x}", hasher.finish())
    }

    /// Logger le plan d'exécution avec EXPLAIN ANALYZE
    async fn log_explain_analyze(&self, query: &str) {
        // Extraire la requête principale (avant le premier ;)
        let main_query = query.split(';').next().unwrap_or(query);

        // Ne pas exécuter EXPLAIN ANALYZE sur les requêtes qui modifient les données
        if main_query.trim_start().to_uppercase().starts_with("INSERT")
            || main_query.trim_start().to_uppercase().starts_with("UPDATE")
            || main_query.trim_start().to_uppercase().starts_with("DELETE")
        {
            return;
        }

        // Limiter la longueur de la requête pour EXPLAIN
        if main_query.len() > 5000 {
            log::warn!(
                "[QueryMonitor] Requête trop longue pour EXPLAIN ANALYZE ({} caractères)",
                main_query.len()
            );
            return;
        }

        // Essayer d'exécuter EXPLAIN ANALYZE
        // Note: On ne peut pas exécuter directement car on n'a pas les paramètres bindés
        // On log juste un avertissement
        log::warn!(
            "[QueryMonitor] ⚠️ Requête très lente détectée (>3s). Considérez analyser avec EXPLAIN ANALYZE:\n{}",
            main_query.chars().take(500).collect::<String>()
        );
    }

    /// Réinitialiser les métriques
    pub async fn reset_metrics(&self) {
        let mut metrics_map = self.metrics.write().await;
        metrics_map.clear();
        log::info!("[QueryMonitor] Métriques réinitialisées");
    }
}

/// Wrapper pour mesurer le temps d'exécution d'une requête
pub struct QueryTimer {
    monitor: Arc<QueryMonitor>,
    query_summary: String,
    endpoint: Option<String>,
    start: Instant,
}

impl QueryTimer {
    pub fn new(
        monitor: Arc<QueryMonitor>,
        query_summary: String,
        endpoint: Option<String>,
    ) -> Self {
        Self {
            monitor,
            query_summary,
            endpoint,
            start: Instant::now(),
        }
    }
}

impl Drop for QueryTimer {
    fn drop(&mut self) {
        let duration = self.start.elapsed();
        let monitor = self.monitor.clone();
        let query_summary = self.query_summary.clone();
        let endpoint = self.endpoint.clone();

        // Enregistrer de manière asynchrone
        tokio::spawn(async move {
            monitor
                .record_query(&query_summary, duration, endpoint.as_deref())
                .await;
        });
    }
}
