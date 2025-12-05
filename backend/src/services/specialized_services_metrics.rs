// ✅ Phase 7.4: Métriques Prometheus pour services spécialisés

use once_cell::sync::Lazy;
use prometheus::{Histogram, IntCounter, IntGauge, Registry};

static SPECIALIZED_SERVICES_REQUESTS: Lazy<IntCounter> = Lazy::new(|| {
    IntCounter::new(
        "specialized_services_requests_total",
        "Nombre total de requêtes pour services spécialisés",
    )
    .expect("Failed to create metric")
});

static PHARMACY_REQUESTS: Lazy<IntCounter> = Lazy::new(|| {
    IntCounter::new(
        "pharmacy_requests_total",
        "Nombre total de requêtes pour pharmacies",
    )
    .expect("Failed to create metric")
});

static HOSPITAL_REQUESTS: Lazy<IntCounter> = Lazy::new(|| {
    IntCounter::new(
        "hospital_requests_total",
        "Nombre total de requêtes pour hôpitaux",
    )
    .expect("Failed to create metric")
});

static CARPOOL_REQUESTS: Lazy<IntCounter> = Lazy::new(|| {
    IntCounter::new(
        "carpool_requests_total",
        "Nombre total de requêtes pour covoiturages",
    )
    .expect("Failed to create metric")
});

static TAXI_REQUESTS: Lazy<IntCounter> = Lazy::new(|| {
    IntCounter::new("taxi_requests_total", "Nombre total de requêtes pour taxis")
        .expect("Failed to create metric")
});

static SPECIALIZED_SERVICES_LATENCY: Lazy<Histogram> = Lazy::new(|| {
    Histogram::with_opts(
        prometheus::HistogramOpts::new(
            "specialized_services_request_duration_seconds",
            "Durée des requêtes pour services spécialisés en secondes",
        )
        .buckets(vec![
            0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0,
        ]),
    )
    .expect("Failed to create metric")
});

static CACHE_HITS: Lazy<IntCounter> = Lazy::new(|| {
    IntCounter::new(
        "specialized_services_cache_hits_total",
        "Nombre total de cache hits",
    )
    .expect("Failed to create metric")
});

static CACHE_MISSES: Lazy<IntCounter> = Lazy::new(|| {
    IntCounter::new(
        "specialized_services_cache_misses_total",
        "Nombre total de cache misses",
    )
    .expect("Failed to create metric")
});

static RESPONSE_SIZE: Lazy<Histogram> = Lazy::new(|| {
    Histogram::with_opts(
        prometheus::HistogramOpts::new(
            "specialized_services_response_size_bytes",
            "Taille des réponses en bytes",
        )
        .buckets(vec![
            1024.0, 5120.0, 10240.0, 51200.0, 102400.0, 512000.0, 1048576.0,
        ]),
    )
    .expect("Failed to create metric")
});

static ACTIVE_SERVICES: Lazy<IntGauge> = Lazy::new(|| {
    IntGauge::new(
        "specialized_services_active_total",
        "Nombre total de services spécialisés actifs",
    )
    .expect("Failed to create metric")
});

static SPECIALIZED_SERVICES_ERRORS: Lazy<IntCounter> = Lazy::new(|| {
    IntCounter::new(
        "specialized_services_errors_total",
        "Nombre total d'erreurs pour services spécialisés",
    )
    .expect("Failed to create metric")
});

/// Enregistrer toutes les métriques dans le registry Prometheus
/// Note: Les métriques sont automatiquement enregistrées dans le registry global Prometheus
/// via DEFAULT_REGISTRY, donc cette fonction est optionnelle
pub fn register_metrics(registry: &Registry) -> Result<(), prometheus::Error> {
    registry.register(Box::new(SPECIALIZED_SERVICES_REQUESTS.clone()))?;
    registry.register(Box::new(PHARMACY_REQUESTS.clone()))?;
    registry.register(Box::new(HOSPITAL_REQUESTS.clone()))?;
    registry.register(Box::new(CARPOOL_REQUESTS.clone()))?;
    registry.register(Box::new(TAXI_REQUESTS.clone()))?;
    registry.register(Box::new(SPECIALIZED_SERVICES_LATENCY.clone()))?;
    registry.register(Box::new(CACHE_HITS.clone()))?;
    registry.register(Box::new(CACHE_MISSES.clone()))?;
    registry.register(Box::new(RESPONSE_SIZE.clone()))?;
    registry.register(Box::new(ACTIVE_SERVICES.clone()))?;
    registry.register(Box::new(SPECIALIZED_SERVICES_ERRORS.clone()))?;
    Ok(())
}

/// Incrémenter le compteur de requêtes selon le type
pub fn increment_request_counter(service_type: Option<&str>) {
    SPECIALIZED_SERVICES_REQUESTS.inc();
    match service_type {
        Some("pharmacie") => PHARMACY_REQUESTS.inc(),
        Some("hopital") => HOSPITAL_REQUESTS.inc(),
        Some("carpool") | Some("covoiturage") => CARPOOL_REQUESTS.inc(),
        Some("taxi") => TAXI_REQUESTS.inc(),
        _ => {}
    }
}

/// Enregistrer un cache hit
pub fn record_cache_hit() {
    CACHE_HITS.inc();
}

/// Enregistrer un cache miss
pub fn record_cache_miss() {
    CACHE_MISSES.inc();
}

/// Enregistrer la latence d'une requête
pub fn record_latency(duration_seconds: f64) {
    SPECIALIZED_SERVICES_LATENCY.observe(duration_seconds);
}

/// Enregistrer la taille d'une réponse
pub fn record_response_size(size_bytes: f64) {
    RESPONSE_SIZE.observe(size_bytes);
}

/// Enregistrer une erreur
pub fn record_error() {
    SPECIALIZED_SERVICES_ERRORS.inc();
}

/// Mettre à jour le nombre de services actifs
pub fn update_active_services(count: i64) {
    ACTIVE_SERVICES.set(count);
}
