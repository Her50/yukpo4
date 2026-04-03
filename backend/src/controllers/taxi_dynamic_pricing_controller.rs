//! ✅ Contrôleur Prix Dynamique IA - Taxi & Covoiturage
//!
//! Pricing intelligent basé sur demande/prédiction

use crate::core::types::AppResult;
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::taxi_demand_prediction_service::{
    PredictionZone, TaxiDemandPredictionService,
};
use crate::services::taxi_dynamic_pricing_service::TaxiDynamicPricingService;
use crate::state::AppState;
use axum::{
    extract::{Extension, State},
    response::IntoResponse,
    Json,
};
use log::info;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

/// Requête pour calcul prix dynamique
#[derive(Debug, Deserialize)]
pub struct DynamicPricingRequest {
    pub base_price: f64,
    pub distance_km: f64,
    pub zone_id: String,
    pub latitude: f64,
    pub longitude: f64,
    pub radius_km: Option<f64>,
    pub vehicle_type: Option<String>,
    // Infos véhicule pour catégorisation automatique
    pub marque_modele: Option<String>,
    pub annee: Option<i32>,
    pub climatisation: Option<bool>,
    pub wifi: Option<bool>,
    pub time_of_day: Option<chrono::DateTime<chrono::Utc>>,
}

/// ✅ POST /api/taxi/dynamic-price
/// Calculer prix dynamique avec IA
pub async fn calculate_dynamic_price(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<DynamicPricingRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[calculate_dynamic_price] User {} calcule prix dynamique",
        user_id
    );

    // Créer zone
    let zone = PredictionZone {
        zone_id: payload.zone_id,
        latitude: payload.latitude,
        longitude: payload.longitude,
        radius_km: payload.radius_km.unwrap_or(10.0),
        name: None,
    };

    // Créer service prix dynamique
    let mut pricing_service = TaxiDynamicPricingService::new(Arc::new(state.pg.clone()));

    // Injecter AppIA
    pricing_service = pricing_service.with_app_ia(state.ia.clone());

    // Créer service prédiction
    let mut prediction_service = TaxiDemandPredictionService::new(Arc::new(state.pg.clone()));
    prediction_service = prediction_service.with_app_ia(state.ia.clone());
    pricing_service = pricing_service.with_prediction_service(Arc::new(prediction_service));

    // Créer requête pricing
    let pricing_request = crate::services::taxi_dynamic_pricing_service::PricingRequest {
        base_price: payload.base_price,
        distance_km: payload.distance_km,
        zone,
        vehicle_type: payload.vehicle_type,
        marque_modele: payload.marque_modele,
        annee: payload.annee,
        climatisation: payload.climatisation,
        wifi: payload.wifi,
        time_of_day: payload.time_of_day,
    };

    // Calculer prix
    let dynamic_price = pricing_service.calculate_dynamic_price(pricing_request).await?;

    info!(
        "[calculate_dynamic_price] ✅ Prix calculé: {} → {} (×{:.2})",
        dynamic_price.base_price, dynamic_price.final_price, dynamic_price.dynamic_multiplier
    );

    Ok(Json(json!({
        "success": true,
        "data": dynamic_price,
    })))
}
