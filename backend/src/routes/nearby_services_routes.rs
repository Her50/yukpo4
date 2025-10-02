use std::sync::Arc;
use axum::{
    extract::{Query, State},
    response::Json,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};

use crate::state::AppState;

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
    
    // Utiliser la fonction PostgreSQL existante pour la recherche GPS
    let services = match sqlx::query_as!(
        NearbyService,
        r#"
        SELECT 
            s.id::text as id,
            COALESCE(s.data->'titre_service'->>'valeur', s.data->'titre'->>'valeur', 'Service') as name,
            COALESCE(s.data->'description'->>'valeur', 'Service disponible') as description,
            COALESCE(s.data->'category'->>'valeur', s.category, 'Général') as category,
            ROUND(
                ST_Distance(
                    ST_GeogFromText('POINT(' || $2 || ' ' || $1 || ')'),
                    ST_GeogFromText('POINT(' || SPLIT_PART(s.gps, ',', 2) || ' ' || SPLIT_PART(s.gps, ',', 1) || ')')
                )
            )::int as distance,
            0.0 as rating,
            '€' as price,
            CAST(SPLIT_PART(s.gps, ',', 1) AS FLOAT) as latitude,
            CAST(SPLIT_PART(s.gps, ',', 2) AS FLOAT) as longitude,
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
        "#,
        params.latitude,
        params.longitude,
        radius as i64,
        limit as i64
    )
    .fetch_all(&state.pg)
    .await
    {
        Ok(services) => services,
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
