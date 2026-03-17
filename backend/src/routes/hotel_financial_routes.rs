// ✅ NOUVEAU: Routes financières pour les partenaires hôtel/meublé
// Date: 2026-03-17

use crate::controllers::hotel_financial_controller;
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;
use axum::{middleware, routing::get, Router};
use std::sync::Arc;

pub fn hotel_financial_routes(_state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // Tableau de bord financier
        .route(
            "/api/hotel/financial/dashboard",
            get(hotel_financial_controller::get_financial_dashboard),
        )
        // Résumé financier rapide
        .route(
            "/api/hotel/financial/summary",
            get(hotel_financial_controller::get_financial_summary),
        )
        // Historique des transactions
        .route(
            "/api/hotel/financial/transactions",
            get(hotel_financial_controller::get_transaction_history),
        )
        // Export CSV
        .route(
            "/api/hotel/financial/export",
            get(hotel_financial_controller::export_financial_data),
        )
        // Middleware JWT pour toutes les routes
        .layer(middleware::from_fn(jwt_auth))
}
