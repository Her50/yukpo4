//! ✅ 2026-04-01: Routes Recherche Universelle Yukpo
//! GET /api/search/universal — recherche cross-services (produits, menus, services spécialisés)

use crate::controllers::universal_search_controller;
use crate::state::AppState;
use axum::{routing::get, Router};
use std::sync::Arc;

pub fn universal_search_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/api/search/universal",
            get(universal_search_controller::universal_search),
        )
        .with_state(state)
}
