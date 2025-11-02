// Service pour enrichissement géographique avec GeoNames API
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use log::{info, warn};
use crate::core::error::AppError;

const GEONAMES_BASE: &str = "http://api.geonames.org";
const MAX_DEPTH: u8 = 7; // Quartier max

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GeoNamePlace {
    #[serde(rename = "geonameId")]
    pub geoname_id: i64,
    pub name: String,
    pub fcode: String,
    pub lat: String,
    pub lng: String,
    #[serde(rename = "countryName")]
    pub country_name: Option<String>,
    #[serde(rename = "countryCode")]
    pub country_code: Option<String>,
    pub population: Option<i64>,
    pub timezone: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct GeoNameSearchResponse {
    pub geonames: Vec<GeoNamePlace>,
}

/// Recherche un lieu dans GeoNames et retourne son ID
pub async fn search_geoname(
    place_name: &str,
    country_context: Option<&str>,
) -> Result<GeoNamePlace, AppError> {
    let username = std::env::var("GEONAMES_USERNAME")
        .unwrap_or_else(|_| "demo".to_string());
    
    let client = Client::new();
    
    // Construire query avec contexte pays si fourni
    let query = if let Some(country) = country_context {
        format!("{}, {}", place_name, country)
    } else {
        place_name.to_string()
    };
    
    let search_url = format!(
        "{}/searchJSON?name={}&maxRows=1&username={}",
        GEONAMES_BASE,
        urlencoding::encode(&query),
        username
    );
    
    info!("🌍 Recherche GeoNames: {}", query);
    
    let response = client.get(&search_url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("GeoNames request failed: {}", e)))?;
    
    let search_data: GeoNameSearchResponse = response.json()
        .await
        .map_err(|e| AppError::Internal(format!("GeoNames JSON parse failed: {}", e)))?;
    
    search_data.geonames
        .into_iter()
        .next()
        .ok_or_else(|| AppError::NotFound(format!("Lieu '{}' non trouvé dans GeoNames", place_name)))
}

/// Récupère la hiérarchie (parents) d'un lieu
pub async fn get_hierarchy(geoname_id: i64) -> Result<Vec<GeoNamePlace>, AppError> {
    let username = std::env::var("GEONAMES_USERNAME")
        .unwrap_or_else(|_| "demo".to_string());
    
    let client = Client::new();
    
    let hierarchy_url = format!(
        "{}/hierarchyJSON?geonameId={}&username={}",
        GEONAMES_BASE, geoname_id, username
    );
    
    let response = client.get(&hierarchy_url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("GeoNames hierarchy failed: {}", e)))?;
    
    let hierarchy_data: GeoNameSearchResponse = response.json()
        .await
        .map_err(|e| AppError::Internal(format!("GeoNames hierarchy JSON failed: {}", e)))?;
    
    Ok(hierarchy_data.geonames)
}

/// Récupère les enfants (descendants) d'un lieu
pub async fn get_children(geoname_id: i64) -> Result<Vec<GeoNamePlace>, AppError> {
    let username = std::env::var("GEONAMES_USERNAME")
        .unwrap_or_else(|_| "demo".to_string());
    
    let client = Client::new();
    
    let children_url = format!(
        "{}/childrenJSON?geonameId={}&username={}",
        GEONAMES_BASE, geoname_id, username
    );
    
    let response = client.get(&children_url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("GeoNames children failed: {}", e)))?;
    
    let children_data: GeoNameSearchResponse = response.json()
        .await
        .map_err(|e| AppError::Internal(format!("GeoNames children JSON failed: {}", e)))?;
    
    Ok(children_data.geonames)
}

