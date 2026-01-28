use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

use crate::{
    controllers::webhook_controller::{
        audio_premium_webhook, generic_webhook, mtn_money_webhook, orange_money_webhook,
        test_webhook,
    },
    state::AppState,
};

/// Routes pour les webhooks de paiement
pub fn webhook_routes() -> Router<Arc<AppState>> {
    Router::new()
        // Webhooks spécifiques aux providers
        .route("/orange-money", post(orange_money_webhook))
        .route("/mtn-money", post(mtn_money_webhook))
        .route("/generic", post(generic_webhook))
        .route("/audio-premium/{provider}", post(audio_premium_webhook))
        // Endpoint de test pour les webhooks
        .route("/test", post(test_webhook))
        // Endpoint de santé spécifique aux webhooks (évite conflit avec /health global)
        .route("/webhooks/health", get(webhook_health))
}

/// Endpoint de santé pour les webhooks
async fn webhook_health() -> &'static str {
    "Webhooks are healthy"
}
