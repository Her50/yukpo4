use axum::{
    routing::{get, post},
    Router,
};
use sqlx::PgPool;
use std::sync::Arc;

use crate::controllers::vehicle_model_controller::{
    create_vehicle_model, get_vehicle_models,
};

/// Routes pour la gestion des modèles de véhicules
pub fn vehicle_model_routes(pool: Arc<PgPool>) -> Router {
    Router::new()
        // GET /vehicle-models?brand=Toyota
        .route("/vehicle-models", get(get_vehicle_models))
        // GET /vehicle-models/all
        .route("/vehicle-models/all", get(get_vehicle_models))
        // POST /vehicle-models
        .route("/vehicle-models", post(create_vehicle_model))
        .with_state(pool)
}

