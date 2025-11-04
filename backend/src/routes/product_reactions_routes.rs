// Routes pour les réactions sur les produits
use axum::{
    routing::{get, post},
    Router,
};
use crate::controllers::product_reactions_controller::{
    toggle_product_reaction,
    get_product_reactions,
};
use crate::state::AppState;
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
        .with_state(state)
}
