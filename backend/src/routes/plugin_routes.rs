// ✅ NOUVEAU Phase 2: Routes pour gestion des plugins
// Date: 2025-01-27

use axum::{
    routing::{delete, get, post},
    Router,
};
use std::sync::Arc;

use crate::controllers::plugin_controller::{
    activate_plugin, deactivate_plugin, get_plugin, install_plugin, list_plugins,
    search_marketplace, uninstall_plugin,
};
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;
use axum::middleware;

pub fn plugin_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/plugins", get(list_plugins))
        .route("/api/plugins/:id", get(get_plugin))
        .route("/api/plugins/install", post(install_plugin))
        .route("/api/plugins/:id/activate", post(activate_plugin))
        .route("/api/plugins/:id/deactivate", post(deactivate_plugin))
        .route("/api/plugins/:id/uninstall", delete(uninstall_plugin))
        .route("/api/plugins/marketplace/search", get(search_marketplace))
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state)
}
