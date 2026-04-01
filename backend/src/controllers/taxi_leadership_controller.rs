//! ✅ Contrôleur Leadership Global - Taxi & Covoiturage
//!
//! Endpoints pour IA Prédictive, Optimisation, Recommandations
//! Objectif: Atteindre 100% de leadership technique

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::taxi_demand_prediction_service::{
    PredictionPeriod, PredictionZone, TaxiDemandPredictionService,
};
use crate::state::AppState;
use axum::{
    extract::{Extension, Query, State},
    response::IntoResponse,
    Json,
};
use log::{error, info};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

/// Requête pour prédiction de demande
#[derive(Debug, Deserialize)]
pub struct DemandPredictionRequest {
    pub zone_id: String,
    pub latitude: f64,
    pub longitude: f64,
    pub radius_km: Option<f64>,
    pub period: String, // "next_hour" | "next_day" | "next_week"
    pub target_datetime: Option<chrono::DateTime<chrono::Utc>>,
    pub zone_name: Option<String>,
}

/// Requête pour prédiction multi-zones
#[derive(Debug, Deserialize)]
pub struct MultiZonePredictionRequest {
    pub zones: Vec<ZonePredictionRequest>,
    pub period: String,
    pub target_datetime: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct ZonePredictionRequest {
    pub zone_id: String,
    pub latitude: f64,
    pub longitude: f64,
    pub radius_km: Option<f64>,
    pub zone_name: Option<String>,
}

/// ✅ POST /api/taxi/demand-prediction
/// Prédire la demande pour une zone géographique
pub async fn predict_demand(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<DemandPredictionRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[predict_demand] User {} prédit demande zone={}",
        user_id, payload.zone_id
    );

    // Valider période
    let period = match payload.period.as_str() {
        "next_hour" => PredictionPeriod::NextHour,
        "next_day" => PredictionPeriod::NextDay,
        "next_week" => PredictionPeriod::NextWeek,
        _ => {
            return Err(AppError::BadRequest(
                "Période doit être: 'next_hour', 'next_day', ou 'next_week'".to_string(),
            ));
        }
    };

    // Créer zone
    let zone = PredictionZone {
        zone_id: payload.zone_id,
        latitude: payload.latitude,
        longitude: payload.longitude,
        radius_km: payload.radius_km.unwrap_or(10.0),
        name: payload.zone_name,
    };

    // Créer service de prédiction
    let mut prediction_service = TaxiDemandPredictionService::new(Arc::new(state.pg.clone()));

    // Injecter AppIA (state.ia est directement Arc<AppIA>)
    prediction_service = prediction_service.with_app_ia(state.ia.clone());

    // Prédire
    let prediction = prediction_service
        .predict_demand(&zone, period, payload.target_datetime)
        .await?;

    info!(
        "[predict_demand] ✅ Prédiction complétée: demande={:.2}, confiance={:.2}%",
        prediction.predicted_demand,
        prediction.confidence * 100.0
    );

    Ok(Json(json!({
        "success": true,
        "data": prediction,
        "metrics": prediction_service.get_metrics(),
    })))
}

/// ✅ POST /api/taxi/demand-prediction/multi-zone
/// Prédire la demande pour plusieurs zones simultanément
pub async fn predict_demand_multi_zone(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<MultiZonePredictionRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[predict_demand_multi_zone] User {} prédit demande pour {} zones",
        user_id,
        payload.zones.len()
    );

    // Valider période
    let period = match payload.period.as_str() {
        "next_hour" => PredictionPeriod::NextHour,
        "next_day" => PredictionPeriod::NextDay,
        "next_week" => PredictionPeriod::NextWeek,
        _ => {
            return Err(AppError::BadRequest(
                "Période doit être: 'next_hour', 'next_day', ou 'next_week'".to_string(),
            ));
        }
    };

    // Créer service
    let mut prediction_service = TaxiDemandPredictionService::new(Arc::new(state.pg.clone()));
    prediction_service = prediction_service.with_app_ia(state.ia.clone());

    // Prédire pour chaque zone
    let zones_count = payload.zones.len();
    let mut predictions = Vec::new();
    for zone_req in payload.zones {
        let zone = PredictionZone {
            zone_id: zone_req.zone_id,
            latitude: zone_req.latitude,
            longitude: zone_req.longitude,
            radius_km: zone_req.radius_km.unwrap_or(10.0),
            name: zone_req.zone_name,
        };

        match prediction_service
            .predict_demand(&zone, period.clone(), payload.target_datetime)
            .await
        {
            Ok(pred) => predictions.push(pred),
            Err(e) => {
                error!(
                    "[predict_demand_multi_zone] Erreur zone {}: {}",
                    zone.zone_id, e
                );
                // Continue avec les autres zones
            }
        }
    }

    info!(
        "[predict_demand_multi_zone] ✅ {} prédictions complétées sur {}",
        predictions.len(),
        zones_count
    );

    Ok(Json(json!({
        "success": true,
        "data": predictions,
        "total_zones": zones_count,
        "successful_predictions": predictions.len(),
        "metrics": prediction_service.get_metrics(),
    })))
}

