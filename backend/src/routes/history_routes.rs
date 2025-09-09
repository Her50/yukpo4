use crate::controllers::history_controller;
use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

use crate::state::AppState;

/// ??? Routes pour l'historique et les consultations
pub fn history_routes() -> Router<Arc<AppState>> {
    Router::new()
        // Enregistrer une consultation
        .route("/consultation/{user_id}/{service_id}", post(history_controller::enregistrer_consultation))
        
        // R?cup?rer les consultations d'un utilisateur
        .route("/consultations/{user_id}", get(history_controller::get_consultations_utilisateur))
        
        // Statistiques de consultation d'un service
        .route("/stats/service/{service_id}/{days}", get(history_controller::get_service_consultation_stats))
        .route("/stats/service/{service_id}", get(history_controller::get_service_consultation_stats))
        
        // Statistiques globales de consultation
        .route("/stats/global/{days}", get(history_controller::get_global_consultation_stats))
        .route("/stats/global", get(history_controller::get_global_consultation_stats))
}
