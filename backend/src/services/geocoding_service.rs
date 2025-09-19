use serde::{Deserialize, Serialize};
use crate::core::types::AppError;
use reqwest;
use std::time::Duration;
use log::{info, warn, error};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GeocodingResult {
    pub address: Option<String>,
    pub city: Option<String>,
    pub country: Option<String>,
    pub formatted_address: Option<String>,
    pub latitude: f64,
    pub longitude: f64,
    pub place_id: Option<String>,
    pub postal_code: Option<String>,
    pub administrative_area_level_1: Option<String>,
    pub administrative_area_level_2: Option<String>,
    pub location_type: Option<String>,
    pub types: Vec<String>,
    pub partial_match: bool,
    pub confidence: f64,
}

#[derive(Debug, Deserialize)]
struct GoogleGeocodingResponse {
    results: Vec<GoogleGeocodingResult>,
    status: String,
    error_message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GoogleGeocodingResult {
    formatted_address: String,
    place_id: String,
    address_components: Vec<AddressComponent>,
    geometry: Geometry,
    types: Vec<String>,
    partial_match: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct AddressComponent {
    long_name: String,
    #[allow(dead_code)]
    short_name: String,
    types: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct Geometry {
    location: Location,
    location_type: String,
}

#[derive(Debug, Deserialize)]
struct Location {
    lat: f64,
    lng: f64,
}

pub struct GeocodingService {
    api_key: String,
    client: reqwest::Client,
    base_url: String,
    timeout: Duration,
    max_retries: u32,
}

impl GeocodingService {
    pub fn new() -> Self {
        let api_key = std::env::var("GOOGLE_MAPS_API_KEY")
            .unwrap_or_else(|_| {
                warn!("GOOGLE_MAPS_API_KEY non definie, utilisation de la cle par defaut");
                "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ".to_string()
            });
        
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("Yukpo-GeocodingService/1.0")
            .build()
            .expect("Impossible de creer le client HTTP");
        
        Self {
            api_key,
            client,
            base_url: "https://maps.googleapis.com/maps/api/geocode/json".to_string(),
            timeout: Duration::from_secs(30),
            max_retries: 3,
        }
    }

    pub async fn reverse_geocode(&self, latitude: f64, longitude: f64) -> Result<GeocodingResult, AppError> {
        if !self.is_valid_coordinates(latitude, longitude) {
            return Err(AppError::BadRequest(
                "Coordonnees GPS invalides".to_string()
            ));
        }

        let url = format!(
            "{}?latlng={},{}&key={}&language=fr&region=fr",
            self.base_url, latitude, longitude, self.api_key
        );

        info!("Reverse geocoding pour: {}, {}", latitude, longitude);

        let response = self.make_request_with_retry(&url).await?;
        let google_response: GoogleGeocodingResponse = response
            .json()
            .await
            .map_err(|e| {
                error!("Erreur de parsing JSON: {}", e);
                AppError::Internal(format!("Erreur de parsing de la reponse Google Maps: {}", e))
            })?;

        self.process_geocoding_response(google_response, "reverse geocoding")
    }

    pub async fn geocode(&self, address: &str) -> Result<Vec<GeocodingResult>, AppError> {
        if address.trim().is_empty() {
            return Err(AppError::BadRequest("Adresse vide".to_string()));
        }

        let url = format!(
            "{}?address={}&key={}&language=fr&region=fr",
            self.base_url,
            urlencoding::encode(address),
            self.api_key
        );

        info!("Geocoding pour: {}", address);

        let response = self.make_request_with_retry(&url).await?;
        let google_response: GoogleGeocodingResponse = response
            .json()
            .await
            .map_err(|e| {
                error!("Erreur de parsing JSON: {}", e);
                AppError::Internal(format!("Erreur de parsing de la reponse Google Maps: {}", e))
            })?;

        match google_response.status.as_str() {
            "OK" => {
                let mut results = Vec::new();
                for (index, result) in google_response.results.into_iter().enumerate() {
                    let geocoding_result = self.convert_google_result(result, index == 0);
                    results.push(geocoding_result);
                }
                Ok(results)
            }
            "ZERO_RESULTS" => {
                warn!("Aucun resultat trouve pour: {}", address);
                Ok(Vec::new())
            }
            "OVER_QUERY_LIMIT" => {
                error!("Quota Google Maps API depasse");
                Err(AppError::Internal("Quota API depasse".to_string()))
            }
            "REQUEST_DENIED" => {
                error!("Requete refusee par Google Maps API");
                Err(AppError::Internal("Cle API invalide ou requete refusee".to_string()))
            }
            "INVALID_REQUEST" => {
                error!("Requete invalide vers Google Maps API");
                Err(AppError::BadRequest("Requete de geocodage invalide".to_string()))
            }
            _ => {
                error!("Erreur Google Maps API: {}", google_response.status);
                Err(AppError::Internal(format!(
                    "Erreur Google Maps API: {} - {}",
                    google_response.status,
                    google_response.error_message.unwrap_or_default()
                )))
            }
        }
    }

    async fn make_request_with_retry(&self, url: &str) -> Result<reqwest::Response, AppError> {
        let mut last_error = None;
        
        for attempt in 1..=self.max_retries {
            match self.client.get(url).send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        return Ok(response);
                    } else if response.status().is_server_error() && attempt < self.max_retries {
                        warn!("Erreur serveur (tentative {}/{}), retry dans 1s", attempt, self.max_retries);
                        tokio::time::sleep(Duration::from_secs(1)).await;
                        continue;
                    } else {
                        return Err(AppError::Internal(format!(
                            "Erreur HTTP: {}",
                            response.status()
                        )));
                    }
                }
                Err(e) => {
                    last_error = Some(e);
                    if attempt < self.max_retries {
                        warn!("Erreur de requete (tentative {}/{}), retry dans 1s", attempt, self.max_retries);
                        tokio::time::sleep(Duration::from_secs(1)).await;
                    }
                }
            }
        }
        
        Err(AppError::Internal(format!(
            "Echec apres {} tentatives: {}",
            self.max_retries,
            last_error.unwrap().to_string()
        )))
    }

