use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

use crate::controllers::prestataire_controller::{get_prestataire, get_prestataires_batch};
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;
use axum::middleware;

pub fn prestataire_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/prestataires/{id}", get(get_prestataire))
        .route("/api/prestataires/batch", post(get_prestataires_batch))
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state)
} 