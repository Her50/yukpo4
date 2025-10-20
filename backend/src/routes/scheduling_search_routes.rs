// Routes pour la recherche avec planifications
use crate::controllers::scheduling_search_controller::{
    get_available_medical_services,
    get_pharmacies_on_duty,
    refresh_pharmacies_on_duty,
    search_with_scheduling,
};
use axum::{
    routing::get,
    Router,
};
use std::sync::Arc;
use sqlx::PgPool;

pub fn scheduling_search_routes() -> Router<Arc<PgPool>> {
    Router::new()
        // Recherche avancée avec planifications
        .route("/api/search/scheduling", get(search_with_scheduling))
        
        // Pharmacies de garde
        .route("/api/search/pharmacies-on-duty", get(get_pharmacies_on_duty))
        
        // Services médicaux disponibles
        .route("/api/search/medical-services", get(get_available_medical_services))
        
        // Rafraîchissement de la vue matérialisée
        .route("/api/admin/refresh-pharmacies", get(refresh_pharmacies_on_duty))
}
