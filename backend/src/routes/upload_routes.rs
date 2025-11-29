// src/routes/upload_routes.rs
// Routes pour l'upload préalable de fichiers

use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use crate::controllers::upload_controller::{upload_files, serve_temp_file};
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;
use axum::middleware;

pub fn upload_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // ✅ Upload préalable (multipart/form-data, limite 20 MB par fichier)
        .route(
            "/api/upload",
            post(upload_files)
                .layer(
                    axum::extract::DefaultBodyLimit::max(50_000_000) // 50 MB total (plusieurs fichiers)
                )
        )
        // ✅ Servir les fichiers temporaires uploadés
        .route(
            "/api/media/temp/*path",
            get(serve_temp_file)
        )
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state)
}

