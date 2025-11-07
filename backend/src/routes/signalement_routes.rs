// src/routes/signalement_routes.rs
// Routes pour la gestion des signalements

use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use std::sync::Arc;

use crate::{
    controllers::signalement_controller::{
        create_signalement, get_prestataire_risque, get_user_signalements,
    },
    middlewares::jwt::jwt_auth,
    state::AppState,
};

pub fn signalement_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // Gestion des signalements
        .route("/signalements", post(create_signalement))
        .route("/signalements/mes-signalements", get(get_user_signalements))
        // Vérification risque prestataire (route publique pour que tous puissent vérifier)
        .route(
            "/signalements/risque/{user_id}",
            get(get_prestataire_risque),
        )
        // Routes protégées par authentification
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state)
}
