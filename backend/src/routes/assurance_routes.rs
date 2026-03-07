//! ✅ Routes pour service Assurance dédié — Digitalisation complète
//!
//! Routes publiques :
//! - GET  /api/assurance/search                    - Recherche dédiée
//!
//! Routes protégées (JWT) — IA :
//! - POST /api/assurance/ai/quote                  - Génération devis IA
//! - POST /api/assurance/ai/compare                - Comparaison produits IA
//! - POST /api/assurance/ai/recommendations        - Recommandations IA
//! - POST /api/assurance/ai/estimate-premium       - Estimation prime IA
//!
//! Routes protégées (JWT) — CRUD Produits :
//! - POST /api/assurance/products                  - Créer un produit
//! - GET  /api/assurance/products                  - Lister ses produits
//! - PUT  /api/assurance/products/:id              - Modifier un produit
//! - POST /api/assurance/products/:id/toggle       - Activer/désactiver
//!
//! Routes protégées (JWT) — Polices :
//! - POST /api/assurance/policies                  - Émettre une police
//! - GET  /api/assurance/policies                  - Lister ses polices
//! - PUT  /api/assurance/policies/:id/status       - Changer statut police
//! - GET  /api/assurance/policies/client            - Polices côté client
//!
//! Routes protégées (JWT) — Sinistres :
//! - POST /api/assurance/claims                    - Déclarer un sinistre
//! - GET  /api/assurance/claims                    - Lister sinistres (assureur)
//! - GET  /api/assurance/claims/client             - Sinistres côté client
//! - PUT  /api/assurance/claims/:id/status         - Maj statut sinistre
//! - POST /api/assurance/claims/:id/ai-analyze     - Analyse IA sinistre
//!
//! Routes protégées (JWT) — Dashboard :
//! - GET  /api/assurance/dashboard/stats           - Stats complètes

use crate::controllers::assurance_controller;
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;
use axum::{
    middleware,
    routing::{get, post, put},
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

    // Routes protégées (avec JWT)
    let protected_routes = Router::new()
        // IA
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
        // CRUD Produits
        .route(
            "/api/assurance/products",
            post(assurance_controller::create_insurance_product)
                .get(assurance_controller::list_insurance_products),
        )
        .route(
            "/api/assurance/products/{id}",
            put(assurance_controller::update_insurance_product),
        )
        .route(
            "/api/assurance/products/{id}/toggle",
            post(assurance_controller::toggle_insurance_product),
        )
        // Polices
        .route(
            "/api/assurance/policies",
            post(assurance_controller::create_policy).get(assurance_controller::list_policies),
        )
        .route(
            "/api/assurance/policies/client",
            get(assurance_controller::get_client_policies),
        )
        .route(
            "/api/assurance/policies/{id}/status",
            put(assurance_controller::update_policy_status),
        )
        // Sinistres
        .route(
            "/api/assurance/claims",
            post(assurance_controller::create_claim).get(assurance_controller::list_claims),
        )
        .route(
            "/api/assurance/claims/client",
            get(assurance_controller::get_client_claims),
        )
        .route(
            "/api/assurance/claims/{id}/status",
            put(assurance_controller::update_claim_status),
        )
        .route(
            "/api/assurance/claims/{id}/ai-analyze",
            post(assurance_controller::ai_analyze_claim),
        )
        // Dashboard
        .route(
            "/api/assurance/dashboard/stats",
            get(assurance_controller::get_dashboard_stats),
        )
        .layer(middleware::from_fn_with_state(state.clone(), jwt_auth))
        .with_state(state.clone());

    Router::new().merge(public_routes).merge(protected_routes).with_state(state)
}
