// ✅ NOUVEAU 2025-12-01: Service de métriques de recherche pour monitoring
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

/// Métriques de recherche
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SearchMetrics {
    pub total_searches: u64,
    pub successful_searches: u64,
    pub failed_searches: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub average_response_time_ms: f64,
    pub average_db_time_ms: f64,
    pub searches_by_type: HashMap<String, u64>,
    pub searches_by_category: HashMap<String, u64>,
    pub top_queries: Vec<(String, u64)>,
    pub last_24h_searches: u64,
    pub last_hour_searches: u64,
    pub pool_connections_active: u32,
    pub pool_connections_idle: u32,
}

/// Service de métriques de recherche
pub struct SearchMetricsService {
    metrics: Arc<RwLock<SearchMetrics>>,
    query_history: Arc<RwLock<Vec<(String, Instant)>>>,
    response_times: Arc<RwLock<Vec<Duration>>>,
    db_times: Arc<RwLock<Vec<Duration>>>,
}

impl SearchMetricsService {
    pub fn new() -> Self {
        Self {
            metrics: Arc::new(RwLock::new(SearchMetrics::default())),
            query_history: Arc::new(RwLock::new(Vec::new())),
            response_times: Arc::new(RwLock::new(Vec::new())),
            db_times: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Enregistre une recherche réussie
    pub async fn record_search(
        &self,
        query: &str,
        specialized_type: Option<&str>,
        category: Option<&str>,
        response_time: Duration,
        db_time: Duration,
        cache_hit: bool,
    ) {
        let mut metrics = self.metrics.write().await;
        metrics.total_searches += 1;
        metrics.successful_searches += 1;

        if cache_hit {
            metrics.cache_hits += 1;
        } else {
            metrics.cache_misses += 1;
        }

        // Enregistrer le type de recherche
        let search_type = specialized_type.unwrap_or("general").to_string();
        *metrics.searches_by_type.entry(search_type).or_insert(0) += 1;

        // Enregistrer la catégorie
        if let Some(cat) = category {
            *metrics
                .searches_by_category
                .entry(cat.to_string())
                .or_insert(0) += 1;
        }

        // Enregistrer la requête
        let mut history = self.query_history.write().await;
        history.push((query.to_lowercase().trim().to_string(), Instant::now()));

        // Nettoyer l'historique (garder seulement 24h)
        let cutoff = Instant::now() - Duration::from_secs(86400);
        history.retain(|(_, time)| *time > cutoff);

        // Enregistrer les temps de réponse
        let mut response_times = self.response_times.write().await;
        response_times.push(response_time);
        if response_times.len() > 1000 {
            response_times.remove(0);
        }

        let mut db_times = self.db_times.write().await;
        db_times.push(db_time);
        if db_times.len() > 1000 {
            db_times.remove(0);
        }

        // Calculer les moyennes
        if !response_times.is_empty() {
            let total: Duration = response_times.iter().sum();
            metrics.average_response_time_ms =
                total.as_millis() as f64 / response_times.len() as f64;
        }

        if !db_times.is_empty() {
            let total: Duration = db_times.iter().sum();
            metrics.average_db_time_ms = total.as_millis() as f64 / db_times.len() as f64;
        }

        // Calculer les recherches dernières 24h et dernière heure
        let now = Instant::now();
        metrics.last_24h_searches = history
            .iter()
            .filter(|(_, time)| now.duration_since(*time) < Duration::from_secs(86400))
            .count() as u64;
        metrics.last_hour_searches = history
            .iter()
            .filter(|(_, time)| now.duration_since(*time) < Duration::from_secs(3600))
            .count() as u64;

        // Top 10 requêtes les plus fréquentes
        let mut query_counts: HashMap<String, u64> = HashMap::new();
        for (q, _) in history.iter() {
            *query_counts.entry(q.clone()).or_insert(0) += 1;
        }
        let mut top_queries: Vec<(String, u64)> = query_counts.into_iter().collect();
        top_queries.sort_by(|a, b| b.1.cmp(&a.1));
        metrics.top_queries = top_queries.into_iter().take(10).collect();
    }

    /// Enregistre une recherche échouée
    pub async fn record_failed_search(&self) {
        let mut metrics = self.metrics.write().await;
        metrics.total_searches += 1;
        metrics.failed_searches += 1;
    }

    /// Met à jour les informations du pool de connexions
    pub async fn update_pool_info(&self, active: u32, idle: u32) {
        let mut metrics = self.metrics.write().await;
        metrics.pool_connections_active = active;
        metrics.pool_connections_idle = idle;
    }

    /// Récupère les métriques actuelles
    pub async fn get_metrics(&self) -> SearchMetrics {
        self.metrics.read().await.clone()
    }

    /// Calcule le taux de cache hit
    pub async fn cache_hit_rate(&self) -> f64 {
        let metrics = self.metrics.read().await;
        let total = metrics.cache_hits + metrics.cache_misses;
        if total == 0 {
            return 0.0;
        }
        (metrics.cache_hits as f64 / total as f64) * 100.0
    }
}

impl Default for SearchMetricsService {
    fn default() -> Self {
        Self::new()
    }
}
