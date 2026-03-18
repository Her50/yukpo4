// ✅ Routes Réseau Librairies - Système intelligent de distribution
// Commandes mixtes, validation compétitive, QR codes, paiements agrégés

use axum::{
    middleware,
    routing::{get, patch, post},
    Router,
};
use std::sync::Arc;

use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;

pub fn librairie_network_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // Routes publiques (sans JWT)
    let public_routes = Router::new()
        // Enregistrement librairie partenaire (public)
        .route(
            "/api/librairie-network/register",
            post(crate::controllers::librairie_network_controller::register_librairie_publique),
        )
        // QR codes partageables (public pour scan)
        .route(
            "/api/librairie-network/qrcode/{qr_id}/scan",
            post(crate::controllers::librairie_network_controller::scan_shareable_qrcode),
        )
        .route(
            "/api/librairie-network/qrcode/{qr_id}/status",
            get(crate::controllers::librairie_network_controller::get_qrcode_status),
        )
        // Catalogue livres neufs (déjà dans bourse_livre_routes)
        .route(
            "/api/librairie-network/new-books",
            get(crate::controllers::bourse_livre_v2_controller::browse_new_books),
        )
        // Comparaison prix (déjà dans bourse_livre_routes)
        .route(
            "/api/librairie-network/compare-prices",
            get(crate::controllers::bourse_livre_v2_controller::compare_prices),
        )
        // Lister les librairies proches (public pour géolocalisation)
        .route(
            "/api/librairie-network/librairies-proches",
            get(crate::controllers::librairie_network_controller::get_librairies_proches),
        );

    // Routes protégées (avec JWT)
    let protected_routes = Router::new()
        // ========================================
        // COMMANDES MIXTES (Neufs + Occasion)
        // ========================================
        .route(
            "/api/librairie-network/commandes",
            post(crate::controllers::librairie_network_controller::create_commande_mixte),
        )
        .route(
            "/api/librairie-network/commandes/{commande_id}",
            patch(crate::controllers::librairie_network_controller::update_commande_mixte),
        )
        .route(
            "/api/librairie-network/commandes/{commande_id}/valider-budget",
            post(crate::controllers::librairie_network_controller::valider_budget_commande),
        )
        .route(
            "/api/librairie-network/commandes/{commande_id}/details",
            get(crate::controllers::librairie_network_controller::get_commande_details),
        )
        .route(
            "/api/librairie-network/commandes/{commande_id}/broadcast",
            post(crate::controllers::librairie_network_controller::broadcast_commande_librairies),
        )
        .route(
            "/api/librairie-network/commandes/{commande_id}/finaliser",
            post(crate::controllers::librairie_network_controller::finaliser_commande),
        )
        .route(
            "/api/librairie-network/mes-commandes",
            get(crate::controllers::librairie_network_controller::get_mes_commandes),
        )
        // ========================================
        // QR CODES PARTAGEABLES
        // ========================================
        .route(
            "/api/librairie-network/qrcode/share",
            post(crate::controllers::librairie_network_controller::generate_shareable_qrcode),
        )
        // ========================================
        // VALIDATION LIBRAIRIE (Compétitive)
        // ========================================
        .route(
            "/api/librairie-network/validation/valider",
            post(crate::controllers::librairie_network_controller::valider_livres_commande),
        )
        // ========================================
        // QR CODES SÉCURITÉ COURSIER
        // ========================================
        .route(
            "/api/librairie-network/qr-codes/generer",
            post(crate::controllers::librairie_network_controller::generer_qr_code_coursier),
        )
        .route(
            "/api/librairie-network/qr-codes/valider",
            post(crate::controllers::librairie_network_controller::valider_qr_code_coursier),
        )
        // ========================================
        // CHAÎNES LIVRAISON UNIFIÉES
        // ========================================
        .route(
            "/api/librairie-network/chaines/optimiser",
            post(crate::controllers::librairie_network_controller::optimiser_chaine_livraison),
        )
        // ========================================
        // PAIEMENTS AGRÉGÉS
        // ========================================
        .route(
            "/api/librairie-network/paiements/demander",
            post(crate::controllers::paiement_agrege_controller::creer_demande_paiement),
        )
        .route(
            "/api/librairie-network/paiements/{transaction_id}",
            get(crate::controllers::paiement_agrege_controller::get_transaction_details),
        )
        .route(
            "/api/librairie-network/paiements/user/{user_id}",
            get(crate::controllers::paiement_agrege_controller::get_user_transactions),
        )
        .route(
            "/api/librairie-network/wallet/solde",
            get(crate::controllers::paiement_agrege_controller::get_solde_wallet),
        )
        .route(
            "/api/librairie-network/wallet/crediter",
            post(crate::controllers::paiement_agrege_controller::crediter_wallet),
        )
        // ========================================
        // ADMINISTRATION
        // ========================================
        .route(
            "/api/librairie-network/admin/librairies",
            post(crate::controllers::librairie_admin_controller::create_librairie_partner),
        )
        .route(
            "/api/librairie-network/admin/librairies",
            get(crate::controllers::librairie_admin_controller::get_librairies_admin),
        )
        .route(
            "/api/librairie-network/admin/librairies/{librairie_id}",
            patch(crate::controllers::librairie_admin_controller::update_librairie_partner),
        )
        .route(
            "/api/librairie-network/admin/fournisseurs-paiement",
            post(crate::controllers::paiement_admin_controller::create_fournisseur_paiement),
        )
        .route(
            "/api/librairie-network/admin/fournisseurs-paiement",
            get(crate::controllers::paiement_admin_controller::get_fournisseurs_paiement),
        )
        .route(
            "/api/librairie-network/admin/transactions",
            get(crate::controllers::paiement_admin_controller::get_all_transactions),
        )
        .route(
            "/api/librairie-network/admin/statistiques",
            get(crate::controllers::librairie_admin_controller::get_statistiques_reseau),
        )
        .layer(middleware::from_fn_with_state(state.clone(), jwt_auth));

    // ========================================
    // CALLBACKS EXTERNES (sans JWT)
    // ========================================
    let callback_routes = Router::new()
        // Callbacks paiements externes
        .route(
            "/api/librairie-network/callbacks/orange-money",
            post(crate::services::paiement_agrege_service::callback_orange_money),
        )
        .route(
            "/api/librairie-network/callbacks/mtn-mobile-money",
            post(crate::services::paiement_agrege_service::callback_mtn_mobile_money),
        )
        .route(
            "/api/librairie-network/callbacks/wave",
            post(crate::services::paiement_agrege_service::callback_wave),
        )
        .route(
            "/api/librairie-network/callbacks/stripe",
            post(crate::services::paiement_agrege_service::callback_stripe),
        );

    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .merge(callback_routes)
        .with_state(state)
}
