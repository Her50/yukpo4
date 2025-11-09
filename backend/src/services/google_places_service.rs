// 🗺️ Service Google Places API pour enrichissement géographique bidirectionnel
use log::{error, info, warn};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::core::types::AppError;

#[derive(Debug, Serialize, Deserialize)]
pub struct GooglePlacesResult {
    pub place_name: String,
    pub location_vector: Vec<String>, // ["Makepe", "Douala", "Wouri", "Littoral", "Cameroun"]
    pub coordinates: Coordinates,
    pub formatted_address: String,
    pub place_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Coordinates {
    pub lat: f64,
    pub lng: f64,
}

#[derive(Debug, Deserialize)]
struct GooglePlacesResponse {
    results: Vec<GooglePlace>,
    status: String,
    #[serde(default)]
    error_message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GooglePlace {
    formatted_address: String,
    geometry: Geometry,
    place_id: String,
    address_components: Vec<AddressComponent>,
}

#[derive(Debug, Deserialize)]
struct Geometry {
    location: Location,
}

#[derive(Debug, Deserialize)]
struct Location {
    lat: f64,
    lng: f64,
}

#[derive(Debug, Deserialize)]
struct AddressComponent {
    long_name: String,
    #[allow(dead_code)]
    short_name: String,
    types: Vec<String>,
}

pub struct GooglePlacesService {
    api_key: String,
    client: Client,
}

impl GooglePlacesService {
    pub fn new() -> Self {
        let api_key = std::env::var("GOOGLE_MAPS_API_KEY").unwrap_or_else(|_| {
            warn!("GOOGLE_MAPS_API_KEY non définie, utilisation de la clé par défaut");
            "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ".to_string()
        });

        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .user_agent("Yukpomnang-GooglePlaces/1.0")
            .build()
            .expect("Impossible de créer le client HTTP");

        Self { api_key, client }
    }

    /// Recherche un lieu et construit sa hiérarchie MONTANTE (parents)
    pub async fn search_and_build_hierarchy(
        &self,
        place_name: &str,
        country: Option<&str>,
    ) -> Result<GooglePlacesResult, AppError> {
        info!(
            "🗺️ Recherche Google Places: {} ({})",
            place_name,
            country.unwrap_or("?")
        );

        // Construire la requête
        let query = if let Some(c) = country {
            format!("{}, {}", place_name, c)
        } else {
            place_name.to_string()
        };

        let url = format!(
            "https://maps.googleapis.com/maps/api/place/textsearch/json?query={}&key={}",
            urlencoding::encode(&query),
            self.api_key
        );

        // Appeler l'API
        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur Google Places API: {}", e)))?;

        let google_response: GooglePlacesResponse = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur parsing Google Places: {}", e)))?;

        // Vérifier le statut
        if google_response.status != "OK" {
            if google_response.status == "ZERO_RESULTS" {
                warn!("⚠️ Google Places: Aucun résultat pour '{}'", place_name);
                return Err(AppError::NotFound(format!(
                    "Lieu '{}' introuvable",
                    place_name
                )));
            } else {
                if let Some(ref message) = google_response.error_message {
                    error!(
                        "❌ Google Places API erreur: {} ({}) pour requête '{}'",
                        google_response.status, message, query
                    );
                } else {
                    error!(
                        "❌ Google Places API erreur: {} (aucun message) pour requête '{}'",
                        google_response.status, query
                    );
                }
                return Err(AppError::Internal(format!(
                    "Google Places API: {}{}",
                    google_response.status,
                    google_response
                        .error_message
                        .as_ref()
                        .map(|msg| format!(" ({})", msg))
                        .unwrap_or_default()
                )));
            }
        }

        // Prendre le premier résultat
        let place = google_response
            .results
            .into_iter()
            .next()
            .ok_or_else(|| AppError::NotFound("Aucun résultat".to_string()))?;

        // Construire le location_vector à partir des address_components
        // Ordre : Quartier → Ville → Département → Région → Pays
        let mut location_vector = Vec::new();

        // Types à extraire dans l'ordre (du plus spécifique au plus général)
        let type_order = [
            "sublocality_level_1",
            "sublocality",
            "neighborhood",
            "locality",
            "administrative_area_level_2",
            "administrative_area_level_1",
            "country",
        ];

        for type_name in &type_order {
            if let Some(component) = place
                .address_components
                .iter()
                .find(|c| c.types.contains(&type_name.to_string()))
            {
                if !location_vector.contains(&component.long_name) {
                    location_vector.push(component.long_name.clone());
                }
            }
        }

        info!(
            "✅ Google Places: {} → {} éléments dans location_vector",
            place_name,
            location_vector.len()
        );

        Ok(GooglePlacesResult {
            place_name: location_vector
                .first()
                .cloned()
                .unwrap_or_else(|| place_name.to_string()),
            location_vector,
            coordinates: Coordinates {
                lat: place.geometry.location.lat,
                lng: place.geometry.location.lng,
            },
            formatted_address: place.formatted_address,
            place_id: place.place_id,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_search_makepe() {
        let service = GooglePlacesService::new();
        let result = service
            .search_and_build_hierarchy("Makepe", Some("Cameroun"))
            .await;

        if let Ok(data) = result {
            println!("Place: {}", data.place_name);
            println!("Vector: {:?}", data.location_vector);
            println!("Coords: {}, {}", data.coordinates.lat, data.coordinates.lng);
            assert!(data.location_vector.len() > 0);
        }
    }
}
