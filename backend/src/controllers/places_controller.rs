// Contrôleur pour enrichissement géographique avec Google Places API + Base locale africaine
use crate::services::african_locations_service::AfricanLocationsService;
use crate::services::google_places_service::GooglePlacesService;
use crate::state::AppState;
use axum::{
    extract::{Query, State},
    response::IntoResponse,
};
use log::{info, warn};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

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
/// Enrichit un lieu avec sa hiérarchie géographique complète via Google Places API
pub async fn enrich_location(
    State(state): State<Arc<AppState>>,
    Query(params): Query<EnrichLocationRequest>,
) -> axum::response::Response {
    info!(
        "🗺️ Enrichissement lieu: {} ({})",
        params.place_name,
        params.country.as_deref().unwrap_or("?")
    );

    let pool = &state.pg;
    let country_str = params.country.as_deref().unwrap_or("");

    // ✅ CORRIGÉ: Gestion d'erreur améliorée avec retour JSON même en cas d'erreur
    // 1. Chercher dans cache d'abord
    let cached = match sqlx::query_as::<
        _,
        (
            String,
            Vec<String>,
            i32,
            bool,
            String,
            Option<String>,
            sqlx::types::BigDecimal,
            sqlx::types::BigDecimal,
        ),
    >(
        "SELECT 
            display_name,
            location_vector,
            admin_level,
            is_leaf,
            parent_country,
            parent_country_code,
            lat,
            lng
         FROM geo_hierarchy 
         WHERE place_name = $1 AND parent_country = $2",
    )
    .bind(&params.place_name)
    .bind(country_str)
    .fetch_optional(pool)
    .await
    {
        Ok(c) => c,
        Err(e) => {
            warn!("[enrich_location] Erreur requête cache: {}", e);
            // Continuer sans cache
            None
        }
    };

    if let Some(cached) = cached {
        info!("✅ Trouvé en cache pour {}", params.place_name);

        let (
            display_name,
            location_vector,
            admin_level,
            is_leaf,
            parent_country,
            parent_country_code,
            lat,
            lng,
        ) = cached;

        // Parents = tout sauf le premier élément (le lieu lui-même)
        let parents = if location_vector.len() > 1 {
            location_vector[1..].to_vec()
        } else {
            vec![]
        };

        // ✅ Enfants depuis base locale africaine
        let african_service = AfricanLocationsService::new();
        let place_type = if is_leaf {
            "neighborhood"
        } else if admin_level <= 2 {
            "country"
        } else {
            "city"
        };
        let children = african_service.get_children(pool, &params.place_name, place_type).await;

        return (
            axum::http::StatusCode::OK,
            axum::Json(EnrichLocationResponse {
                place_name: params.place_name.clone(),
                geoname_id: None, // Google Places n'a pas de geoname_id
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
                    population: None,
                    timezone: None,
                },
            }),
        )
            .into_response();
    }

    // 2. Pas en cache → Enrichir avec Google Places API
    info!("🗺️ Pas en cache, enrichissement avec Google Places API...");

    let google_service = GooglePlacesService::new();
    let google_result = google_service
        .search_and_enrich(
            &params.place_name,
            params.country.as_deref(),
            Some("fr"),
            None,
        )
        .await;

    let google_data = match google_result {
        Ok(Some(data)) => data,
        Ok(None) => {
            info!(
                "⚠️ Lieu '{}' introuvable dans Google Places, retour données minimales",
                params.place_name
            );
            return (
                axum::http::StatusCode::OK,
                axum::Json(EnrichLocationResponse {
                    place_name: params.place_name.clone(),
                    geoname_id: None,
                    display_name: params.place_name.clone(),
                    location_vector: vec![params.place_name.clone()],
                    hierarchy: LocationHierarchy {
                        parents: params.country.clone().map(|c| vec![c]).unwrap_or_default(),
                        children: vec![],
                        is_leaf: true,
                        admin_level: 8,
                    },
                    coordinates: Coordinates { lat: 0.0, lng: 0.0 },
                    metadata: LocationMetadata {
                        country: params.country.unwrap_or_else(|| "Inconnu".to_string()),
                        country_code: None,
                        population: None,
                        timezone: None,
                    },
                }),
            )
                .into_response();
        }
        Err(error) => {
            let error_msg = error.to_string();

            // ✅ NOUVEAU: Détecter les erreurs critiques (billing, API key, etc.)
            let is_critical_error = error_msg.contains("BILLING_DISABLED")
                || error_msg.contains("API_KEY_INVALID")
                || error_msg.contains("PERMISSION_DENIED")
                || error_msg.contains("indisponible");

            if is_critical_error {
                warn!(
                    "⚠️ Google Places API indisponible pour '{}' ({}), tentative fallback base locale",
                    params.place_name, error_msg
                );
            } else {
                info!(
                    "⚠️ Lieu '{}' introuvable dans Google Places ({}), tentative fallback base locale",
                    params.place_name, error_msg
                );
            }

            // ✅ NOUVEAU: Fallback vers base de données locale (AfricanLocationsService)
            let african_service = AfricanLocationsService::new();
            if let Ok(Some(local_data)) = african_service
                .search_location(pool, &params.place_name, params.country.as_deref())
                .await
            {
                info!("✅ Lieu '{}' trouvé dans la base locale", params.place_name);

                let parents = if local_data.location_vector.len() > 1 {
                    local_data.location_vector[1..].to_vec()
                } else {
                    vec![]
                };

                let children = african_service.get_children(pool, &params.place_name, "city").await;

                return (
                    axum::http::StatusCode::OK,
                    axum::Json(EnrichLocationResponse {
                        place_name: params.place_name.clone(),
                        geoname_id: local_data.geoname_id,
                        display_name: local_data.display_name.clone(),
                        location_vector: local_data.location_vector.clone(),
                        hierarchy: LocationHierarchy {
                            parents,
                            children,
                            is_leaf: local_data.is_leaf,
                            admin_level: local_data.admin_level,
                        },
                        coordinates: Coordinates {
                            lat: local_data.coordinates.lat,
                            lng: local_data.coordinates.lng,
                        },
                        metadata: LocationMetadata {
                            country: local_data.country,
                            country_code: local_data.country_code,
                            population: local_data.population,
                            timezone: local_data.timezone,
                        },
                    }),
                )
                    .into_response();
            }

            // ✅ Fallback final : retourner données minimales
            info!(
                "⚠️ Lieu '{}' introuvable (Google Places et base locale), retour données minimales",
                params.place_name
            );
            return (
                axum::http::StatusCode::OK,
                axum::Json(EnrichLocationResponse {
                    place_name: params.place_name.clone(),
                    geoname_id: None,
                    display_name: params.place_name.clone(),
                    location_vector: vec![params.place_name.clone()],
                    hierarchy: LocationHierarchy {
                        parents: params.country.clone().map(|c| vec![c]).unwrap_or_default(),
                        children: vec![],
                        is_leaf: true,
                        admin_level: 8,
                    },
                    coordinates: Coordinates { lat: 0.0, lng: 0.0 },
                    metadata: LocationMetadata {
                        country: params.country.unwrap_or_else(|| "Inconnu".to_string()),
                        country_code: None,
                        population: None,
                        timezone: None,
                    },
                }),
            )
                .into_response();
        }
    };

    // 3. Sauvegarder dans geo_hierarchy pour le cache
    let admin_level = determine_admin_level(&google_data.location_vector);
    let is_leaf = admin_level >= 7; // Quartiers/localités sont des feuilles
    let parent_country = google_data
        .location_vector
        .last()
        .cloned()
        .unwrap_or_else(|| country_str.to_string());
    let parent_country_code = extract_country_code(&parent_country);

    // ✅ CORRIGÉ: Gestion d'erreur pour l'insertion en cache (non bloquant)
    if let Err(e) = sqlx::query(
        "INSERT INTO geo_hierarchy 
         (place_name, display_name, location_vector, admin_level, is_leaf, 
          parent_country, parent_country_code, lat, lng, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
         ON CONFLICT (place_name, parent_country) 
         DO UPDATE SET 
            display_name = EXCLUDED.display_name,
            location_vector = EXCLUDED.location_vector,
            admin_level = EXCLUDED.admin_level,
            is_leaf = EXCLUDED.is_leaf,
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng,
            updated_at = NOW()",
    )
    .bind(&params.place_name)
    .bind(&google_data.display_name)
    .bind(&google_data.location_vector)
    .bind(admin_level)
    .bind(is_leaf)
    .bind(&parent_country)
    .bind(&parent_country_code)
    .bind(google_data.coordinates.as_ref().map(|c| c.lat).unwrap_or(0.0))
    .bind(google_data.coordinates.as_ref().map(|c| c.lng).unwrap_or(0.0))
    .execute(pool)
    .await
    {
        warn!("[enrich_location] Erreur sauvegarde cache: {}", e);
        // Continuer même si le cache échoue
    }

    info!(
        "✅ Enrichissement Google Places terminé pour {} : {} éléments",
        params.place_name,
        google_data.location_vector.len()
    );

    // Parents = tout sauf le premier élément (le lieu lui-même)
    let parents = if google_data.location_vector.len() > 1 {
        google_data.location_vector[1..].to_vec()
    } else {
        vec![]
    };

    // ✅ Enfants depuis base locale africaine
    let african_service = AfricanLocationsService::new();
    let place_type_str = if is_leaf {
        "neighborhood"
    } else if admin_level <= 2 {
        "country"
    } else {
        "city"
    };
    let children = african_service.get_children(pool, &params.place_name, place_type_str).await;

    (
        axum::http::StatusCode::OK,
        axum::Json(EnrichLocationResponse {
            place_name: params.place_name,
            geoname_id: None,
            display_name: google_data.display_name.clone(),
            location_vector: google_data.location_vector.clone(),
            hierarchy: LocationHierarchy {
                parents,
                children,
                is_leaf,
                admin_level,
            },
            coordinates: Coordinates {
                lat: google_data.coordinates.as_ref().map(|c| c.lat).unwrap_or(0.0),
                lng: google_data.coordinates.as_ref().map(|c| c.lng).unwrap_or(0.0),
            },
            metadata: LocationMetadata {
                country: parent_country,
                country_code: parent_country_code,
                population: None,
                timezone: None,
            },
        }),
    )
        .into_response()
}

