// ✅ Métriques Prometheus pour le calcul des coûts de livraison
use prometheus::{
    register_counter, register_gauge, register_histogram, Counter, Gauge, Histogram, HistogramOpts,
    Opts,
};
use std::sync::Arc;

/// Métriques pour le système de calcul des coûts
pub struct DeliveryPricingMetrics {
    // Estimations de coûts
    pub estimate_cost_requests_total: Counter,
    pub estimate_cost_duration_seconds: Histogram,
    pub estimate_cost_errors_total: Counter,

    // Coûts calculés
    pub delivery_cost_calculated_total: Counter,
    pub delivery_cost_amount_cents_total: Counter,
    pub product_price_calculated_total: Counter,
    pub product_price_amount_cents_total: Counter,

    // Billing modes
    pub billing_mode_standard_total: Counter,
    pub billing_mode_merchant_inclusive_total: Counter,
    pub billing_mode_partner_total: Counter,

    // Distances
    pub delivery_distance_km: Histogram,
    pub delivery_distance_short_total: Counter,  // < 1 km
    pub delivery_distance_medium_total: Counter, // 1-10 km
    pub delivery_distance_long_total: Counter,   // > 10 km

    // Promotions appliquées
    pub product_promotion_applied_total: Counter,
    pub product_promotion_discount_cents_total: Counter,

    // Prix négociés
    pub negotiated_price_applied_total: Counter,

    // Réservations paiement
    pub payment_reservation_created_total: Counter,
    pub payment_reservation_amount_cents_total: Counter,
    pub payment_reservation_failed_total: Counter,
    pub payment_reservation_failed_insufficient_balance_total: Counter,
}

impl DeliveryPricingMetrics {
    pub fn new() -> Result<Arc<Self>, prometheus::Error> {
        // Estimations
        let estimate_cost_requests_total = register_counter!(Opts::new(
            "delivery_estimate_cost_requests_total",
            "Total number of cost estimation requests"
        )
        .const_label("job", "yukpo-backend"))?;

        let estimate_cost_duration_seconds = register_histogram!(HistogramOpts::new(
            "delivery_estimate_cost_duration_seconds",
            "Duration of cost estimation requests"
        )
        .const_label("job", "yukpo-backend")
        .buckets(vec![0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0]))?;

        let estimate_cost_errors_total = register_counter!(Opts::new(
            "delivery_estimate_cost_errors_total",
            "Total number of cost estimation errors"
        )
        .const_label("job", "yukpo-backend"))?;

        // Coûts calculés
        let delivery_cost_calculated_total = register_counter!(Opts::new(
            "delivery_cost_calculated_total",
            "Total number of delivery costs calculated"
        )
        .const_label("job", "yukpo-backend"))?;

        let delivery_cost_amount_cents_total = register_counter!(Opts::new(
            "delivery_cost_amount_cents_total",
            "Total amount of delivery costs calculated (in cents)"
        )
        .const_label("job", "yukpo-backend"))?;

        let product_price_calculated_total = register_counter!(Opts::new(
            "delivery_product_price_calculated_total",
            "Total number of product prices calculated"
        )
        .const_label("job", "yukpo-backend"))?;

        let product_price_amount_cents_total = register_counter!(Opts::new(
            "delivery_product_price_amount_cents_total",
            "Total amount of product prices calculated (in cents)"
        )
        .const_label("job", "yukpo-backend"))?;

        // Billing modes
        let billing_mode_standard_total = register_counter!(Opts::new(
            "delivery_billing_mode_standard_total",
            "Total orders with standard billing mode"
        )
        .const_label("job", "yukpo-backend"))?;

        let billing_mode_merchant_inclusive_total = register_counter!(Opts::new(
            "delivery_billing_mode_merchant_inclusive_total",
            "Total orders with merchant_inclusive billing mode"
        )
        .const_label("job", "yukpo-backend"))?;

        let billing_mode_partner_total = register_counter!(Opts::new(
            "delivery_billing_mode_partner_total",
            "Total orders with partner billing mode"
        )
        .const_label("job", "yukpo-backend"))?;

        // Distances
        let delivery_distance_km = register_histogram!(HistogramOpts::new(
            "delivery_distance_km",
            "Distribution of delivery distances in kilometers"
        )
        .const_label("job", "yukpo-backend")
        .buckets(vec![0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 50.0, 100.0]))?;

        let delivery_distance_short_total = register_counter!(Opts::new(
            "delivery_distance_short_total",
            "Total deliveries with distance < 1 km"
        )
        .const_label("job", "yukpo-backend"))?;

        let delivery_distance_medium_total = register_counter!(Opts::new(
            "delivery_distance_medium_total",
            "Total deliveries with distance 1-10 km"
        )
        .const_label("job", "yukpo-backend"))?;

        let delivery_distance_long_total = register_counter!(Opts::new(
            "delivery_distance_long_total",
            "Total deliveries with distance > 10 km"
        )
        .const_label("job", "yukpo-backend"))?;

        // Promotions
        let product_promotion_applied_total = register_counter!(Opts::new(
            "delivery_product_promotion_applied_total",
            "Total number of product promotions applied"
        )
        .const_label("job", "yukpo-backend"))?;

        let product_promotion_discount_cents_total = register_counter!(Opts::new(
            "delivery_product_promotion_discount_cents_total",
            "Total discount amount from promotions (in cents)"
        )
        .const_label("job", "yukpo-backend"))?;

        // Prix négociés
        let negotiated_price_applied_total = register_counter!(Opts::new(
            "delivery_negotiated_price_applied_total",
            "Total number of negotiated prices applied"
        )
        .const_label("job", "yukpo-backend"))?;

        // Réservations paiement
        let payment_reservation_created_total = register_counter!(Opts::new(
            "delivery_payment_reservation_created_total",
            "Total number of payment reservations created"
        )
        .const_label("job", "yukpo-backend"))?;

        let payment_reservation_amount_cents_total = register_counter!(Opts::new(
            "delivery_payment_reservation_amount_cents_total",
            "Total amount of payment reservations (in cents)"
        )
        .const_label("job", "yukpo-backend"))?;

        let payment_reservation_failed_total = register_counter!(Opts::new(
            "delivery_payment_reservation_failed_total",
            "Total number of failed payment reservations"
        )
        .const_label("job", "yukpo-backend"))?;

        let payment_reservation_failed_insufficient_balance_total = register_counter!(Opts::new(
            "delivery_payment_reservation_failed_insufficient_balance_total",
            "Total number of payment reservations failed due to insufficient balance"
        )
        .const_label("job", "yukpo-backend"))?;

        Ok(Arc::new(Self {
            estimate_cost_requests_total,
            estimate_cost_duration_seconds,
            estimate_cost_errors_total,
            delivery_cost_calculated_total,
            delivery_cost_amount_cents_total,
            product_price_calculated_total,
            product_price_amount_cents_total,
            billing_mode_standard_total,
            billing_mode_merchant_inclusive_total,
            billing_mode_partner_total,
            delivery_distance_km,
            delivery_distance_short_total,
            delivery_distance_medium_total,
            delivery_distance_long_total,
            product_promotion_applied_total,
            product_promotion_discount_cents_total,
            negotiated_price_applied_total,
            payment_reservation_created_total,
            payment_reservation_amount_cents_total,
            payment_reservation_failed_total,
            payment_reservation_failed_insufficient_balance_total,
        }))
    }
}

// Singleton global
lazy_static::lazy_static! {
    pub static ref DELIVERY_PRICING_METRICS: Result<Arc<DeliveryPricingMetrics>, prometheus::Error> =
        DeliveryPricingMetrics::new();
}
