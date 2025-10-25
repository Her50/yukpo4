// Routes pour les modèles de smartphones

use axum::{routing::{get, post}, Router};
use sqlx::PgPool;

use crate::controllers::phone_model_controller::{
    create_phone_model,
    get_phone_models,
};

pub fn phone_model_routes() -> Router<PgPool> {
    Router::new()
        .route("/phone-models", get(get_phone_models))
        .route("/phone-models", post(create_phone_model))
}