/// Détermine le niveau administratif basé sur la taille du location_vector
fn determine_admin_level(location_vector: &[String]) -> i32 {
    match location_vector.len() {
        0..=1 => 0, // Pays
        2 => 2,     // Région
        3 => 4,     // Département
        4 => 6,     // Ville
        _ => 8,     // Quartier/localité
    }
}

/// Extrait le code pays (CM, SN, CI, etc.)
fn extract_country_code(country_name: &str) -> Option<String> {
    // Mapping simple des pays francophones
    let mapping = vec![
        ("Cameroun", "CM"),
        ("Cameroon", "CM"),
        ("Sénégal", "SN"),
        ("Senegal", "SN"),
        ("Côte d'Ivoire", "CI"),
        ("Mali", "ML"),
        ("Burkina Faso", "BF"),
        ("Niger", "NE"),
        ("Tchad", "TD"),
        ("Chad", "TD"),
        ("Guinée", "GN"),
        ("Guinea", "GN"),
        ("Bénin", "BJ"),
        ("Benin", "BJ"),
        ("Togo", "TG"),
        ("Congo", "CG"),
        ("Gabon", "GA"),
        ("RD Congo", "CD"),
        ("Madagascar", "MG"),
    ];

    mapping
        .iter()
        .find(|(name, _)| country_name.contains(name))
        .map(|(_, code)| code.to_string())
}
