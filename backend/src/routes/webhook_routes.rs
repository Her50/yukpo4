use axum::{
    routing::{post, get},
    Router,
};
use std::sync::Arc;

use crate::{
    controllers::webhook_controller::{
        orange_money_webhook,
        mtn_money_webhook,
        generic_webhook,
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
        
        // Endpoint de test pour les webhooks
        .route("/test", post(test_webhook))
        
        // Endpoint de santé pour vérifier que les webhooks sont opérationnels
        .route("/health", get(webhook_health))
}

/// Endpoint de santé pour les webhooks
async fn webhook_health() -> &'static str {
    "Webhooks are healthy"
}

