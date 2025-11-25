// 🗺️ Service Google Places API (Places API New) pour enrichissement avancé
use crate::core::types::AppError;
use crate::utils::currency::infer_country_code;
use log::{error, info, warn};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

const SEARCH_URL: &str = "https://places.googleapis.com/v1/places:searchText";
const PLACES_URL: &str = "https://places.googleapis.com/v1/places";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Coordinates {
    pub lat: f64,
    pub lng: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GooglePlacePhoto {
    pub name: String,
    pub width_px: Option<i32>,
    pub height_px: Option<i32>,
    pub attributions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GooglePlaceEnriched {
    pub place_id: String,
    pub display_name: String,
    pub formatted_address: Option<String>,
    pub location_vector: Vec<String>,
    pub coordinates: Option<Coordinates>,
    pub types: Vec<String>,
    pub primary_type: Option<String>,
    pub primary_type_display_name: Option<String>,
    pub rating: Option<f64>,
    pub rating_count: Option<i32>,
    pub price_level: Option<String>,
    pub business_status: Option<String>,
    pub serves_cuisine: Vec<String>,
    pub website_uri: Option<String>,
    pub google_maps_uri: Option<String>,
    pub international_phone_number: Option<String>,
    pub national_phone_number: Option<String>,
    pub editorial_summary: Option<String>,
    pub current_opening_hours: Option<Value>,
    pub regular_opening_hours: Option<Value>,
    pub photos: Vec<GooglePlacePhoto>,
    pub country: Option<String>,
    pub country_code: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TextValue {
    #[serde(default)]
    text: String,
    #[serde(default)]
    language_code: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LatLng {
    latitude: f64,
    longitude: f64,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AddressComponent {
    #[serde(default)]
    text: String,
    #[serde(default)]
    short_text: Option<String>,
    #[serde(default)]
    types: Vec<String>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchPlace {
    id: Option<String>,
    display_name: Option<TextValue>,
    formatted_address: Option<String>,
    location: Option<LatLng>,
    address_components: Option<Vec<AddressComponent>>,
    primary_type: Option<String>,
    types: Option<Vec<String>>,
    rating: Option<f64>,
    user_rating_count: Option<i32>,
    price_level: Option<String>,
    business_status: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PlacesSearchResponse {
    places: Option<Vec<SearchPlace>>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthorAttribution {
    display_name: Option<String>,
    uri: Option<String>,
    photo_uri: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlacePhoto {
    name: Option<String>,
    width_px: Option<i32>,
    height_px: Option<i32>,
    author_attribution: Option<Vec<AuthorAttribution>>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlaceDetails {
    id: Option<String>,
    display_name: Option<TextValue>,
    formatted_address: Option<String>,
    location: Option<LatLng>,
    types: Option<Vec<String>>,
    primary_type: Option<String>,
    primary_type_display_name: Option<TextValue>,
    google_maps_uri: Option<String>,
    website_uri: Option<String>,
    rating: Option<f64>,
    user_rating_count: Option<i32>,
    price_level: Option<String>,
    business_status: Option<String>,
    editorial_summary: Option<TextValue>,
    serves_cuisine: Option<Vec<String>>,
    international_phone_number: Option<String>,
    national_phone_number: Option<String>,
    current_opening_hours: Option<Value>,
    regular_opening_hours: Option<Value>,
    address_components: Option<Vec<AddressComponent>>,
    photos: Option<Vec<PlacePhoto>>,
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
            .timeout(Duration::from_secs(12))
            .user_agent("Yukpomnang-GooglePlaces/1.0")
            .build()
            .expect("Impossible de créer le client HTTP");

        Self { api_key, client }
    }

    /// Recherche Google Places et retourne plusieurs résultats pour comparaison
    pub async fn search_places(
        &self,
        query: &str,
        country_hint: Option<&str>,
        language_code: Option<&str>,
        coordinates: Option<(f64, f64)>,
    ) -> Result<Vec<SearchPlace>, AppError> {
        if query.trim().is_empty() {
            return Ok(Vec::new());
        }

        let mut body = serde_json::json!({
            "textQuery": query,
            "languageCode": language_code.unwrap_or("fr"),
        });

        if let Some(country) = country_hint {
            if let Some(code) = infer_country_code(country) {
                body["regionCode"] = serde_json::Value::String(code.to_string());
            }
        }

        if let Some((lat, lng)) = coordinates {
            body["locationBias"] = serde_json::json!({
                "circle": {
                    "center": {
                        "latitude": lat,
                        "longitude": lng
                    },
                    "radius": 8000.0
                }
            });
        }

        info!(
            "🗺️ [Places] Recherche avancée: '{}' (hint: {:?})",
            query, country_hint
        );

        let search_response = self
            .client
            .post(SEARCH_URL)
            .header("X-Goog-Api-Key", &self.api_key)
            .header(
                "X-Goog-FieldMask",
                "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.rating,places.userRatingCount,places.priceLevel,places.businessStatus,places.addressComponents",
            )
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur Google Places search: {}", e)))?;

        if !search_response.status().is_success() {
            let status = search_response.status();
            let text = search_response
                .text()
                .await
                .unwrap_or_else(|_| "<no body>".to_string());
            
            let error_type = if text.contains("BILLING_DISABLED") || text.contains("billing_disabled") {
                "BILLING_DISABLED"
            } else if text.contains("API_KEY_INVALID") || text.contains("api_key_invalid") {
                "API_KEY_INVALID"
            } else if text.contains("PERMISSION_DENIED") || text.contains("permission_denied") {
                "PERMISSION_DENIED"
            } else if status == 403 {
                "FORBIDDEN"
            } else if status == 429 {
                "RATE_LIMIT"
            } else {
                "UNKNOWN"
            };
            
            error!(
                "[Places] Recherche échouée (HTTP {}): {} - Type: {}",
                status.as_u16(),
                text,
                error_type
            );
            
            if error_type == "BILLING_DISABLED" || error_type == "API_KEY_INVALID" || error_type == "PERMISSION_DENIED" {
                return Err(AppError::Internal(format!(
                    "Google Places API indisponible ({}): {}. Veuillez activer la facturation ou vérifier la clé API.",
                    error_type,
                    text.chars().take(200).collect::<String>()
                )));
            }
            
            return Ok(Vec::new());
        }

        let search_payload: PlacesSearchResponse = search_response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur parsing Places search: {}", e)))?;

        Ok(search_payload.places.unwrap_or_default())
    }

    /// Enrichit un lieu Google Places avec ses détails complets
    async fn enrich_place_details(
        &self,
        place_id: &str,
        language_code: Option<&str>,
    ) -> Result<GooglePlaceEnriched, AppError> {
        let detail_url = format!(
            "{}/{}?languageCode={}",
            PLACES_URL,
            place_id,
            language_code.unwrap_or("fr")
        );
        let details_response = self
            .client
            .get(&detail_url)
            .header("X-Goog-Api-Key", &self.api_key)
            .header(
                "X-Goog-FieldMask",
                "id,displayName,formattedAddress,location,types,primaryType,primaryTypeDisplayName,googleMapsUri,websiteUri,rating,userRatingCount,priceLevel,businessStatus,editorialSummary,currentOpeningHours,regularOpeningHours,nationalPhoneNumber,internationalPhoneNumber,addressComponents,photos",
            )
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur Google Places details: {}", e)))?;

        if !details_response.status().is_success() {
            let status = details_response.status();
            let text = details_response
                .text()
                .await
                .unwrap_or_else(|_| "<no body>".to_string());
            
            let error_type = if text.contains("BILLING_DISABLED") || text.contains("billing_disabled") {
                "BILLING_DISABLED"
            } else if text.contains("API_KEY_INVALID") || text.contains("api_key_invalid") {
                "API_KEY_INVALID"
            } else if text.contains("PERMISSION_DENIED") || text.contains("permission_denied") {
                "PERMISSION_DENIED"
            } else if status == 403 {
                "FORBIDDEN"
            } else if status == 429 {
                "RATE_LIMIT"
            } else {
                "UNKNOWN"
            };
            
            error!(
                "[Places] Détails échoués (HTTP {}): {} - Type: {}",
                status.as_u16(),
                text,
                error_type
            );
            
            if error_type == "BILLING_DISABLED" || error_type == "API_KEY_INVALID" || error_type == "PERMISSION_DENIED" {
                return Err(AppError::Internal(format!(
                    "Google Places API indisponible ({}): {}. Veuillez activer la facturation ou vérifier la clé API.",
                    error_type,
                    text.chars().take(200).collect::<String>()
                )));
            }
            
            return Err(AppError::Internal(format!("Erreur récupération détails: {}", text)));
        }

        let details: PlaceDetails = details_response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur parsing Places details: {}", e)))?;

        let display_name = details
            .display_name
            .as_ref()
            .map(|v| v.text.clone())
            .unwrap_or_else(|| "".to_string());

        let location_vector = build_location_vector(details.address_components.as_ref());
        let country = location_vector.last().cloned().or_else(|| {
            details.address_components.as_ref().and_then(|components| {
                components
                    .iter()
                    .find(|component| component.types.iter().any(|t| t == "country"))
                    .map(|c| c.text.clone())
            })
        });

        let coordinates = details.location.map(|loc| Coordinates {
            lat: loc.latitude,
            lng: loc.longitude,
        });

        let photos = details
            .photos
            .unwrap_or_default()
            .into_iter()
            .filter_map(|photo| {
                let name = photo.name?;
                let attributions = photo
                    .author_attribution
                    .unwrap_or_default()
                    .into_iter()
                    .filter_map(|attr| attr.display_name)
                    .collect::<Vec<_>>();
                Some(GooglePlacePhoto {
                    name,
                    width_px: photo.width_px,
                    height_px: photo.height_px,
                    attributions,
                })
            })
            .collect::<Vec<_>>();

        let enriched = GooglePlaceEnriched {
            place_id: details.id.unwrap_or_default(),
            display_name,
            formatted_address: details.formatted_address,
            location_vector,
            coordinates,
            types: details.types.unwrap_or_default(),
            primary_type: details.primary_type,
            primary_type_display_name: details.primary_type_display_name.and_then(|t| Some(t.text)),
            rating: details.rating,
            rating_count: details.user_rating_count,
            price_level: details.price_level,
            business_status: details.business_status,
            serves_cuisine: details.serves_cuisine.unwrap_or_default(),
            website_uri: details.website_uri,
            google_maps_uri: details.google_maps_uri,
            international_phone_number: details.international_phone_number,
            national_phone_number: details.national_phone_number,
            editorial_summary: details.editorial_summary.map(|v| v.text),
            current_opening_hours: details.current_opening_hours,
            regular_opening_hours: details.regular_opening_hours,
            photos,
            country: country.clone(),
            country_code: country
                .as_deref()
                .and_then(|c| infer_country_code(c).map(|code| code.to_string())),
        };

        Ok(enriched)
    }

    /// Recherche et enrichit un lieu (ancienne méthode, gardée pour compatibilité)
    /// Utilise maintenant search_places et enrich_place_details
    pub async fn search_and_enrich(
        &self,
        query: &str,
        country_hint: Option<&str>,
        language_code: Option<&str>,
        coordinates: Option<(f64, f64)>,
    ) -> Result<Option<GooglePlaceEnriched>, AppError> {
        let places = self.search_places(query, country_hint, language_code, coordinates).await?;
        
        if places.is_empty() {
            return Ok(None);
        }

        // Prendre le premier résultat (comportement original)
        let first_place = places.into_iter().next().unwrap();
        let place_id = match first_place.id {
            Some(id) => id,
            None => {
                warn!("[Places] Résultat sans ID pour '{}'", query);
                return Ok(None);
            }
        };

        let enriched = self.enrich_place_details(&place_id, language_code).await?;
        Ok(Some(enriched))
    }

    /// Recherche plusieurs lieux et retourne le meilleur match selon critères
    pub async fn search_and_select_best_match(
        &self,
        query: &str,
        country_hint: Option<&str>,
        language_code: Option<&str>,
        coordinates: Option<(f64, f64)>,
        prestataire_name: Option<&str>,
        max_distance_km: f64,
    ) -> Result<Option<GooglePlaceEnriched>, AppError> {
        let places = self.search_places(query, country_hint, language_code, coordinates).await?;
        
        if places.is_empty() {
            info!("[Places] Aucun résultat pour '{}'", query);
            return Ok(None);
        }

        // Limiter à 5 résultats pour éviter trop d'appels API
        let places_to_check = places.into_iter().take(5).collect::<Vec<_>>();
        
        let mut best_match: Option<(GooglePlaceEnriched, f64)> = None; // (enriched, score)
        
        for place in places_to_check {
            let place_id = match place.id {
                Some(id) => id,
                None => continue,
            };

            // Enrichir avec les détails complets
            let enriched = match self.enrich_place_details(&place_id, language_code).await {
                Ok(e) => e,
                Err(e) => {
                    warn!("[Places] Erreur enrichissement place_id {}: {}", place_id, e);
                    continue;
                }
            };

            // Calculer le score de matching
            let mut score = 0.0;

            // 1. Validation de la distance (critère obligatoire si coordonnées fournies)
            if let Some((lat, lng)) = coordinates {
                if let Some(place_coords) = enriched.coordinates.as_ref() {
                    let distance_km = calculate_distance_haversine(
                        lat, lng,
                        place_coords.lat, place_coords.lng
                    );
                    
                    if distance_km > max_distance_km {
                        warn!(
                            "[Places] Lieu {} trop éloigné: {} km (max: {} km)",
                            place_id, distance_km, max_distance_km
                        );
                        continue; // Ignorer ce lieu
                    }
                    
                    // Score inversement proportionnel à la distance (plus proche = meilleur)
                    score += (max_distance_km - distance_km) / max_distance_km * 50.0;
                } else {
                    // Pas de coordonnées pour le lieu → pénalité
                    score -= 20.0;
                }
            }

            // 2. Matching du nom du prestataire (critère important)
            if let Some(prestataire) = prestataire_name {
                let display_name_lower = enriched.display_name.to_lowercase();
                let prestataire_lower = prestataire.to_lowercase();
                
                if display_name_lower.contains(&prestataire_lower) {
                    score += 40.0; // Correspondance exacte du nom
                } else {
                    // Vérifier correspondance partielle (mots individuels)
                    let prestataire_words: Vec<&str> = prestataire_lower.split_whitespace().collect();
                    let matching_words = prestataire_words.iter()
                        .filter(|word| display_name_lower.contains(*word))
                        .count();
                    
                    if matching_words > 0 {
                        score += (matching_words as f64 / prestataire_words.len() as f64) * 30.0;
                    }
                }
            }

            // 3. Rating (bonus)
            if let Some(rating) = enriched.rating {
                score += rating * 5.0; // Bonus jusqu'à 25 points (rating max 5.0)
            }

            // 4. Nombre d'avis (crédibilité)
            if let Some(rating_count) = enriched.rating_count {
                if rating_count > 10 {
                    score += 10.0; // Bonus pour lieux avec beaucoup d'avis
                }
            }

            // Garder le meilleur match
            if best_match.is_none() || score > best_match.as_ref().unwrap().1 {
                best_match = Some((enriched, score));
            }
        }

        if let Some((enriched, score)) = best_match {
            info!(
                "[Places] Meilleur match sélectionné pour '{}': {} (score: {:.2})",
                query, enriched.display_name, score
            );
            Ok(Some(enriched))
        } else {
            warn!("[Places] Aucun match valide trouvé pour '{}'", query);
            Ok(None)
        }
    }
}

/// Calcule la distance entre deux points GPS en km (formule de Haversine)
fn calculate_distance_haversine(lat1: f64, lng1: f64, lat2: f64, lng2: f64) -> f64 {
    let r = 6371.0; // Rayon de la Terre en km

    let dlat = (lat2 - lat1).to_radians();
    let dlng = (lng2 - lng1).to_radians();

    let a = (dlat / 2.0).sin().powi(2)
        + lat1.to_radians().cos() * lat2.to_radians().cos() * (dlng / 2.0).sin().powi(2);

    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());

    r * c
}

fn build_location_vector(components: Option<&Vec<AddressComponent>>) -> Vec<String> {
    let mut vector = Vec::new();
    if let Some(components) = components {
        let priority_types = [
            "sublocality_level_1",
            "sublocality",
            "neighborhood",
            "locality",
            "administrative_area_level_2",
            "administrative_area_level_1",
            "country",
        ];

        for type_name in &priority_types {
            if let Some(component) = components
                .iter()
                .find(|comp| comp.types.iter().any(|t| t.eq_ignore_ascii_case(type_name)))
            {
                let label = component.text.trim();
                if !label.is_empty()
                    && !vector
                        .iter()
                        .any(|existing: &String| existing.eq_ignore_ascii_case(label))
                {
                    vector.push(label.to_string());
                }
            }
        }
    }
    vector
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_search_makepe() {
        let service = GooglePlacesService::new();
        let result = service
            .search_and_enrich("Makepe", Some("Cameroun"), None, None)
            .await;

        if let Ok(Some(data)) = result {
            println!("Place: {}", data.display_name);
            println!("Vector: {:?}", data.location_vector);
            if let Some(coords) = data.coordinates.as_ref() {
                println!("Coords: {}, {}", coords.lat, coords.lng);
            }
            assert!(!data.location_vector.is_empty());
        }
    }
}
