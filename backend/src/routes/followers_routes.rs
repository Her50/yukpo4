// Routes pour le système de suivi (follow/unfollow) des vendeurs
use crate::controllers::followers_controller::{
    check_follow_by_service, check_follow_status, followers_count, get_my_following, toggle_follow,
    toggle_follow_by_service,
};
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;
use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use std::sync::Arc;

pub fn followers_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // GET /api/users/me/following - Liste des vendeurs suivis (AVANT {user_id} pour éviter conflit)
        .route("/api/users/me/following", get(get_my_following))
        // POST /api/users/:user_id/follow - Suivre/ne plus suivre un utilisateur
        .route("/api/users/{user_id}/follow", post(toggle_follow))
        // GET /api/users/:user_id/follow-status - Vérifier si on suit un utilisateur
        .route(
            "/api/users/{user_id}/follow-status",
            get(check_follow_status),
        )
        // GET /api/users/:user_id/followers-count - Nombre de followers (public)
        .route("/api/users/{user_id}/followers-count", get(followers_count))
        // GET /api/services/:service_id/follow-status - Vérifier suivi via service_id
        .route(
            "/api/services/{service_id}/follow-status",
            get(check_follow_by_service),
        )
        // POST /api/services/:service_id/follow - Suivre/ne plus suivre via service_id
        .route(
            "/api/services/{service_id}/follow",
            post(toggle_follow_by_service),
        )
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state)
}
