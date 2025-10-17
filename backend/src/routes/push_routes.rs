// Routes pour les push notifications
use std::sync::Arc;
use axum::{
    routing::{post, patch},
    Router,
    middleware,
};
use crate::{
    state::AppState,
    middlewares::auth::auth_middleware,
    controllers::push_controller,
};

pub fn push_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::<Arc<AppState>>::new()
        // Enregistrer un token push
        .route("/api/push/register", post(push_controller::register_push_token))
        
        // Désactiver un token push
        .route("/api/push/deactivate", patch(push_controller::deactivate_push_token))
        
        // Envoyer une notification (admin/test)
        .route("/api/push/send", post(push_controller::send_push_notification))
        
        // Appliquer l'authentification à toutes les routes
        .layer(middleware::from_fn_with_state(state.clone(), auth_middleware))
        .with_state(state)
}

