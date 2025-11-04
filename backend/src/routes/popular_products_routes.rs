use axum::{
    routing::get,
    Router,
};
use std::sync::Arc;
use crate::state::AppState;
use crate::controllers::popular_products_controller::get_popular_products;

/// Routes pour les produits populaires
/// Permet au prestataire de voir les produits les plus commercialisés pour ajuster sa stratégie
pub fn popular_products_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // GET /api/products/popular?search=...&category=...&limit=...
        .route("/api/products/popular", get(get_popular_products))
        .with_state(state)
}


