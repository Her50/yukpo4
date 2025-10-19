use std::sync::Arc;
use axum::{
    Router,
    routing::{get, post},
};
use crate::controllers::product_lifecycle_controller;
use crate::state::AppState;

pub fn product_lifecycle_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // Récupérer les produits désactivés du prestataire
        .route("/products/inactive", get(product_lifecycle_controller::get_inactive_products))
        
        // Récupérer le statut des produits d'un service
        .route("/products/:service_id/status", get(product_lifecycle_controller::get_products_status))
        
        // Réactiver un seul produit
        .route("/products/reactivate", post(product_lifecycle_controller::reactivate_product))
        
        // Réactiver plusieurs produits en une fois
        .route("/products/reactivate-multiple", post(product_lifecycle_controller::reactivate_multiple))
        
        // Obtenir le coût de réactivation
        .route("/products/reactivation-cost", get(product_lifecycle_controller::get_reactivation_cost))
        
        .with_state(state)
}
