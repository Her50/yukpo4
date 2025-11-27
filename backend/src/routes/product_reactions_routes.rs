// Routes pour les réactions sur les produits
use crate::controllers::product_reactions_controller::{
    get_product_reactions, toggle_product_reaction,
};
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;
use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use std::sync::Arc;

pub fn product_reactions_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // POST /api/products/:service_id/:product_id/react - Ajouter/retirer une réaction
        .route(
            "/api/products/{service_id}/{product_id}/react",
            post(toggle_product_reaction),
        )
        // GET /api/products/{service_id}/{product_id}/reactions - Récupérer les réactions
        .route(
            "/api/products/{service_id}/{product_id}/reactions",
            get(get_product_reactions),
        )
        .layer(middleware::from_fn(jwt_auth)) // ✅ CORRIGÉ: Ajouter middleware JWT
        .with_state(state)
}
