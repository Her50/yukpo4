// Contrôleur pour la recherche avec planifications
use sqlx::PgPool;
use crate::services::scheduling_search_service::{SchedulingSearchService, PharmacyOnDuty, MedicalServiceAvailability};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct PharmacySearchParams {
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub max_distance: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct MedicalSearchParams {
    pub service: Option<String>,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub max_distance: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct SchedulingSearchParams {
    pub query: String,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub max_distance: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct SchedulingSearchResponse {
    pub results: Vec<SchedulingSearchResult>,
    pub total: usize,
    pub search_intent: String,
}

#[derive(Debug, Serialize)]
pub struct SchedulingSearchResult {
    pub service_id: i32,
    pub product_data: serde_json::Value,
    pub relevance_score: f64,
    pub distance_km: Option<f64>,
    pub is_available_now: bool,
    pub availability_info: String,
}

/// Recherche avancée avec planifications
pub async fn search_with_scheduling(
    Query(params): Query<SchedulingSearchParams>,
    State(pool): State<Arc<PgPool>>,
) -> Result<Json<SchedulingSearchResponse>, StatusCode> {
    let scheduling_service = SchedulingSearchService::new((*pool).clone());
    
    // Analyser l'intention de recherche
    let intent = scheduling_service.analyze_search_intent(&params.query);
    
    let results = scheduling_service.search_with_scheduling(
        &params.query,
        None, // Utilise NOW()
        params.lat,
        params.lng,
        params.max_distance,
    ).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let search_results: Vec<SchedulingSearchResult> = results.into_iter().map(|r| SchedulingSearchResult {
        service_id: r.service_id,
        product_data: r.product_data,
        relevance_score: r.relevance_score,
        distance_km: r.distance_km,
        is_available_now: r.is_available_now,
        availability_info: r.availability_info,
    }).collect();

    Ok(Json(SchedulingSearchResponse {
        results: search_results,
        total: search_results.len(),
        search_intent: format!("{:?}", intent),
    }))
}

/// Recherche de pharmacies de garde
pub async fn get_pharmacies_on_duty(
    Query(params): Query<PharmacySearchParams>,
    State(pool): State<Arc<PgPool>>,
) -> Result<Json<Vec<PharmacyOnDuty>>, StatusCode> {
    let scheduling_service = SchedulingSearchService::new((*pool).clone());
    
    let results = scheduling_service.search_pharmacies_on_duty(
        params.lat,
        params.lng,
        params.max_distance,
    ).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(results))
}

/// Recherche de services médicaux disponibles
pub async fn get_available_medical_services(
    Query(params): Query<MedicalSearchParams>,
    State(pool): State<Arc<PgPool>>,
) -> Result<Json<Vec<MedicalServiceAvailability>>, StatusCode> {
    let scheduling_service = SchedulingSearchService::new((*pool).clone());
    
    let results = scheduling_service.search_available_medical_services(
        params.service.as_deref(),
        params.lat,
        params.lng,
        params.max_distance,
    ).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(results))
}

/// Rafraîchir la vue matérialisée des pharmacies de garde
pub async fn refresh_pharmacies_on_duty(
    State(pool): State<Arc<PgPool>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let scheduling_service = SchedulingSearchService::new((*pool).clone());
    
    scheduling_service.refresh_pharmacies_on_duty()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Vue matérialisée des pharmacies de garde rafraîchie avec succès"
    })))
}
