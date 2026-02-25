use crate::{config::timeouts::get_geocoding_timeout, core::types::AppError};
use log::{error, info, warn};
use reqwest;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json;
use std::{cmp::min, env, time::Duration};

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

#[derive(Debug, Deserialize, Clone)]
struct MapboxResponse {
    features: Vec<MapboxFeature>,
}

#[derive(Debug, Deserialize, Clone)]
struct MapboxFeature {
    #[serde(default)]
    place_name: String,
    #[serde(default)]
    context: Vec<MapboxContext>,
    #[serde(default)]
    place_type: Vec<String>,
    #[serde(default)]
    properties: MapboxProperties,
    geometry: MapboxGeometry,
}

#[derive(Debug, Deserialize, Default, Clone)]
struct MapboxContext {
    id: String,
    #[serde(default)]
    text: String,
}

#[derive(Debug, Deserialize, Default, Clone)]
struct MapboxProperties {
    #[serde(default)]
    accuracy: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
struct MapboxGeometry {
    coordinates: [f64; 2],
}

pub struct GeocodingService {
    api_key: String,
    mapbox_key: Option<String>,
    client: reqwest::Client,
    base_url: String,
    mapbox_base_url: String,
    timeout: Duration,
    max_retries: u32,
    cache_ttl: Duration,
    redis_client: Option<redis::Client>,
}

impl GeocodingService {
    pub fn new() -> Self {
        Self::with_cache(None)
    }

    pub fn with_cache(redis_client: Option<redis::Client>) -> Self {
        let api_key = std::env::var("GOOGLE_MAPS_API_KEY").unwrap_or_else(|_| {
            warn!("GOOGLE_MAPS_API_KEY non definie, utilisation de la cle par defaut");
            "AIzaSyDqlMAysWsGzv1jQtR6WJn8LZXpH75SwFo".to_string()
        });

        let timeout = get_geocoding_timeout();
        let cache_ttl = Duration::from_secs(
            env::var("GEOCODING_CACHE_TTL_SECONDS")
                .ok()
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(900),
        );

        let client = reqwest::Client::builder()
            .timeout(timeout)
            .user_agent("Yukpo-GeocodingService/1.0")
            .build()
            .expect("Impossible de creer le client HTTP");

        Self {
            api_key,
            mapbox_key: std::env::var("MAPBOX_ACCESS_TOKEN").ok(),
            client,
            base_url: "https://maps.googleapis.com/maps/api/geocode/json".to_string(),
            mapbox_base_url: "https://api.mapbox.com/geocoding/v5/mapbox.places".to_string(),
            timeout,
            max_retries: 3,
            cache_ttl,
            redis_client,
        }
    }

    pub async fn reverse_geocode(
        &self,
        latitude: f64,
        longitude: f64,
    ) -> Result<GeocodingResult, AppError> {
        if !self.is_valid_coordinates(latitude, longitude) {
            return Err(AppError::BadRequest(
                "Coordonnees GPS invalides".to_string(),
            ));
        }
        let cache_key = Self::build_reverse_cache_key(latitude, longitude);
        if let Some(result) = self.get_cached::<GeocodingResult>(&cache_key).await? {
            return Ok(result);
        }

        info!("[Geocoding] Reverse pour {}, {}", latitude, longitude);

        if let Ok(result) = self.reverse_geocode_google(latitude, longitude).await {
            self.set_cache(&cache_key, &result).await?;
            return Ok(result);
        }

        if let Some(mapbox_result) = self.reverse_geocode_mapbox(latitude, longitude).await? {
            self.set_cache(&cache_key, &mapbox_result).await?;
            return Ok(mapbox_result);
        }

        let fallback = self.build_offline_result(latitude, longitude);
        self.set_cache(&cache_key, &fallback).await?;
        Ok(fallback)
    }

