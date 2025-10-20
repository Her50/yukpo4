// 🖼️ Routes pour la recherche par image
use axum::{routing::post, Router};
use std::sync::Arc;

use crate::controllers::image_search_controller;
use crate::state::AppState;

pub fn image_search_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/search/by-image", post(image_search_controller::search_by_image))
        .route("/api/search/product-images", post(image_search_controller::search_product_images))
        .with_state(state)
}
