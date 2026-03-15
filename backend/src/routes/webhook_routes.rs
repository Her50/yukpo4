use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

use crate::{
    controllers::webhook_controller::{
        audio_premium_webhook, cinetpay_webhook, generic_webhook, mtn_money_webhook,
        notchpay_webhook, orange_money_webhook, test_webhook,
    },
    state::AppState,
};

/// Routes pour les webhooks de paiement
pub fn webhook_routes() -> Router<Arc<AppState>> {
    Router::new()
        // ✅ Webhooks agrégateurs (production) — URL: /api/webhooks/cinetpay et /api/webhooks/notchpay
        .route("/api/webhooks/cinetpay", post(cinetpay_webhook))
        .route("/api/webhooks/notchpay", post(notchpay_webhook))
        // Webhooks legacy (providers directs)
        .route("/api/webhooks/orange-money", post(orange_money_webhook))
        .route("/api/webhooks/mtn-money", post(mtn_money_webhook))
        .route("/api/webhooks/generic", post(generic_webhook))
        .route(
            "/api/webhooks/audio-premium/{provider}",
            post(audio_premium_webhook),
        )
        // Endpoint de test (bloqué en production)
        .route("/api/webhooks/test", post(test_webhook))
        // Endpoint de santé
        .route("/api/webhooks/health", get(webhook_health))
}

/// Endpoint de santé pour les webhooks
async fn webhook_health() -> &'static str {
    "Webhooks are healthy"
}
