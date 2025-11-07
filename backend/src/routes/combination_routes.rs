use crate::controllers::autocomplete_controller::{
    get_combinations_by_session, link_combinations_to_service, save_ai_combinations,
    search_combinations,
};
use crate::controllers::combination_progress_controller::get_combination_progress;
use crate::state::AppState;
use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

/// Routes pour la gestion des combinaisons vectorielles (autocomplete_combinations)
/// Séparé de /api/autocomplete/* qui gère autocomplete_characteristics (valeurs individuelles)
pub fn combination_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // GET /api/combinations/progress/{session_id} - Progression génération background
        .route(
            "/api/combinations/progress/{session_id}",
            get(get_combination_progress),
        )
        // POST /api/combinations/search - Recherche intelligente dans autocomplete_combinations
        .route("/api/combinations/search", post(search_combinations))
        // POST /api/combinations/save-ai - Sauvegarder combinaisons générées par l'IA
        .route("/api/combinations/save-ai", post(save_ai_combinations))
        // GET /api/combinations/session/{session_id} - Récupérer combinaisons d'une session IA
        .route(
            "/api/combinations/session/{session_id}",
            get(get_combinations_by_session),
        )
        // POST /api/combinations/link-to-service - Lier combinaisons à un service
        .route(
            "/api/combinations/link-to-service",
            post(link_combinations_to_service),
        )
        .with_state(state)
}
