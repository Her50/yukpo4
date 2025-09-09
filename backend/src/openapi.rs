// src/openapi.rs
// Exposition OpenAPI/Swagger via utoipa et Swagger UI
use axum::{Router};

// #[derive(OpenApi)]
// #[openapi(
//     paths(
//         crate::controllers::interaction_controller::post_message,
//         crate::controllers::interaction_controller::post_review,
//         crate::controllers::interaction_controller::post_audio,
//         crate::controllers::interaction_controller::post_call,
//         crate::controllers::interaction_controller::post_share,
//         crate::controllers::interaction_controller::get_service_interactions,
//         crate::controllers::interaction_controller::get_service_reviews,
//         crate::controllers::interaction_controller::get_service_score,
//     ),
//     components(
//         schemas(crate::models::interaction_model::Interaction,
//                  crate::models::service_review_model::ServiceReview,
//                  crate::models::service_score_model::ServiceScore)
//     ),
//     tags(
//         (name = "Service", description = "Gestion des interactions et scoring de service")
//     )
// )]
pub struct ApiDoc;

pub fn swagger_router() -> Router {
    Router::new() // Swagger d?sactiv? temporairement pour la prod
}
