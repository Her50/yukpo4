//! ✅ Contrôleur Recommandations Personnalisées - Taxi & Covoiturage
//!
//! Recommandations basées sur historique et préférences utilisateur

use crate::core::types::AppResult;
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::taxi_personalized_recommendations_service::TaxiPersonalizedRecommendationsService;
use crate::state::AppState;
use axum::{
    extract::{Extension, Query, State},
    response::IntoResponse,
    Json,
};
use log::info;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct RecommendationsQuery {
    pub service_type: Option<String>, // "taxi" | "covoiturage"
    pub limit: Option<i64>,
    pub location_lat: Option<f64>,
    pub location_lng: Option<f64>,
    pub radius_km: Option<f64>,
}

/// ✅ GET /api/taxi/personalized-recommendations
/// Obtenir recommandations personnalisées pour un utilisateur
pub async fn get_personalized_recommendations(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<RecommendationsQuery>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_personalized_recommendations] User {} demande recommandations",
        user_id
    );

    let svc = TaxiPersonalizedRecommendationsService::new(Arc::new(state.pg.clone()));
    let recommendations = svc
        .get_recommendations(
            user_id,
            params.service_type,
            params.location_lat,
            params.location_lng,
            params.radius_km,
            params.limit,
        )
        .await?;

    info!(
        "[get_personalized_recommendations] ✅ {} recommandations trouvées",
        recommendations.len()
    );

    Ok(Json(json!({
        "success": true,
        "data": recommendations,
        "count": recommendations.len(),
    })))
}