    pub async fn geocode(&self, address: &str) -> Result<Vec<GeocodingResult>, AppError> {
        if address.trim().is_empty() {
            return Err(AppError::BadRequest("Adresse vide".to_string()));
        }

        let cache_key = Self::build_address_cache_key(address);
        if let Some(results) = self.get_cached::<Vec<GeocodingResult>>(&cache_key).await? {
            return Ok(results);
        }

        info!("[Geocoding] Adresse '{}'", address);

        if let Ok(results) = self.geocode_google(address).await {
            self.set_cache(&cache_key, &results).await?;
            return Ok(results);
        }

        if let Some(results) = self.geocode_mapbox(address).await? {
            self.set_cache(&cache_key, &results).await?;
            return Ok(results);
        }

        warn!(
            "[Geocoding] Fallback offline pour adresse '{}', aucun provider disponible",
            address
        );
        Ok(vec![self.build_offline_result(0.0, 0.0)])
    }

    async fn make_request_with_retry(&self, url: &str) -> Result<reqwest::Response, AppError> {
        let mut last_error = None;

        for attempt in 1..=self.max_retries {
            match self.client.get(url).send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        return Ok(response);
                    } else if response.status().is_server_error() && attempt < self.max_retries {
                        warn!(
                            "Erreur serveur (tentative {}/{}), retry dans 1s",
                            attempt, self.max_retries
                        );
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
                        warn!(
                            "Erreur de requete (tentative {}/{}), retry dans 1s",
                            attempt, self.max_retries
                        );
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
                    Err(AppError::NotFound(format!(
                        "Aucun resultat pour {}",
                        operation
                    )))
                } else {
                    let result = google_response.results.into_iter().next().unwrap();
                    Ok(self.convert_google_result(result, true))
                }
            }
            "ZERO_RESULTS" => {
                warn!("Aucun resultat trouve pour {}", operation);
                Err(AppError::NotFound(format!(
                    "Aucun resultat pour {}",
                    operation
                )))
            }
            "OVER_QUERY_LIMIT" => {
                error!("Quota Google Maps API depasse");
                Err(AppError::Internal("Quota API depasse".to_string()))
            }
            "REQUEST_DENIED" => {
                error!("Requete refusee par Google Maps API");
                Err(AppError::Internal(
                    "Cle API invalide ou requete refusee".to_string(),
                ))
            }
            "INVALID_REQUEST" => {
                error!("Requete invalide vers Google Maps API");
                Err(AppError::BadRequest(
                    "Requete de geocodage invalide".to_string(),
                ))
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

    fn convert_google_result(
        &self,
        result: GoogleGeocodingResult,
        is_primary: bool,
    ) -> GeocodingResult {
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
                        geocoding_result.administrative_area_level_2 =
                            Some(component.long_name.clone());
                    }
                    "country" => {
                        geocoding_result.country = Some(component.long_name.clone());
                    }
                    "postal_code" => {
                        geocoding_result.postal_code = Some(component.long_name.clone());
                    }
                    "administrative_area_level_1" => {
                        geocoding_result.administrative_area_level_1 =
                            Some(component.long_name.clone());
                    }
                    _ => {}
                }
            }
        }

        geocoding_result
    }

    fn convert_mapbox_feature(&self, feature: &MapboxFeature, is_primary: bool) -> GeocodingResult {
        let latitude = feature.geometry.coordinates[1];
        let longitude = feature.geometry.coordinates[0];

        let mut city = None;
        let mut country = None;
        let mut admin_level_1 = None;
        let mut admin_level_2 = None;

        for ctx in &feature.context {
            if ctx.id.starts_with("place.") || ctx.id.starts_with("locality.") {
                city = Some(ctx.text.clone());
            } else if ctx.id.starts_with("region.") {
                admin_level_1 = Some(ctx.text.clone());
            } else if ctx.id.starts_with("district.") {
                admin_level_2 = Some(ctx.text.clone());
            } else if ctx.id.starts_with("country.") {
                country = Some(ctx.text.clone());
            }
        }

        GeocodingResult {
            address: Some(feature.place_name.clone()),
            city,
            country,
            formatted_address: Some(feature.place_name.clone()),
            latitude,
            longitude,
            place_id: None,
            postal_code: None,
            administrative_area_level_1: admin_level_1,
            administrative_area_level_2: admin_level_2,
            location_type: feature
                .properties
                .accuracy
                .clone()
                .or_else(|| Some("approximate".to_string())),
            types: feature.place_type.clone(),
            partial_match: false,
            confidence: if is_primary { 0.6 } else { 0.45 },
        }
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

        let has_street = result.address_components.iter().any(|c| {
            c.types.contains(&"street_number".to_string()) || c.types.contains(&"route".to_string())
        });
        if has_street {
            confidence += 0.1;
        }

        confidence.min(1.0).max(0.0)
    }

    fn is_valid_coordinates(&self, latitude: f64, longitude: f64) -> bool {
        latitude >= -90.0 && latitude <= 90.0 && longitude >= -180.0 && longitude <= 180.0
    }

    fn build_reverse_cache_key(lat: f64, lng: f64) -> String {
        format!("geo:reverse:{:.5}:{:.5}", lat, lng)
    }

    fn build_address_cache_key(address: &str) -> String {
        format!("geo:address:{}", address.trim().to_lowercase())
    }

    async fn get_cached<T>(&self, key: &str) -> Result<Option<T>, AppError>
    where
        T: DeserializeOwned,
    {
        let Some(client) = &self.redis_client else {
            return Ok(None);
        };
        // ✅ CORRIGÉ: Utiliser le helper Redis avec retry automatique
        use crate::utils::redis_helper;

        match redis_helper::get_with_retry(client, key).await {
            Ok(Some(payload)) => match serde_json::from_str::<T>(&payload) {
                Ok(value) => Ok(Some(value)),
                Err(err) => {
                    warn!(
                        "[Geocoding] Impossible de parser le cache {}: {:?}",
                        key, err
                    );
                    Ok(None)
                }
            },
            Ok(None) => Ok(None),
            Err(e) => {
                warn!(
                    "[Geocoding] Redis indisponible pour {}: {}. Retour None.",
                    key, e
                );
                Ok(None)
            }
        }
    }

    async fn set_cache<T>(&self, key: &str, value: &T) -> Result<(), AppError>
    where
        T: Serialize,
    {
        let Some(client) = &self.redis_client else {
            return Ok(());
        };

        let payload = match serde_json::to_string(value) {
            Ok(json) => json,
            Err(err) => {
                warn!(
                    "[Geocoding] Impossible de sérialiser la valeur pour {}: {:?}",
                    key, err
                );
                return Ok(());
            }
        };

        // ✅ CORRIGÉ: Utiliser le helper Redis avec retry automatique
        use crate::utils::redis_helper;

        let ttl_seconds = min(self.cache_ttl.as_secs(), i64::MAX as u64);
        if let Err(e) = redis_helper::set_with_retry(client, key, &payload, Some(ttl_seconds)).await
        {
            warn!(
                "[Geocoding] Redis indisponible pour set {}: {}. L'opération continue sans cache.",
                key, e
            );
        }

        Ok(())
    }

    async fn reverse_geocode_google(
        &self,
        latitude: f64,
        longitude: f64,
    ) -> Result<GeocodingResult, AppError> {
        let url = format!(
            "{}?latlng={},{}&key={}&language=fr&region=fr",
            self.base_url, latitude, longitude, self.api_key
        );
        let response = self.make_request_with_retry(&url).await?;
        let google_response: GoogleGeocodingResponse = response.json().await.map_err(|e| {
            error!("Erreur de parsing JSON: {}", e);
            AppError::Internal(format!(
                "Erreur de parsing de la reponse Google Maps: {}",
                e
            ))
        })?;
        self.process_geocoding_response(google_response, "reverse geocoding")
    }

    async fn geocode_google(&self, address: &str) -> Result<Vec<GeocodingResult>, AppError> {
        let url = format!(
            "{}?address={}&key={}&language=fr&region=fr",
            self.base_url,
            urlencoding::encode(address),
            self.api_key
        );

        let response = self.make_request_with_retry(&url).await?;
        let google_response: GoogleGeocodingResponse = response.json().await.map_err(|e| {
            error!("Erreur de parsing JSON: {}", e);
            AppError::Internal(format!(
                "Erreur de parsing de la reponse Google Maps: {}",
                e
            ))
        })?;

        match google_response.status.as_str() {
            "OK" => Ok(google_response
                .results
                .into_iter()
                .enumerate()
                .map(|(index, result)| self.convert_google_result(result, index == 0))
                .collect()),
            "ZERO_RESULTS" => Ok(Vec::new()),
            "OVER_QUERY_LIMIT" => Err(AppError::Internal("Quota API depasse".to_string())),
            "REQUEST_DENIED" => Err(AppError::Internal(
                "Cle API invalide ou requete refusee".to_string(),
            )),
            "INVALID_REQUEST" => Err(AppError::BadRequest(
                "Requete de geocodage invalide".to_string(),
            )),
            _ => Err(AppError::Internal(format!(
                "Erreur Google Maps API: {} - {}",
                google_response.status,
                google_response.error_message.unwrap_or_default()
            ))),
        }
    }

    async fn reverse_geocode_mapbox(
        &self,
        latitude: f64,
        longitude: f64,
    ) -> Result<Option<GeocodingResult>, AppError> {
        let Some(mapbox_key) = &self.mapbox_key else {
            return Ok(None);
        };

        let url = format!(
            "{}/{},{}.json?access_token={}&language=fr&limit=3",
            self.mapbox_base_url, longitude, latitude, mapbox_key
        );
        let response = match self.client.get(&url).send().await {
            Ok(resp) if resp.status().is_success() => resp,
            Ok(resp) => {
                warn!(
                    "[Geocoding] Mapbox reverse geocode status: {}",
                    resp.status()
                );
                return Ok(None);
            }
            Err(err) => {
                warn!("[Geocoding] Mapbox reverse geocode error: {:?}", err);
                return Ok(None);
            }
        };

        let body: MapboxResponse = response.json().await.map_err(|err| {
            AppError::Internal(format!("Erreur parsing Mapbox reverse response: {:?}", err))
        })?;

        if let Some(feature) = body.features.first() {
            return Ok(Some(self.convert_mapbox_feature(feature, true)));
        }

        Ok(None)
    }

    async fn geocode_mapbox(
        &self,
        address: &str,
    ) -> Result<Option<Vec<GeocodingResult>>, AppError> {
        let Some(mapbox_key) = &self.mapbox_key else {
            return Ok(None);
        };

        let url = format!(
            "{}/{}.json?access_token={}&language=fr&limit=5",
            self.mapbox_base_url,
            urlencoding::encode(address),
            mapbox_key
        );

        let response = match self.client.get(&url).send().await {
            Ok(resp) if resp.status().is_success() => resp,
            Ok(resp) => {
                warn!("[Geocoding] Mapbox geocode status: {}", resp.status());
                return Ok(None);
            }
            Err(err) => {
                warn!("[Geocoding] Mapbox geocode error: {:?}", err);
                return Ok(None);
            }
        };

        let body: MapboxResponse = response.json().await.map_err(|err| {
            AppError::Internal(format!("Erreur parsing Mapbox geocode response: {:?}", err))
        })?;

        if body.features.is_empty() {
            return Ok(Some(Vec::new()));
        }

        let results = body
            .features
            .iter()
            .enumerate()
            .map(|(index, feature)| self.convert_mapbox_feature(feature, index == 0))
            .collect();

        Ok(Some(results))
    }

    fn build_offline_result(&self, latitude: f64, longitude: f64) -> GeocodingResult {
        GeocodingResult {
            address: None,
            city: None,
            country: None,
            formatted_address: None,
            latitude,
            longitude,
            place_id: None,
            postal_code: None,
            administrative_area_level_1: None,
            administrative_area_level_2: None,
            location_type: Some("offline_cache".to_string()),
            types: vec!["approximate".to_string()],
            partial_match: true,
            confidence: 0.2,
        }
    }

    pub fn get_service_info(&self) -> std::collections::HashMap<String, String> {
        let mut info = std::collections::HashMap::new();
        info.insert("service".to_string(), "Google Maps Geocoding".to_string());
        info.insert("version".to_string(), "1.0".to_string());
        info.insert(
            "timeout".to_string(),
            format!("{}s", self.timeout.as_secs()),
        );
        info.insert("max_retries".to_string(), self.max_retries.to_string());
        info.insert(
            "api_key_configured".to_string(),
            (!self.api_key.is_empty()).to_string(),
        );
        info.insert(
            "cache_ttl_seconds".to_string(),
            self.cache_ttl.as_secs().to_string(),
        );
        info
    }
}

impl Default for GeocodingService {
    fn default() -> Self {
        Self::new()
    }
}
