// Routes pour les modèles de smartphones

use axum::{routing::{get, post}, Router};
use std::sync::Arc;
use crate::state::AppState;

use crate::controllers::phone_model_controller::{
    create_phone_model,
    get_phone_models,
};

pub fn phone_model_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/phone-models", get(get_phone_models))
        .route("/phone-models", post(create_phone_model))
        .with_state(state)
}


