use axum::{
    body::Body,
    extract::{Query, State},
    http::{HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct PlacesAutocompleteQuery {
    pub query: Option<String>, // ✅ CORRECTION 2025-11-06: Rendre optionnel pour éviter 400 si absent
    #[serde(rename = "type")]
    pub place_type: Option<String>, // 'city', 'neighborhood', 'point', 'hospital', 'pharmacy', 'health'
    pub city: Option<String>, // Contexte de ville pour filtrer les résultats
    pub lat: Option<f64>,     // Latitude pour recherche par proximité
    pub lng: Option<f64>,     // Longitude pour recherche par proximité
    pub radius: Option<u32>,  // Rayon en mètres (défaut: 5000m = 5km)
}

#[derive(Debug, Serialize)]
pub struct PlaceResult {
    pub description: String,
    pub place_id: Option<String>,
    pub types: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct PlacesAutocompleteResponse {
    pub success: bool,
    pub data: Option<Vec<String>>, // ✅ Compatibilité: format simple (string)
    pub results: Option<Vec<PlaceResult>>, // ✅ NOUVEAU: format enrichi avec types
    pub error: Option<String>,
}

/// Endpoint pour l'autocomplete de lieux avec Google Maps API
/// GET /api/places/autocomplete?query=Doual&type=city
/// GET /api/places/autocomplete?query=Bonanjo&type=neighborhood&city=Douala
/// GET /api/places/autocomplete?query=Gare&type=point&city=Douala
/// GET /api/places/autocomplete?query=Laquintinie&type=hospital&lat=4.05&lng=9.7&radius=5000
pub async fn autocomplete_places(
    State(_state): State<Arc<AppState>>,
    Query(params): Query<PlacesAutocompleteQuery>,
) -> impl IntoResponse {
    // Pour les types de santé, la query peut être vide (recherche par proximité)
    let is_health_search = matches!(
        params.place_type.as_deref(),
        Some("hospital") | Some("pharmacy") | Some("health")
    );

    // ✅ CORRECTION 2025-11-06: Si query vide ou absente, retourner suggestions par défaut au lieu de 400
    let query_str = params.query.as_deref().unwrap_or("").trim();
    if !is_health_search && query_str.is_empty() {
        // Retourner les villes populaires du Cameroun comme suggestions par défaut
        let default_suggestions = vec![
            "Douala, Cameroun".to_string(),
            "Yaoundé, Cameroun".to_string(),
            "Bafoussam, Cameroun".to_string(),
            "Garoua, Cameroun".to_string(),
            "Maroua, Cameroun".to_string(),
        ];

        let default_results: Vec<PlaceResult> = default_suggestions
            .iter()
            .map(|desc| PlaceResult {
                description: desc.clone(),
                place_id: None,
                types: Some(vec!["locality".to_string(), "political".to_string()]),
            })
            .collect();

        return (
            StatusCode::OK,
            Json(PlacesAutocompleteResponse {
                success: true,
                data: Some(default_suggestions),
                results: Some(default_results),
                error: None,
            }),
        );
    }

    // ✅ NOUVEAU 2025-11-04: Place type est optional maintenant, None = recherche universelle
    let place_type = params.place_type.as_deref();

    // ✅ NOUVEAU 2025-11-06: Utiliser la clé API Google Maps (même clé que geocoding_service)
    let google_api_key = std::env::var("GOOGLE_MAPS_API_KEY").unwrap_or_else(|_| {
        // Utiliser la même clé par défaut que geocoding_service
        "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ".to_string()
    });

    if google_api_key.is_empty() {
        // Pas de clé API configurée, retourner vide pour fallback local
        return (
            StatusCode::OK,
            Json(PlacesAutocompleteResponse {
                success: true,
                data: Some(vec![]),
                results: Some(vec![]),
                error: None,
            }),
        );
    }

    // Construire la requête Google Maps API
    let mut url = format!(
        "https://maps.googleapis.com/maps/api/place/autocomplete/json?input={}&key={}",
        urlencoding::encode(query_str),
        google_api_key
    );

    // Filtrer par type et géolocalisation
    match place_type {
        None => {
            // ✅ AMÉLIORÉ 2025-01-02: Recherche universelle - inclut TOUS les types (géographiques + établissements)
            // Ne pas spécifier types pour obtenir tous les résultats (villes, quartiers, établissements, etc.)
            // Biais vers l'Afrique francophone
            url.push_str("&components=country:cm|country:ci|country:sn|country:cd|country:ml|country:bf|country:ne|country:td|country:gn|country:bj|country:tg|country:cg|country:ga|country:cf|country:mg|country:bi|country:rw|country:dj|country:km|country:mr");
        }
        Some("city") => {
            // Filtrer pour villes uniquement
            url.push_str("&types=(cities)");
            // Biais vers l'Afrique francophone
            url.push_str("&components=country:cm|country:ci|country:sn|country:cd|country:ml|country:bf|country:ne|country:td|country:gn|country:bj|country:tg|country:cg|country:ga|country:cf|country:mg|country:bi|country:rw|country:dj|country:km|country:mr");
        }
        Some("neighborhood") => {
            // ✅ NOUVEAU: Quartiers et sous-localités
            url.push_str("&types=sublocality|neighborhood");
            // Biais vers l'Afrique francophone
            url.push_str("&components=country:cm|country:ci|country:sn|country:cd|country:ml|country:bf|country:ne|country:td|country:gn|country:bj|country:tg|country:cg|country:ga|country:cf|country:mg|country:bi|country:rw|country:dj|country:km|country:mr");
            // Si contexte de ville fourni, ajouter comme biais
            if let Some(city) = &params.city {
                url.push_str(&format!("&location={}", urlencoding::encode(city)));
            }
        }
        Some("point") => {
            // Points d'intérêt, établissements
            url.push_str("&types=establishment");
            // Si contexte de ville fourni, ajouter comme biais
            if let Some(city) = &params.city {
                url.push_str(&format!("&location={}", urlencoding::encode(city)));
            }
        }
        Some("hospital") => {
            // Recherche d'hôpitaux par proximité
            url.push_str("&types=hospital");
            if let (Some(lat), Some(lng)) = (params.lat, params.lng) {
                let radius = params.radius.unwrap_or(5000); // 5km par défaut
                url.push_str(&format!("&location={},{}&radius={}", lat, lng, radius));
            }
        }
        Some("pharmacy") => {
            // Recherche de pharmacies par proximité
            url.push_str("&types=pharmacy");
            if let (Some(lat), Some(lng)) = (params.lat, params.lng) {
                let radius = params.radius.unwrap_or(5000);
                url.push_str(&format!("&location={},{}&radius={}", lat, lng, radius));
            }
        }
        Some("health") => {
            // Recherche structures de santé générales (labos, cliniques, etc.)
            url.push_str("&types=health");
            if let (Some(lat), Some(lng)) = (params.lat, params.lng) {
                let radius = params.radius.unwrap_or(5000);
                url.push_str(&format!("&location={},{}&radius={}", lat, lng, radius));
            }
        }
        _ => {}
    }

    // Appeler l'API Google Maps
    match reqwest::get(&url).await {
        Ok(response) => {
            if let Ok(json) = response.json::<serde_json::Value>().await {
                if let Some(predictions) = json.get("predictions").and_then(|p| p.as_array()) {
                    // ✅ AMÉLIORÉ: Extraire description, place_id et types pour chaque résultat
                    let enriched_results: Vec<PlaceResult> = predictions
                        .iter()
                        .filter_map(|pred| {
                            let description = pred
                                .get("description")
                                .and_then(|d| d.as_str())
                                .map(|s| s.to_string())?;

                            let place_id = pred
                                .get("place_id")
                                .and_then(|p| p.as_str())
                                .map(|s| s.to_string());

                            let types = pred.get("types").and_then(|t| t.as_array()).map(|arr| {
                                arr.iter()
                                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                                    .collect::<Vec<String>>()
                            });

                            Some(PlaceResult {
                                description,
                                place_id,
                                types,
                            })
                        })
                        .take(20) // Limiter à 20 résultats
                        .collect();

                    // ✅ Compatibilité: format simple (string) pour l'ancien code
                    let simple_results: Vec<String> =
                        enriched_results.iter().map(|r| r.description.clone()).collect();

                    return (
                        StatusCode::OK,
                        Json(PlacesAutocompleteResponse {
                            success: true,
                            data: Some(simple_results), // Format simple pour compatibilité
                            results: Some(enriched_results), // Format enrichi avec types
                            error: None,
                        }),
                    );
                }
            }

            // Erreur de parsing, retourner vide pour fallback
            (
                StatusCode::OK,
                Json(PlacesAutocompleteResponse {
                    success: true,
                    data: Some(vec![]),
                    results: Some(vec![]),
                    error: None,
                }),
            )
        }
        Err(err) => {
            // Erreur réseau, retourner vide pour fallback
            eprintln!("[Places API] Error calling Google Maps: {:?}", err);
            (
                StatusCode::OK,
                Json(PlacesAutocompleteResponse {
                    success: true,
                    data: Some(vec![]),
                    results: Some(vec![]),
                    error: None,
                }),
            )
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct PlacePhotoQuery {
    pub name: String,
    pub max_width: Option<u32>,
    pub max_height: Option<u32>,
}

/// Proxy pour récupérer les photos Google Places sans exposer la clé côté client
pub async fn fetch_place_photo(Query(params): Query<PlacePhotoQuery>) -> impl IntoResponse {
    let api_key = std::env::var("GOOGLE_MAPS_API_KEY").unwrap_or_default();
    if api_key.is_empty() {
        return StatusCode::BAD_REQUEST.into_response();
    }

    let name = params.name.trim();
    if name.is_empty() || !name.starts_with("places/") {
        return StatusCode::BAD_REQUEST.into_response();
    }

    let max_width = params.max_width.unwrap_or(800);
    let mut url = format!(
        "https://places.googleapis.com/v1/{}/media?maxWidthPx={}",
        name, max_width
    );

    if let Some(max_height) = params.max_height {
        url.push_str(&format!("&maxHeightPx={}", max_height));
    }

    let client = reqwest::Client::new();
    match client.get(&url).header("X-Goog-Api-Key", api_key).send().await {
        Ok(response) => {
            if !response.status().is_success() {
                return StatusCode::from_u16(response.status().as_u16())
                    .unwrap_or(StatusCode::BAD_GATEWAY)
                    .into_response();
            }

            let content_type = response
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .unwrap_or("image/jpeg")
                .to_string();

            match response.bytes().await {
                Ok(bytes) => Response::builder()
                    .status(StatusCode::OK)
                    .header(
                        axum::http::header::CONTENT_TYPE,
                        HeaderValue::from_str(&content_type)
                            .unwrap_or_else(|_| HeaderValue::from_static("image/jpeg")),
                    )
                    .body(Body::from(bytes))
                    .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
                    .into_response(),
                Err(err) => {
                    eprintln!("[Places] Impossible de lire la photo: {:?}", err);
                    StatusCode::BAD_GATEWAY.into_response()
                }
            }
        }
        Err(err) => {
            eprintln!("[Places] Erreur appel photo: {:?}", err);
            StatusCode::BAD_GATEWAY.into_response()
        }
    }
}

// Note: Le router pour les routes places n'est pas défini ici car les routes
// sont définies directement dans router_yukpo.rs (lignes 67-68)
