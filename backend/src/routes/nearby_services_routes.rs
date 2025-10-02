use std::sync::Arc;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

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
) -> Result<Json<NearbyServicesResponse>, StatusCode> {
    let radius = params.radius.unwrap_or(5000); // 5km par défaut
    let limit = params.limit.unwrap_or(20); // 20 services par défaut
    
    // Utiliser la fonction PostgreSQL existante pour la recherche GPS
    let services = sqlx::query_as!(
        NearbyService,
        r#"
        SELECT 
            s.id::text as id,
            s.titre as name,
            COALESCE(s.description, 'Service disponible') as description,
            COALESCE(s.categorie, 'Général') as category,
            ROUND(
                ST_Distance(
                    ST_GeogFromText('POINT(' || $2 || ' ' || $1 || ')'),
                    ST_GeogFromText('POINT(' || s.longitude || ' ' || s.latitude || ')')
                )
            )::int as distance,
            COALESCE(s.rating, 0.0) as rating,
            COALESCE(s.prix, '€') as price,
            s.latitude,
            s.longitude,
            COALESCE(s.adresse, 'Adresse non disponible') as address,
            s.telephone as phone,
            s.site_web as website
        FROM services s
        WHERE 
            s.latitude IS NOT NULL 
            AND s.longitude IS NOT NULL
            AND ST_DWithin(
                ST_GeogFromText('POINT(' || $2 || ' ' || $1 || ')'),
                ST_GeogFromText('POINT(' || s.longitude || ' ' || s.latitude || ')'),
                $3
            )
            AND s.actif = true
        ORDER BY 
            ST_Distance(
                ST_GeogFromText('POINT(' || $2 || ' ' || $1 || ')'),
                ST_GeogFromText('POINT(' || s.longitude || ' ' || s.latitude || ')')
            )
        LIMIT $4
        "#,
        params.latitude,
        params.longitude,
        radius as i64,
        limit as i64
    )
    .fetch_all(&state.pg_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(NearbyServicesResponse { services }))
}

pub fn nearby_services_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::<Arc<AppState>>::new()
        .route("/services/nearby", get(get_nearby_services))
        .with_state(state)
}
