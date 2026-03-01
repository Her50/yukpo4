use axum::{
    body::Body,
    extract::{Query, State},
    http::{HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
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

    // ✅ CORRIGÉ 2026-02-25: Clé Google Maps depuis env var ou fallback
    let google_api_key = std::env::var("GOOGLE_MAPS_API_KEY").unwrap_or_else(|_| {
        eprintln!("[Places API] GOOGLE_MAPS_API_KEY non trouvée dans env, utilisation du fallback");
        "AIzaSyDqlMAysWsGzv1jQtR6WJn8LZXpH75SwFo".to_string()
    });
    // Log masqué pour diagnostic
    if google_api_key.len() > 10 {
        eprintln!(
            "[Places API] Clé utilisée: {}...{} (len={})",
            &google_api_key[..8],
            &google_api_key[google_api_key.len() - 4..],
            google_api_key.len()
        );
    }

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
            // ✅ FIX 2026-03-01: Recherche universelle SANS filtre components
            // Le filtre components=country:... limitait les résultats aux quartiers uniquement
            // car Google favorise les résultats géographiques quand on filtre par pays sans type.
            // Sans components, Google retourne TOUS les types: villes, quartiers, établissements,
            // restaurants, adresses, etc. On utilise language=fr pour obtenir des résultats en français.
            url.push_str("&language=fr");
            // Utiliser les coordonnées du client si fournies, sinon biais vers Douala
            if let (Some(lat), Some(lng)) = (params.lat, params.lng) {
                let radius = params.radius.unwrap_or(50000);
                url.push_str(&format!("&location={},{}&radius={}", lat, lng, radius));
            } else {
                // Biais vers Douala, Cameroun avec un rayon large (500km) pour couvrir la sous-région
                url.push_str("&location=4.05,9.7&radius=500000");
            }
        }
        Some("city") => {
            // Filtrer pour villes uniquement
            url.push_str("&types=(cities)");
            // ✅ FIX 2026-02-25: Google Places API limite à 5 composants country max
            url.push_str("&components=country:cm|country:ci|country:sn|country:cd|country:ga");
            url.push_str("&language=fr");
        }
        Some("neighborhood") => {
            // ✅ FIX 2026-03-01: Quartiers et sous-localités SANS filtre components
            url.push_str("&types=sublocality|neighborhood");
            url.push_str("&language=fr");
            if let (Some(lat), Some(lng)) = (params.lat, params.lng) {
                let radius = params.radius.unwrap_or(50000);
                url.push_str(&format!("&location={},{}&radius={}", lat, lng, radius));
            } else if let Some(city) = &params.city {
                url.push_str(&format!("&location={}", urlencoding::encode(city)));
            } else {
                url.push_str("&location=4.05,9.7&radius=500000");
            }
        }
        Some("point") | Some("establishment") => {
            // Points d'intérêt, établissements (mobile envoie "point" ou "establishment")
            url.push_str("&types=establishment");
            url.push_str("&language=fr");
            if let (Some(lat), Some(lng)) = (params.lat, params.lng) {
                let radius = params.radius.unwrap_or(50000);
                url.push_str(&format!("&location={},{}&radius={}", lat, lng, radius));
            } else if let Some(city) = &params.city {
                url.push_str(&format!("&location={}", urlencoding::encode(city)));
            } else {
                url.push_str("&location=4.05,9.7&radius=500000");
            }
        }
        Some("hospital") => {
            // Recherche d'hôpitaux par proximité
            url.push_str("&types=hospital");
            url.push_str("&language=fr");
            if let (Some(lat), Some(lng)) = (params.lat, params.lng) {
                let radius = params.radius.unwrap_or(5000); // 5km par défaut
                url.push_str(&format!("&location={},{}&radius={}", lat, lng, radius));
            }
        }
        Some("pharmacy") => {
            // Recherche de pharmacies par proximité
            url.push_str("&types=pharmacy");
            url.push_str("&language=fr");
            if let (Some(lat), Some(lng)) = (params.lat, params.lng) {
                let radius = params.radius.unwrap_or(5000);
                url.push_str(&format!("&location={},{}&radius={}", lat, lng, radius));
            }
        }
        Some("health") => {
            // Recherche structures de santé générales (labos, cliniques, etc.)
            url.push_str("&types=health");
            url.push_str("&language=fr");
            if let (Some(lat), Some(lng)) = (params.lat, params.lng) {
                let radius = params.radius.unwrap_or(5000);
                url.push_str(&format!("&location={},{}&radius={}", lat, lng, radius));
            }
        }
        _ => {}
    }

    // Log de l'URL finale pour diagnostic (clé masquée)
    let masked_url = url.replace(&google_api_key, "KEY_***");
    eprintln!("[Places API] URL finale: {}", masked_url);

    // Appeler l'API Google Maps
    match reqwest::get(&url).await {
        Ok(response) => {
            if let Ok(json) = response.json::<serde_json::Value>().await {
                // Log de la réponse brute pour diagnostic
                let status = json.get("status").and_then(|s| s.as_str()).unwrap_or("UNKNOWN");
                if status != "OK" {
                    let error_msg =
                        json.get("error_message").and_then(|e| e.as_str()).unwrap_or("");
                    eprintln!(
                        "[Places API] Google retourne status={} error={}",
                        status, error_msg
                    );
                }
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

// ✅ NOUVEAU 2026-02-10: Réponse pour les détails Google Business
#[derive(Debug, Serialize)]
pub struct GoogleBusinessDetailsResponse {
    pub success: bool,
    pub data: Option<GoogleBusinessDetails>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GoogleBusinessDetails {
    pub place_id: String,
    pub name: String,
    pub formatted_address: String,
    pub location: LocationCoords,
    pub phone_number: Option<String>,
    pub website: Option<String>,
    pub photos: Vec<String>,                // URLs des photos
    pub opening_hours: Option<Vec<String>>, // Horaires d'ouverture
    pub rating: Option<f64>,
    pub user_ratings_total: Option<i32>,
    pub business_status: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct LocationCoords {
    pub lat: f64,
    pub lng: f64,
}

#[derive(Debug, Deserialize)]
pub struct GoogleBusinessDetailsQuery {
    pub place_id: String,
}

/// ✅ NOUVEAU 2026-02-10: Obtenir les détails complets d'un Google Business Profile
/// Récupère toutes les informations nécessaires pour pré-remplir le formulaire de création de service
/// GET /api/places/google-business-details?place_id=ChIJ...
pub async fn get_google_business_details(
    State(_state): State<Arc<AppState>>,
    Query(params): Query<GoogleBusinessDetailsQuery>,
) -> impl IntoResponse {
    let api_key = std::env::var("GOOGLE_MAPS_API_KEY")
        .unwrap_or_else(|_| "AIzaSyDqlMAysWsGzv1jQtR6WJn8LZXpH75SwFo".to_string());

    if api_key.is_empty() {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(GoogleBusinessDetailsResponse {
                success: false,
                data: None,
                error: Some("GOOGLE_MAPS_API_KEY non configurée".to_string()),
            }),
        );
    }

    // ✅ Récupérer tous les champs nécessaires pour Google Business
    let fields = "place_id,name,formatted_address,geometry,international_phone_number,website,photos,opening_hours,rating,user_ratings_total,business_status";
    let url = format!(
        "https://maps.googleapis.com/maps/api/place/details/json?place_id={}&fields={}&key={}&language=fr",
        urlencoding::encode(&params.place_id),
        fields,
        api_key
    );

    let client = reqwest::Client::new();
    match client.get(&url).timeout(std::time::Duration::from_secs(10)).send().await {
        Ok(response) => {
            match response.json::<serde_json::Value>().await {
                Ok(data) => {
                    if let Some(status) = data.get("status").and_then(|s| s.as_str()) {
                        if status != "OK" {
                            return (
                                StatusCode::BAD_REQUEST,
                                Json(GoogleBusinessDetailsResponse {
                                    success: false,
                                    data: None,
                                    error: Some(format!("Google Places API error: {}", status)),
                                }),
                            );
                        }

                        if let Some(result) = data.get("result") {
                            // Extraire les coordonnées
                            let location =
                                match result.get("geometry").and_then(|g| g.get("location")) {
                                    Some(loc) => {
                                        let lat =
                                            loc.get("lat").and_then(|l| l.as_f64()).unwrap_or(0.0);
                                        let lng =
                                            loc.get("lng").and_then(|l| l.as_f64()).unwrap_or(0.0);
                                        LocationCoords { lat, lng }
                                    }
                                    None => {
                                        return (
                                            StatusCode::BAD_REQUEST,
                                            Json(GoogleBusinessDetailsResponse {
                                                success: false,
                                                data: None,
                                                error: Some("Géométrie invalide".to_string()),
                                            }),
                                        );
                                    }
                                };

                            // Extraire le nom
                            let name = result
                                .get("name")
                                .and_then(|n| n.as_str())
                                .unwrap_or("")
                                .to_string();

                            // Extraire l'adresse
                            let formatted_address = result
                                .get("formatted_address")
                                .and_then(|a| a.as_str())
                                .unwrap_or("")
                                .to_string();

                            // Extraire le téléphone
                            let phone_number = result
                                .get("international_phone_number")
                                .and_then(|p| p.as_str())
                                .map(|s| s.to_string());

                            // Extraire le site web
                            let website = result
                                .get("website")
                                .and_then(|w| w.as_str())
                                .map(|s| s.to_string());

                            // Extraire les photos (premières 10)
                            let mut photos: Vec<String> = Vec::new();
                            if let Some(photos_array) =
                                result.get("photos").and_then(|p| p.as_array())
                            {
                                for photo in photos_array.iter().take(10) {
                                    if let Some(photo_reference) =
                                        photo.get("photo_reference").and_then(|r| r.as_str())
                                    {
                                        // Construire l'URL de la photo
                                        let photo_url = format!(
                                            "https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference={}&key={}",
                                            urlencoding::encode(photo_reference),
                                            api_key
                                        );
                                        photos.push(photo_url);
                                    }
                                }
                            }

                            // Extraire les horaires d'ouverture
                            let opening_hours = result
                                .get("opening_hours")
                                .and_then(|h| h.get("weekday_text"))
                                .and_then(|w| w.as_array())
                                .map(|arr| {
                                    arr.iter()
                                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                                        .collect()
                                });

                            // Extraire la note
                            let rating = result.get("rating").and_then(|r| r.as_f64());

                            // Extraire le nombre d'avis
                            let user_ratings_total = result
                                .get("user_ratings_total")
                                .and_then(|u| u.as_i64())
                                .map(|i| i as i32);

                            // Extraire le statut business
                            let business_status = result
                                .get("business_status")
                                .and_then(|b| b.as_str())
                                .map(|s| s.to_string());

                            return (
                                StatusCode::OK,
                                Json(GoogleBusinessDetailsResponse {
                                    success: true,
                                    data: Some(GoogleBusinessDetails {
                                        place_id: params.place_id,
                                        name,
                                        formatted_address,
                                        location,
                                        phone_number,
                                        website,
                                        photos,
                                        opening_hours,
                                        rating,
                                        user_ratings_total,
                                        business_status,
                                    }),
                                    error: None,
                                }),
                            );
                        }
                    }

                    (
                        StatusCode::BAD_REQUEST,
                        Json(GoogleBusinessDetailsResponse {
                            success: false,
                            data: None,
                            error: Some("Aucun résultat pour ce place_id".to_string()),
                        }),
                    )
                }
                Err(err) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(GoogleBusinessDetailsResponse {
                        success: false,
                        data: None,
                        error: Some(format!("Erreur parsing Google Business Details: {}", err)),
                    }),
                ),
            }
        }
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(GoogleBusinessDetailsResponse {
                success: false,
                data: None,
                error: Some(format!("Erreur requête Google Business Details: {}", err)),
            }),
        ),
    }
}

/// ✅ NOUVEAU 2026-02-10: Router pour les routes Google Places
pub fn places_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/places/autocomplete", get(autocomplete_places))
        .route(
            "/api/places/google-business-details",
            get(get_google_business_details),
        )
        .route("/api/places/photo", get(fetch_place_photo))
        .with_state(state)
}
