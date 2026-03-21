use crate::controllers::app_update_controller;
use axum::{
    routing::{get, post},
    Router,
};
use crate::auth::jwt_auth;

pub fn create_app_update_routes() -> Router {
    Router::new()
        .route("/check", post(check_for_updates))
        .route("/info", get(get_update_info))
        .layer(jwt_auth::jwt_middleware())
}

// Handlers
async fn check_for_updates(
    claims: Option<crate::auth::Claims>,
    axum::extract::State(db): axum::extract::State<crate::database::Database>,
    axum::Json(request): axum::Json<crate::controllers::app_update_controller::UpdateCheckRequest>,
) -> Result<axum::Json<crate::controllers::app_update_controller::UpdateCheckResponse>, axum::response::ErrorResponse> {
    match app_update_controller::check_for_updates(claims, &db, request).await {
        Ok(response) => Ok(axum::Json(response)),
        Err(e) => {
            tracing::error!("Error checking for updates: {:?}", e);
            Err(axum::response::ErrorResponse::from(axum::http::StatusCode::INTERNAL_SERVER_ERROR))
        }
    }
}

async fn get_update_info(
    claims: Option<crate::auth::Claims>,
    axum::extract::State(db): axum::extract::State<crate::database::Database>,
) -> Result<axum::Json<crate::controllers::app_update_controller::AppVersionInfo>, axum::response::ErrorResponse> {
    match app_update_controller::get_update_info(claims, &db).await {
        Ok(response) => Ok(axum::Json(response)),
        Err(e) => {
            tracing::error!("Error getting update info: {:?}", e);
            Err(axum::response::ErrorResponse::from(axum::http::StatusCode::INTERNAL_SERVER_ERROR))
        }
    }
}
