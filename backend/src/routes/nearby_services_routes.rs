use axum::{
    extract::{Query, State},
    response::Json,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::state::AppState;
use sqlx::FromRow;

#[derive(FromRow)]
struct NearbyServiceRow {
    id: i32,
    name: Option<String>,
    description: Option<String>,
    category: Option<String>,
    distance: Option<i32>,
    latitude: Option<f64>,
    longitude: Option<f64>,
    address: Option<String>,
    phone: Option<String>,
    website: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct NearbyServicesParams {
    pub latitude: f64,
    pub longitude: f64,
    pub radius: Option<i32>,
    pub limit: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct NearbyServicesResponse {
    pub services: Vec<NearbyService>,
}

#[derive(Debug, Serialize)]
pub struct NearbyService {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub distance: i32,
    pub rating: f64,
    pub price: String,
    pub latitude: f64,
    pub longitude: f64,
    pub address: String,
    pub phone: Option<String>,
    pub website: Option<String>,
}

/// Récupère les services à proximité d'une position GPS
pub async fn get_nearby_services(
    Query(params): Query<NearbyServicesParams>,
    State(state): State<Arc<AppState>>,
) -> Json<NearbyServicesResponse> {
    let radius = params.radius.unwrap_or(5000); // 5km par défaut
    let limit = params.limit.unwrap_or(20); // 20 services par défaut

    // Requête simplifiée pour éviter les problèmes de types
    let lat_str = params.latitude.to_string();
    let lon_str = params.longitude.to_string();
    let services: Vec<NearbyService> = match sqlx::query_as::<_, NearbyServiceRow>(
        r#"
        SELECT 
            s.id,
            COALESCE(s.data->'titre_service'->>'valeur', s.data->'titre'->>'valeur', 'Service') as name,
            COALESCE(s.data->'description'->>'valeur', 'Service disponible') as description,
            COALESCE(s.data->'category'->>'valeur', s.category, 'Général') as category,
            ROUND(
                ST_Distance(
                    ST_GeogFromText('POINT(' || $2 || ' ' || $1 || ')'),
                    ST_GeogFromText('POINT(' || SPLIT_PART(s.gps, ',', 2) || ' ' || SPLIT_PART(s.gps, ',', 1) || ')')
                )
            )::int as distance,
            COALESCE(CAST(SPLIT_PART(s.gps, ',', 1) AS FLOAT), 0.0) as latitude,
            COALESCE(CAST(SPLIT_PART(s.gps, ',', 2) AS FLOAT), 0.0) as longitude,
            COALESCE(s.data->'adresse'->>'valeur', 'Adresse non disponible') as address,
            s.data->'telephone'->>'valeur' as phone,
            s.data->'site_web'->>'valeur' as website
        FROM services s
        WHERE 
            s.gps IS NOT NULL 
            AND s.gps != ''
            AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$'
            AND ST_DWithin(
                ST_GeogFromText('POINT(' || $2 || ' ' || $1 || ')'),
                ST_GeogFromText('POINT(' || SPLIT_PART(s.gps, ',', 2) || ' ' || SPLIT_PART(s.gps, ',', 1) || ')'),
                $3
            )
            AND s.is_active = true
        ORDER BY 
            ST_Distance(
                ST_GeogFromText('POINT(' || $2 || ' ' || $1 || ')'),
                ST_GeogFromText('POINT(' || SPLIT_PART(s.gps, ',', 2) || ' ' || SPLIT_PART(s.gps, ',', 1) || ')')
            )
        LIMIT $4
        "#
    )
    .bind(&lat_str)
    .bind(&lon_str)
    .bind(radius as i64)
    .bind(limit as i64)
    .fetch_all(&state.pg)
    .await
    {
        Ok(rows) => {
            rows.into_iter().map(|row| NearbyService {
                id: row.id.to_string(),
                name: row.name.unwrap_or_else(|| "Service".to_string()),
                description: row.description.unwrap_or_else(|| "Service disponible".to_string()),
                category: row.category.unwrap_or_else(|| "Général".to_string()),
                distance: row.distance.unwrap_or(0),
                rating: 0.0,
                price: "€".to_string(),
                latitude: row.latitude.unwrap_or(0.0),
                longitude: row.longitude.unwrap_or(0.0),
                address: row.address.unwrap_or_else(|| "Adresse non disponible".to_string()),
                phone: row.phone,
                website: row.website,
            }).collect()
        },
        Err(_) => {
            return Json(NearbyServicesResponse { services: vec![] });
        }
    };

    Json(NearbyServicesResponse { services })
}

pub fn nearby_services_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::<Arc<AppState>>::new()
        .route("/services/nearby", get(get_nearby_services))
        .with_state(state)
}
