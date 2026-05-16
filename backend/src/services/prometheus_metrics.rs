// ✅ Phase 4: Métriques Prometheus pour monitoring

use std::sync::Arc;

use log::info;
use prometheus::{
    register_counter, register_gauge, register_histogram, Counter, Gauge, Histogram, HistogramOpts,
    Opts,
};

pub struct VideoMetrics {
    // ✅ Compteurs
    pub jobs_queued: Counter,
    pub jobs_processed: Counter,
    pub jobs_failed: Counter,
    pub jobs_completed: Counter,

    // ✅ Gauges
    pub queue_length: Gauge,
    pub active_workers: Gauge,
    pub cache_hits: Gauge,
    pub cache_misses: Gauge,

    // ✅ Histogrammes (latence)
    pub job_duration: Histogram,
    pub api_request_duration: Histogram,
    pub render_duration: Histogram,
}

impl VideoMetrics {
    pub fn new() -> AppResult<Arc<Self>> {
        // ✅ Compteurs avec label job="yukpo-backend"
        let jobs_queued = register_counter!(Opts::new(
            "video_jobs_queued_total",
            "Total number of video jobs queued"
        )
        .const_label("job", "yukpo-backend"))?;

        let jobs_processed = register_counter!(Opts::new(
            "video_jobs_processed_total",
            "Total number of video jobs processed"
        )
        .const_label("job", "yukpo-backend"))?;

        let jobs_failed = register_counter!(Opts::new(
            "video_jobs_failed_total",
            "Total number of video jobs failed"
        )
        .const_label("job", "yukpo-backend"))?;

        let jobs_completed = register_counter!(Opts::new(
            "video_jobs_completed_total",
            "Total number of video jobs completed"
        )
        .const_label("job", "yukpo-backend"))?;

        // ✅ Gauges avec label job="yukpo-backend"
        let queue_length = register_gauge!(Opts::new(
            "video_queue_length",
            "Current length of video job queue"
        )
        .const_label("job", "yukpo-backend"))?;

        let active_workers = register_gauge!(Opts::new(
            "video_active_workers",
            "Number of active video processing workers"
        )
        .const_label("job", "yukpo-backend"))?;

        let cache_hits = register_gauge!(Opts::new("video_cache_hits", "Number of cache hits")
            .const_label("job", "yukpo-backend"))?;

        let cache_misses =
            register_gauge!(Opts::new("video_cache_misses", "Number of cache misses")
                .const_label("job", "yukpo-backend"))?;

        // ✅ Histogrammes avec label job="yukpo-backend"
        let job_duration = register_histogram!(HistogramOpts::new(
            "video_job_duration_seconds",
            "Duration of video job processing in seconds"
        )
        .const_label("job", "yukpo-backend")
        .buckets(vec![1.0, 5.0, 10.0, 30.0, 60.0, 300.0, 600.0]))?;

        let api_request_duration = register_histogram!(HistogramOpts::new(
            "video_api_request_duration_seconds",
            "Duration of API requests in seconds"
        )
        .const_label("job", "yukpo-backend")
        .buckets(vec![0.1, 0.5, 1.0, 2.0, 5.0, 10.0]))?;

        let render_duration = register_histogram!(HistogramOpts::new(
            "video_render_duration_seconds",
            "Duration of video rendering in seconds"
        )
        .const_label("job", "yukpo-backend")
        .buckets(vec![10.0, 30.0, 60.0, 120.0, 300.0, 600.0]))?;

        info!("[Prometheus] Metrics registered successfully");

        Ok(Arc::new(Self {
            jobs_queued,
            jobs_processed,
            jobs_failed,
            jobs_completed,
            queue_length,
            active_workers,
            cache_hits,
            cache_misses,
            job_duration,
            api_request_duration,
            render_duration,
        }))
    }
}

use crate::core::types::AppResult;

// ✅ Fonction pour exposer les métriques au format Prometheus
pub fn render_metrics() -> String {
    use prometheus::Encoder;
    let encoder = prometheus::TextEncoder::new();
    let metric_families = prometheus::gather();
    let mut buffer = Vec::new();
    encoder.encode(&metric_families, &mut buffer).unwrap();
    let mut out = String::from_utf8(buffer).unwrap_or_default();

    // ✅ 2026-05-16 — Append des compteurs cache_service.rs (Bourse + global).
    // Non enregistrés dans le registry Prometheus historique pour éviter de
    // mélanger des AtomicU64 process-local avec des IntCounter. On les expose
    // au format texte directement.
    let (hits, misses, errors) = crate::services::cache_service::cache_metrics_snapshot();
    out.push_str("# HELP yukpo_cache_hits_total Cache hits (CacheService).\n");
    out.push_str("# TYPE yukpo_cache_hits_total counter\n");
    out.push_str(&format!("yukpo_cache_hits_total {}\n", hits));
    out.push_str("# HELP yukpo_cache_misses_total Cache misses (CacheService).\n");
    out.push_str("# TYPE yukpo_cache_misses_total counter\n");
    out.push_str(&format!("yukpo_cache_misses_total {}\n", misses));
    out.push_str("# HELP yukpo_cache_redis_errors_total Erreurs Redis (CacheService).\n");
    out.push_str("# TYPE yukpo_cache_redis_errors_total counter\n");
    out.push_str(&format!("yukpo_cache_redis_errors_total {}\n", errors));

    // Hit-rate (calcul instantané) — utile pour alertes Grafana.
    let total = hits.saturating_add(misses) as f64;
    let hit_ratio = if total > 0.0 {
        hits as f64 / total
    } else {
        0.0
    };
    out.push_str("# HELP yukpo_cache_hit_ratio Ratio hits / (hits + misses).\n");
    out.push_str("# TYPE yukpo_cache_hit_ratio gauge\n");
    out.push_str(&format!("yukpo_cache_hit_ratio {:.4}\n", hit_ratio));

    out
}
