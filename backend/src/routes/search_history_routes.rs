use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use crate::state::AppState;
use crate::controllers::search_history_controller::{
    record_search,
    record_search_click,
    get_popular_searches,
    get_search_suggestions,
    get_user_search_history,
};
use crate::middlewares::jwt::{jwt_auth, optional_jwt_auth};
use axum::middleware;

/// Routes pour la gestion de l'historique de recherche
pub fn search_history_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // Routes publiques (peuvent être anonymes avec auth optionnelle)
    let public_routes = Router::new()
        // POST /api/search/history/record - Enregistrer une recherche (peut être anonyme)
        .route("/api/search/history/record", post(record_search))
        // GET /api/search/history/popular?limit=...&category=...&days=... - Recherches populaires
        .route("/api/search/history/popular", get(get_popular_searches))
        // GET /api/search/history/suggestions?prefix=...&limit=... - Suggestions de recherche (peut être anonyme)
        .route("/api/search/history/suggestions", get(get_search_suggestions))
        .layer(middleware::from_fn(optional_jwt_auth))
        .with_state(state.clone());
    
    // Routes protégées (requièrent authentification)
    let protected_routes = Router::new()
        // POST /api/search/history/{search_id}/click - Enregistrer un clic
        .route("/api/search/history/:search_id/click", post(record_search_click))
        // GET /api/search/history/user?limit=... - Historique utilisateur
        .route("/api/search/history/user", get(get_user_search_history))
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state);
    
    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
}

