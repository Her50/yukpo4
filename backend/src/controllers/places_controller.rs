// Contrôleur pour enrichissement géographique avec GeoNames
use axum::{
    extract::{Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use log::info;
use crate::core::types::AppError;
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
    let cached = sqlx::query_as::<_, (
        i64, String, Vec<String>, i32, bool, String, Option<String>,
        sqlx::types::BigDecimal, sqlx::types::BigDecimal, Option<i32>, Option<String>
    )>(
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
         WHERE place_name = $1 AND parent_country = $2"
    )
    .bind(&params.place_name)
    .bind(params.country.as_deref().unwrap_or(""))
    .fetch_optional(pool)
    .await?;
    
    if let Some(cached) = cached {
        info!("✅ Trouvé en cache pour {}", params.place_name);
        
        let (geoname_id, display_name, location_vector, admin_level, is_leaf, 
             parent_country, parent_country_code, lat, lng, population, timezone) = cached;
        
        // Séparer location_vector en parents et enfants
        let children = if location_vector.len() > 1 {
            location_vector[1..].iter()
                .take_while(|s| !parent_country.contains(s.as_str()))
                .cloned()
                .collect()
        } else {
            vec![]
        };
        
        let parents = if location_vector.len() > 1 {
            location_vector[1..].iter()
                .skip_while(|s| !parent_country.contains(s.as_str()))
                .cloned()
                .collect()
        } else {
            vec![]
        };
        
        return Ok(Json(EnrichLocationResponse {
            place_name: params.place_name.clone(),
            geoname_id: Some(geoname_id),
            display_name,
            location_vector: location_vector.clone(),
            hierarchy: LocationHierarchy {
                parents,
                children,
                is_leaf,
                admin_level,
            },
            coordinates: Coordinates {
                lat: lat.to_string().parse().unwrap_or(0.0),
                lng: lng.to_string().parse().unwrap_or(0.0),
            },
            metadata: LocationMetadata {
                country: parent_country,
                country_code: parent_country_code,
                population,
                timezone,
            },
        }));
    }
    
    // 2. Pas en cache → Enrichir avec GeoNames
    info!("🌍 Pas en cache, enrichissement avec GeoNames...");
    
    let _location_vector = geonames_service::enrich_location_bidirectional(
        pool,
        &params.place_name,
        params.country.as_deref(),
    )
    .await?;
    
    // 3. Re-fetch après enrichissement
    let enriched_opt = sqlx::query_as::<_, (
        i64, String, Vec<String>, i32, bool, String, Option<String>,
        sqlx::types::BigDecimal, sqlx::types::BigDecimal, Option<i32>, Option<String>
    )>(
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
         WHERE place_name = $1 AND parent_country = $2"
    )
    .bind(&params.place_name)
    .bind(params.country.as_deref().unwrap_or(""))
    .fetch_optional(pool)
    .await?;
    
    // ✅ Si GeoNames ne trouve rien, retourner des données par défaut au lieu de 404
    if enriched_opt.is_none() {
        info!("⚠️ Lieu '{}' introuvable dans GeoNames, retour données minimales", params.place_name);
        return Ok(Json(EnrichLocationResponse {
            place_name: params.place_name.clone(),
            geoname_id: None,
            display_name: params.place_name.clone(),
            location_vector: vec![params.place_name.clone()],
            hierarchy: LocationHierarchy {
                parents: params.country.clone().map(|c| vec![c]).unwrap_or_default(),
                children: vec![],
                is_leaf: true,
                admin_level: 8, // Quartier/localité
            },
            coordinates: Coordinates {
                lat: 0.0,
                lng: 0.0,
            },
            metadata: LocationMetadata {
                country: params.country.unwrap_or_else(|| "Inconnu".to_string()),
                country_code: None,
                population: None,
                timezone: None,
            },
        }));
    }
    
    let enriched = enriched_opt.unwrap();
    
    let (geoname_id, display_name, location_vector, admin_level, is_leaf, 
         parent_country, parent_country_code, lat, lng, population, timezone) = enriched;
    
    // Séparer location_vector en parents et enfants
    let children = if location_vector.len() > 1 {
        location_vector[1..].iter()
            .take_while(|s| !parent_country.contains(s.as_str()))
            .cloned()
            .collect()
    } else {
        vec![]
    };
    
    let parents = if location_vector.len() > 1 {
        location_vector[1..].iter()
            .skip_while(|s| !parent_country.contains(s.as_str()))
            .cloned()
            .collect()
    } else {
        vec![]
    };
    
    info!("✅ Enrichissement terminé pour {} : {} éléments", params.place_name, location_vector.len());
    
    Ok(Json(EnrichLocationResponse {
        place_name: params.place_name,
        geoname_id: Some(geoname_id),
        display_name,
        location_vector: location_vector.clone(),
        hierarchy: LocationHierarchy {
            parents,
            children,
            is_leaf,
            admin_level,
        },
        coordinates: Coordinates {
            lat: lat.to_string().parse().unwrap_or(0.0),
            lng: lng.to_string().parse().unwrap_or(0.0),
        },
        metadata: LocationMetadata {
            country: parent_country,
            country_code: parent_country_code,
            population,
            timezone,
        },
    }))
}

