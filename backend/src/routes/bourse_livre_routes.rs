// ✅ Routes pour Bourse du Livre avec IA - V1 + V2

use axum::{
    middleware,
    routing::{get, patch, post},
    Router,
};
use std::sync::Arc;

use crate::controllers::bourse_livre_v2_controller;
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
        // Échanges & Analytics
        .route(
            "/api/bourse-livre/my-exchanges",
            get(livres_scolaires_controller::get_my_exchanges),
        )
        .route(
            "/api/bourse-livre/analytics",
            get(livres_scolaires_controller::get_analytics),
        )
        .route(
            "/api/bourse-livre/{id}/availability",
            axum::routing::patch(livres_scolaires_controller::update_availability),
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

    // ================================================================
    // V2 Routes - Sessions, Recto-Verso, Paquets, Dons, Programmes
    // ================================================================

    // V2 Routes publiques
    let v2_public_routes = Router::new().route(
        "/api/bourse-livre/v2/programmes",
        get(bourse_livre_v2_controller::get_programmes_scolaires),
    );

    // V2 Routes protégées
    let v2_protected_routes = Router::new()
        // Sessions d'upload progressive
        .route(
            "/api/bourse-livre/v2/sessions",
            post(bourse_livre_v2_controller::create_upload_session),
        )
        .route(
            "/api/bourse-livre/v2/sessions/{id}",
            get(bourse_livre_v2_controller::get_upload_session),
        )
        .route(
            "/api/bourse-livre/v2/sessions/{id}/finalize",
            post(bourse_livre_v2_controller::finalize_upload_session),
        )
        // Analyse recto-verso IA
        .route(
            "/api/bourse-livre/v2/analyze-recto-verso",
            post(bourse_livre_v2_controller::analyze_recto_verso),
        )
        // Paquets livraison coursier
        .route(
            "/api/bourse-livre/v2/packages",
            post(bourse_livre_v2_controller::create_delivery_package),
        )
        .route(
            "/api/bourse-livre/v2/packages/my",
            get(bourse_livre_v2_controller::get_my_packages),
        )
        .route(
            "/api/bourse-livre/v2/packages/courier",
            get(bourse_livre_v2_controller::get_courier_packages),
        )
        .route(
            "/api/bourse-livre/v2/packages/{id}/status",
            patch(bourse_livre_v2_controller::update_package_status),
        )
        // Dons de livres
        .route(
            "/api/bourse-livre/v2/donations/request",
            post(bourse_livre_v2_controller::request_donation),
        )
        .route(
            "/api/bourse-livre/v2/donations/my",
            get(bourse_livre_v2_controller::get_my_donation_requests),
        )
        // Calcul net échange
        .route(
            "/api/bourse-livre/v2/calculate-net",
            post(bourse_livre_v2_controller::calculate_net_amount),
        )
        // Admin: Programmes scolaires
        .route(
            "/api/bourse-livre/v2/admin/programmes",
            post(bourse_livre_v2_controller::create_programme_scolaire),
        )
        // Admin: Upload fichier programme (PDF/Excel/Image) + extraction IA
        .route(
            "/api/bourse-livre/v2/admin/programmes/upload",
            post(bourse_livre_v2_controller::upload_programme_file),
        )
        // Matching IA livre ↔ programme (avec date)
        .route(
            "/api/bourse-livre/v2/match-programme",
            post(bourse_livre_v2_controller::match_livre_programme),
        )
        // Achats directs (sans échange)
        .route(
            "/api/bourse-livre/v2/purchases",
            post(bourse_livre_v2_controller::create_book_purchase),
        )
        .route(
            "/api/bourse-livre/v2/purchases/my",
            get(bourse_livre_v2_controller::get_my_purchases),
        )
        .route(
            "/api/bourse-livre/v2/purchases/{id}/status",
            patch(bourse_livre_v2_controller::update_purchase_status),
        )
        // Paquet dépôt-seulement (coursier dépose sans récupérer)
        .route(
            "/api/bourse-livre/v2/packages/depot-only",
            post(bourse_livre_v2_controller::create_depot_only_package),
        )
        .layer(middleware::from_fn_with_state(state.clone(), jwt_auth));

    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .merge(v2_public_routes)
        .merge(v2_protected_routes)
        .with_state(state)
}
