// ✅ NOUVEAU: Contrôleur pour avis et ratings services spécialisés

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::specialized_rating_service::SpecializedRatingService;
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::info;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct CreateRatingRequest {
    pub service_id: i32,
    pub service_type: String,
    pub rating: i32,
    pub comment: Option<String>,
    pub quality_rating: Option<i32>,
    pub punctuality_rating: Option<i32>,
    pub price_rating: Option<i32>,
    pub communication_rating: Option<i32>,
    pub reservation_id: Option<i32>,
}

/// POST /api/specialized-services/ratings
/// Créer un avis
pub async fn create_rating(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateRatingRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_rating] user_id={}, service_id={}, rating={}",
        user_id, payload.service_id, payload.rating
    );

    // Récupérer le prestataire_id depuis le service
    let prestataire_id: i32 = sqlx::query_scalar(
        r#"
        SELECT user_id FROM services
        WHERE id = $1 AND specialized_type = $2
        "#,
    )
    .bind(payload.service_id)
    .bind(&payload.service_type)
    .fetch_optional(&state.pg)
    .await?
    .ok_or_else(|| AppError::NotFound("Service non trouvé".to_string()))?;

    let rating_service = SpecializedRatingService::new(Arc::new(state.pg.clone()));

    let rating = rating_service
        .create_rating(
            payload.service_id,
            &payload.service_type,
            user_id,
            prestataire_id,
            payload.rating,
            payload.comment,
            payload.quality_rating,
            payload.punctuality_rating,
            payload.price_rating,
            payload.communication_rating,
            payload.reservation_id,
        )
        .await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({ "success": true, "rating": rating })),
    ))
}

/// GET /api/specialized-services/:service_id/ratings
/// Lister les avis d'un service
pub async fn list_service_ratings(
    State(state): State<Arc<AppState>>,
    Path(service_id): Path<i32>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> AppResult<impl IntoResponse> {
    let limit = params
        .get("limit")
        .and_then(|s| s.parse::<i32>().ok())
        .unwrap_or(20);
    let offset = params
        .get("offset")
        .and_then(|s| s.parse::<i32>().ok())
        .unwrap_or(0);

    let rating_service = SpecializedRatingService::new(Arc::new(state.pg.clone()));
    let ratings = rating_service
        .list_service_ratings(service_id, Some(limit), Some(offset))
        .await?;

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "ratings": ratings })),
    ))
}

/// GET /api/specialized-services/:service_id/ratings/stats
/// Obtenir les statistiques de ratings
pub async fn get_rating_stats(
    State(state): State<Arc<AppState>>,
    Path(service_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    let rating_service = SpecializedRatingService::new(Arc::new(state.pg.clone()));
    let stats = rating_service.get_service_rating_stats(service_id).await?;

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "stats": stats })),
    ))
}

/// POST /api/specialized-services/ratings/:id/helpful
/// Marquer un avis comme utile
pub async fn mark_rating_helpful(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(rating_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    let rating_service = SpecializedRatingService::new(Arc::new(state.pg.clone()));
    rating_service.mark_helpful(rating_id, user_id).await?;

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "message": "Avis marqué comme utile" })),
    ))
}
