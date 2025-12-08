// ✅ NOUVEAU Phase 2: Routes pour timelines multi-pistes avancées

use axum::{
    routing::{delete, get, post, put},
    Router,
};
use std::sync::Arc;

use crate::controllers::advanced_timeline_controller::{
    create_timeline, delete_timeline, get_timeline, list_timelines, update_timeline,
};
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;

pub fn advanced_timeline_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // ✅ NOUVEAU Phase 2: Routes pour timelines multi-pistes avancées
        .route("/api/timelines", post(create_timeline))
        .route("/api/timelines", get(list_timelines))
        .route("/api/timelines/{timeline_id}", get(get_timeline))
        .route("/api/timelines/{timeline_id}", put(update_timeline))
        .route("/api/timelines/{timeline_id}", delete(delete_timeline))
        .layer(axum::middleware::from_fn(jwt_auth))
        .with_state(state)
}
