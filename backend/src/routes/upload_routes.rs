// src/routes/upload_routes.rs
// Routes pour l'upload préalable de fichiers

use crate::controllers::async_upload_controller::{get_upload_status, start_async_upload}; // ✅ NOUVEAU
use crate::controllers::upload_controller::{serve_temp_file, upload_files};
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;
use axum::middleware;
use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

pub fn upload_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // ✅ Upload préalable synchrone (multipart/form-data, limite 200 MB total)
        .route(
            "/api/upload",
            post(upload_files).layer(
                axum::extract::DefaultBodyLimit::max(200_000_000), // ✅ 200 MB total - pour permettre plusieurs fichiers volumineux
            ),
        )
        // ✅ NOUVEAU 2025-01-27 : Upload asynchrone pour gros fichiers
        .route(
            "/api/upload/async",
            post(start_async_upload).layer(
                axum::extract::DefaultBodyLimit::max(1_000_000_000), // ✅ 1 GB pour uploads asynchrones
            ),
        )
        // ✅ NOUVEAU 2025-01-27 : Statut d'un upload asynchrone
        .route("/api/upload/status/{upload_id}", get(get_upload_status))
        // ✅ Servir les fichiers temporaires uploadés
        .route("/api/media/temp/{*path}", get(serve_temp_file))
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state)
}
