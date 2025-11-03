use axum::{
    routing::get,
    Router,
};
use std::sync::Arc;
use crate::state::AppState;
use crate::controllers::combination_progress_controller::get_combination_progress;

/// Routes pour la gestion de la progression de génération
pub fn combination_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // GET /api/combinations/progress/{session_id}
        .route("/api/combinations/progress/{session_id}", get(get_combination_progress))
        .with_state(state)
}

