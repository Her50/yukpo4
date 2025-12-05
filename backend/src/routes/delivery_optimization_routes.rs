//! ✅ Routes API pour optimisation et ML (VRP, ETA, Recommendations, Forecasting, Fraud)

use crate::core::types::AppError;
use crate::services::{
    delivery_ai_eta_service::{DeliveryAIETAService, Location as ETALocation},
    delivery_ai_forecasting_service::{
        DeliveryAIForecastingService, GeoZone as AIGeoZone, TimePeriod,
    },
    delivery_ai_recommendations::{DeliveryAIRecommendationsService, RecommendationContext},
    delivery_demand_forecasting::{DeliveryDemandForecastingService, GeoZone},
    delivery_fraud_detection::{DeliveryData, DeliveryFraudDetectionService},
    delivery_ml_eta::{DeliveryMLETAService, ETAFeatures},
    delivery_vrp_solver::{DeliveryPoint, DeliveryVRPSolver},
};
use crate::state::AppState;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use std::sync::Arc;
use std::sync::Mutex;
use uuid::Uuid;

/// POST /api/delivery/vrp/solve
/// Résout le VRP pour optimiser les routes
pub async fn solve_vrp(
    State(_state): State<Arc<AppState>>,
    Json(payload): Json<SolveVRPRequest>,
) -> Result<impl IntoResponse, AppError> {
    let solver = DeliveryVRPSolver::new();

    let solution = solver
        .solve(
            payload.deliveries,
            payload.courier_positions,
            payload.max_deliveries_per_courier.unwrap_or(10),
        )
        .await?;

    Ok((StatusCode::OK, Json(solution)))
}

#[derive(Debug, Deserialize)]
pub struct SolveVRPRequest {
    pub deliveries: Vec<DeliveryPoint>,
    pub courier_positions: Vec<(i32, f64, f64)>, // (courier_id, lat, lng)
    pub max_deliveries_per_courier: Option<usize>,
}

