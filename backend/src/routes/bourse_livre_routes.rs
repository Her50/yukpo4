// ✅ Routes pour Bourse du Livre avec IA

use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use std::sync::Arc;

use crate::controllers::livres_scolaires_controller;
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;

pub fn bourse_livre_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // Routes publiques (sans JWT)
    let public_routes = Router::new()
        .route(
            "/api/bourse-livre/search",
            get(livres_scolaires_controller::search_livres_scolaires),
        )
        .route(
            "/api/bourse-livre/{id}",
            get(livres_scolaires_controller::get_livre_details),
        )
        .route(
            "/api/bourse-livre/ai/price-suggestions",
            get(livres_scolaires_controller::price_suggestions),
        );

    // Routes protégées (avec JWT)
    let protected_routes = Router::new()
        .route(
            "/api/bourse-livre",
            post(livres_scolaires_controller::create_livre_scolaire),
        )
        .route(
            "/api/bourse-livre/mes-livres",
            get(livres_scolaires_controller::get_mes_livres),
        )
        .route(
            "/api/bourse-livre/{id}",
            axum::routing::put(livres_scolaires_controller::update_livre_scolaire),
        )
        .route(
            "/api/bourse-livre/{id}",
            axum::routing::delete(livres_scolaires_controller::delete_livre_scolaire),
        )
        // Endpoints IA
        .route(
            "/api/bourse-livre/ai/recommendations",
            post(livres_scolaires_controller::ai_recommendations),
        )
        .route(
            "/api/bourse-livre/ai/matching",
            post(livres_scolaires_controller::ai_matching),
        )
        .route(
            "/api/bourse-livre/ai/analyze-image",
            post(livres_scolaires_controller::analyze_book_image),
        )
        .layer(middleware::from_fn_with_state(state.clone(), jwt_auth));

    Router::new().merge(public_routes).merge(protected_routes).with_state(state)
}
