use axum::{
    routing::{delete, get, post},
    Router,
};
use std::sync::Arc;

use crate::controllers::flash_promo_controller::{
    create_flash_promo, delete_flash_promo, get_active_flash_promos, list_flash_promos,
};
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;
use axum::middleware;

pub fn flash_promo_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // ✅ Route publique (sans auth) pour les utilisateurs
    let public_routes =
        Router::new().route("/api/flash-promos/active", get(get_active_flash_promos));

    // Routes protégées (avec auth) pour les prestataires
    let protected_routes = Router::new()
        .route("/api/flash-promos", post(create_flash_promo))
        .route(
            "/api/flash-promos/service/{service_id}",
            get(list_flash_promos),
        )
        .route(
            "/api/flash-promos/service/{service_id}/{promo_id}",
            delete(delete_flash_promo),
        )
        .layer(middleware::from_fn(jwt_auth));

    Router::new().merge(public_routes).merge(protected_routes).with_state(state)
}
