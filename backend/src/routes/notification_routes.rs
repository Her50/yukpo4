// Routes pour les notifications
use std::sync::Arc;
use axum::{
    routing::{get, patch},
    Router,
};
use crate::{
    state::AppState,
    middlewares::jwt::jwt_auth,
    controllers::notification_controller,
};

pub fn notification_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::<Arc<AppState>>::new()
        // Récupérer les notifications
        .route("/api/notifications/user/{user_id}", get(notification_controller::get_user_notifications))
        
        // Compter les non lues
        .route("/api/notifications/user/{user_id}/unread-count", get(notification_controller::count_unread_notifications))
        
        // Marquer comme lue
        .route("/api/notifications/{notification_id}/read", patch(notification_controller::mark_notification_as_read))
        
        // Tout marquer comme lu
        .route("/api/notifications/user/{user_id}/mark-all-read", patch(notification_controller::mark_all_notifications_as_read))
        
        // Appliquer l'authentification à toutes les routes
        .layer(axum::middleware::from_fn_with_state(state.clone(), jwt_auth))
        .with_state(state)
}


