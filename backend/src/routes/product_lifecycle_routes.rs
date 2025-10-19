use actix_web::web;
use crate::controllers::product_lifecycle_controller;

pub fn configure_product_lifecycle_routes(cfg: &mut web::ServiceConfig) {
    cfg
        // Récupérer les produits désactivés du prestataire
        .route("/products/inactive", web::get().to(product_lifecycle_controller::get_inactive_products))
        
        // Récupérer le statut des produits d'un service
        .route("/products/{service_id}/status", web::get().to(product_lifecycle_controller::get_products_status))
        
        // Réactiver un seul produit
        .route("/products/reactivate", web::post().to(product_lifecycle_controller::reactivate_product))
        
        // Réactiver plusieurs produits en une fois
        .route("/products/reactivate-multiple", web::post().to(product_lifecycle_controller::reactivate_multiple))
        
        // Obtenir le coût de réactivation
        .route("/products/reactivation-cost", web::get().to(product_lifecycle_controller::get_reactivation_cost));
}

