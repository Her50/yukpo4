use std::sync::Arc;

use axum::{
    middleware,
    routing::{get, post},
    Router,
};

use crate::controllers::paiement_agrege_controller;
use crate::middlewares::jwt::jwt_auth;
use crate::services::paiement_agrege_service;
use crate::state::AppState;

pub fn paiement_agrege_routes(_state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // Callbacks publics (webhooks fournisseurs)
        .route(
            "/paiement/callback/orange",
            post(paiement_agrege_service::callback_orange_money),
        )
        .route(
            "/paiement/callback/mtn",
            post(paiement_agrege_service::callback_mtn_mobile_money),
        )
        // Routes protégées par JWT
        .route(
            "/paiement/request",
            post(paiement_agrege_controller::creer_demande_paiement),
        )
        .route(
            "/paiement/transaction/:transaction_id",
            get(paiement_agrege_controller::get_transaction_details),
        )
        .route(
            "/paiement/transactions",
            get(paiement_agrege_controller::get_user_transactions),
        )
        .route(
            "/paiement/remboursement",
            post(paiement_agrege_controller::demander_remboursement),
        )
        .route(
            "/paiement/wallet/solde",
            get(paiement_agrege_controller::get_solde_wallet),
        )
        .route(
            "/paiement/wallet/historique",
            get(paiement_agrege_controller::get_wallet_historique),
        )
        .route(
            "/paiement/wallet/credit",
            post(paiement_agrege_controller::crediter_wallet),
        )
        .route_layer(middleware::from_fn(jwt_auth))
}
