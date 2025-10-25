use axum::{
    routing::{get, post},
    Router,
};
use sqlx::PgPool;
use std::sync::Arc;

use crate::controllers::appliance_model_controller::{
    create_appliance_model, get_appliance_models,
};

/// Routes pour la gestion des modèles d'appareils électroménagers
pub fn appliance_model_routes(pool: Arc<PgPool>) -> Router {
    Router::new()
        // GET /appliance-models?brand=Samsung
        .route("/appliance-models", get(get_appliance_models))
        // GET /appliance-models/all
        .route("/appliance-models/all", get(get_appliance_models))
        // POST /appliance-models
        .route("/appliance-models", post(create_appliance_model))
        .with_state(pool)
}

