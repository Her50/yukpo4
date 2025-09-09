use std::sync::Arc;
use axum::{
    routing::{post, get},
    Router,
};

use crate::{
    controllers::payment_controller::{initiate_payment, confirm_payment, get_payment_history},
    middlewares::jwt::jwt_auth,
    state::AppState,
};

/// Routes pour la gestion des paiements et recharge de tokens
pub fn payment_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::<Arc<AppState>>::new()
        // Initier un paiement
        .route("/api/payments/initiate", post(initiate_payment))
        // Confirmer un paiement
        .route("/api/payments/confirm", post(confirm_payment))
        // Historique des paiements
        .route("/api/payments/history", get(get_payment_history))
        // Middleware d'authentification JWT obligatoire
        .layer(axum::middleware::from_fn(jwt_auth))
        .with_state(state)
}
