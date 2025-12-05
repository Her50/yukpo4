//! ✅ Phase 3 - Métriques Prometheus pour optimisations Phase 1 & 2
//! Métriques pool DB, rate limiting, partitionnement, cache, WebSocket

use prometheus::{
    register_counter, register_gauge, register_histogram, Counter, Gauge, Histogram, HistogramOpts,
    Opts,
};
use std::sync::Arc;

/// Métriques Prometheus pour optimisations livraison
pub struct DeliveryPrometheusMetrics {
    // ✅ Phase 1: Pool DB
    pub db_pool_size: Gauge,
    pub db_pool_idle: Gauge,
    pub db_pool_active: Gauge,
    pub db_pool_wait_time_seconds: Histogram,

    // ✅ Phase 1: Cache Redis Matching
    pub cache_matching_hits_total: Counter,
    pub cache_matching_misses_total: Counter,
    pub cache_matching_hit_rate: Gauge,

    // ✅ Phase 1: Matching Algorithm
    pub matching_attempts_total: Counter,
    pub matching_duration_seconds: Histogram,
    pub matching_batch_size: Gauge,

    // ✅ Phase 2: Rate Limiting
    pub rate_limit_blocked_total: Counter,
    pub rate_limit_blocked_by_ip_total: Counter,
    pub rate_limit_blocked_by_user_total: Counter,

    // ✅ Phase 2: Partitionnement
    pub deliveries_partition_count: Gauge,
    pub deliveries_archive_size: Gauge,
    pub archive_operations_total: Counter,
    pub archive_deliveries_count: Counter,

    // ✅ Phase 2: WebSocket Optimisé
    pub ws_batch_count_total: Counter,
    pub ws_compression_ratio: Gauge,
    pub ws_messages_batched_total: Counter,
    pub ws_flush_duration_seconds: Histogram,
}

impl DeliveryPrometheusMetrics {
    pub fn new() -> Result<Arc<Self>, prometheus::Error> {
        // Pool DB
        let db_pool_size = register_gauge!(Opts::new(
            "delivery_db_pool_size",
            "Total size of database connection pool"
        )
        .const_label("job", "yukpo-backend"))?;

        let db_pool_idle = register_gauge!(Opts::new(
            "delivery_db_pool_idle",
            "Number of idle connections in database pool"
        )
        .const_label("job", "yukpo-backend"))?;

        let db_pool_active = register_gauge!(Opts::new(
            "delivery_db_pool_active",
            "Number of active connections in database pool"
        )
        .const_label("job", "yukpo-backend"))?;

        let db_pool_wait_time_seconds = register_histogram!(HistogramOpts::new(
            "delivery_db_pool_wait_time_seconds",
            "Time waiting for database connection"
        )
        .const_label("job", "yukpo-backend")
        .buckets(vec![0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 5.0]))?;

        // Cache Redis Matching
        let cache_matching_hits_total = register_counter!(Opts::new(
            "delivery_cache_matching_hits_total",
            "Total cache hits for matching algorithm"
        )
        .const_label("job", "yukpo-backend"))?;

        let cache_matching_misses_total = register_counter!(Opts::new(
            "delivery_cache_matching_misses_total",
            "Total cache misses for matching algorithm"
        )
        .const_label("job", "yukpo-backend"))?;

        let cache_matching_hit_rate = register_gauge!(Opts::new(
            "delivery_cache_matching_hit_rate",
            "Cache hit rate for matching algorithm (0-1)"
        )
        .const_label("job", "yukpo-backend"))?;

        // Matching Algorithm
        let matching_attempts_total = register_counter!(Opts::new(
            "delivery_matching_attempts_total",
            "Total matching attempts"
        )
        .const_label("job", "yukpo-backend"))?;

        let matching_duration_seconds = register_histogram!(HistogramOpts::new(
            "delivery_matching_duration_seconds",
            "Duration of matching algorithm execution"
        )
        .const_label("job", "yukpo-backend")
        .buckets(vec![0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0]))?;

        let matching_batch_size = register_gauge!(Opts::new(
            "delivery_matching_batch_size",
            "Current batch size for matching worker"
        )
        .const_label("job", "yukpo-backend"))?;

        // Rate Limiting
        let rate_limit_blocked_total = register_counter!(Opts::new(
            "delivery_rate_limit_blocked_total",
            "Total requests blocked by rate limiting"
        )
        .const_label("job", "yukpo-backend"))?;

        let rate_limit_blocked_by_ip_total = register_counter!(Opts::new(
            "delivery_rate_limit_blocked_by_ip_total",
            "Total requests blocked by IP rate limiting"
        )
        .const_label("job", "yukpo-backend"))?;

        let rate_limit_blocked_by_user_total = register_counter!(Opts::new(
            "delivery_rate_limit_blocked_by_user_total",
            "Total requests blocked by user rate limiting"
        )
        .const_label("job", "yukpo-backend"))?;

        // Partitionnement
        let deliveries_partition_count = register_gauge!(Opts::new(
            "delivery_partitions_count",
            "Number of partitions for deliveries table"
        )
        .const_label("job", "yukpo-backend"))?;

        let deliveries_archive_size = register_gauge!(Opts::new(
            "delivery_archive_size",
            "Number of deliveries in archive table"
        )
        .const_label("job", "yukpo-backend"))?;

        let archive_operations_total = register_counter!(Opts::new(
            "delivery_archive_operations_total",
            "Total archive operations executed"
        )
        .const_label("job", "yukpo-backend"))?;

        let archive_deliveries_count = register_counter!(Opts::new(
            "delivery_archive_deliveries_count",
            "Total deliveries archived"
        )
        .const_label("job", "yukpo-backend"))?;

        // WebSocket Optimisé
        let ws_batch_count_total = register_counter!(Opts::new(
            "delivery_ws_batch_count_total",
            "Total number of WebSocket batches created"
        )
        .const_label("job", "yukpo-backend"))?;

        let ws_compression_ratio = register_gauge!(Opts::new(
            "delivery_ws_compression_ratio",
            "Compression ratio for WebSocket messages (0-1)"
        )
        .const_label("job", "yukpo-backend"))?;

        let ws_messages_batched_total = register_counter!(Opts::new(
            "delivery_ws_messages_batched_total",
            "Total messages sent in batches"
        )
        .const_label("job", "yukpo-backend"))?;

        let ws_flush_duration_seconds = register_histogram!(HistogramOpts::new(
            "delivery_ws_flush_duration_seconds",
            "Duration of WebSocket batch flush"
        )
        .const_label("job", "yukpo-backend")
        .buckets(vec![0.001, 0.005, 0.01, 0.05, 0.1, 0.5]))?;

        Ok(Arc::new(Self {
            db_pool_size,
            db_pool_idle,
            db_pool_active,
            db_pool_wait_time_seconds,
            cache_matching_hits_total,
            cache_matching_misses_total,
            cache_matching_hit_rate,
            matching_attempts_total,
            matching_duration_seconds,
            matching_batch_size,
            rate_limit_blocked_total,
            rate_limit_blocked_by_ip_total,
            rate_limit_blocked_by_user_total,
            deliveries_partition_count,
            deliveries_archive_size,
            archive_operations_total,
            archive_deliveries_count,
            ws_batch_count_total,
            ws_compression_ratio,
            ws_messages_batched_total,
            ws_flush_duration_seconds,
        }))
    }
}

// Singleton global pour les métriques
lazy_static::lazy_static! {
    pub static ref DELIVERY_PROMETHEUS_METRICS: Result<Arc<DeliveryPrometheusMetrics>, prometheus::Error> =
        DeliveryPrometheusMetrics::new();
}
