// 🖼️ Routes pour la recherche par image
use axum::{routing::post, Router};
use sqlx::PgPool;
use std::sync::Arc;

use crate::controllers::image_search_controller;

pub fn image_search_routes(pool: Arc<PgPool>) -> Router<Arc<PgPool>> {
    Router::new()
        .route("/api/search/by-image", post(image_search_controller::search_by_image))
        .route("/api/search/product-images", post(image_search_controller::search_product_images))
        .with_state(pool)
}
