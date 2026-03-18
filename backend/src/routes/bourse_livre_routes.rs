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
    let v2_public_routes = Router::new()
        .route(
            "/api/bourse-livre/v2/programmes",
            get(bourse_livre_v2_controller::get_programmes_scolaires),
        )
        // Parcourir livres par classe (achat sans troc)
        .route(
            "/api/bourse-livre/v2/browse-by-class",
            get(bourse_livre_v2_controller::browse_books_by_class),
        )
        // Classes avec stats (nombre de livres disponibles)
        .route(
            "/api/bourse-livre/v2/classes-programmes",
            get(bourse_livre_v2_controller::get_classes_with_programmes),
        )
        // Suggestions intelligentes (autocomplete multi-critères)
        .route(
            "/api/bourse-livre/v2/suggestions",
            get(bourse_livre_v2_controller::get_smart_suggestions),
        )
        // Catalogue livres neufs (public)
        .route(
            "/api/bourse-livre/v2/new-books",
            get(bourse_livre_v2_controller::browse_new_books),
        )
        // Comparaison prix neuf vs occasion (public)
        .route(
            "/api/bourse-livre/v2/compare-prices",
            get(bourse_livre_v2_controller::compare_prices),
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
        // Détail paquet coursier (livres enrichis + itinéraire)
        .route(
            "/api/bourse-livre/v2/packages/{id}/detail",
            get(bourse_livre_v2_controller::get_package_detail_for_courier),
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
        // Phase 3: Pont vers système de livraison intelligent
        .route(
            "/api/bourse-livre/v2/packages/{id}/dispatch",
            post(bourse_livre_v2_controller::dispatch_book_package),
        )
        .route(
            "/api/bourse-livre/v2/packages/{id}/availability",
            patch(bourse_livre_v2_controller::update_package_availability),
        )
        // Phase 3: Dashboards livres scolaires
        .route(
            "/api/bourse-livre/v2/courier/dashboard",
            get(bourse_livre_v2_controller::courier_book_dashboard),
        )
        .route(
            "/api/bourse-livre/v2/courier/accept/{id}",
            post(bourse_livre_v2_controller::courier_accept_book_package),
        )
        .route(
            "/api/bourse-livre/v2/user/book-dashboard",
            get(bourse_livre_v2_controller::user_book_dashboard),
        )
        // Constitution intelligente des paquets (regroupe par expéditeur→destinataire)
        .route(
            "/api/bourse-livre/v2/packages/build-intelligent",
            post(bourse_livre_v2_controller::build_intelligent_packages),
        )
        // Admin: constitution batch pour tous les utilisateurs
        .route(
            "/api/bourse-livre/v2/packages/build-all",
            post(bourse_livre_v2_controller::build_all_pending_packages),
        )
        // E2: Validation besoin — tous les paquets constitués avant dispatch
        .route(
            "/api/bourse-livre/v2/packages/validate-need",
            get(bourse_livre_v2_controller::validate_need_fulfillment),
        )
        // E3: Route optimisée coursier (nearest-neighbor TSP)
        .route(
            "/api/bourse-livre/v2/packages/optimized-route",
            post(bourse_livre_v2_controller::compute_optimized_route),
        )
        // E3: Tous les paquets non-dispatchés d'un utilisateur
        .route(
            "/api/bourse-livre/v2/packages/user-packages",
            get(bourse_livre_v2_controller::get_all_packages_for_user),
        )
        // V3: Chaîne DAG — création, finalisation, détails
        .route(
            "/api/bourse-livre/v2/chains/create",
            post(bourse_livre_v2_controller::create_chain_from_matching),
        )
        .route(
            "/api/bourse-livre/v2/chains/{id}/finalize",
            post(bourse_livre_v2_controller::finalize_chain),
        )
        .route(
            "/api/bourse-livre/v2/chains/{id}/schedule",
            post(bourse_livre_v2_controller::build_delivery_schedule),
        )
        .route(
            "/api/bourse-livre/v2/chains/{id}",
            get(bourse_livre_v2_controller::get_chain_details),
        )
        // V3: Annulation livre par coursier sur le terrain
        .route(
            "/api/bourse-livre/v2/packages/cancel-book",
            post(bourse_livre_v2_controller::cancel_book_on_site),
        )
        // QR Codes pour livraison de livres
        .route(
            "/api/bourse-livre/v2/packages/{id}/qr-generate",
            post(bourse_livre_v2_controller::generate_package_qr),
        )
        .route(
            "/api/bourse-livre/v2/packages/qr-validate",
            post(bourse_livre_v2_controller::validate_package_qr),
        )
        // Libraire: Publier livres neufs en lot
        .route(
            "/api/bourse-livre/v2/libraire/publish",
            post(bourse_livre_v2_controller::libraire_publish_new_books),
        )
        // Admin: Gestion des dons
        .route(
            "/api/bourse-livre/v2/admin/donations",
            get(bourse_livre_v2_controller::admin_list_donation_requests),
        )
        .route(
            "/api/bourse-livre/v2/admin/donations/{id}/approve",
            post(bourse_livre_v2_controller::admin_approve_donation),
        )
        .route(
            "/api/bourse-livre/v2/admin/donations/{id}/reject",
            post(bourse_livre_v2_controller::admin_reject_donation),
        )
        .layer(middleware::from_fn_with_state(state.clone(), jwt_auth));

    // Webhook routes (PUBLIQUES, sans JWT — appelées par les prestataires de paiement)
    let webhook_routes = Router::new().route(
        "/api/webhooks/book-purchase/{id}",
        post(bourse_livre_v2_controller::book_purchase_webhook),
    );

    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .merge(v2_public_routes)
        .merge(v2_protected_routes)
        .merge(webhook_routes)
        .with_state(state)
}