    fn process_geocoding_response(
        &self,
        google_response: GoogleGeocodingResponse,
        operation: &str,
    ) -> Result<GeocodingResult, AppError> {
        match google_response.status.as_str() {
            "OK" => {
                if google_response.results.is_empty() {
                    Err(AppError::NotFound(format!("Aucun resultat pour {}", operation)))
                } else {
                    let result = google_response.results.into_iter().next().unwrap();
                    Ok(self.convert_google_result(result, true))
                }
            }
            "ZERO_RESULTS" => {
                warn!("Aucun resultat trouve pour {}", operation);
                Err(AppError::NotFound(format!("Aucun resultat pour {}", operation)))
            }
            "OVER_QUERY_LIMIT" => {
                error!("Quota Google Maps API depasse");
                Err(AppError::Internal("Quota API depasse".to_string()))
            }
            "REQUEST_DENIED" => {
                error!("Requete refusee par Google Maps API");
                Err(AppError::Internal("Cle API invalide ou requete refusee".to_string()))
            }
            "INVALID_REQUEST" => {
                error!("Requete invalide vers Google Maps API");
                Err(AppError::BadRequest("Requete de geocodage invalide".to_string()))
            }
            _ => {
                error!("Erreur Google Maps API: {}", google_response.status);
                Err(AppError::Internal(format!(
                    "Erreur Google Maps API: {} - {}",
                    google_response.status,
                    google_response.error_message.unwrap_or_default()
                )))
            }
        }
    }

    fn convert_google_result(&self, result: GoogleGeocodingResult, is_primary: bool) -> GeocodingResult {
        let mut geocoding_result = GeocodingResult {
            address: None,
            city: None,
            country: None,
            formatted_address: Some(result.formatted_address.clone()),
            latitude: result.geometry.location.lat,
            longitude: result.geometry.location.lng,
            place_id: Some(result.place_id.clone()),
            postal_code: None,
            administrative_area_level_1: None,
            administrative_area_level_2: None,
            location_type: Some(result.geometry.location_type.clone()),
            types: result.types.clone(),
            partial_match: result.partial_match.unwrap_or(false),
            confidence: self.calculate_confidence(&result, is_primary),
        };

        for component in &result.address_components {
            for component_type in &component.types {
                match component_type.as_str() {
                    "street_number" | "route" => {
                        if geocoding_result.address.is_none() {
                            geocoding_result.address = Some(component.long_name.clone());
                        } else {
                            geocoding_result.address = Some(format!(
                                "{} {}",
                                geocoding_result.address.as_ref().unwrap(),
                                component.long_name
                            ));
                        }
                    }
                    "locality" | "administrative_area_level_2" => {
                        geocoding_result.city = Some(component.long_name.clone());
                        geocoding_result.administrative_area_level_2 = Some(component.long_name.clone());
                    }
                    "country" => {
                        geocoding_result.country = Some(component.long_name.clone());
                    }
                    "postal_code" => {
                        geocoding_result.postal_code = Some(component.long_name.clone());
                    }
                    "administrative_area_level_1" => {
                        geocoding_result.administrative_area_level_1 = Some(component.long_name.clone());
                    }
                    _ => {}
                }
            }
        }

        geocoding_result
    }

    fn calculate_confidence(&self, result: &GoogleGeocodingResult, is_primary: bool) -> f64 {
        let mut confidence: f64 = 0.5;
        
        if is_primary {
            confidence += 0.2;
        }
        
        match result.geometry.location_type.as_str() {
            "ROOFTOP" => confidence += 0.3,
            "RANGE_INTERPOLATED" => confidence += 0.2,
            "GEOMETRIC_CENTER" => confidence += 0.1,
            "APPROXIMATE" => confidence += 0.0,
            _ => {}
        }
        
        if result.partial_match.unwrap_or(false) {
            confidence -= 0.2;
        }
        
        let has_street = result.address_components.iter().any(|c| 
            c.types.contains(&"street_number".to_string()) || 
            c.types.contains(&"route".to_string())
        );
        if has_street {
            confidence += 0.1;
        }
        
        confidence.min(1.0).max(0.0)
    }

    fn is_valid_coordinates(&self, latitude: f64, longitude: f64) -> bool {
        latitude >= -90.0 && latitude <= 90.0 && longitude >= -180.0 && longitude <= 180.0
    }

    pub fn get_service_info(&self) -> std::collections::HashMap<String, String> {
        let mut info = std::collections::HashMap::new();
        info.insert("service".to_string(), "Google Maps Geocoding".to_string());
        info.insert("version".to_string(), "1.0".to_string());
        info.insert("timeout".to_string(), format!("{}s", self.timeout.as_secs()));
        info.insert("max_retries".to_string(), self.max_retries.to_string());
        info.insert("api_key_configured".to_string(), (!self.api_key.is_empty()).to_string());
        info
    }
}

impl Default for GeocodingService {
    fn default() -> Self {
        Self::new()
    }
}
