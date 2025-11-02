// Contrôleur pour enrichissement géographique avec GeoNames
use axum::{
    extract::{Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use log::info;
use crate::core::error::AppError;
use crate::services::geonames_service;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct EnrichLocationRequest {
    pub place_name: String,
    pub country: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct EnrichLocationResponse {
    pub place_name: String,
    pub geoname_id: Option<i64>,
    pub display_name: String,
    pub location_vector: Vec<String>,
    pub hierarchy: LocationHierarchy,
    pub coordinates: Coordinates,
    pub metadata: LocationMetadata,
}

#[derive(Debug, Serialize)]
pub struct LocationHierarchy {
    pub parents: Vec<String>,
    pub children: Vec<String>,
    pub is_leaf: bool,
    pub admin_level: i32,
}

#[derive(Debug, Serialize)]
pub struct Coordinates {
    pub lat: f64,
    pub lng: f64,
}

#[derive(Debug, Serialize)]
pub struct LocationMetadata {
    pub country: String,
    pub country_code: Option<String>,
    pub population: Option<i32>,
    pub timezone: Option<String>,
}

/// GET /api/places/enrich
/// Enrichit un lieu avec sa hiérarchie géographique complète
pub async fn enrich_location(
    State(state): State<Arc<AppState>>,
    Query(params): Query<EnrichLocationRequest>,
) -> Result<Json<EnrichLocationResponse>, AppError> {
    info!("🌍 Enrichissement lieu: {} ({})", params.place_name, params.country.as_deref().unwrap_or("?"));
    
    let pool = &state.pg;
    
    // 1. Chercher dans cache d'abord
    let cached = sqlx::query!(
        "SELECT 
            geoname_id,
            display_name,
            location_vector,
            admin_level,
            is_leaf,
            parent_country,
            parent_country_code,
            lat,
            lng,
            population,
            timezone
         FROM geo_hierarchy 
         WHERE place_name = $1 AND parent_country = $2",
        params.place_name,
        params.country.as_deref().unwrap_or("")
    )
    .fetch_optional(pool)
    .await?;
    
    if let Some(cached) = cached {
        info!("✅ Trouvé en cache pour {}", params.place_name);
        
        // Séparer location_vector en parents et enfants
        let location_vector = cached.location_vector.clone();
        let children = if location_vector.len() > 1 {
            location_vector[1..].iter()
                .take_while(|s| !cached.parent_country.contains(*s))
                .cloned()
                .collect()
        } else {
            vec![]
        };
        
        let parents = if location_vector.len() > 1 {
            location_vector[1..].iter()
                .skip_while(|s| !cached.parent_country.contains(*s))
                .cloned()
                .collect()
        } else {
            vec![]
        };
        
        return Ok(Json(EnrichLocationResponse {
            place_name: params.place_name.clone(),
            geoname_id: Some(cached.geoname_id),
            display_name: cached.display_name,
            location_vector: cached.location_vector,
            hierarchy: LocationHierarchy {
                parents,
                children,
                is_leaf: cached.is_leaf,
                admin_level: cached.admin_level,
            },
            coordinates: Coordinates {
                lat: cached.lat.to_f64().unwrap_or(0.0),
                lng: cached.lng.to_f64().unwrap_or(0.0),
            },
            metadata: LocationMetadata {
                country: cached.parent_country,
                country_code: cached.parent_country_code,
                population: cached.population,
                timezone: cached.timezone,
            },
        }));
    }
    
    // 2. Pas en cache → Enrichir avec GeoNames
    info!("🌍 Pas en cache, enrichissement avec GeoNames...");
    
    let location_vector = geonames_service::enrich_location_bidirectional(
        pool,
        &params.place_name,
        params.country.as_deref(),
    )
    .await?;
    
    // 3. Re-fetch après enrichissement
    let enriched = sqlx::query!(
        "SELECT 
            geoname_id,
            display_name,
            location_vector,
            admin_level,
            is_leaf,
            parent_country,
            parent_country_code,
            lat,
            lng,
            population,
            timezone
         FROM geo_hierarchy 
         WHERE place_name = $1 AND parent_country = $2",
        params.place_name,
        params.country.as_deref().unwrap_or("")
    )
    .fetch_one(pool)
    .await?;
    
    // Séparer location_vector en parents et enfants
    let children = if enriched.location_vector.len() > 1 {
        enriched.location_vector[1..].iter()
            .take_while(|s| !enriched.parent_country.contains(*s))
            .cloned()
            .collect()
    } else {
        vec![]
    };
    
    let parents = if enriched.location_vector.len() > 1 {
        enriched.location_vector[1..].iter()
            .skip_while(|s| !enriched.parent_country.contains(*s))
            .cloned()
            .collect()
    } else {
        vec![]
    };
    
    info!("✅ Enrichissement terminé pour {} : {} éléments", params.place_name, enriched.location_vector.len());
    
    Ok(Json(EnrichLocationResponse {
        place_name: params.place_name,
        geoname_id: Some(enriched.geoname_id),
        display_name: enriched.display_name,
        location_vector: enriched.location_vector,
        hierarchy: LocationHierarchy {
            parents,
            children,
            is_leaf: enriched.is_leaf,
            admin_level: enriched.admin_level,
        },
        coordinates: Coordinates {
            lat: enriched.lat.to_f64().unwrap_or(0.0),
            lng: enriched.lng.to_f64().unwrap_or(0.0),
        },
        metadata: LocationMetadata {
            country: enriched.parent_country,
            country_code: enriched.parent_country_code,
            population: enriched.population,
            timezone: enriched.timezone,
        },
    }))
}

