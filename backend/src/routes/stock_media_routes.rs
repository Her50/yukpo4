// ✅ NOUVEAU Phase 2: Routes pour Stock Media Integration
// Date: 2025-01-27

use axum::{routing::get, Router};
use std::sync::Arc;

use crate::controllers::stock_media_controller::{list_stock_media_providers, search_stock_media};
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;
use axum::middleware;

pub fn stock_media_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/stock-media/search", get(search_stock_media))
        .route(
            "/api/stock-media/providers",
            get(list_stock_media_providers),
        )
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state)
}
