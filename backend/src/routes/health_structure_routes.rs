use axum::{
    routing::{get, post},
    Router,
};
use sqlx::PgPool;
use std::sync::Arc;

use crate::controllers::health_structure_controller::{
    create_health_structure, get_all_health_structures, get_health_structures,
};

/// Routes pour la gestion des structures de santé (autocomplete)
pub fn health_structure_routes(pool: Arc<PgPool>) -> Router {
    Router::new()
        // GET /health-structures?type=hopital_clinique
        .route("/health-structures", get(get_health_structures))
        // GET /health-structures/all
        .route("/health-structures/all", get(get_all_health_structures))
        // POST /health-structures
        .route("/health-structures", post(create_health_structure))
        .with_state(pool)
}

