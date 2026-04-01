//! ✅ Routes pour service Supermarché dédié
//!
//! Routes :
//! - GET  /api/supermarkets/{id}/products         - Produits d'un supermarché
//! - GET  /api/supermarkets/products/search        - Recherche produits globale
//! - GET  /api/supermarkets/products/trending       - Produits tendances
//! - POST /api/supermarkets/compare-prices          - Comparaison de prix
//! - GET  /api/supermarkets/{id}/promotions         - Promotions d'un supermarché
//! - GET  /api/supermarkets/promotions/nearby       - Promotions à proximité
//! - GET  /api/supermarkets/{id}/categories         - Catégories d'un supermarché
//! - POST /api/supermarkets/products/bulk-import    - Import en masse de produits
//! - POST /api/supermarkets/products/sync-external  - Sync catalogue API externe

use crate::controllers::supermarket_controller;
use crate::state::AppState;
use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

pub fn supermarket_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/api/supermarkets/{id}/products",
            get(supermarket_controller::get_supermarket_products),
        )
        .route(
            "/api/supermarkets/products/search",
            get(supermarket_controller::search_products),
        )
        .route(
            "/api/supermarkets/products/trending",
            get(supermarket_controller::get_trending_products),
        )
        .route(
            "/api/supermarkets/compare-prices",
            post(supermarket_controller::compare_prices),
        )
        .route(
            "/api/supermarkets/{id}/promotions",
            get(supermarket_controller::get_supermarket_promotions),
        )
        .route(
            "/api/supermarkets/promotions/nearby",
            get(supermarket_controller::get_nearby_promotions),
        )
        .route(
            "/api/supermarkets/{id}/categories",
            get(supermarket_controller::get_supermarket_categories),
        )
        .route(
            "/api/supermarkets/products/bulk-import",
            post(supermarket_controller::bulk_import_products),
        )
        .route(
            "/api/supermarkets/products/sync-external",
            post(supermarket_controller::sync_products_from_external_api),
        )
        .with_state(state)
}
