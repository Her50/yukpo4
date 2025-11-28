// Service pour enrichir les données de service avec Google Places depuis google_places_data
use crate::core::types::AppError;
use log::warn;
use serde_json::Value;
use sqlx::{PgPool, Row};
use std::collections::HashMap;

/// Enrichit un service avec les données Google Places complètes depuis google_places_data
/// Remplace le place_id dans services.data.google_place par les données complètes
pub async fn enrich_service_with_google_places_data(
    pool: &PgPool,
    service_id: i32,
    service_data: &mut Value,
) -> Result<(), AppError> {
    // Vérifier si le service a un place_id dans google_place
    let place_id = service_data
        .get("google_place")
        .and_then(|gp| gp.as_object())
        .and_then(|gp_obj| gp_obj.get("place_id"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    if place_id.is_none() {
        // Pas de Google Places pour ce service
        return Ok(());
    }

    let place_id = place_id.unwrap();

    // Récupérer les données complètes depuis google_places_data
    // Utiliser une requête qui retourne directement un JSONB pour simplifier
    let row = sqlx::query(
        r#"
        SELECT 
            jsonb_build_object(
                'place_id', place_id,
                'display_name', display_name,
                'formatted_address', formatted_address,
                'location_vector', location_vector,
                'coordinates', jsonb_build_object('lat', latitude, 'lng', longitude),
                'types', types,
                'primary_type', primary_type,
                'primary_type_display_name', primary_type_display_name,
                'rating', rating,
                'rating_count', rating_count,
                'price_level', price_level,
                'business_status', business_status,
                'serves_cuisine', serves_cuisine,
                'website_uri', website_uri,
                'google_maps_uri', google_maps_uri,
                'international_phone_number', international_phone_number,
                'national_phone_number', national_phone_number,
                'editorial_summary', editorial_summary,
                'current_opening_hours', current_opening_hours,
                'regular_opening_hours', regular_opening_hours,
                'photos', photos,
                'country', country,
                'country_code', country_code
            ) as google_place_data
        FROM google_places_data
        WHERE service_id = $1 AND place_id = $2
        LIMIT 1
        "#
    )
    .bind(service_id)
    .bind(&place_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération Google Places: {}", e)))?;

    if let Some(row) = row {
        // Récupérer le JSONB directement
        let google_place_data: Option<Value> = row
            .try_get("google_place_data")
            .map_err(|e| AppError::Internal(format!("Erreur parsing Google Places JSON: {}", e)))?;
        
        if let Some(mut gp_data) = google_place_data {
            // Nettoyer les valeurs NULL du JSON
            if let Some(gp_obj) = gp_data.as_object_mut() {
                gp_obj.retain(|_, v| !v.is_null());
            }
            
            // Remplacer le place_id par l'objet complet dans service_data
            if let Some(data_obj) = service_data.as_object_mut() {
                data_obj.insert("google_place".to_string(), gp_data);
            }
        }
    } else {
        warn!(
            "[enrich_google_places] Aucune donnée Google Places trouvée pour service_id={}, place_id={}",
            service_id, place_id
        );
    }

    Ok(())
}

/// Enrichit plusieurs services avec les données Google Places
pub async fn enrich_services_with_google_places_data(
    pool: &PgPool,
    services: &mut Vec<(i32, Value)>,
) -> Result<(), AppError> {
    for (service_id, service_data) in services.iter_mut() {
        if let Err(e) = enrich_service_with_google_places_data(pool, *service_id, service_data).await {
            warn!(
                "[enrich_google_places] Erreur enrichissement service {}: {}",
                service_id, e
            );
            // Continue avec les autres services même si un échoue
        }
    }
    Ok(())
}

/// ✅ OPTIMISÉ 2025-11-28: Enrichit plusieurs services en BATCH (1 requête SQL au lieu de N)
/// Récupère toutes les données Google Places en une seule requête SQL pour améliorer les performances
/// 
/// Version pour Vec<(service_id, service_data)>
pub async fn enrich_search_results_batch_with_google_places_data(
    pool: &PgPool,
    results: &mut Vec<(i32, Value)>,
) -> Result<(), AppError> {
    if results.is_empty() {
        return Ok(());
    }

    // 1. Extraire tous les (service_id, place_id) des résultats
    let mut service_place_map: HashMap<i32, String> = HashMap::new();
    for (service_id, service_data) in results.iter() {
        if let Some(place_id) = service_data
            .get("google_place")
            .and_then(|gp| gp.as_object())
            .and_then(|gp_obj| gp_obj.get("place_id"))
            .and_then(|v| v.as_str())
        {
            service_place_map.insert(*service_id, place_id.to_string());
        }
    }

    if service_place_map.is_empty() {
        // Aucun service n'a de Google Places
        return Ok(());
    }

    // 2. Requête SQL batch : récupérer toutes les données en une fois
    let service_ids: Vec<i32> = service_place_map.keys().cloned().collect();
    let place_ids: Vec<String> = service_place_map.values().cloned().collect();

    let rows = sqlx::query(
        r#"
        SELECT 
            service_id,
            place_id,
            jsonb_build_object(
                'place_id', place_id,
                'display_name', display_name,
                'formatted_address', formatted_address,
                'location_vector', location_vector,
                'coordinates', jsonb_build_object('lat', latitude, 'lng', longitude),
                'types', types,
                'primary_type', primary_type,
                'primary_type_display_name', primary_type_display_name,
                'rating', rating,
                'rating_count', rating_count,
                'price_level', price_level,
                'business_status', business_status,
                'serves_cuisine', serves_cuisine,
                'website_uri', website_uri,
                'google_maps_uri', google_maps_uri,
                'international_phone_number', international_phone_number,
                'national_phone_number', national_phone_number,
                'editorial_summary', editorial_summary,
                'current_opening_hours', current_opening_hours,
                'regular_opening_hours', regular_opening_hours,
                'photos', photos,
                'country', country,
                'country_code', country_code
            ) as google_place_data
        FROM google_places_data
        WHERE service_id = ANY($1) AND place_id = ANY($2)
        "#
    )
    .bind(&service_ids)
    .bind(&place_ids)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération batch Google Places: {}", e)))?;

    // 3. Créer un HashMap pour accès rapide
    let mut google_places_data_map: HashMap<i32, Value> = HashMap::new();
    for row in rows {
        let service_id: i32 = row.get("service_id");
        let google_place_data: Option<Value> = row
            .try_get("google_place_data")
            .map_err(|e| AppError::Internal(format!("Erreur parsing Google Places JSON: {}", e)))?;
        
        if let Some(mut gp_data) = google_place_data {
            // Nettoyer les valeurs NULL du JSON
            if let Some(gp_obj) = gp_data.as_object_mut() {
                gp_obj.retain(|_, v| !v.is_null());
            }
            google_places_data_map.insert(service_id, gp_data);
        }
    }

    // 4. Appliquer les enrichissements aux résultats
    for (service_id, service_data) in results.iter_mut() {
        if let Some(google_place_data) = google_places_data_map.get(service_id) {
            if let Some(data_obj) = service_data.as_object_mut() {
                data_obj.insert("google_place".to_string(), google_place_data.clone());
            }
        }
    }

    Ok(())
}

/// ✅ OPTIMISÉ 2025-11-28: Enrichit plusieurs SearchResult en BATCH (1 requête SQL au lieu de N)
/// Version optimisée pour Vec<SearchResult>
pub async fn enrich_search_results_batch(
    pool: &PgPool,
    results: &mut [crate::services::native_search_service::SearchResult],
) -> Result<(), AppError> {
    if results.is_empty() {
        return Ok(());
    }

    // 1. Extraire tous les (service_id, place_id) des résultats
    let mut service_place_map: HashMap<i32, String> = HashMap::new();
    for result in results.iter() {
        if let Some(place_id) = result.data
            .get("google_place")
            .and_then(|gp| gp.as_object())
            .and_then(|gp_obj| gp_obj.get("place_id"))
            .and_then(|v| v.as_str())
        {
            service_place_map.insert(result.service_id, place_id.to_string());
        }
    }

    if service_place_map.is_empty() {
        return Ok(());
    }

    // 2. Requête SQL batch
    let service_ids: Vec<i32> = service_place_map.keys().cloned().collect();
    let place_ids: Vec<String> = service_place_map.values().cloned().collect();

    let rows = sqlx::query(
        r#"
        SELECT 
            service_id,
            place_id,
            jsonb_build_object(
                'place_id', place_id,
                'display_name', display_name,
                'formatted_address', formatted_address,
                'location_vector', location_vector,
                'coordinates', jsonb_build_object('lat', latitude, 'lng', longitude),
                'types', types,
                'primary_type', primary_type,
                'primary_type_display_name', primary_type_display_name,
                'rating', rating,
                'rating_count', rating_count,
                'price_level', price_level,
                'business_status', business_status,
                'serves_cuisine', serves_cuisine,
                'website_uri', website_uri,
                'google_maps_uri', google_maps_uri,
                'international_phone_number', international_phone_number,
                'national_phone_number', national_phone_number,
                'editorial_summary', editorial_summary,
                'current_opening_hours', current_opening_hours,
                'regular_opening_hours', regular_opening_hours,
                'photos', photos,
                'country', country,
                'country_code', country_code
            ) as google_place_data
        FROM google_places_data
        WHERE service_id = ANY($1) AND place_id = ANY($2)
        "#
    )
    .bind(&service_ids)
    .bind(&place_ids)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération batch Google Places: {}", e)))?;

    // 3. Créer un HashMap pour accès rapide
    let mut google_places_data_map: HashMap<i32, Value> = HashMap::new();
    for row in rows {
        let service_id: i32 = row.get("service_id");
        let google_place_data: Option<Value> = row
            .try_get("google_place_data")
            .map_err(|e| AppError::Internal(format!("Erreur parsing Google Places JSON: {}", e)))?;
        
        if let Some(mut gp_data) = google_place_data {
            if let Some(gp_obj) = gp_data.as_object_mut() {
                gp_obj.retain(|_, v| !v.is_null());
            }
            google_places_data_map.insert(service_id, gp_data);
        }
    }

    // 4. Appliquer les enrichissements
    for result in results.iter_mut() {
        if let Some(google_place_data) = google_places_data_map.get(&result.service_id) {
            if let Some(data_obj) = result.data.as_object_mut() {
                data_obj.insert("google_place".to_string(), google_place_data.clone());
            }
        }
    }

    Ok(())
}
