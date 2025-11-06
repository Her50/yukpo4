use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use crate::{
    controllers::debug_controller,
    state::AppState,
};

/// Routes de debug pour vérifier l'état de la base de données
pub fn debug_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/debug/tables", get(debug_controller::check_all_tables))
        .route("/api/debug/autocomplete", get(debug_controller::check_autocomplete_tables))
        .route("/api/debug/clean-combinations", post(debug_controller::clean_invalid_combinations))
        .with_state(state)
}

