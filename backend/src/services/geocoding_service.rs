use crate::core::types::{AppResult, AppError};
use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::env;

#[derive(Debug, Serialize, Deserialize)]
pub struct GeocodingResult {
    pub formatted_address: String,
    pub city: Option<String>,
    pub neighbourhood: Option<String>,
    pub country: Option<String>,
    pub confidence: f64,
}

#[derive(Debug, Serialize, Deserialize)]
struct GoogleGeocodingResponse {
    status: String,
    results: Vec<GoogleGeocodingResult>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GoogleGeocodingResult {
    formatted_address: String,
    address_components: Vec<AddressComponent>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AddressComponent {
    long_name: String,
    short_name: String,
    types: Vec<String>,
}

pub struct GeocodingService {
    client: Client,
    api_key: String,
}

impl GeocodingService {
    pub fn new() -> Self {
        let api_key = env::var("GOOGLE_MAPS_API_KEY")
            .unwrap_or_else(|_| "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ".to_string());
        
        Self {
            client: Client::new(),
            api_key,
        }
    }

    pub async fn reverse_geocode(&self, lat: f64, lng: f64) -> AppResult<GeocodingResult> {
        let url = format!(
            "https://maps.googleapis.com/maps/api/geocode/json?latlng={},{}&key={}&language=fr",
            lat, lng, self.api_key
        );

        let response = self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur de requête HTTP: {}", e)))?;

        if !response.status().is_success() {
            return Err(AppError::Internal(format!(
                "Erreur API Google Maps: {}",
                response.status()
            )));
        }

        let data: GoogleGeocodingResponse = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur de parsing JSON: {}", e)))?;

        if data.status != "OK" || data.results.is_empty() {
            return Err(AppError::NotFound("Aucun résultat de géocodage trouvé".to_string()));
        }

        let result = &data.results[0];
        let formatted_name = self.format_location_name(result);

        Ok(GeocodingResult {
            formatted_address: formatted_name,
            city: self.extract_component(result, "locality"),
            neighbourhood: self.extract_component(result, "neighbourhood"),
            country: self.extract_component(result, "country"),
            confidence: 0.9, // Google Maps est généralement très fiable
        })
    }

    fn format_location_name(&self, result: &GoogleGeocodingResult) -> String {
        let _components = &result.address_components;
        
        // Priorité 1: Quartier/Neighbourhood
        if let Some(neighbourhood) = self.extract_component(result, "neighbourhood") {
            if let Some(city) = self.extract_component(result, "locality") {
                return format!("{}, {}", neighbourhood, city);
            }
            return neighbourhood;
        }
        
        // Priorité 2: Sublocalité
        if let Some(sublocality) = self.extract_component(result, "sublocality") {
            if let Some(city) = self.extract_component(result, "locality") {
                return format!("{}, {}", sublocality, city);
            }
            return sublocality;
        }
        
        // Priorité 3: Localité/Ville
        if let Some(city) = self.extract_component(result, "locality") {
            if let Some(state) = self.extract_component(result, "administrative_area_level_1") {
                return format!("{}, {}", city, state);
            }
            return city;
        }
        
        // Priorité 4: Région/État
        if let Some(state) = self.extract_component(result, "administrative_area_level_1") {
            return state;
        }
        
        // Fallback: adresse formatée (première partie)
        result.formatted_address.split(',').next().unwrap_or("Lieu inconnu").trim().to_string()
    }

    fn extract_component(&self, result: &GoogleGeocodingResult, component_type: &str) -> Option<String> {
        result.address_components
            .iter()
            .find(|c| c.types.contains(&component_type.to_string()))
            .map(|c| c.long_name.clone())
    }
} 