/// Enrichit un lieu avec hiérarchie bidirectionnelle complète
pub async fn enrich_location_bidirectional(
    pool: &PgPool,
    place_name: &str,
    country_context: Option<&str>,
) -> Result<Vec<String>, AppError> {
    info!("🌍 Enrichissement bidirectionnel pour: {} ({})", place_name, country_context.unwrap_or("?"));
    
    // 1. Chercher dans cache d'abord
    let cache_key = format!("{}_{}", place_name, country_context.unwrap_or(""));
    let cached = sqlx::query!(
        "SELECT location_vector FROM geo_hierarchy 
         WHERE place_name = $1 AND parent_country = $2",
        place_name,
        country_context.unwrap_or("")
    )
    .fetch_optional(pool)
    .await?;
    
    if let Some(cached) = cached {
        info!("✅ Trouvé en cache pour {}", place_name);
        return Ok(cached.location_vector);
    }
    
    // 2. Pas en cache → Chercher dans GeoNames
    let geoname_place = search_geoname(place_name, country_context).await?;
    let geoname_id = geoname_place.geoname_id;
    
    info!("📍 GeoName ID trouvé: {} pour {}", geoname_id, place_name);
    
    // 3. Récupérer hiérarchie (parents)
    let hierarchy = get_hierarchy(geoname_id).await?;
    
    // 4. Récupérer enfants
    let all_children = get_children(geoname_id).await?;
    
    // 5. Filtrer enfants selon profondeur et type
    let valid_children: Vec<GeoNamePlace> = all_children
        .into_iter()
        .filter(|c| {
            let level = admin_level_from_fcode(&c.fcode);
            level <= MAX_DEPTH as i32 && !is_excluded_fcode(&c.fcode)
        })
        .collect();
    
    let is_leaf = valid_children.is_empty();
    
    info!("🌳 Hiérarchie: {} parents, {} enfants valides", hierarchy.len(), valid_children.len());
    
    // 6. Construire vecteur : [Choix, Enfants..., Parents...]
    let mut vector = vec![place_name.to_string()];
    
    // Ajouter enfants (max 50 pour éviter explosion)
    for (i, child) in valid_children.iter().enumerate() {
        if i >= 50 {
            warn!("⚠️ Trop d'enfants pour {}, limité à 50", place_name);
            break;
        }
        vector.push(child.name.clone());
    }
    
    // Ajouter parents (filtrés, min niveau 2 = pays)
    for parent in hierarchy.iter().rev() {
        let level = admin_level_from_fcode(&parent.fcode);
        if level >= 2 && level < 10 && !vector.contains(&parent.name) {
            vector.push(parent.name.clone());
        }
    }
    
    // 7. Extraire infos pays
    let country_name = hierarchy.iter()
        .find(|p| p.fcode == "PCLI")
        .and_then(|p| p.country_name.as_ref())
        .unwrap_or(&geoname_place.country_name.clone().unwrap_or_default())
        .clone();
    
    let country_code = hierarchy.iter()
        .find(|p| p.fcode == "PCLI")
        .and_then(|p| p.country_code.as_ref())
        .unwrap_or(&geoname_place.country_code.clone().unwrap_or_default())
        .clone();
    
    let admin_level = admin_level_from_fcode(&geoname_place.fcode);
    
    // 8. Construire display_name
    let display_name = if !country_name.is_empty() {
        format!("{}, {}", place_name, country_name)
    } else {
        place_name.to_string()
    };
    
    // 9. Parser coordonnées
    let lat: f64 = geoname_place.lat.parse().unwrap_or(0.0);
    let lng: f64 = geoname_place.lng.parse().unwrap_or(0.0);
    
    // 10. Sauvegarder dans geo_hierarchy
    sqlx::query!(
        "INSERT INTO geo_hierarchy 
         (geoname_id, place_name, display_name, feature_code, admin_level, 
          is_leaf, parent_country, parent_country_code, location_vector, 
          lat, lng, population, timezone, last_enriched_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
         ON CONFLICT (geoname_id) DO UPDATE SET
            location_vector = $9,
            last_enriched_at = NOW(),
            times_used = geo_hierarchy.times_used + 1",
        geoname_id,
        place_name,
        display_name,
        geoname_place.fcode,
        admin_level,
        is_leaf,
        country_name,
        country_code,
        &vector,
        lat,
        lng,
        geoname_place.population.map(|p| p as i32),
        geoname_place.timezone
    )
    .execute(pool)
    .await?;
    
    info!("✅ Enrichissement terminé pour {} → {} éléments dans vecteur", place_name, vector.len());
    
    Ok(vector)
}

/// Construit le vecteur de localisation (avec cache)
pub async fn build_location_vector(
    pool: &PgPool,
    chosen_place: &str,
    country_context: Option<&str>,
) -> Result<Vec<String>, AppError> {
    // Chercher dans cache
    let cached = sqlx::query!(
        "SELECT location_vector FROM geo_hierarchy 
         WHERE place_name = $1 AND parent_country = $2",
        chosen_place,
        country_context.unwrap_or("")
    )
    .fetch_optional(pool)
    .await?;
    
    if let Some(cached) = cached {
        return Ok(cached.location_vector);
    }
    
    // Pas en cache → Enrichir
    enrich_location_bidirectional(pool, chosen_place, country_context).await
}

/// Expand location search pour recherche (retourne vecteur complet)
pub async fn expand_location_search(
    pool: &PgPool,
    location: &str,
) -> Result<Vec<String>, AppError> {
    let geo = sqlx::query!(
        "SELECT location_vector FROM geo_hierarchy 
         WHERE place_name = $1
         ORDER BY times_used DESC
         LIMIT 1",
        location
    )
    .fetch_optional(pool)
    .await?;
    
    if let Some(geo) = geo {
        Ok(geo.location_vector)
    } else {
        // Pas enrichi encore → Retourne juste le nom
        Ok(vec![location.to_string()])
    }
}

/// Obtenir geoname_id d'un lieu
pub async fn get_geoname_id(
    pool: &PgPool,
    place_name: &str,
) -> Result<Option<i64>, AppError> {
    let result = sqlx::query!(
        "SELECT geoname_id FROM geo_hierarchy 
         WHERE place_name = $1
         ORDER BY times_used DESC
         LIMIT 1",
        place_name
    )
    .fetch_optional(pool)
    .await?;
    
    Ok(result.map(|r| r.geoname_id))
}

/// Convertit feature code GeoNames en niveau administratif
pub fn admin_level_from_fcode(fcode: &str) -> i32 {
    match fcode {
        "CONT" => 1,         // Continent
        "PCLI" => 2,         // Pays
        "ADM1" => 3,         // Région/État
        "ADM2" => 4,         // Département
        "ADM3" => 5,         // Arrondissement
        "PPL" | "PPLA" | "PPLC" => 6,  // Ville
        "PPLX" => 7,         // Quartier
        _ => 8,              // Autre (moins important)
    }
}

/// Vérifie si un feature code doit être exclu (privacy)
pub fn is_excluded_fcode(fcode: &str) -> bool {
    matches!(fcode, "ROAD" | "STR" | "BLDG" | "ADDR")
}

/// Extrait le nom de pays d'une chaîne "Ville, Pays"
pub fn extract_country_from_lieu(lieu_str: &str) -> Option<String> {
    let parts: Vec<&str> = lieu_str.split(',').collect();
    if parts.len() >= 2 {
        Some(parts[parts.len() - 1].trim().to_string())
    } else {
        None
    }
}

