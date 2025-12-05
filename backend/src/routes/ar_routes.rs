// ✅ NOUVEAU Phase 3.2: Routes pour preview AR/VR

use axum::{routing::post, Router};
use std::sync::Arc;

use crate::controllers::ar_preview_controller::generate_ar_preview;
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;

pub fn ar_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // ✅ NOUVEAU Phase 3.2: Routes pour preview AR/VR
        .route("/api/ar/preview", post(generate_ar_preview))
        .layer(axum::middleware::from_fn(jwt_auth))
        .with_state(state)
}
