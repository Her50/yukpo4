// ✅ NOUVEAU Phase 2.3: Routes pour jobs d'export vidéo

use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

use crate::controllers::export_controller::{
    cancel_export, get_export_status, list_exports, start_export,
};
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;

pub fn export_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // ✅ NOUVEAU Phase 2.3: Routes pour export vidéo
        .route("/api/export/start", post(start_export))
        .route("/api/export/status/{job_id}", get(get_export_status))
        .route("/api/export/cancel/{job_id}", post(cancel_export))
        .route("/api/export/list", get(list_exports))
        .layer(axum::middleware::from_fn(jwt_auth))
        .with_state(state)
}