/// POST /api/delivery/eta/predict
/// Prédit l'ETA avec IA (fallback sur ML si IA non disponible)
pub async fn predict_eta(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<PredictETARequest>,
) -> Result<impl IntoResponse, AppError> {
    // ✅ NOUVEAU: Utiliser le service IA avec fallback
    let ai_service =
        DeliveryAIETAService::new(Arc::new(state.pg.clone())).with_ia(state.ia.clone());

    // Convertir les features en Location
    let origin = ETALocation {
        lat: payload.origin_lat.unwrap_or(0.0),
        lng: payload.origin_lng.unwrap_or(0.0),
    };
    let destination = ETALocation {
        lat: payload.destination_lat.unwrap_or(0.0),
        lng: payload.destination_lng.unwrap_or(0.0),
    };

    // Calculer distance si non fournie
    let distance_km = payload.distance_km.unwrap_or_else(|| {
        // Formule de Haversine simplifiée
        let lat_diff = (destination.lat - origin.lat).to_radians();
        let lng_diff = (destination.lng - origin.lng).to_radians();
        let a = (lat_diff / 2.0).sin().powi(2)
            + origin.lat.to_radians().cos()
                * destination.lat.to_radians().cos()
                * (lng_diff / 2.0).sin().powi(2);
        let c = 2.0 * a.sqrt().asin();
        6371.0 * c // Rayon de la Terre en km
    });

    // Essayer d'abord avec l'IA (nécessite &mut)
    let delivery_type = payload
        .delivery_type
        .clone()
        .unwrap_or_else(|| "parcel".to_string());
    let mut ai_service_mut = ai_service;
    match ai_service_mut
        .predict_eta_with_ai(
            &origin,
            &destination,
            distance_km,
            &delivery_type,
            payload.courier_rating,
        )
        .await
    {
        Ok(eta) => {
            log::info!(
                "[ETA Route] Prédiction IA réussie: {} min",
                eta.estimated_minutes
            );
            Ok((StatusCode::OK, Json(eta)))
        }
        Err(e) => {
            log::warn!("[ETA Route] Erreur IA, fallback ML: {}", e);
            // Fallback sur l'ancien service ML
            let mut ml_service = DeliveryMLETAService::new();
            let features = ETAFeatures {
                distance_km,
                hour_of_day: payload.hour_of_day.unwrap_or(12),
                day_of_week: payload.day_of_week.unwrap_or(1),
                is_weekend: payload.is_weekend.unwrap_or(false),
                courier_avg_speed_kmh: payload.courier_avg_speed_kmh.unwrap_or(30.0),
                courier_rating: payload.courier_rating.unwrap_or(4.0),
                delivery_type: delivery_type.clone(),
                weather_factor: payload.weather_factor.unwrap_or(1.0),
                traffic_factor: payload.traffic_factor.unwrap_or(1.0),
                route_complexity: payload.route_complexity.unwrap_or(0.5),
            };
            let prediction = ml_service.predict_eta(features, payload.courier_id).await?;
            // Convertir en format EstimatedTime
            let eta = crate::services::delivery_ai_eta_service::EstimatedTime {
                estimated_minutes: prediction.estimated_minutes,
                confidence: prediction.confidence,
                lower_bound_minutes: prediction.lower_bound_minutes,
                upper_bound_minutes: prediction.upper_bound_minutes,
                factors: prediction.factors,
                risk_factors: vec!["Fallback ML (IA non disponible)".to_string()],
                method: "ml_fallback".to_string(),
            };
            Ok((StatusCode::OK, Json(eta)))
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct PredictETARequest {
    // Coordonnées pour l'IA
    pub origin_lat: Option<f64>,
    pub origin_lng: Option<f64>,
    pub destination_lat: Option<f64>,
    pub destination_lng: Option<f64>,
    pub distance_km: Option<f64>,
    pub delivery_type: Option<String>,
    pub courier_rating: Option<f32>,
    pub courier_id: Option<i32>,
    // Features pour fallback ML
    pub hour_of_day: Option<u8>,
    pub day_of_week: Option<u8>,
    pub is_weekend: Option<bool>,
    pub courier_avg_speed_kmh: Option<f64>,
    pub weather_factor: Option<f32>,
    pub traffic_factor: Option<f32>,
    pub route_complexity: Option<f32>,
}

/// GET /api/delivery/recommendations
/// Obtenir recommandations produits IA
pub async fn get_recommendations(
    State(state): State<Arc<AppState>>,
    Query(params): Query<RecommendationsQuery>,
) -> Result<impl IntoResponse, AppError> {
    // ✅ NOUVEAU: Connecter au service IA existant
    let mut service = DeliveryAIRecommendationsService::new().with_ia(state.ia.clone());

    let context = RecommendationContext {
        user_id: params.user_id,
        current_cart: params.current_cart.unwrap_or_default(),
        delivery_location: params.delivery_location,
        delivery_type: params
            .delivery_type
            .unwrap_or_else(|| "shopping".to_string()),
        budget_range: params.budget_range,
        preferences: params.preferences.unwrap_or_default(),
    };

    let recommendations = service
        .get_recommendations(context, params.max_results.unwrap_or(10))
        .await?;

    Ok((StatusCode::OK, Json(recommendations)))
}

#[derive(Debug, Deserialize)]
pub struct RecommendationsQuery {
    pub user_id: i32,
    #[serde(default)]
    pub current_cart: Option<Vec<i32>>,
    pub delivery_location: Option<(f64, f64)>,
    pub delivery_type: Option<String>,
    pub budget_range: Option<(f64, f64)>,
    #[serde(default)]
    pub preferences: Option<std::collections::HashMap<String, String>>,
    pub max_results: Option<usize>,
}

/// GET /api/delivery/forecast
/// Prédire demande par zone avec IA (fallback sur ML si IA non disponible)
pub async fn forecast_demand(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ForecastQuery>,
) -> Result<impl IntoResponse, AppError> {
    // ✅ NOUVEAU: Utiliser le service IA avec fallback
    let ai_service =
        DeliveryAIForecastingService::new(Arc::new(state.pg.clone())).with_ia(state.ia.clone());

    let zone = AIGeoZone {
        zone_id: params.zone_id.clone(),
        latitude: params.latitude,
        longitude: params.longitude,
        radius_km: params.radius_km.unwrap_or(5.0),
    };

    // Déterminer la période
    let time_period = match params.time_period.as_deref() {
        Some("day") => TimePeriod::NextDay,
        Some("week") => TimePeriod::NextWeek,
        Some("month") => TimePeriod::NextMonth,
        _ => TimePeriod::NextWeek, // Par défaut
    };

    // Essayer d'abord avec l'IA (nécessite &mut)
    let mut ai_service_mut = ai_service;
    match ai_service_mut
        .forecast_demand_with_ai(&zone, time_period, params.product_id)
        .await
    {
        Ok(forecast) => {
            log::info!(
                "[Forecast Route] Prévision IA réussie: {} demandes",
                forecast.predicted_demand
            );
            Ok((StatusCode::OK, Json(forecast)))
        }
        Err(e) => {
            log::warn!("[Forecast Route] Erreur IA, fallback ML: {}", e);
            // Fallback sur l'ancien service ML
            let mut ml_service = DeliveryDemandForecastingService::new();
            let ml_zone = GeoZone {
                zone_id: params.zone_id,
                latitude: params.latitude,
                longitude: params.longitude,
                radius_km: params.radius_km.unwrap_or(5.0),
            };
            let ml_forecast = ml_service
                .forecast_demand(
                    ml_zone,
                    params.hour.unwrap_or(12),
                    params.day_of_week.unwrap_or(1),
                )
                .await?;
            // Convertir en format DemandForecast
            let forecast = crate::services::delivery_ai_forecasting_service::DemandForecast {
                predicted_demand: ml_forecast.predicted_demand,
                confidence: ml_forecast.confidence,
                trend: ml_forecast.trend,
                historical_avg: ml_forecast.historical_avg,
                factors: std::collections::HashMap::new(),
                method: "ml_fallback".to_string(),
            };
            Ok((StatusCode::OK, Json(forecast)))
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct ForecastQuery {
    pub zone_id: String,
    pub latitude: f64,
    pub longitude: f64,
    pub radius_km: Option<f64>,
    pub time_period: Option<String>, // "day", "week", "month" pour l'IA
    pub product_id: Option<i32>,     // Optionnel pour l'IA
    // Pour fallback ML
    pub hour: Option<u8>,
    pub day_of_week: Option<u8>,
}

/// POST /api/delivery/fraud/analyze
/// Analyser une livraison pour fraude
pub async fn analyze_fraud(
    State(_state): State<Arc<AppState>>,
    Json(payload): Json<AnalyzeFraudRequest>,
) -> Result<impl IntoResponse, AppError> {
    let mut service = DeliveryFraudDetectionService::new();

    let delivery_data = DeliveryData {
        delivery_id: payload.delivery_id,
        distance_km: payload.distance_km,
        duration_minutes: payload.duration_minutes,
        has_proof: payload.has_proof,
        pickup_gps: payload.pickup_gps,
        delivery_gps: payload.delivery_gps,
        payment_amount: payload.payment_amount,
    };

    let signals = service
        .analyze_delivery(
            payload.delivery_id,
            payload.user_id,
            payload.courier_id,
            delivery_data,
        )
        .await?;

    Ok((StatusCode::OK, Json(signals)))
}

#[derive(Debug, Deserialize)]
pub struct AnalyzeFraudRequest {
    pub delivery_id: Uuid,
    pub user_id: i32,
    pub courier_id: Option<i32>,
    pub distance_km: f64,
    pub duration_minutes: f64,
    pub has_proof: bool,
    pub pickup_gps: (f64, f64),
    pub delivery_gps: (f64, f64),
    pub payment_amount: f64,
}

/// POST /api/delivery/batch/optimize
/// Optimiser batch delivery
pub async fn optimize_batch_delivery(
    State(_state): State<Arc<AppState>>,
    Json(payload): Json<OptimizeBatchRequest>,
) -> Result<impl IntoResponse, AppError> {
    let solver = DeliveryVRPSolver::new();

    let batches = solver
        .optimize_batch_delivery(
            payload.deliveries,
            payload.max_batch_size.unwrap_or(5),
            payload.max_distance_km.unwrap_or(10.0),
        )
        .await?;

    Ok((StatusCode::OK, Json(batches)))
}

#[derive(Debug, Deserialize)]
pub struct OptimizeBatchRequest {
    pub deliveries: Vec<DeliveryPoint>,
    pub max_batch_size: Option<usize>,
    pub max_distance_km: Option<f64>,
}

/// GET /api/delivery/eta/metrics
/// Obtient les métriques de performance ETA
pub async fn get_eta_metrics(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    // Note: Pour obtenir les métriques, il faudrait stocker le service dans AppState
    // Pour l'instant, retourner un message indiquant que les métriques sont disponibles
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "message": "Métriques disponibles via get_metrics() sur DeliveryAIETAService",
            "note": "Intégrer le service dans AppState pour exposer les métriques via API"
        })),
    ))
}

/// GET /api/delivery/forecast/metrics
/// Obtient les métriques de performance Forecasting
pub async fn get_forecast_metrics(
    State(_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "message": "Métriques disponibles via get_metrics() sur DeliveryAIForecastingService",
            "note": "Intégrer le service dans AppState pour exposer les métriques via API"
        })),
    ))
}

/// Créer le routeur pour les routes d'optimisation
pub fn delivery_optimization_routes(state: Arc<AppState>) -> axum::Router<Arc<AppState>> {
    use axum::routing::{get, post};

    axum::Router::new()
        .route("/api/delivery/vrp/solve", post(solve_vrp))
        .route("/api/delivery/eta/predict", post(predict_eta))
        .route("/api/delivery/eta/metrics", get(get_eta_metrics))
        .route("/api/delivery/recommendations", get(get_recommendations))
        .route("/api/delivery/forecast", get(forecast_demand))
        .route("/api/delivery/forecast/metrics", get(get_forecast_metrics))
        .route("/api/delivery/fraud/analyze", post(analyze_fraud))
        .route(
            "/api/delivery/batch/optimize",
            post(optimize_batch_delivery),
        )
        .with_state(state)
}
