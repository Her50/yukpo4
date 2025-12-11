// ✅ Routes admin pour vérification manuelle KYC

use axum::routing::{get, post};
use axum::Router;
use std::sync::Arc;

use crate::controllers::kyc_admin_controller;
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;

pub fn kyc_admin_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/api/admin/kyc/pending",
            get(kyc_admin_controller::list_pending_documents),
        )
        .route(
            "/api/admin/kyc/{id}",
            get(kyc_admin_controller::get_document_details),
        )
        .route(
            "/api/admin/kyc/{id}/verify",
            post(kyc_admin_controller::verify_document_manual),
        )
        .layer(axum::middleware::from_fn(jwt_auth))
        .with_state(state)
}
