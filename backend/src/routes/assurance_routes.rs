//! ✅ Routes pour service Assurance dédié
//!
//! Routes :
//! - GET  /api/assurance/search              - Recherche dédiée (publique)
//! - POST /api/assurance/ai/quote            - Génération devis IA (protégée)
//! - POST /api/assurance/ai/compare          - Comparaison produits IA (protégée)
//! - POST /api/assurance/ai/recommendations  - Recommandations IA (protégée)
//! - POST /api/assurance/ai/estimate-premium - Estimation prime IA (protégée)

use crate::controllers::assurance_controller;
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;
use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use std::sync::Arc;

pub fn assurance_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // Route publique (sans JWT) - recherche
    let public_routes = Router::new()
        .route(
            "/api/assurance/search",
            get(assurance_controller::search_insurance),
        )
        .with_state(state.clone());

    // Routes protégées (avec JWT) - fonctionnalités IA
    let protected_routes = Router::new()
        .route(
            "/api/assurance/ai/quote",
            post(assurance_controller::generate_quote),
        )
        .route(
            "/api/assurance/ai/compare",
            post(assurance_controller::compare_products),
        )
        .route(
            "/api/assurance/ai/recommendations",
            post(assurance_controller::get_recommendations),
        )
        .route(
            "/api/assurance/ai/estimate-premium",
            post(assurance_controller::estimate_premium),
        )
        .layer(middleware::from_fn_with_state(state.clone(), jwt_auth))
        .with_state(state.clone());

    Router::new().merge(public_routes).merge(protected_routes).with_state(state)
}
