use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct PlacesAutocompleteQuery {
    pub query: String,
    #[serde(rename = "type")]
    pub place_type: Option<String>, // 'city', 'neighborhood', 'point', 'hospital', 'pharmacy', 'health'
    pub city: Option<String>, // Contexte de ville pour filtrer les résultats
    pub lat: Option<f64>, // Latitude pour recherche par proximité
    pub lng: Option<f64>, // Longitude pour recherche par proximité
    pub radius: Option<u32>, // Rayon en mètres (défaut: 5000m = 5km)
}

#[derive(Debug, Serialize)]
pub struct PlacesAutocompleteResponse {
    pub success: bool,
    pub data: Option<Vec<String>>,
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
    
    // Validation de la requête
    if !is_health_search && params.query.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(PlacesAutocompleteResponse {
                success: false,
                data: None,
                error: Some("Query parameter is required".to_string()),
            }),
        );
    }

    // ✅ NOUVEAU 2025-11-04: Place type est optional maintenant, None = recherche universelle
    let place_type = params.place_type.as_deref();

    // TODO: Intégrer l'API Google Maps Places Autocomplete
    // Pour l'instant, retourner une réponse vide pour que le fallback local fonctionne
    
    // Clé API Google Maps (à mettre dans les variables d'environnement)
    let google_api_key = std::env::var("GOOGLE_MAPS_API_KEY").unwrap_or_default();
    
    if google_api_key.is_empty() {
        // Pas de clé API configurée, retourner vide pour fallback
        return (
            StatusCode::OK,
            Json(PlacesAutocompleteResponse {
                success: true,
                data: Some(vec![]),
                error: None,
            }),
        );
    }

    // Construire la requête Google Maps API
    let mut url = format!(
        "https://maps.googleapis.com/maps/api/place/autocomplete/json?input={}&key={}",
        urlencoding::encode(&params.query),
        google_api_key
    );

    // Filtrer par type et géolocalisation
    match place_type {
        None => {
            // ✅ NOUVEAU: Recherche universelle - tous les types géographiques (geocode = régions, pays, villes, quartiers)
            url.push_str("&types=geocode");
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
                    let results: Vec<String> = predictions
                        .iter()
                        .filter_map(|pred| {
                            pred.get("description")
                                .and_then(|d| d.as_str())
                                .map(|s| s.to_string())
                        })
                        .take(20) // Limiter à 20 résultats
                        .collect();

                    return (
                        StatusCode::OK,
                        Json(PlacesAutocompleteResponse {
                            success: true,
                            data: Some(results),
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
                    error: None,
                }),
            )
        }
    }
}

// Note: Le router pour les routes places n'est pas défini ici car les routes 
// sont définies directement dans router_yukpo.rs (lignes 67-68)
