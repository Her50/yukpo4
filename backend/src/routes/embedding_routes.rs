use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use crate::AppState;
use crate::controllers::embedding_controller;
use crate::middlewares::jwt::jwt_auth;

/// ? Routes pour la gestion des embeddings
pub fn embedding_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/services/:service_id/embedding-status",
            get(embedding_controller::get_embedding_status)
                .layer(axum::middleware::from_fn(jwt_auth)),
        )
        .route(
            "/services/:service_id/retry-embedding",
            post(embedding_controller::retry_embedding)
                .layer(axum::middleware::from_fn(jwt_auth)),
        )
        .route(
            "/services/embedding-status",
            get(embedding_controller::get_user_services_embedding_status)
                .layer(axum::middleware::from_fn(jwt_auth)),
        )
} 
