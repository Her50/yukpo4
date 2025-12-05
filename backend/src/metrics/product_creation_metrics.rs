// ✅ NOUVEAU 2025-01-27 : Métriques Prometheus pour création de produits

use prometheus::{
    register_counter, register_gauge, register_histogram, Counter, Gauge, Histogram, HistogramOpts,
    Opts,
};
use std::sync::Arc;

use crate::core::types::AppResult;

/// Métriques pour la création de produits
pub struct ProductCreationMetrics {
    // Compteurs
    pub products_created_total: Counter,
    pub products_created_success: Counter,
    pub products_created_failed: Counter,
    pub products_validation_failed: Counter,

    // Gauges
    pub products_creation_in_progress: Gauge,
    pub products_media_processing: Gauge,

    // Histogrammes (latence)
    pub product_creation_duration: Histogram,
    pub product_media_processing_duration: Histogram,
    pub product_validation_duration: Histogram,
}

impl ProductCreationMetrics {
    pub fn new() -> AppResult<Arc<Self>> {
        // Compteurs
        let products_created_total = register_counter!(Opts::new(
            "products_created_total",
            "Total number of product creation attempts"
        )
        .const_label("job", "yukpo-backend"))?;

        let products_created_success = register_counter!(Opts::new(
            "products_created_success_total",
            "Total number of successful product creations"
        )
        .const_label("job", "yukpo-backend"))?;

        let products_created_failed = register_counter!(Opts::new(
            "products_created_failed_total",
            "Total number of failed product creations"
        )
        .const_label("job", "yukpo-backend"))?;

        let products_validation_failed = register_counter!(Opts::new(
            "products_validation_failed_total",
            "Total number of product validation failures"
        )
        .const_label("job", "yukpo-backend"))?;

        // Gauges
        let products_creation_in_progress = register_gauge!(Opts::new(
            "products_creation_in_progress",
            "Number of product creations currently in progress"
        )
        .const_label("job", "yukpo-backend"))?;

        let products_media_processing = register_gauge!(Opts::new(
            "products_media_processing",
            "Number of products with media currently being processed"
        )
        .const_label("job", "yukpo-backend"))?;

        // Histogrammes
        let product_creation_duration = register_histogram!(HistogramOpts::new(
            "product_creation_duration_seconds",
            "Duration of product creation in seconds"
        )
        .const_label("job", "yukpo-backend")
        .buckets(vec![0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0]))?;

        let product_media_processing_duration = register_histogram!(HistogramOpts::new(
            "product_media_processing_duration_seconds",
            "Duration of product media processing in seconds"
        )
        .const_label("job", "yukpo-backend")
        .buckets(vec![0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0]))?;

        let product_validation_duration = register_histogram!(HistogramOpts::new(
            "product_validation_duration_seconds",
            "Duration of product validation in seconds"
        )
        .const_label("job", "yukpo-backend")
        .buckets(vec![0.01, 0.05, 0.1, 0.5, 1.0]))?;

        log::info!("[ProductCreationMetrics] Métriques enregistrées avec succès");

        Ok(Arc::new(Self {
            products_created_total,
            products_created_success,
            products_created_failed,
            products_validation_failed,
            products_creation_in_progress,
            products_media_processing,
            product_creation_duration,
            product_media_processing_duration,
            product_validation_duration,
        }))
    }
}
