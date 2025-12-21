// Routes pour la gestion des utilisateurs par les administrateurs
use axum::{
    routing::{get, patch},
    Router,
};
use std::sync::Arc;

use crate::controllers::admin_user_controller::{list_users, update_user_role};
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;
use axum::middleware;

pub fn admin_user_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/admin/users", get(list_users))
        .route("/api/admin/users/:user_id/role", patch(update_user_role))
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state)
}

