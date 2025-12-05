// ✅ NOUVEAU 2025-01-29: Routes webhook KYC
use crate::state::AppState;
use axum::Router;
use std::sync::Arc;

pub fn kyc_webhook_routes(_state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // TODO: Implémenter les routes webhook KYC
}

