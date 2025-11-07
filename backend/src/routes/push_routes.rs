// Routes pour les push notifications
use crate::{controllers::push_controller, middlewares::jwt::jwt_auth, state::AppState};
use axum::{
    routing::{patch, post},
    Router,
};
use std::sync::Arc;

pub fn push_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::<Arc<AppState>>::new()
        // Enregistrer un token push
        .route(
            "/api/push/register",
            post(push_controller::register_push_token),
        )
        // Désactiver un token push
        .route(
            "/api/push/deactivate",
            patch(push_controller::deactivate_push_token),
        )
        // Envoyer une notification (admin/test)
        .route(
            "/api/push/send",
            post(push_controller::send_push_notification),
        )
        // Appliquer l'authentification à toutes les routes
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            jwt_auth,
        ))
        .with_state(state)
}
