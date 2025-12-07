//! ✅ Contrôleur Optimisation Itinéraires IA - Taxi
//!
//! Optimisation multi-points avec IA et ML

use crate::core::types::AppResult;
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::taxi_route_optimization_service::TaxiRouteOptimizationService;
use crate::state::AppState;
use axum::{
    extract::{Extension, State},
    response::IntoResponse,
    Json,
};
use log::info;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

/// Requête pour optimisation d'itinéraire
#[derive(Debug, Deserialize)]
pub struct RouteOptimizationRequest {
    pub origin: RoutePoint,
    pub destination: RoutePoint,
    pub waypoints: Option<Vec<RoutePoint>>,
    pub optimize_waypoints: Option<bool>, // Réorganiser waypoints pour optimiser
    pub avoid_tolls: Option<bool>,
    pub avoid_highways: Option<bool>,
    pub vehicle_type: Option<String>, // "taxi", "covoiturage"
    pub preferences: Option<RoutePreferences>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct RoutePoint {
    pub latitude: f64,
    pub longitude: f64,
    pub address: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RoutePreferences {
    pub prioritize_time: Option<bool>, // Prioriser temps vs distance
    pub prioritize_distance: Option<bool>,
    pub avoid_traffic: Option<bool>,
    pub use_ml_prediction: Option<bool>, // Utiliser ML pour prédire trafic
}

/// Résultat d'optimisation
#[derive(Debug, Serialize)]
pub struct OptimizedRoute {
    pub waypoints_order: Vec<usize>, // Ordre optimisé des waypoints
    pub total_distance_km: f64,
    pub total_duration_minutes: i32,
    pub estimated_cost: Option<i32>,
    pub route_points: Vec<RoutePoint>,
    pub polyline: Option<String>, // Encodage polyline pour carte
    pub traffic_info: Option<TrafficInfo>,
    pub optimization_score: f64, // Score d'optimisation (0-100)
}

#[derive(Debug, Serialize)]
pub struct TrafficInfo {
    pub current_delay_minutes: i32,
    pub predicted_delay_minutes: i32,
    pub traffic_level: String, // "low", "medium", "high", "very_high"
    pub ml_confidence: f32,
}

/// ✅ POST /api/taxi/optimize-route
/// Optimiser un itinéraire avec IA
pub async fn optimize_route(
    State(_state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<RouteOptimizationRequest>,
) -> AppResult<impl IntoResponse> {
    info!("[optimize_route] User {} optimise itinéraire", user_id);

    // Créer service d'optimisation
    let optimization_service = TaxiRouteOptimizationService::new();

    // Convertir RoutePoint du contrôleur vers service
    let origin = crate::services::taxi_route_optimization_service::RoutePoint {
        latitude: payload.origin.latitude,
        longitude: payload.origin.longitude,
        address: payload.origin.address.clone(),
        stop_duration_minutes: None,
    };

    let destination = crate::services::taxi_route_optimization_service::RoutePoint {
        latitude: payload.destination.latitude,
        longitude: payload.destination.longitude,
        address: payload.destination.address.clone(),
        stop_duration_minutes: None,
    };

    let waypoints = payload.waypoints.map(|wps| {
        wps.into_iter()
            .map(
                |wp| crate::services::taxi_route_optimization_service::RoutePoint {
                    latitude: wp.latitude,
                    longitude: wp.longitude,
                    address: wp.address.clone(),
                    stop_duration_minutes: None,
                },
            )
            .collect()
    });

    let preferences = payload.preferences.map(|prefs| {
        crate::services::taxi_route_optimization_service::RoutePreferences {
            prioritize_time: prefs.prioritize_time,
            prioritize_distance: prefs.prioritize_distance,
            avoid_traffic: prefs.avoid_traffic,
            use_ml_prediction: prefs.use_ml_prediction,
            avoid_tolls: payload.avoid_tolls,
            avoid_highways: payload.avoid_highways,
        }
    });

    // Optimiser
    let optimized_route = optimization_service
        .optimize_route(&origin, &destination, waypoints, preferences)
        .await?;

    info!(
        "[optimize_route] ✅ Itinéraire optimisé: {}km, {}min, score={:.1}%",
        optimized_route.total_distance_km,
        optimized_route.total_duration_minutes,
        optimized_route.optimization_score
    );

    // Convertir vers format contrôleur
    let route_response = OptimizedRoute {
        waypoints_order: optimized_route.waypoints_order,
        total_distance_km: optimized_route.total_distance_km,
        total_duration_minutes: optimized_route.total_duration_minutes,
        estimated_cost: optimized_route.estimated_cost,
        route_points: optimized_route
            .route_points
            .into_iter()
            .map(|rp| RoutePoint {
                latitude: rp.latitude,
                longitude: rp.longitude,
                address: rp.address,
            })
            .collect(),
        polyline: optimized_route.polyline,
        traffic_info: optimized_route.traffic_info.map(|ti| TrafficInfo {
            current_delay_minutes: ti.current_delay_minutes,
            predicted_delay_minutes: ti.predicted_delay_minutes,
            traffic_level: ti.traffic_level,
            ml_confidence: ti.ml_confidence,
        }),
        optimization_score: optimized_route.optimization_score,
    };

    Ok(Json(json!({
        "success": true,
        "data": route_response,
    })))
}

// TODO: Implémenter service réel d'optimisation avec Google Maps + ML