/// ✅ GET /api/taxi/demand-prediction/metrics
/// Obtenir les métriques du service de prédiction
pub async fn get_prediction_metrics(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_prediction_metrics] User {} demande métriques",
        user_id
    );

    let prediction_service = TaxiDemandPredictionService::new(Arc::new(state.pg.clone()));
    let metrics = prediction_service.get_metrics();
    let cache_size = prediction_service.get_cache_size().await;

    Ok(Json(json!({
        "success": true,
        "data": {
            "metrics": metrics,
            "cache_size": cache_size,
        }
    })))
}

/// ✅ GET /api/taxi/demand-prediction/heatmap
/// Obtenir une heatmap de prédiction pour une zone
pub async fn get_demand_heatmap(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<HeatmapQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[get_demand_heatmap] User {} demande heatmap", user_id);

    // Valider période
    let period = match params.period.as_deref().unwrap_or("next_day") {
        "next_hour" => PredictionPeriod::NextHour,
        "next_day" => PredictionPeriod::NextDay,
        "next_week" => PredictionPeriod::NextWeek,
        _ => PredictionPeriod::NextDay,
    };

    // Créer zone centrale
    let _center_zone = PredictionZone {
        zone_id: "heatmap_center".to_string(),
        latitude: params.center_lat,
        longitude: params.center_lng,
        radius_km: params.radius_km.unwrap_or(5.0),
        name: None,
    };

    // Créer service
    let mut prediction_service = TaxiDemandPredictionService::new(Arc::new(state.pg.clone()));
    prediction_service = prediction_service.with_app_ia(state.ia.clone());

    // Générer grid de zones pour heatmap
    let grid_size = params.grid_size.unwrap_or(5); // 5x5 grid
    let step_lat = params.radius_km.unwrap_or(5.0) / (grid_size as f64 * 2.0);
    let step_lng = params.radius_km.unwrap_or(5.0) / (grid_size as f64 * 2.0);

    let mut heatmap_data = Vec::new();

    for i in 0..grid_size {
        for j in 0..grid_size {
            let lat = params.center_lat + (i as f64 - grid_size as f64 / 2.0) * step_lat;
            let lng = params.center_lng + (j as f64 - grid_size as f64 / 2.0) * step_lng;

            let zone = PredictionZone {
                zone_id: format!("grid_{}_{}", i, j),
                latitude: lat,
                longitude: lng,
                radius_km: step_lat,
                name: None,
            };

            if let Ok(prediction) = prediction_service
                .predict_demand(&zone, period.clone(), params.target_datetime)
                .await
            {
                heatmap_data.push(json!({
                    "latitude": lat,
                    "longitude": lng,
                    "demand": prediction.predicted_demand,
                    "confidence": prediction.confidence,
                    "color_intensity": (prediction.predicted_demand / 10.0).min(1.0), // Normalisé 0-1
                }));
            }
        }
    }

    Ok(Json(json!({
        "success": true,
        "data": {
            "heatmap": heatmap_data,
            "center": {
                "latitude": params.center_lat,
                "longitude": params.center_lng,
            },
            "radius_km": params.radius_km.unwrap_or(5.0),
            "grid_size": grid_size,
        }
    })))
}

#[derive(Debug, Deserialize)]
pub struct HeatmapQuery {
    pub center_lat: f64,
    pub center_lng: f64,
    pub radius_km: Option<f64>,
    pub period: Option<String>,
    pub grid_size: Option<u8>,
    pub target_datetime: Option<chrono::DateTime<chrono::Utc>>,
}
