// ✅ NOUVEAU: Routes pour navigation intelligente avec embouteillages et points d'intérêt

use axum::{
    extract::{Extension, Path, Query, State},
    middleware,
    response::Json,
    routing::{delete, get, post, put},
    Router,
};
use chrono::{self, Datelike};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::{jwt_auth, AuthenticatedUser};
use crate::state::AppState;

#[derive(Deserialize)]
struct GeocodeRequest {
    address: String,
}

#[derive(Serialize)]
struct GeocodeResponse {
    location: LocationCoords,
    formatted_address: String,
}

#[derive(Deserialize)]
struct PlaceDetailsRequest {
    place_id: String,
}

#[derive(Serialize)]
struct PlaceDetailsResponse {
    location: LocationCoords,
    formatted_address: String,
    name: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
struct LocationCoords {
    lat: f64,
    lng: f64,
}

#[derive(Deserialize)]
struct RoutesRequest {
    origin: LocationCoords,
    destination: LocationCoords,
    alternatives: Option<bool>,
    avoid: Option<Vec<String>>,
    traffic_model: Option<String>,
    waypoints: Option<Vec<LocationCoords>>,
    mode: Option<String>,           // driving, walking, bicycling, transit
    departure_time: Option<String>, // ISO timestamp or "now"
}

#[derive(Serialize)]
struct RouteOption {
    id: String,
    distance_meters: f64,
    duration_seconds: f64,
    duration_in_traffic_seconds: Option<f64>,
    summary: String,
    overview_polyline: String,
    steps: Vec<RouteStep>,
    traffic_level: String,
    arrival_time: Option<String>,
    departure_time: Option<String>,
    start_address: Option<String>,
    end_address: Option<String>,
    warnings: Vec<String>,
    fare: Option<RouteFare>,
    mode: String,
}

#[derive(Serialize)]
struct RouteFare {
    currency: String,
    value: f64,
    text: String,
}

#[derive(Serialize, Deserialize)]
struct RouteStep {
    instructions: String,
    distance_meters: f64,
    duration_seconds: f64,
    location: LocationCoords,
}

#[derive(Serialize)]
struct RoutesResponse {
    routes: Vec<RouteOption>,
}

#[derive(Deserialize)]
struct PointsOfInterestRequest {
    #[allow(dead_code)]
    route_id: String,
    origin_lat: f64,
    origin_lng: f64,
    dest_lat: f64,
    dest_lng: f64,
    /// JSON-encoded array of {lat,lng} objects representing the route steps
    route_steps: Option<String>,
}

#[derive(Serialize)]
struct PointOfInterest {
    id: String,
    name: String,
    #[serde(rename = "type")]
    poi_type: String,
    location: LocationCoords,
    distance_from_route_meters: f64,
    rating: Option<f64>,
    is_open: Option<bool>,
    address: Option<String>,
    phone: Option<String>,
    price_level: Option<i64>,
    total_ratings: Option<i64>,
}

#[derive(Serialize)]
struct PointsOfInterestResponse {
    pois: Vec<PointOfInterest>,
}

#[derive(Deserialize)]
struct TripRequest {
    origin: LocationCoords,
    destination: LocationCoords,
    route_id: String,
    distance_meters: f64,
    duration_seconds: f64,
    waypoints: Option<Vec<LocationCoords>>,
}

#[derive(Serialize)]
struct NavigationStats {
    total_trips: i64,
    total_distance_km: f64,
    total_duration_minutes: f64,
    most_visited_places: Vec<MostVisitedPlace>,
    favorite_poi_types: Vec<FavoritePOIType>,
}

#[derive(Serialize)]
struct MostVisitedPlace {
    name: String,
    visit_count: i64,
}

#[derive(Serialize)]
struct FavoritePOIType {
    #[serde(rename = "type")]
    poi_type: String,
    count: i64,
}

/// Géocoder une adresse en coordonnées GPS
async fn geocode_address(
    Query(params): Query<GeocodeRequest>,
    State(_state): State<Arc<AppState>>,
) -> AppResult<Json<GeocodeResponse>> {
    let api_key = std::env::var("GOOGLE_MAPS_API_KEY")
        .map_err(|_| AppError::Internal("GOOGLE_MAPS_API_KEY non configurée".to_string()))?;

    let url = format!(
        "https://maps.googleapis.com/maps/api/geocode/json?address={}&key={}&language=fr",
        urlencoding::encode(&params.address),
        api_key
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur requête Google Geocoding: {}", e)))?;

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur parsing Google Geocoding: {}", e)))?;

    if let Some(status) = data.get("status").and_then(|s| s.as_str()) {
        if status != "OK" {
            return Err(AppError::Internal(format!(
                "Google Geocoding API error: {}",
                status
            )));
        }

        if let Some(results) = data.get("results").and_then(|r| r.as_array()) {
            if let Some(first_result) = results.first() {
                if let Some(geometry) = first_result.get("geometry") {
                    if let Some(location) = geometry.get("location") {
                        let lat = location
                            .get("lat")
                            .and_then(|l| l.as_f64())
                            .ok_or_else(|| AppError::Internal("Latitude invalide".to_string()))?;
                        let lng = location
                            .get("lng")
                            .and_then(|l| l.as_f64())
                            .ok_or_else(|| AppError::Internal("Longitude invalide".to_string()))?;

                        let formatted_address = first_result
                            .get("formatted_address")
                            .and_then(|a| a.as_str())
                            .unwrap_or(&params.address)
                            .to_string();

                        return Ok(Json(GeocodeResponse {
                            location: LocationCoords { lat, lng },
                            formatted_address,
                        }));
                    }
                }
            }
        }
    }

    Err(AppError::Internal(
        "Aucun résultat de géocodage".to_string(),
    ))
}

/// Obtenir les coordonnées depuis un place_id Google Places
async fn get_place_details(
    Query(params): Query<PlaceDetailsRequest>,
    State(_state): State<Arc<AppState>>,
) -> AppResult<Json<PlaceDetailsResponse>> {
    let api_key = std::env::var("GOOGLE_MAPS_API_KEY")
        .map_err(|_| AppError::Internal("GOOGLE_MAPS_API_KEY non configurée".to_string()))?;

    let url = format!(
        "https://maps.googleapis.com/maps/api/place/details/json?place_id={}&fields=geometry,formatted_address,name&key={}&language=fr",
        urlencoding::encode(&params.place_id),
        api_key
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur requête Google Places Details: {}", e)))?;

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur parsing Google Places Details: {}", e)))?;

    if let Some(status) = data.get("status").and_then(|s| s.as_str()) {
        if status != "OK" {
            return Err(AppError::Internal(format!(
                "Google Places Details API error: {}",
                status
            )));
        }

        if let Some(result) = data.get("result") {
            if let Some(geometry) = result.get("geometry") {
                if let Some(location) = geometry.get("location") {
                    let lat = location
                        .get("lat")
                        .and_then(|l| l.as_f64())
                        .ok_or_else(|| AppError::Internal("Latitude invalide".to_string()))?;
                    let lng = location
                        .get("lng")
                        .and_then(|l| l.as_f64())
                        .ok_or_else(|| AppError::Internal("Longitude invalide".to_string()))?;

                    let formatted_address = result
                        .get("formatted_address")
                        .and_then(|a| a.as_str())
                        .unwrap_or("")
                        .to_string();

                    let name = result.get("name").and_then(|n| n.as_str()).map(|s| s.to_string());

                    return Ok(Json(PlaceDetailsResponse {
                        location: LocationCoords { lat, lng },
                        formatted_address,
                        name,
                    }));
                }
            }
        }
    }

    Err(AppError::Internal(
        "Aucun résultat pour ce place_id".to_string(),
    ))
}

/// Obtenir plusieurs routes avec embouteillages
async fn get_routes(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<RoutesRequest>,
) -> AppResult<Json<RoutesResponse>> {
    let api_key = std::env::var("GOOGLE_MAPS_API_KEY")
        .map_err(|_| AppError::Internal("GOOGLE_MAPS_API_KEY non configurée".to_string()))?;

    let alternatives = request.alternatives.unwrap_or(true);
    let travel_mode = request.mode.as_deref().unwrap_or("driving");
    let traffic_model = request.traffic_model.as_deref().unwrap_or("best_guess");

    let mut url = format!(
        "https://maps.googleapis.com/maps/api/directions/json?origin={},{}&destination={},{}&key={}&language=fr&units=metric&alternatives={}&mode={}",
        request.origin.lat,
        request.origin.lng,
        request.destination.lat,
        request.destination.lng,
        api_key,
        alternatives,
        travel_mode
    );

    // Ajouter traffic_model et departure_time pour le mode driving
    if travel_mode == "driving" {
        url.push_str(&format!("&traffic_model={}", traffic_model));
        if let Some(ref dep_time) = request.departure_time {
            url.push_str(&format!("&departure_time={}", dep_time));
        } else {
            url.push_str("&departure_time=now");
        }
    } else if travel_mode == "transit" {
        // Transit: departure_time requis pour les horaires
        if let Some(ref dep_time) = request.departure_time {
            url.push_str(&format!("&departure_time={}", dep_time));
        } else {
            url.push_str("&departure_time=now");
        }
    }

    // Ajouter les waypoints si spécifiés
    if let Some(ref waypoints) = request.waypoints {
        if !waypoints.is_empty() {
            let wp_str: Vec<String> =
                waypoints.iter().map(|wp| format!("{},{}", wp.lat, wp.lng)).collect();
            url.push_str(&format!("&waypoints={}", wp_str.join("|")));
        }
    }

    // Ajouter les évitements si spécifiés
    if let Some(avoid) = &request.avoid {
        if !avoid.is_empty() {
            url.push_str(&format!("&avoid={}", avoid.join("|")));
        }
    }

    println!("[navigation] Google Directions API request: URL={}", url);

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur requête Google Directions: {}", e)))?;

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur parsing Google Directions: {}", e)))?;

    let api_status = data.get("status").and_then(|s| s.as_str()).unwrap_or("UNKNOWN");
    let error_message = data.get("error_message").and_then(|s| s.as_str());
    let routes_count = data.get("routes").and_then(|r| r.as_array()).map(|a| a.len()).unwrap_or(0);

    println!(
        "[navigation] Google Directions API response: status={}, mode={}, routes_count={}, error={:?}, origin={},{}, dest={},{}",
        api_status, travel_mode, routes_count,
        error_message,
        request.origin.lat, request.origin.lng,
        request.destination.lat, request.destination.lng
    );

    if let Some(status) = data.get("status").and_then(|s| s.as_str()) {
        if status != "OK" {
            let detail = error_message.unwrap_or("Pas de détail");

            // Cas spécial : ZERO_RESULTS - vérifier les modes disponibles
            if status == "ZERO_RESULTS" {
                // Vérifier si Google a retourné des modes alternatifs
                if let Some(available_modes) =
                    data.get("available_travel_modes").and_then(|m| m.as_array())
                {
                    let modes_str: Vec<String> = available_modes
                        .iter()
                        .filter_map(|m| m.as_str())
                        .map(|s| match s {
                            "DRIVING" => "voiture".to_string(),
                            "WALKING" => "à pied".to_string(),
                            "BICYCLING" => "vélo".to_string(),
                            "TRANSIT" => "transport en commun".to_string(),
                            _ => s.to_lowercase(),
                        })
                        .collect();

                    if !modes_str.is_empty() {
                        return Err(AppError::BadRequest(format!(
                            "Mode {} non disponible pour cette région. Modes disponibles: {}",
                            match travel_mode {
                                "bicycling" => "vélo",
                                "transit" => "transport en commun",
                                "walking" => "marche",
                                _ => travel_mode,
                            },
                            modes_str.join(", ")
                        )));
                    }
                }

                return Err(AppError::BadRequest(format!(
                    "Aucun itinéraire trouvé pour le mode {} - {}",
                    match travel_mode {
                        "bicycling" => "vélo",
                        "transit" => "transport en commun",
                        "walking" => "marche",
                        _ => travel_mode,
                    },
                    detail
                )));
            }

            // REQUEST_DENIED / INVALID_REQUEST → erreur utilisateur (400), pas serveur (500)
            if status == "REQUEST_DENIED"
                || status == "INVALID_REQUEST"
                || status == "NOT_FOUND"
                || status == "MAX_WAYPOINTS_EXCEEDED"
                || status == "MAX_ROUTE_LENGTH_EXCEEDED"
            {
                return Err(AppError::BadRequest(format!(
                    "Google Directions: {} - {}",
                    status, detail
                )));
            }
            return Err(AppError::Internal(format!(
                "Google Directions: {} - {}",
                status, detail
            )));
        }

        let mut routes = Vec::new();

        if let Some(routes_data) = data.get("routes").and_then(|r| r.as_array()) {
            for (idx, route_data) in routes_data.iter().enumerate() {
                let route_id = format!("route_{}", idx);

                let summary =
                    route_data.get("summary").and_then(|s| s.as_str()).unwrap_or("").to_string();

                let overview_polyline = route_data
                    .get("overview_polyline")
                    .and_then(|p| p.get("points"))
                    .and_then(|p| p.as_str())
                    .unwrap_or("")
                    .to_string();

                // Warnings (ex: "Ce trajet comporte des péages")
                let warnings: Vec<String> = route_data
                    .get("warnings")
                    .and_then(|w| w.as_array())
                    .map(|arr| {
                        arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect()
                    })
                    .unwrap_or_default();

                // Fare (transit seulement)
                let fare = route_data.get("fare").and_then(|f| {
                    Some(RouteFare {
                        currency: f.get("currency")?.as_str()?.to_string(),
                        value: f.get("value")?.as_f64()?,
                        text: f.get("text")?.as_str()?.to_string(),
                    })
                });

                let mut total_distance = 0.0;
                let mut total_duration = 0.0;
                let mut total_duration_in_traffic = None;
                let mut steps = Vec::new();
                let mut start_address: Option<String> = None;
                let mut end_address: Option<String> = None;
                let mut arrival_time: Option<String> = None;
                let mut departure_time_str: Option<String> = None;

                if let Some(legs) = route_data.get("legs").and_then(|l| l.as_array()) {
                    // Adresses de départ et d'arrivée
                    if let Some(first_leg) = legs.first() {
                        start_address = first_leg
                            .get("start_address")
                            .and_then(|a| a.as_str())
                            .map(|s| s.to_string());
                        departure_time_str = first_leg
                            .get("departure_time")
                            .and_then(|dt| dt.get("text"))
                            .and_then(|t| t.as_str())
                            .map(|s| s.to_string());
                    }
                    if let Some(last_leg) = legs.last() {
                        end_address = last_leg
                            .get("end_address")
                            .and_then(|a| a.as_str())
                            .map(|s| s.to_string());
                        arrival_time = last_leg
                            .get("arrival_time")
                            .and_then(|at| at.get("text"))
                            .and_then(|t| t.as_str())
                            .map(|s| s.to_string());
                    }

                    for leg in legs {
                        if let Some(distance) = leg
                            .get("distance")
                            .and_then(|d| d.get("value"))
                            .and_then(|v| v.as_f64())
                        {
                            total_distance += distance;
                        }

                        if let Some(duration) = leg
                            .get("duration")
                            .and_then(|d| d.get("value"))
                            .and_then(|v| v.as_f64())
                        {
                            total_duration += duration;
                        }

                        if let Some(dit) = leg
                            .get("duration_in_traffic")
                            .and_then(|d| d.get("value"))
                            .and_then(|v| v.as_f64())
                        {
                            total_duration_in_traffic =
                                Some(total_duration_in_traffic.unwrap_or(0.0) + dit);
                        }

                        if let Some(leg_steps) = leg.get("steps").and_then(|s| s.as_array()) {
                            for step in leg_steps {
                                let html_instructions = step
                                    .get("html_instructions")
                                    .and_then(|i| i.as_str())
                                    .unwrap_or("")
                                    .to_string();

                                let clean_instructions = html_instructions
                                    .replace("<b>", "")
                                    .replace("</b>", "")
                                    .replace("<div style=\"font-size:0.9em\">", " · ")
                                    .replace("</div>", "")
                                    .replace("<wbr/>", "")
                                    .trim()
                                    .to_string();

                                let step_distance = step
                                    .get("distance")
                                    .and_then(|d| d.get("value"))
                                    .and_then(|v| v.as_f64())
                                    .unwrap_or(0.0);

                                let step_duration = step
                                    .get("duration")
                                    .and_then(|d| d.get("value"))
                                    .and_then(|v| v.as_f64())
                                    .unwrap_or(0.0);

                                let step_start_location = step.get("start_location");
                                let location = if let Some(loc) = step_start_location {
                                    LocationCoords {
                                        lat: loc.get("lat").and_then(|l| l.as_f64()).unwrap_or(0.0),
                                        lng: loc.get("lng").and_then(|l| l.as_f64()).unwrap_or(0.0),
                                    }
                                } else {
                                    LocationCoords {
                                        lat: request.origin.lat,
                                        lng: request.origin.lng,
                                    }
                                };

                                steps.push(RouteStep {
                                    instructions: clean_instructions,
                                    distance_meters: step_distance,
                                    duration_seconds: step_duration,
                                    location,
                                });
                            }
                        }
                    }
                }

                // Calculer ETA si pas fournie par Google (mode driving)
                if arrival_time.is_none() {
                    let effective_duration = total_duration_in_traffic.unwrap_or(total_duration);
                    let eta_seconds = effective_duration as i64;
                    let now = chrono::Utc::now() + chrono::Duration::seconds(eta_seconds);
                    arrival_time = Some(now.format("%H:%M").to_string());
                }

                // Déterminer le niveau de trafic
                let traffic_level = if let Some(duration_traffic) = total_duration_in_traffic {
                    let traffic_delay = duration_traffic - total_duration;
                    if total_duration > 0.0 {
                        let traffic_percentage = (traffic_delay / total_duration) * 100.0;
                        if traffic_percentage > 30.0 {
                            "high"
                        } else if traffic_percentage > 10.0 {
                            "medium"
                        } else {
                            "low"
                        }
                    } else {
                        "low"
                    }
                } else {
                    "low"
                };

                routes.push(RouteOption {
                    id: route_id,
                    distance_meters: total_distance,
                    duration_seconds: total_duration,
                    duration_in_traffic_seconds: total_duration_in_traffic,
                    summary,
                    overview_polyline,
                    steps,
                    traffic_level: traffic_level.to_string(),
                    arrival_time,
                    departure_time: departure_time_str,
                    start_address,
                    end_address,
                    warnings,
                    fare,
                    mode: travel_mode.to_string(),
                });
            }
        }

        // Trier par durée avec trafic
        routes.sort_by(|a, b| {
            let a_duration = a.duration_in_traffic_seconds.unwrap_or(a.duration_seconds);
            let b_duration = b.duration_in_traffic_seconds.unwrap_or(b.duration_seconds);
            a_duration.partial_cmp(&b_duration).unwrap_or(std::cmp::Ordering::Equal)
        });

        Ok(Json(RoutesResponse { routes }))
    } else {
        Err(AppError::Internal(
            "Réponse Google Directions invalide".to_string(),
        ))
    }
}

/// Obtenir les points d'intérêt le long d'une route
async fn get_points_of_interest(
    Query(params): Query<PointsOfInterestRequest>,
    State(_state): State<Arc<AppState>>,
) -> AppResult<Json<PointsOfInterestResponse>> {
    let api_key = std::env::var("GOOGLE_MAPS_API_KEY")
        .map_err(|_| AppError::Internal("GOOGLE_MAPS_API_KEY non configurée".to_string()))?;

    // Types de POI à rechercher — élargi pour couvrir les besoins réels des utilisateurs
    let poi_types = vec![
        "pharmacy",
        "bakery",
        "gas_station",
        "supermarket",
        "restaurant",
        "atm",
        "hospital",
        "parking",
        "car_wash",
        "car_repair",
        "mosque",
        "church",
        "lodging", // Hôtel
        "police",
    ];

    let mut all_pois = Vec::new();

    // ✅ FIX 2026-03-03: Fonction Haversine pour calcul de distance précis (en mètres)
    let haversine_distance = |lat1: f64, lng1: f64, lat2: f64, lng2: f64| -> f64 {
        let r = 6_371_000.0; // Rayon de la Terre en mètres
        let d_lat = (lat2 - lat1).to_radians();
        let d_lng = (lng2 - lng1).to_radians();
        let a = (d_lat / 2.0).sin().powi(2)
            + lat1.to_radians().cos() * lat2.to_radians().cos() * (d_lng / 2.0).sin().powi(2);
        let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());
        r * c
    };

    // ✅ FIX 2026-03-03: Distance totale du trajet pour adapter le rayon
    let route_distance = haversine_distance(
        params.origin_lat,
        params.origin_lng,
        params.dest_lat,
        params.dest_lng,
    );

    // ✅ FIX 2026-03-04: Utiliser les VRAIS points du trajet (steps) au lieu d'une interpolation linéaire
    // Cela évite que les POI soient trouvés "derrière" ou "à l'opposé" du trajet réel
    let route_step_points: Vec<(f64, f64)> = if let Some(ref steps_json) = params.route_steps {
        // Parser les steps envoyés par le mobile
        if let Ok(steps) = serde_json::from_str::<Vec<LocationCoords>>(steps_json) {
            steps.iter().map(|s| (s.lat, s.lng)).collect()
        } else {
            vec![]
        }
    } else {
        vec![]
    };

    // Points de recherche: soit les vrais steps du trajet, soit fallback linéaire
    let search_points: Vec<(f64, f64)> = if route_step_points.len() >= 3 {
        // Échantillonner ~5 points répartis le long des vrais steps
        let step_count = route_step_points.len();
        let mut sampled = Vec::new();
        let sample_indices = if step_count <= 5 {
            (0..step_count).collect::<Vec<_>>()
        } else {
            vec![
                step_count / 5,
                2 * step_count / 5,
                3 * step_count / 5,
                4 * step_count / 5,
            ]
        };
        for idx in sample_indices {
            sampled.push(route_step_points[idx]);
        }
        sampled
    } else {
        // Fallback: interpolation linéaire (ancien comportement)
        vec![
            (
                params.origin_lat + (params.dest_lat - params.origin_lat) * 0.25,
                params.origin_lng + (params.dest_lng - params.origin_lng) * 0.25,
            ),
            (
                (params.origin_lat + params.dest_lat) / 2.0,
                (params.origin_lng + params.dest_lng) / 2.0,
            ),
            (
                params.origin_lat + (params.dest_lat - params.origin_lat) * 0.75,
                params.origin_lng + (params.dest_lng - params.origin_lng) * 0.75,
            ),
        ]
    };

    // ✅ FIX 2026-03-04: Rayon adaptatif — plus petit quand on a les vrais steps (meilleure précision)
    let has_real_steps = route_step_points.len() >= 3;
    let radius_per_point = if has_real_steps {
        // Avec les vrais points du trajet, un rayon plus petit suffit (500m–1500m)
        ((route_distance * 0.10).max(500.0).min(1500.0)) as u32
    } else {
        // Sans steps, rayon plus large pour compenser l'imprécision
        ((route_distance * 0.20).max(500.0).min(3000.0)) as u32
    };

    // ✅ FIX 2026-03-04: Garder les step points pour calculer la distance DEPUIS LE TRAJET (pas l'origine)
    let route_path_for_distance: Vec<(f64, f64)> = if route_step_points.len() >= 2 {
        route_step_points.clone()
    } else {
        // Fallback: créer un chemin simple origin → dest
        vec![
            (params.origin_lat, params.origin_lng),
            (params.dest_lat, params.dest_lng),
        ]
    };

    let client = reqwest::Client::new();
    let mut seen_place_ids = std::collections::HashSet::new();

    for (search_lat, search_lng) in &search_points {
        for poi_type in &poi_types {
            let url = format!(
                "https://maps.googleapis.com/maps/api/place/nearbysearch/json?location={},{}&radius={}&type={}&key={}&language=fr",
                search_lat, search_lng, radius_per_point, poi_type, api_key
            );

            if let Ok(response) =
                client.get(&url).timeout(std::time::Duration::from_secs(10)).send().await
            {
                if let Ok(data) = response.json::<serde_json::Value>().await {
                    if let Some(results) = data.get("results").and_then(|r| r.as_array()) {
                        for result in results {
                            // ✅ Dédoublonner par place_id
                            let place_id = result
                                .get("place_id")
                                .and_then(|p| p.as_str())
                                .unwrap_or("")
                                .to_string();
                            if place_id.is_empty() || !seen_place_ids.insert(place_id) {
                                continue;
                            }

                            if let Some(geometry) = result.get("geometry") {
                                if let Some(location) = geometry.get("location") {
                                    let lat =
                                        location.get("lat").and_then(|l| l.as_f64()).unwrap_or(0.0);
                                    let lng =
                                        location.get("lng").and_then(|l| l.as_f64()).unwrap_or(0.0);

                                    // ✅ FIX 2026-03-04: Distance depuis le TRAJET (point le plus proche)
                                    // = combien l'utilisateur devra dévier pour atteindre ce POI
                                    let distance_from_route = route_path_for_distance
                                        .iter()
                                        .map(|(slat, slng)| {
                                            haversine_distance(*slat, *slng, lat, lng)
                                        })
                                        .fold(f64::MAX, f64::min);

                                    // ✅ FIX 2026-03-04: Filtrer les POI trop éloignés du trajet réel
                                    // Max 1500m de détour (sauf si le trajet est très court)
                                    let max_detour = if route_distance < 3000.0 {
                                        800.0
                                    } else {
                                        1500.0
                                    };
                                    if distance_from_route > max_detour {
                                        continue;
                                    }

                                    let name = result
                                        .get("name")
                                        .and_then(|n| n.as_str())
                                        .unwrap_or("")
                                        .to_string();

                                    let rating = result.get("rating").and_then(|r| r.as_f64());
                                    let total_ratings =
                                        result.get("user_ratings_total").and_then(|r| r.as_i64());
                                    let price_level =
                                        result.get("price_level").and_then(|p| p.as_i64());

                                    let opening_hours = result.get("opening_hours");
                                    let is_open = opening_hours
                                        .and_then(|oh| oh.get("open_now"))
                                        .and_then(|on| on.as_bool());

                                    let address = result
                                        .get("vicinity")
                                        .and_then(|v| v.as_str())
                                        .map(|s| s.to_string());

                                    // Mapper le type Google vers notre type
                                    let mapped_type = match *poi_type {
                                        "pharmacy" => "pharmacy",
                                        "bakery" => "bakery",
                                        "gas_station" => "gas_station",
                                        "supermarket" => "supermarket",
                                        "restaurant" => "restaurant",
                                        "atm" => "atm",
                                        "hospital" => "hospital",
                                        "parking" => "parking",
                                        "car_wash" => "car_wash",
                                        "car_repair" => "car_repair",
                                        "mosque" => "mosque",
                                        "church" => "church",
                                        "lodging" => "hotel",
                                        "police" => "police",
                                        _ => poi_type,
                                    };

                                    all_pois.push(PointOfInterest {
                                        id: format!("poi_{}", Uuid::new_v4()),
                                        name,
                                        poi_type: mapped_type.to_string(),
                                        location: LocationCoords { lat, lng },
                                        distance_from_route_meters: distance_from_route,
                                        rating,
                                        is_open,
                                        address,
                                        phone: None, // NearbySearch ne retourne pas le téléphone
                                        price_level,
                                        total_ratings,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // ✅ FIX 2026-03-04: Trier par distance de détour (les plus proches du trajet en premier)
    all_pois.sort_by(|a, b| {
        a.distance_from_route_meters
            .partial_cmp(&b.distance_from_route_meters)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    // Limiter à 40 POI les plus proches (élargi pour couvrir plus de catégories)
    all_pois.truncate(40);

    // ✅ DEBUG: Log POI names to verify structure
    log::info!("[POI] Returning {} POIs", all_pois.len());
    for (idx, poi) in all_pois.iter().enumerate().take(5) {
        log::info!(
            "[POI] #{}: name='{}', type={}, distance={:.0}m",
            idx + 1,
            poi.name,
            poi.poi_type,
            poi.distance_from_route_meters
        );
    }

    Ok(Json(PointsOfInterestResponse { pois: all_pois }))
}

/// Enregistrer un trajet pour les statistiques
async fn save_trip(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(request): Json<TripRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let user_id = user.id;

    sqlx::query(
        r#"
        INSERT INTO navigation_trips (
            user_id, origin_lat, origin_lng, destination_lat, destination_lng,
            route_id, distance_meters, duration_seconds, waypoints, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        "#,
    )
    .bind(user_id as i32)
    .bind(request.origin.lat)
    .bind(request.origin.lng)
    .bind(request.destination.lat)
    .bind(request.destination.lng)
    .bind(&request.route_id)
    .bind(request.distance_meters)
    .bind(request.duration_seconds as i64)
    .bind(serde_json::to_value(request.waypoints).ok())
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur sauvegarde trajet: {}", e)))?;

    Ok(Json(serde_json::json!({ "success": true })))
}

/// Obtenir les statistiques de navigation
async fn get_stats(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<NavigationStats>> {
    let user_id = user.id;

    // Statistiques globales
    let stats = sqlx::query_as::<_, (i64, i64, i64)>(
        r#"
        SELECT 
            COUNT(*)::bigint as total_trips,
            COALESCE(SUM(distance_meters), 0)::bigint as total_distance,
            COALESCE(SUM(duration_seconds), 0)::bigint as total_duration
        FROM navigation_trips
        WHERE user_id = $1
        "#,
    )
    .bind(user_id as i32)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération stats: {}", e)))?;

    // Lieux les plus visités (utilise activity_log pour avoir les vraies adresses)
    let most_visited = sqlx::query_as::<_, (Option<String>, i64)>(
        r#"
        SELECT 
            COALESCE(destination_address, destination_lat || ',' || destination_lng) as place_name,
            COUNT(*)::bigint as visit_count
        FROM navigation_activity_log
        WHERE user_id = $1 AND destination_address IS NOT NULL
        GROUP BY destination_address, destination_lat, destination_lng
        ORDER BY visit_count DESC
        LIMIT 5
        "#,
    )
    .bind(user_id as i32)
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    let most_visited_places = if most_visited.is_empty() {
        // Fallback sur navigation_trips si pas encore d'activités loguées
        let trips_visited = sqlx::query_as::<_, (Option<String>, i64)>(
            r#"
            SELECT 
                destination_lat || ',' || destination_lng as place_key,
                COUNT(*)::bigint as visit_count
            FROM navigation_trips
            WHERE user_id = $1
            GROUP BY destination_lat, destination_lng
            ORDER BY visit_count DESC
            LIMIT 5
            "#,
        )
        .bind(user_id as i32)
        .fetch_all(&state.pg)
        .await
        .unwrap_or_default();
        trips_visited
            .into_iter()
            .map(|(place_key, visit_count)| MostVisitedPlace {
                name: place_key.unwrap_or_else(|| "Destination inconnue".to_string()),
                visit_count,
            })
            .collect()
    } else {
        most_visited
            .into_iter()
            .map(|(place_name, visit_count)| MostVisitedPlace {
                name: place_name.unwrap_or_else(|| "Destination inconnue".to_string()),
                visit_count,
            })
            .collect()
    };

    // Types de POI favoris (basé sur les modes de transport les plus utilisés dans activity_log)
    let poi_favorites = sqlx::query_as::<_, (String, i64)>(
        r#"
        SELECT travel_mode, COUNT(*)::bigint as mode_count
        FROM navigation_activity_log
        WHERE user_id = $1
        GROUP BY travel_mode
        ORDER BY mode_count DESC
        LIMIT 5
        "#,
    )
    .bind(user_id as i32)
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    let favorite_poi_types = if poi_favorites.is_empty() {
        vec![
            FavoritePOIType {
                poi_type: "pharmacy".to_string(),
                count: 0,
            },
            FavoritePOIType {
                poi_type: "restaurant".to_string(),
                count: 0,
            },
        ]
    } else {
        poi_favorites
            .into_iter()
            .map(|(mode, count)| FavoritePOIType {
                poi_type: mode,
                count,
            })
            .collect()
    };

    Ok(Json(NavigationStats {
        total_trips: stats.0,
        total_distance_km: (stats.1 as f64) / 1000.0,
        total_duration_minutes: (stats.2 as f64) / 60.0,
        most_visited_places,
        favorite_poi_types,
    }))
}

#[derive(Deserialize)]
struct SaveDestinationRequest {
    label: String,                // 'domicile', 'bureau', 'autre'
    custom_label: Option<String>, // Si label = 'autre'
    address: String,
    latitude: f64,
    longitude: f64,
    place_id: Option<String>,
}

#[derive(Serialize)]
struct SavedDestination {
    id: String,
    label: String,
    custom_label: Option<String>,
    address: String,
    latitude: f64,
    longitude: f64,
    place_id: Option<String>,
    is_default: bool,
}

#[derive(Serialize)]
struct SavedDestinationsResponse {
    destinations: Vec<SavedDestination>,
}

// Structures pour les résultats de requêtes SQL
#[derive(sqlx::FromRow)]
struct SavedDestinationRow {
    id: i32,
    label: String,
    custom_label: Option<String>,
    address: String,
    latitude: f64,
    longitude: f64,
    place_id: Option<String>,
    is_default: bool,
}

#[derive(sqlx::FromRow)]
struct SavedDestinationIdRow {
    id: i32,
}

#[derive(sqlx::FromRow)]
struct SavedDestinationAutocompleteRow {
    label: String,
    custom_label: Option<String>,
    address: String,
    latitude: f64,
    longitude: f64,
}

/// Enregistrer une destination favorite (domicile, bureau, etc.)
async fn save_destination(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(request): Json<SaveDestinationRequest>,
) -> AppResult<Json<SavedDestination>> {
    let user_id = user.id;

    // Valider le label
    let valid_labels = ["domicile", "bureau", "autre"];
    if !valid_labels.contains(&request.label.as_str()) {
        return Err(AppError::BadRequest(
            "Label invalide. Utilisez: domicile, bureau, ou autre".to_string(),
        ));
    }

    // Si label = 'autre', custom_label est requis
    if request.label == "autre" && request.custom_label.is_none() {
        return Err(AppError::BadRequest(
            "custom_label est requis quand label = 'autre'".to_string(),
        ));
    }

    // Marquer comme défaut si c'est le premier de ce type
    // Pour 'autre', chercher par (label, custom_label) pour permettre plusieurs favoris personnalisés
    let existing = if request.label == "autre" {
        sqlx::query_as::<_, SavedDestinationIdRow>(
            "SELECT id FROM navigation_saved_destinations WHERE user_id = $1 AND label = $2 AND custom_label = $3",
        )
        .bind(user_id as i32)
        .bind(&request.label)
        .bind(&request.custom_label)
        .fetch_optional(&state.pg)
        .await?
    } else {
        sqlx::query_as::<_, SavedDestinationIdRow>(
            "SELECT id FROM navigation_saved_destinations WHERE user_id = $1 AND label = $2",
        )
        .bind(user_id as i32)
        .bind(&request.label)
        .fetch_optional(&state.pg)
        .await?
    };

    let is_default = existing.is_none();

    // Si un autre existe avec le même label (et custom_label pour 'autre'), le mettre à jour
    if let Some(existing_row) = existing {
        let result = sqlx::query_as::<_, SavedDestinationIdRow>(
            r#"
            UPDATE navigation_saved_destinations
            SET custom_label = $1, address = $2, latitude = $3, longitude = $4, 
                place_id = $5, is_default = $6, updated_at = NOW()
            WHERE id = $7
            RETURNING id
            "#,
        )
        .bind(&request.custom_label)
        .bind(&request.address)
        .bind(request.latitude)
        .bind(request.longitude)
        .bind(&request.place_id)
        .bind(is_default)
        .bind(existing_row.id)
        .fetch_one(&state.pg)
        .await?;

        return Ok(Json(SavedDestination {
            id: result.id.to_string(),
            label: request.label,
            custom_label: request.custom_label,
            address: request.address,
            latitude: request.latitude,
            longitude: request.longitude,
            place_id: request.place_id,
            is_default,
        }));
    }

    // Créer nouveau
    let result = sqlx::query_as::<_, SavedDestinationIdRow>(
        r#"
        INSERT INTO navigation_saved_destinations (
            user_id, label, custom_label, address, latitude, longitude, place_id, is_default
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
        "#,
    )
    .bind(user_id as i32)
    .bind(&request.label)
    .bind(&request.custom_label)
    .bind(&request.address)
    .bind(request.latitude)
    .bind(request.longitude)
    .bind(&request.place_id)
    .bind(is_default)
    .fetch_one(&state.pg)
    .await?;

    Ok(Json(SavedDestination {
        id: result.id.to_string(),
        label: request.label,
        custom_label: request.custom_label,
        address: request.address,
        latitude: request.latitude,
        longitude: request.longitude,
        place_id: request.place_id,
        is_default,
    }))
}

/// Lister les destinations favorites
async fn list_destinations(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<SavedDestinationsResponse>> {
    let user_id = user.id;

    let rows = sqlx::query_as::<_, SavedDestinationRow>(
        r#"
        SELECT id, label, custom_label, address, latitude, longitude, place_id, is_default
        FROM navigation_saved_destinations
        WHERE user_id = $1
        ORDER BY is_default DESC, created_at DESC
        "#,
    )
    .bind(user_id as i32)
    .fetch_all(&state.pg)
    .await?;

    let destinations = rows
        .into_iter()
        .map(|row| SavedDestination {
            id: row.id.to_string(),
            label: row.label,
            custom_label: row.custom_label,
            address: row.address,
            latitude: row.latitude,
            longitude: row.longitude,
            place_id: row.place_id,
            is_default: row.is_default,
        })
        .collect();

    Ok(Json(SavedDestinationsResponse { destinations }))
}

/// Obtenir une destination par label (domicile, bureau, etc.)
async fn get_destination_by_label(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(label): Path<String>,
) -> AppResult<Json<SavedDestination>> {
    let user_id = user.id;

    let row = sqlx::query_as::<_, SavedDestinationRow>(
        r#"
        SELECT id, label, custom_label, address, latitude, longitude, place_id, is_default
        FROM navigation_saved_destinations
        WHERE user_id = $1 AND label = $2
        LIMIT 1
        "#,
    )
    .bind(user_id as i32)
    .bind(&label)
    .fetch_optional(&state.pg)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Destination '{}' non trouvée", label)))?;

    Ok(Json(SavedDestination {
        id: row.id.to_string(),
        label: row.label,
        custom_label: row.custom_label,
        address: row.address,
        latitude: row.latitude,
        longitude: row.longitude,
        place_id: row.place_id,
        is_default: row.is_default,
    }))
}

/// Supprimer une destination
async fn delete_destination(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(destination_id): Path<i32>,
) -> AppResult<Json<serde_json::Value>> {
    let user_id = user.id;

    let result = sqlx::query_as::<_, SavedDestinationIdRow>(
        r#"
        DELETE FROM navigation_saved_destinations
        WHERE id = $1 AND user_id = $2
        RETURNING id
        "#,
    )
    .bind(destination_id)
    .bind(user_id as i32)
    .fetch_optional(&state.pg)
    .await?;

    if result.is_none() {
        return Err(AppError::NotFound("Destination non trouvée".to_string()));
    }

    Ok(Json(serde_json::json!({ "success": true })))
}

/// Autocomplete avec destinations favorites incluses
async fn autocomplete_with_saved(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(params): Query<serde_json::Value>,
) -> AppResult<Json<serde_json::Value>> {
    let query = params.get("query").and_then(|q| q.as_str()).unwrap_or("").trim();
    let query_lower = query.to_lowercase();

    // Récupérer les destinations favorites
    let user_id = user.id;
    let saved_destinations = sqlx::query_as::<_, SavedDestinationAutocompleteRow>(
        r#"
        SELECT label, custom_label, address, latitude, longitude
        FROM navigation_saved_destinations
        WHERE user_id = $1
        ORDER BY is_default DESC
        "#,
    )
    .bind(user_id as i32)
    .fetch_all(&state.pg)
    .await?;

    let mut results = Vec::new();

    // Ajouter les destinations favorites qui correspondent
    for dest in saved_destinations {
        let display_label = match dest.label.as_str() {
            "domicile" => "🏠 Domicile".to_string(),
            "bureau" => "💼 Bureau".to_string(),
            "autre" => format!("📍 {}", dest.custom_label.as_deref().unwrap_or("Autre")),
            _ => format!("📍 {}", dest.label),
        };

        if query.is_empty()
            || dest.label.to_lowercase().contains(&query_lower)
            || dest.address.to_lowercase().contains(&query_lower)
            || display_label.to_lowercase().contains(&query_lower)
        {
            results.push(serde_json::json!({
                "description": display_label,
                "address": dest.address,
                "latitude": dest.latitude,
                "longitude": dest.longitude,
                "is_saved": true,
                "label": dest.label
            }));
        }
    }

    // Si la query n'est pas vide et > 2 caractères, appeler Google Places
    if !query.is_empty() && query.len() > 2 {
        let api_key = std::env::var("GOOGLE_MAPS_API_KEY")
            .map_err(|_| AppError::Internal("GOOGLE_MAPS_API_KEY non configurée".to_string()))?;

        let url = format!(
            "https://maps.googleapis.com/maps/api/place/autocomplete/json?input={}&key={}&language=fr",
            urlencoding::encode(query),
            api_key
        );

        if let Ok(response) = reqwest::Client::new()
            .get(&url)
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await
        {
            if let Ok(data) = response.json::<serde_json::Value>().await {
                if let Some(predictions) = data.get("predictions").and_then(|p| p.as_array()) {
                    for pred in predictions.iter().take(10) {
                        if let Some(description) = pred.get("description").and_then(|d| d.as_str())
                        {
                            results.push(serde_json::json!({
                                "description": description,
                                "is_saved": false,
                                "place_id": pred.get("place_id").and_then(|p| p.as_str())
                            }));
                        }
                    }
                }
            }
        }
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "results": results
    })))
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ✅ NOUVEAU 2026-03-05: Système d'activité & statistiques intelligentes
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#[derive(Deserialize)]
struct LogActivityRequest {
    travel_mode: String,
    origin_address: Option<String>,
    destination_address: Option<String>,
    origin_lat: Option<f64>,
    origin_lng: Option<f64>,
    dest_lat: Option<f64>,
    dest_lng: Option<f64>,
    distance_meters: f64,
    duration_seconds: i32,
    avg_speed_kmh: f64,
    max_speed_kmh: f64,
    calories_burned: f64,
    quality_score: f64,
    speed_consistency: f64,
    pace_per_km_seconds: Option<f64>,
    checkpoints_reported: Option<i32>,
    checkpoints_encountered: Option<i32>,
    was_off_route: Option<bool>,
    started_at: String,
}

#[derive(Deserialize)]
struct ActivitySummaryQuery {
    period: Option<String>, // week, month, year, all
}

#[derive(Deserialize)]
struct ActivityHistoryQuery {
    page: Option<i32>,
    limit: Option<i32>,
    mode: Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
struct ActivityRow {
    id: uuid::Uuid,
    travel_mode: String,
    origin_address: Option<String>,
    destination_address: Option<String>,
    distance_meters: f64,
    duration_seconds: i32,
    avg_speed_kmh: Option<f64>,
    max_speed_kmh: Option<f64>,
    calories_burned: Option<f64>,
    quality_score: Option<f64>,
    started_at: chrono::DateTime<chrono::Utc>,
    ended_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Enregistrer une session d'activité (appelé automatiquement à l'arrêt du suivi)
async fn log_activity(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(req): Json<LogActivityRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let started_at = chrono::DateTime::parse_from_rfc3339(&req.started_at)
        .map(|dt| dt.with_timezone(&chrono::Utc))
        .unwrap_or_else(|_| chrono::Utc::now());

    sqlx::query(
        r#"
        INSERT INTO navigation_activity_log (
            user_id, travel_mode, origin_address, destination_address,
            origin_lat, origin_lng, dest_lat, dest_lng,
            distance_meters, duration_seconds, avg_speed_kmh, max_speed_kmh,
            calories_burned, quality_score, speed_consistency, pace_per_km_seconds,
            checkpoints_reported, checkpoints_encountered, was_off_route,
            started_at, ended_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW())
        "#,
    )
    .bind(user.id)
    .bind(&req.travel_mode)
    .bind(&req.origin_address)
    .bind(&req.destination_address)
    .bind(req.origin_lat)
    .bind(req.origin_lng)
    .bind(req.dest_lat)
    .bind(req.dest_lng)
    .bind(req.distance_meters)
    .bind(req.duration_seconds)
    .bind(req.avg_speed_kmh)
    .bind(req.max_speed_kmh)
    .bind(req.calories_burned)
    .bind(req.quality_score)
    .bind(req.speed_consistency)
    .bind(req.pace_per_km_seconds)
    .bind(req.checkpoints_reported.unwrap_or(0))
    .bind(req.checkpoints_encountered.unwrap_or(0))
    .bind(req.was_off_route.unwrap_or(false))
    .bind(started_at)
    .execute(&state.pg)
    .await?;

    Ok(Json(serde_json::json!({ "success": true })))
}

/// Statistiques d'activité par période (semaine, mois, année)
async fn get_activity_summary(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(params): Query<ActivitySummaryQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let period = params.period.unwrap_or_else(|| "week".to_string());
    let since = match period.as_str() {
        "week" => chrono::Utc::now() - chrono::Duration::days(7),
        "month" => chrono::Utc::now() - chrono::Duration::days(30),
        "year" => chrono::Utc::now() - chrono::Duration::days(365),
        _ => chrono::DateTime::<chrono::Utc>::MIN_UTC,
    };

    // Métriques agrégées sur la période
    let stats = sqlx::query_as::<_, (i64, f64, i64, f64, f64, f64, f64)>(
        r#"
        SELECT
            COUNT(*)::bigint,
            COALESCE(SUM(distance_meters), 0)::float8,
            COALESCE(SUM(duration_seconds), 0)::bigint,
            COALESCE(AVG(avg_speed_kmh), 0)::float8,
            COALESCE(MAX(max_speed_kmh), 0)::float8,
            COALESCE(SUM(calories_burned), 0)::float8,
            COALESCE(AVG(quality_score), 0)::float8
        FROM navigation_activity_log
        WHERE user_id = $1 AND started_at >= $2
        "#,
    )
    .bind(user.id)
    .bind(since)
    .fetch_one(&state.pg)
    .await?;

    // Stats par mode de transport
    let by_mode = sqlx::query_as::<_, (String, i64, f64, i64)>(
        r#"
        SELECT
            travel_mode,
            COUNT(*)::bigint,
            COALESCE(SUM(distance_meters), 0)::float8,
            COALESCE(SUM(duration_seconds), 0)::bigint
        FROM navigation_activity_log
        WHERE user_id = $1 AND started_at >= $2
        GROUP BY travel_mode
        ORDER BY COUNT(*) DESC
        "#,
    )
    .bind(user.id)
    .bind(since)
    .fetch_all(&state.pg)
    .await?;

    // Destinations les plus visitées
    let top_destinations = sqlx::query_as::<_, (Option<String>, i64)>(
        r#"
        SELECT destination_address, COUNT(*)::bigint as visits
        FROM navigation_activity_log
        WHERE user_id = $1 AND started_at >= $2 AND destination_address IS NOT NULL
        GROUP BY destination_address
        ORDER BY visits DESC
        LIMIT 10
        "#,
    )
    .bind(user.id)
    .bind(since)
    .fetch_all(&state.pg)
    .await?;

    // Tendance quotidienne (distance par jour sur la période)
    let daily_trend = sqlx::query_as::<_, (String, f64, i64)>(
        r#"
        SELECT
            TO_CHAR(started_at, 'YYYY-MM-DD') as day,
            COALESCE(SUM(distance_meters), 0)::float8 as distance,
            COALESCE(SUM(duration_seconds), 0)::bigint as duration
        FROM navigation_activity_log
        WHERE user_id = $1 AND started_at >= $2
        GROUP BY day
        ORDER BY day DESC
        LIMIT 30
        "#,
    )
    .bind(user.id)
    .bind(since)
    .fetch_all(&state.pg)
    .await?;

    // Meilleure session (qualité la plus élevée)
    let best_session = sqlx::query_as::<_, (f64, f64, i32, f64, chrono::DateTime<chrono::Utc>)>(
        r#"
        SELECT quality_score, distance_meters, duration_seconds, avg_speed_kmh, started_at
        FROM navigation_activity_log
        WHERE user_id = $1 AND started_at >= $2 AND quality_score > 0
        ORDER BY quality_score DESC
        LIMIT 1
        "#,
    )
    .bind(user.id)
    .bind(since)
    .fetch_optional(&state.pg)
    .await?;

    let modes_json: Vec<serde_json::Value> = by_mode
        .iter()
        .map(|(mode, count, dist, dur)| {
            serde_json::json!({
                "mode": mode,
                "count": count,
                "distance_km": *dist / 1000.0,
                "duration_minutes": *dur as f64 / 60.0,
            })
        })
        .collect();

    let destinations_json: Vec<serde_json::Value> = top_destinations
        .iter()
        .map(|(addr, visits)| {
            serde_json::json!({
                "address": addr.as_deref().unwrap_or("Inconnu"),
                "visits": visits,
            })
        })
        .collect();

    let trend_json: Vec<serde_json::Value> = daily_trend
        .iter()
        .map(|(day, dist, dur)| {
            serde_json::json!({
                "date": day,
                "distance_km": *dist / 1000.0,
                "duration_minutes": *dur as f64 / 60.0,
            })
        })
        .collect();

    Ok(Json(serde_json::json!({
        "success": true,
        "period": period,
        "summary": {
            "total_sessions": stats.0,
            "total_distance_km": stats.1 / 1000.0,
            "total_duration_minutes": stats.2 as f64 / 60.0,
            "avg_speed_kmh": stats.3,
            "max_speed_kmh": stats.4,
            "total_calories": stats.5,
            "avg_quality_score": stats.6,
        },
        "by_mode": modes_json,
        "top_destinations": destinations_json,
        "daily_trend": trend_json,
        "best_session": best_session.map(|(q, d, dur, spd, date)| serde_json::json!({
            "quality_score": q,
            "distance_km": d / 1000.0,
            "duration_minutes": dur as f64 / 60.0,
            "avg_speed_kmh": spd,
            "date": date.format("%Y-%m-%d").to_string(),
        })),
    })))
}

/// Historique des activités (paginé)
async fn get_activity_history(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(params): Query<ActivityHistoryQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(20).min(50);
    let offset = (page - 1) * limit;

    let rows = if let Some(mode) = &params.mode {
        sqlx::query_as::<_, ActivityRow>(
            r#"
            SELECT id, travel_mode, origin_address, destination_address,
                   distance_meters, duration_seconds, avg_speed_kmh, max_speed_kmh,
                   calories_burned, quality_score, started_at, ended_at
            FROM navigation_activity_log
            WHERE user_id = $1 AND travel_mode = $2
            ORDER BY started_at DESC
            LIMIT $3 OFFSET $4
            "#,
        )
        .bind(user.id)
        .bind(mode)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.pg)
        .await?
    } else {
        sqlx::query_as::<_, ActivityRow>(
            r#"
            SELECT id, travel_mode, origin_address, destination_address,
                   distance_meters, duration_seconds, avg_speed_kmh, max_speed_kmh,
                   calories_burned, quality_score, started_at, ended_at
            FROM navigation_activity_log
            WHERE user_id = $1
            ORDER BY started_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(user.id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.pg)
        .await?
    };

    let activities: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            serde_json::json!({
                "id": r.id.to_string(),
                "travel_mode": r.travel_mode,
                "origin": r.origin_address,
                "destination": r.destination_address,
                "distance_km": r.distance_meters / 1000.0,
                "duration_minutes": r.duration_seconds as f64 / 60.0,
                "avg_speed_kmh": r.avg_speed_kmh,
                "max_speed_kmh": r.max_speed_kmh,
                "calories": r.calories_burned,
                "quality_score": r.quality_score,
                "date": r.started_at.format("%Y-%m-%dT%H:%M:%SZ").to_string(),
            })
        })
        .collect();

    Ok(Json(serde_json::json!({
        "success": true,
        "activities": activities,
        "page": page,
        "has_more": rows.len() == limit as usize,
    })))
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ✅ NOUVEAU 2026-03-05: Contexte géographique dynamique (adapte l'IA à la région)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/// Contexte géographique dynamique pour adapter l'IA et les calculs au pays/région de l'utilisateur
#[derive(Debug, Clone)]
struct GeoContext {
    region_name: String,
    country_hint: String,
    currency_code: String,
    currency_symbol: String,
    fuel_price_per_liter: f64,
    fuel_consumption_l_100km: f64,
    co2_car_g_per_km: f64,
    co2_transit_g_per_km: f64,
    cultural_context: String,
    language_hint: String,
}

impl GeoContext {
    /// Détecte le contexte géographique à partir de multiples signaux
    /// Priorité: phone_country > adresse récente > coordonnées GPS > défaut
    fn detect(
        lat: Option<f64>,
        lng: Option<f64>,
        address: Option<&str>,
        phone_country: Option<&str>,
    ) -> Self {
        // 1. Code pays du téléphone (le plus fiable)
        if let Some(cc) = phone_country {
            let cc = cc.trim().to_uppercase();
            if !cc.is_empty() {
                if let Some(ctx) = Self::from_country_code(&cc) {
                    return ctx;
                }
            }
        }

        // 2. Parsing de l'adresse pour extraire le pays
        if let Some(addr) = address {
            if let Some(ctx) = Self::from_address(addr) {
                return ctx;
            }
        }

        // 3. Coordonnées GPS (bounding boxes régionales)
        if let (Some(lat), Some(lng)) = (lat, lng) {
            return Self::from_lat_lng(lat, lng);
        }

        // 4. Défaut: contexte international générique
        Self::default_international()
    }

    fn from_country_code(code: &str) -> Option<Self> {
        match code {
            // ── CEMAC (Afrique centrale, XAF) ──
            "CM" => Some(Self::cemac("Cameroun")),
            "GA" => Some(Self::cemac("Gabon")),
            "CG" => Some(Self::cemac("Congo-Brazzaville")),
            "CF" => Some(Self::cemac("République centrafricaine")),
            "TD" => Some(Self::cemac("Tchad")),
            "GQ" => Some(Self::cemac("Guinée équatoriale")),
            // ── CEDEAO/UEMOA (Afrique de l'Ouest, XOF) ──
            "SN" => Some(Self::cedeao_xof("Sénégal")),
            "CI" => Some(Self::cedeao_xof("Côte d'Ivoire")),
            "ML" => Some(Self::cedeao_xof("Mali")),
            "BF" => Some(Self::cedeao_xof("Burkina Faso")),
            "NE" => Some(Self::cedeao_xof("Niger")),
            "TG" => Some(Self::cedeao_xof("Togo")),
            "BJ" => Some(Self::cedeao_xof("Bénin")),
            "GW" => Some(Self::cedeao_xof("Guinée-Bissau")),
            // ── Afrique de l'Ouest (monnaie locale) ──
            "NG" => Some(Self::new("Afrique de l'Ouest", "Nigeria", "NGN", "₦", 700.0, 10.0, 140.0, 60.0,
                "Contexte nigérian: trafic dense à Lagos/Abuja, moto-taxis (okada), carburant subventionné. Adapter les conseils au contexte urbain nigérian.", "en")),
            "GH" => Some(Self::new("Afrique de l'Ouest", "Ghana", "GHS", "GH₵", 15.0, 9.0, 130.0, 55.0,
                "Contexte ghanéen: trotros (minibus), trafic à Accra, routes mixtes. Conseils adaptés au Ghana.", "en")),
            "GN" => Some(Self::new("Afrique de l'Ouest", "Guinée", "GNF", "GNF", 12000.0, 9.0, 135.0, 55.0,
                "Contexte guinéen: mobilité mixte, taxis partagés. Adapter au contexte local.", "fr")),
            // ── Afrique de l'Est ──
            "KE" => Some(Self::east_africa("Kenya", "KES", "KSh", 180.0)),
            "TZ" => Some(Self::east_africa("Tanzanie", "TZS", "TSh", 2800.0)),
            "UG" => Some(Self::east_africa("Ouganda", "UGX", "USh", 5500.0)),
            "RW" => Some(Self::east_africa("Rwanda", "RWF", "FRw", 1350.0)),
            "BI" => Some(Self::east_africa("Burundi", "BIF", "FBu", 3200.0)),
            "ET" => Some(Self::east_africa("Éthiopie", "ETB", "Br", 60.0)),
            "CD" => Some(Self::new("Afrique centrale", "RD Congo", "CDF", "FC", 3500.0, 10.0, 140.0, 60.0,
                "Contexte congolais (RDC): routes souvent dégradées, trafic dense à Kinshasa, motos-taxis. Adapter les conseils au contexte local.", "fr")),
            // ── Afrique australe ──
            "ZA" => Some(Self::new("Afrique australe", "Afrique du Sud", "ZAR", "R", 24.0, 8.5, 120.0, 45.0,
                "Contexte sud-africain: réseau routier développé, minibus-taxis, routes longues distances. Adapter les conseils en conséquence.", "en")),
            "MG" => Some(Self::new("Océan Indien", "Madagascar", "MGA", "Ar", 5500.0, 9.0, 130.0, 55.0,
                "Contexte malgache: taxi-brousse, routes parfois difficiles. Adapter les conseils au contexte local.", "fr")),
            // ── Maghreb / Afrique du Nord ──
            "MA" => Some(Self::maghreb("Maroc", "MAD", "DH", 14.0)),
            "DZ" => Some(Self::maghreb("Algérie", "DZD", "DA", 45.0)),
            "TN" => Some(Self::maghreb("Tunisie", "TND", "DT", 2.1)),
            "EG" => Some(Self::new("Afrique du Nord", "Égypte", "EGP", "E£", 12.5, 9.0, 125.0, 50.0,
                "Contexte égyptien: trafic intense au Caire, microbus, Uber populaire. Adapter les conseils.", "ar")),
            // ── Europe ──
            "FR" => Some(Self::europe_eur("France")),
            "BE" => Some(Self::europe_eur("Belgique")),
            "LU" => Some(Self::europe_eur("Luxembourg")),
            "DE" => Some(Self::europe_eur("Allemagne")),
            "ES" => Some(Self::europe_eur("Espagne")),
            "IT" => Some(Self::europe_eur("Italie")),
            "PT" => Some(Self::europe_eur("Portugal")),
            "NL" => Some(Self::europe_eur("Pays-Bas")),
            "AT" => Some(Self::europe_eur("Autriche")),
            "IE" => Some(Self::europe_eur("Irlande")),
            "FI" => Some(Self::europe_eur("Finlande")),
            "GR" => Some(Self::europe_eur("Grèce")),
            "CH" => Some(Self::new("Europe", "Suisse", "CHF", "CHF", 1.85, 6.5, 95.0, 35.0,
                "Contexte suisse: réseau de transport exceptionnel (CFF), pistes cyclables, environnement alpin. Conseils adaptés.", "fr")),
            "GB" => Some(Self::new("Europe", "Royaume-Uni", "GBP", "£", 1.50, 7.0, 100.0, 40.0,
                "Contexte britannique: bus et métro développés, conduite à gauche, vélo populaire à Londres. Adapter les conseils.", "en")),
            // ── Amérique du Nord ──
            "US" => Some(Self::new("Amérique du Nord", "États-Unis", "USD", "$", 0.95, 9.5, 130.0, 50.0,
                "Contexte américain: villes dépendantes de la voiture, distances longues, développement récent des transports en commun et vélo. Adapter les conseils au lifestyle américain.", "en")),
            "CA" => Some(Self::new("Amérique du Nord", "Canada", "CAD", "CA$", 1.70, 8.5, 120.0, 45.0,
                "Contexte canadien: hivers rigoureux, grandes distances, transport en commun dans les grandes villes. Adapter les conseils au climat et aux distances.", "en")),
            // ── Amérique latine ──
            "BR" => Some(Self::new("Amérique du Sud", "Brésil", "BRL", "R$", 6.0, 9.0, 125.0, 50.0,
                "Contexte brésilien: mégalopoles avec trafic dense, motos populaires, Uber/99 très utilisés. Adapter les conseils.", "pt")),
            "MX" => Some(Self::new("Amérique centrale", "Mexique", "MXN", "$MX", 24.0, 9.0, 125.0, 50.0,
                "Contexte mexicain: trafic dense dans les grandes villes, colectivos, mobilité mixte. Adapter les conseils.", "es")),
            // ── Asie ──
            "IN" => Some(Self::new("Asie du Sud", "Inde", "INR", "₹", 100.0, 8.0, 130.0, 45.0,
                "Contexte indien: trafic extrêmement dense, auto-rickshaws, deux-roues omniprésents. Adapter les conseils à la mobilité indienne.", "en")),
            "CN" => Some(Self::new("Asie de l'Est", "Chine", "CNY", "¥", 8.5, 8.0, 115.0, 30.0,
                "Contexte chinois: réseau de transport très développé, vélos/scooters électriques populaires, applications de ride-hailing. Adapter les conseils.", "zh")),
            // ── Moyen-Orient ──
            "AE" => Some(Self::new("Moyen-Orient", "Émirats arabes unis", "AED", "AED", 3.2, 10.0, 140.0, 50.0,
                "Contexte émirati: ville auto-centrée, climatisation intensive, métro à Dubaï. Adapter les conseils au climat chaud.", "en")),
            "SA" => Some(Self::new("Moyen-Orient", "Arabie saoudite", "SAR", "SAR", 2.3, 10.0, 140.0, 50.0,
                "Contexte saoudien: grandes distances, voiture dominante, climat très chaud. Adapter les conseils.", "ar")),
            _ => None,
        }
    }

    fn from_address(addr: &str) -> Option<Self> {
        let addr_lower = addr.to_lowercase();
        // Afrique centrale
        if addr_lower.contains("cameroun") || addr_lower.contains("cameroon") {
            return Some(Self::cemac("Cameroun"));
        }
        if addr_lower.contains("gabon") {
            return Some(Self::cemac("Gabon"));
        }
        if addr_lower.contains("congo-brazzaville")
            || (addr_lower.contains("congo")
                && !addr_lower.contains("kinshasa")
                && !addr_lower.contains("rdc"))
        {
            return Some(Self::cemac("Congo-Brazzaville"));
        }
        if addr_lower.contains("centrafricaine") || addr_lower.contains("central african") {
            return Some(Self::cemac("République centrafricaine"));
        }
        if addr_lower.contains("tchad") || addr_lower.contains("chad") {
            return Some(Self::cemac("Tchad"));
        }
        // Afrique de l'Ouest
        if addr_lower.contains("sénégal")
            || addr_lower.contains("senegal")
            || addr_lower.contains("dakar")
        {
            return Some(Self::cedeao_xof("Sénégal"));
        }
        if addr_lower.contains("côte d'ivoire")
            || addr_lower.contains("ivory coast")
            || addr_lower.contains("abidjan")
        {
            return Some(Self::cedeao_xof("Côte d'Ivoire"));
        }
        if addr_lower.contains("nigeria")
            || addr_lower.contains("lagos")
            || addr_lower.contains("abuja")
        {
            return Some(Self::from_country_code("NG").unwrap());
        }
        // Afrique de l'Est
        if addr_lower.contains("kenya") || addr_lower.contains("nairobi") {
            return Some(Self::east_africa("Kenya", "KES", "KSh", 180.0));
        }
        if addr_lower.contains("rwanda") || addr_lower.contains("kigali") {
            return Some(Self::east_africa("Rwanda", "RWF", "FRw", 1350.0));
        }
        if addr_lower.contains("kinshasa")
            || addr_lower.contains("rdc")
            || addr_lower.contains("rd congo")
        {
            return Self::from_country_code("CD");
        }
        // Maghreb
        if addr_lower.contains("maroc")
            || addr_lower.contains("morocco")
            || addr_lower.contains("casablanca")
            || addr_lower.contains("rabat")
        {
            return Some(Self::maghreb("Maroc", "MAD", "DH", 14.0));
        }
        if addr_lower.contains("algérie")
            || addr_lower.contains("algeria")
            || addr_lower.contains("alger")
        {
            return Some(Self::maghreb("Algérie", "DZD", "DA", 45.0));
        }
        if addr_lower.contains("tunisie")
            || addr_lower.contains("tunisia")
            || addr_lower.contains("tunis")
        {
            return Some(Self::maghreb("Tunisie", "TND", "DT", 2.1));
        }
        // Europe
        if addr_lower.contains("france")
            || addr_lower.contains("paris")
            || addr_lower.contains("lyon")
            || addr_lower.contains("marseille")
        {
            return Some(Self::europe_eur("France"));
        }
        if addr_lower.contains("belgique")
            || addr_lower.contains("belgium")
            || addr_lower.contains("bruxelles")
        {
            return Some(Self::europe_eur("Belgique"));
        }
        if addr_lower.contains("allemagne")
            || addr_lower.contains("germany")
            || addr_lower.contains("berlin")
        {
            return Some(Self::europe_eur("Allemagne"));
        }
        if addr_lower.contains("suisse")
            || addr_lower.contains("switzerland")
            || addr_lower.contains("genève")
            || addr_lower.contains("zurich")
        {
            return Self::from_country_code("CH");
        }
        // Amériques
        if addr_lower.contains("united states")
            || addr_lower.contains("états-unis")
            || addr_lower.contains("new york")
            || addr_lower.contains("los angeles")
        {
            return Self::from_country_code("US");
        }
        if addr_lower.contains("canada")
            || addr_lower.contains("montréal")
            || addr_lower.contains("toronto")
        {
            return Self::from_country_code("CA");
        }
        if addr_lower.contains("brésil")
            || addr_lower.contains("brazil")
            || addr_lower.contains("são paulo")
        {
            return Self::from_country_code("BR");
        }
        None
    }

    fn from_lat_lng(lat: f64, lng: f64) -> Self {
        // Afrique centrale (CEMAC): rough bounding box
        if lat >= -5.0 && lat <= 15.0 && lng >= 8.0 && lng <= 28.0 {
            return Self::cemac("Pays CEMAC");
        }
        // Afrique de l'Ouest
        if lat >= 0.0 && lat <= 20.0 && lng >= -18.0 && lng <= 8.0 {
            return Self::cedeao_xof("Afrique de l'Ouest");
        }
        // Afrique de l'Est
        if lat >= -12.0 && lat <= 15.0 && lng >= 28.0 && lng <= 50.0 {
            return Self::east_africa("Afrique de l'Est", "USD", "$", 1.2);
        }
        // Afrique australe
        if lat >= -35.0 && lat <= -12.0 && lng >= 10.0 && lng <= 50.0 {
            return Self::from_country_code("ZA").unwrap_or_else(Self::default_international);
        }
        // Afrique du Nord / Maghreb
        if lat >= 20.0 && lat <= 37.0 && lng >= -15.0 && lng <= 35.0 {
            return Self::maghreb("Afrique du Nord", "USD", "$", 1.0);
        }
        // Europe
        if lat >= 35.0 && lat <= 72.0 && lng >= -12.0 && lng <= 45.0 {
            return Self::europe_eur("Europe");
        }
        // Amérique du Nord
        if lat >= 25.0 && lat <= 72.0 && lng >= -170.0 && lng <= -50.0 {
            return Self::from_country_code("US").unwrap_or_else(Self::default_international);
        }
        // Amérique du Sud
        if lat >= -55.0 && lat <= 15.0 && lng >= -85.0 && lng <= -30.0 {
            return Self::from_country_code("BR").unwrap_or_else(Self::default_international);
        }
        // Asie du Sud / Sud-Est
        if lat >= -10.0 && lat <= 55.0 && lng >= 60.0 && lng <= 150.0 {
            return Self::from_country_code("IN").unwrap_or_else(Self::default_international);
        }
        // Moyen-Orient
        if lat >= 12.0 && lat <= 42.0 && lng >= 35.0 && lng <= 60.0 {
            return Self::from_country_code("AE").unwrap_or_else(Self::default_international);
        }
        Self::default_international()
    }

    // ── Constructeurs régionaux ─────────────────────────────────────────

    fn new(
        region: &str,
        country: &str,
        currency_code: &str,
        currency_sym: &str,
        fuel_price: f64,
        fuel_conso: f64,
        co2_car: f64,
        co2_transit: f64,
        cultural: &str,
        lang: &str,
    ) -> Self {
        Self {
            region_name: region.to_string(),
            country_hint: country.to_string(),
            currency_code: currency_code.to_string(),
            currency_symbol: currency_sym.to_string(),
            fuel_price_per_liter: fuel_price,
            fuel_consumption_l_100km: fuel_conso,
            co2_car_g_per_km: co2_car,
            co2_transit_g_per_km: co2_transit,
            cultural_context: cultural.to_string(),
            language_hint: lang.to_string(),
        }
    }

    fn cemac(country: &str) -> Self {
        Self::new("Afrique centrale (CEMAC)", country, "XAF", "FCFA", 850.0, 8.0, 120.0, 50.0,
            &format!("Contexte {} (zone CEMAC): motos-taxis fréquents, routes mixtes (goudron/terre), climat tropical. \
            Le transport en commun = minibus/bus. Conseils adaptés au pouvoir d'achat local et aux habitudes de mobilité africaines.", country),
            "fr")
    }

    fn cedeao_xof(country: &str) -> Self {
        Self::new("Afrique de l'Ouest (CEDEAO/UEMOA)", country, "XOF", "FCFA", 750.0, 8.5, 125.0, 50.0,
            &format!("Contexte {} (zone UEMOA): transport en commun = cars rapides, Ndiaga Ndiaye, minibus. \
            Motos et vélos populaires. Conseils adaptés au contexte ouest-africain.", country),
            "fr")
    }

    fn east_africa(country: &str, cur_code: &str, cur_sym: &str, fuel_price: f64) -> Self {
        Self::new(
            "Afrique de l'Est",
            country,
            cur_code,
            cur_sym,
            fuel_price,
            8.5,
            125.0,
            50.0,
            &format!(
                "Contexte {} (Afrique de l'Est): boda-bodas (motos-taxis), matatus (minibus), \
            développement rapide des villes. Conseils adaptés au contexte est-africain.",
                country
            ),
            "en",
        )
    }

    fn maghreb(country: &str, cur_code: &str, cur_sym: &str, fuel_price: f64) -> Self {
        Self::new("Afrique du Nord (Maghreb)", country, cur_code, cur_sym, fuel_price, 7.5, 115.0, 45.0,
            &format!("Contexte {} (Maghreb): réseau de transport varié (taxis, bus, tramway dans les grandes villes), \
            climat chaud, distances parfois importantes. Conseils adaptés.", country),
            "fr")
    }

    fn europe_eur(country: &str) -> Self {
        Self::new("Europe", country, "EUR", "€", 1.75, 6.5, 95.0, 35.0,
            &format!("Contexte {} (Europe): excellent réseau de transport en commun, pistes cyclables développées, \
            sensibilité écologique forte. Conseils adaptés au mode de vie européen.", country),
            "fr")
    }

    fn default_international() -> Self {
        Self::new("International", "Non déterminé", "USD", "$", 1.50, 8.0, 120.0, 45.0,
            "Contexte international: adapter les conseils de mobilité et santé de manière universelle, \
            en privilégiant les recommandations OMS et les bonnes pratiques de mobilité durable.",
            "fr")
    }

    /// Calcule le coût carburant pour une distance en km (mode voiture)
    fn fuel_cost_for_km(&self, km: f64) -> f64 {
        km * (self.fuel_consumption_l_100km / 100.0) * self.fuel_price_per_liter
    }

    /// Génère la section contexte du prompt IA Coach
    fn coach_prompt_context(&self) -> String {
        format!(
            "CONTEXTE GÉOGRAPHIQUE:\n\
            - Région: {} | Pays: {}\n\
            - Devise locale: {} ({})\n\
            - Prix carburant référence: {:.2} {}/litre (valeur indicative, ajuste selon ta connaissance du prix actuel dans ce pays)\n\
            - Consommation moyenne véhicule: {:.1} L/100km\n\
            - CO2 voiture: {:.0} g/km | CO2 transport en commun: {:.0} g/km\n\
            - Contexte local: {}\n\
            NOTE: Les valeurs ci-dessus sont des références stockées en base. Si tu sais que le prix du carburant ou d'autres données ont changé récemment dans ce pays, utilise tes connaissances actualisées dans tes conseils.\n",
            self.region_name, self.country_hint,
            self.currency_symbol, self.currency_code,
            self.fuel_price_per_liter, self.currency_symbol,
            self.fuel_consumption_l_100km,
            self.co2_car_g_per_km, self.co2_transit_g_per_km,
            self.cultural_context
        )
    }

    /// Génère la section contexte du prompt IA sécurité routière
    fn security_prompt_context(&self) -> String {
        format!(
            "Tu es l'IA de sécurité routière Yukpo, expert en analyse de dangers routiers en {} ({}).",
            self.region_name, self.country_hint
        )
    }
}

/// Charge un GeoContext depuis la table geo_regional_config (données dynamiques, modifiables en DB)
async fn load_geo_from_db(pool: &sqlx::PgPool, country_code: &str) -> Option<GeoContext> {
    let row = sqlx::query_as::<_, (String, String, String, String, f64, f64, f64, f64, Option<String>, String)>(
        r#"SELECT country_name, region_name, currency_code, currency_symbol,
                  fuel_price_per_liter, fuel_consumption_l_100km, co2_car_g_per_km, co2_transit_g_per_km,
                  cultural_context, language_hint
           FROM geo_regional_config WHERE country_code = $1"#,
    ).bind(country_code).fetch_optional(pool).await.ok()?;

    row.map(
        |(name, region, cur_code, cur_sym, fuel, conso, co2_car, co2_transit, ctx, lang)| {
            GeoContext {
                region_name: region,
                country_hint: name,
                currency_code: cur_code,
                currency_symbol: cur_sym,
                fuel_price_per_liter: fuel,
                fuel_consumption_l_100km: conso,
                co2_car_g_per_km: co2_car,
                co2_transit_g_per_km: co2_transit,
                cultural_context: ctx.unwrap_or_default(),
                language_hint: lang,
            }
        },
    )
}

/// Détecte le GeoContext d'un utilisateur à partir de ses données
/// Priorité: DB dynamique (geo_regional_config) > hardcodé > défaut international
async fn detect_user_geo_context(pool: &sqlx::PgPool, user_id: i32) -> GeoContext {
    // 1. Récupérer phone_country de l'utilisateur
    let phone_country: Option<String> =
        sqlx::query_scalar("SELECT phone_country FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();

    // 2. Récupérer la dernière activité avec coordonnées
    let last_activity = sqlx::query_as::<_, (Option<f64>, Option<f64>, Option<String>)>(
        r#"SELECT origin_lat, origin_lng, origin_address
           FROM navigation_activity_log
           WHERE user_id = $1 AND origin_lat IS NOT NULL
           ORDER BY started_at DESC LIMIT 1"#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();

    let (lat, lng, addr) = last_activity.unwrap_or((None, None, None));

    // 3. Résoudre le code pays (phone_country > adresse > GPS)
    let resolved_code = resolve_country_code(lat, lng, addr.as_deref(), phone_country.as_deref());

    // 4. Essayer d'abord la DB (données dynamiques, à jour)
    if let Some(ref code) = resolved_code {
        if let Some(db_ctx) = load_geo_from_db(pool, code).await {
            log::info!("[GeoContext] Loaded from DB for country_code={}", code);
            return db_ctx;
        }
    }

    // 5. Fallback: hardcodé (toujours disponible même si DB vide)
    log::info!("[GeoContext] Fallback to hardcoded for {:?}", resolved_code);
    GeoContext::detect(lat, lng, addr.as_deref(), phone_country.as_deref())
}

/// Résout le code pays ISO à partir des signaux disponibles
fn resolve_country_code(
    lat: Option<f64>,
    lng: Option<f64>,
    address: Option<&str>,
    phone_country: Option<&str>,
) -> Option<String> {
    // phone_country est déjà un code ISO (ex: "CM")
    if let Some(cc) = phone_country {
        let cc = cc.trim().to_uppercase();
        if !cc.is_empty() && cc.len() <= 3 {
            return Some(cc);
        }
    }
    // Adresse: extraire un code pays connu
    if let Some(addr) = address {
        if let Some(code) = address_to_country_code(addr) {
            return Some(code);
        }
    }
    // GPS: bounding boxes grossières → code pays
    if let (Some(lat), Some(lng)) = (lat, lng) {
        return Some(coords_to_country_code(lat, lng));
    }
    None
}

fn address_to_country_code(addr: &str) -> Option<String> {
    let a = addr.to_lowercase();
    let mapping = [
        ("cameroun", "CM"),
        ("cameroon", "CM"),
        ("gabon", "GA"),
        ("sénégal", "SN"),
        ("senegal", "SN"),
        ("dakar", "SN"),
        ("côte d'ivoire", "CI"),
        ("ivory coast", "CI"),
        ("abidjan", "CI"),
        ("nigeria", "NG"),
        ("lagos", "NG"),
        ("abuja", "NG"),
        ("kenya", "KE"),
        ("nairobi", "KE"),
        ("rwanda", "RW"),
        ("kigali", "RW"),
        ("kinshasa", "CD"),
        ("rdc", "CD"),
        ("rd congo", "CD"),
        ("maroc", "MA"),
        ("morocco", "MA"),
        ("casablanca", "MA"),
        ("algérie", "DZ"),
        ("algeria", "DZ"),
        ("tunisie", "TN"),
        ("tunisia", "TN"),
        ("france", "FR"),
        ("paris", "FR"),
        ("belgique", "BE"),
        ("bruxelles", "BE"),
        ("allemagne", "DE"),
        ("germany", "DE"),
        ("suisse", "CH"),
        ("switzerland", "CH"),
        ("united states", "US"),
        ("états-unis", "US"),
        ("canada", "CA"),
        ("brésil", "BR"),
        ("brazil", "BR"),
        ("tchad", "TD"),
        ("chad", "TD"),
        ("congo-brazzaville", "CG"),
        ("centrafricaine", "CF"),
        ("central african", "CF"),
    ];
    for (keyword, code) in &mapping {
        if a.contains(keyword) {
            return Some(code.to_string());
        }
    }
    None
}

fn coords_to_country_code(lat: f64, lng: f64) -> String {
    if lat >= -5.0 && lat <= 15.0 && lng >= 8.0 && lng <= 28.0 {
        return "CM".to_string();
    } // Afrique centrale
    if lat >= 0.0 && lat <= 20.0 && lng >= -18.0 && lng <= 8.0 {
        return "SN".to_string();
    } // Afrique Ouest
    if lat >= -12.0 && lat <= 15.0 && lng >= 28.0 && lng <= 50.0 {
        return "KE".to_string();
    } // Afrique Est
    if lat >= -35.0 && lat <= -12.0 && lng >= 10.0 && lng <= 50.0 {
        return "ZA".to_string();
    } // Afrique australe
    if lat >= 20.0 && lat <= 37.0 && lng >= -15.0 && lng <= 35.0 {
        return "MA".to_string();
    } // Maghreb
    if lat >= 35.0 && lat <= 72.0 && lng >= -12.0 && lng <= 45.0 {
        return "FR".to_string();
    } // Europe
    if lat >= 25.0 && lat <= 72.0 && lng >= -170.0 && lng <= -50.0 {
        return "US".to_string();
    } // Amérique Nord
    if lat >= -55.0 && lat <= 15.0 && lng >= -85.0 && lng <= -30.0 {
        return "BR".to_string();
    } // Amérique Sud
    if lat >= -10.0 && lat <= 55.0 && lng >= 60.0 && lng <= 150.0 {
        return "IN".to_string();
    } // Asie
    if lat >= 12.0 && lat <= 42.0 && lng >= 35.0 && lng <= 60.0 {
        return "AE".to_string();
    } // Moyen-Orient
    "XX".to_string() // inconnu → fallback hardcodé
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ✅ NOUVEAU 2026-03-05: Coach IA & Analyse avancée (unique au monde)
// CO2, VO2max, records personnels, badges, défis, patterns trajet domicile,
// évaluation risque santé, recommandations IA personnalisées
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/// Analyse IA complète: insights, records, CO2, fitness, badges, défis, recommandations
async fn get_ai_insights(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(params): Query<ActivitySummaryQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let period = params.period.unwrap_or_else(|| "week".to_string());
    let since = match period.as_str() {
        "week" => chrono::Utc::now() - chrono::Duration::days(7),
        "month" => chrono::Utc::now() - chrono::Duration::days(30),
        "year" => chrono::Utc::now() - chrono::Duration::days(365),
        _ => chrono::DateTime::<chrono::Utc>::MIN_UTC,
    };
    let since_30d = chrono::Utc::now() - chrono::Duration::days(30);
    let since_all = chrono::DateTime::<chrono::Utc>::MIN_UTC;

    // ─── 0. Contexte géographique dynamique ─────────────────────────────
    let geo = detect_user_geo_context(&state.pg, user.id).await;
    log::info!(
        "[Navigation AI] GeoContext: {} / {} ({})",
        geo.region_name,
        geo.country_hint,
        geo.currency_symbol
    );

    // ─── 1. Données de la période ───────────────────────────────────────
    let period_data = sqlx::query_as::<_, (i64, f64, i64, f64, f64, f64, f64, f64)>(
        r#"
        SELECT COUNT(*)::bigint, COALESCE(SUM(distance_meters),0)::float8,
               COALESCE(SUM(duration_seconds),0)::bigint, COALESCE(AVG(avg_speed_kmh),0)::float8,
               COALESCE(MAX(max_speed_kmh),0)::float8, COALESCE(SUM(calories_burned),0)::float8,
               COALESCE(AVG(quality_score),0)::float8, COALESCE(AVG(speed_consistency),0)::float8
        FROM navigation_activity_log WHERE user_id = $1 AND started_at >= $2
        "#,
    )
    .bind(user.id)
    .bind(since)
    .fetch_one(&state.pg)
    .await?;

    // ─── 2. Données globales (all-time) pour records ────────────────────
    let all_time = sqlx::query_as::<_, (i64, f64, i64, f64)>(
        r#"
        SELECT COUNT(*)::bigint, COALESCE(SUM(distance_meters),0)::float8,
               COALESCE(SUM(duration_seconds),0)::bigint, COALESCE(SUM(calories_burned),0)::float8
        FROM navigation_activity_log WHERE user_id = $1
        "#,
    )
    .bind(user.id)
    .fetch_one(&state.pg)
    .await?;

    // ─── 3. Records personnels ──────────────────────────────────────────
    let record_longest = sqlx::query_as::<_, (f64, i32, String, chrono::DateTime<chrono::Utc>)>(
        r#"SELECT distance_meters, duration_seconds, travel_mode, started_at
           FROM navigation_activity_log WHERE user_id = $1 ORDER BY distance_meters DESC LIMIT 1"#,
    )
    .bind(user.id)
    .fetch_optional(&state.pg)
    .await?;

    let record_fastest_km = sqlx::query_as::<_, (f64, f64, chrono::DateTime<chrono::Utc>)>(
        r#"SELECT pace_per_km_seconds, distance_meters, started_at
           FROM navigation_activity_log WHERE user_id = $1 AND pace_per_km_seconds > 0
           AND travel_mode IN ('walking', 'bicycling')
           ORDER BY pace_per_km_seconds ASC LIMIT 1"#,
    )
    .bind(user.id)
    .fetch_optional(&state.pg)
    .await?;

    let record_best_quality = sqlx::query_as::<_, (f64, f64, i32, chrono::DateTime<chrono::Utc>)>(
        r#"SELECT quality_score, distance_meters, duration_seconds, started_at
           FROM navigation_activity_log WHERE user_id = $1 ORDER BY quality_score DESC LIMIT 1"#,
    )
    .bind(user.id)
    .fetch_optional(&state.pg)
    .await?;

    let record_most_calories =
        sqlx::query_as::<_, (f64, f64, i32, String, chrono::DateTime<chrono::Utc>)>(
            r#"SELECT calories_burned, distance_meters, duration_seconds, travel_mode, started_at
           FROM navigation_activity_log WHERE user_id = $1 ORDER BY calories_burned DESC LIMIT 1"#,
        )
        .bind(user.id)
        .fetch_optional(&state.pg)
        .await?;

    let record_max_speed = sqlx::query_as::<_, (f64, String, chrono::DateTime<chrono::Utc>)>(
        r#"SELECT max_speed_kmh, travel_mode, started_at
           FROM navigation_activity_log WHERE user_id = $1 ORDER BY max_speed_kmh DESC LIMIT 1"#,
    )
    .bind(user.id)
    .fetch_optional(&state.pg)
    .await?;

    // ─── 4. CO2 Impact & Coûts transport ────────────────────────────────
    let co2_data = sqlx::query_as::<_, (String, f64)>(
        r#"SELECT travel_mode, COALESCE(SUM(distance_meters),0)::float8
           FROM navigation_activity_log WHERE user_id = $1 AND started_at >= $2
           GROUP BY travel_mode"#,
    )
    .bind(user.id)
    .bind(since)
    .fetch_all(&state.pg)
    .await?;

    let mut co2_emitted_g: f64 = 0.0;
    let mut co2_saved_g: f64 = 0.0;
    let mut fuel_cost_local: f64 = 0.0; // en devise locale (dynamique)
    for (mode, dist_m) in &co2_data {
        let dist_km = dist_m / 1000.0;
        match mode.as_str() {
            "driving" => {
                co2_emitted_g += dist_km * geo.co2_car_g_per_km;
                fuel_cost_local += geo.fuel_cost_for_km(dist_km);
            }
            "transit" => {
                co2_emitted_g += dist_km * geo.co2_transit_g_per_km;
                co2_saved_g += dist_km * (geo.co2_car_g_per_km - geo.co2_transit_g_per_km);
            }
            "walking" | "bicycling" => {
                co2_saved_g += dist_km * geo.co2_car_g_per_km;
                fuel_cost_local -= geo.fuel_cost_for_km(dist_km); // négatif = économisé
            }
            _ => {}
        }
    }
    let trees_equivalent = co2_saved_g / 22000.0; // 1 arbre absorbe ~22kg CO2/an

    // ─── 5. Fitness Level (VO2max estimation) ───────────────────────────
    // Formule simplifiée basée sur vitesse de marche/course et durée
    let fitness_data = sqlx::query_as::<_, (f64, f64, i32)>(
        r#"SELECT COALESCE(AVG(avg_speed_kmh),0)::float8, COALESCE(AVG(quality_score),0)::float8,
                  COALESCE(SUM(duration_seconds),0)::int4
           FROM navigation_activity_log
           WHERE user_id = $1 AND started_at >= $2 AND travel_mode IN ('walking', 'bicycling')"#,
    )
    .bind(user.id)
    .bind(since_30d)
    .fetch_one(&state.pg)
    .await?;

    // VO2max approximation (Cooper formula adapted): VO2max ≈ (distance_km_12min - 0.505) * 44.73
    // Simplifié: basé sur vitesse moyenne de marche + régularité
    let avg_walk_speed = fitness_data.0;
    let vo2max_estimate = if avg_walk_speed > 2.0 {
        // Estimation basée sur la vitesse de marche/course
        let base = avg_walk_speed * 3.5 + 10.0; // formule approximative
        let quality_bonus = fitness_data.1 * 0.1;
        let endurance_bonus = (fitness_data.2 as f64 / 3600.0).min(5.0) * 2.0;
        (base + quality_bonus + endurance_bonus).min(70.0).max(15.0)
    } else {
        0.0
    };

    let fitness_level = if vo2max_estimate >= 50.0 {
        "Excellent"
    } else if vo2max_estimate >= 40.0 {
        "Très bon"
    } else if vo2max_estimate >= 35.0 {
        "Bon"
    } else if vo2max_estimate >= 30.0 {
        "Moyen"
    } else if vo2max_estimate >= 20.0 {
        "À améliorer"
    } else {
        "Données insuffisantes"
    };

    // ─── 6. Streak (jours consécutifs d'activité) ───────────────────────
    let active_days = sqlx::query_as::<_, (String,)>(
        r#"SELECT DISTINCT TO_CHAR(started_at, 'YYYY-MM-DD') as day
           FROM navigation_activity_log WHERE user_id = $1
           ORDER BY day DESC LIMIT 90"#,
    )
    .bind(user.id)
    .fetch_all(&state.pg)
    .await?;

    let mut current_streak = 0i32;
    let mut max_streak = 0i32;
    let today = chrono::Utc::now().date_naive();
    let mut check_date = today;
    for day_row in &active_days {
        if let Ok(d) = chrono::NaiveDate::parse_from_str(&day_row.0, "%Y-%m-%d") {
            if d == check_date || d == check_date - chrono::Duration::days(1) {
                current_streak += 1;
                check_date = d - chrono::Duration::days(1);
            } else if current_streak > 0 {
                break;
            }
        }
    }
    // Calculer max streak sur l'historique
    let mut temp_streak = 0i32;
    let mut prev_date: Option<chrono::NaiveDate> = None;
    for day_row in active_days.iter().rev() {
        if let Ok(d) = chrono::NaiveDate::parse_from_str(&day_row.0, "%Y-%m-%d") {
            if let Some(prev) = prev_date {
                if d == prev + chrono::Duration::days(1) {
                    temp_streak += 1;
                } else {
                    if temp_streak > max_streak {
                        max_streak = temp_streak;
                    }
                    temp_streak = 1;
                }
            } else {
                temp_streak = 1;
            }
            prev_date = Some(d);
        }
    }
    if temp_streak > max_streak {
        max_streak = temp_streak;
    }

    // ─── 7. Badges / Achievements ───────────────────────────────────────
    let existing_badges = sqlx::query_as::<_, (String, i32)>(
        "SELECT badge_type, badge_level FROM navigation_user_achievements WHERE user_id = $1",
    )
    .bind(user.id)
    .fetch_all(&state.pg)
    .await?;

    let existing_set: std::collections::HashSet<(String, i32)> =
        existing_badges.iter().map(|(t, l)| (t.clone(), *l)).collect();

    let total_km = all_time.1 / 1000.0;
    let total_sessions = all_time.0;
    let total_cal = all_time.3;

    // Définir les badges à attribuer
    let mut new_badges: Vec<(&str, i32, &str, &str)> = Vec::new(); // (type, level, emoji, label)

    // Distance badges
    if total_km >= 1.0 && !existing_set.contains(&("distance".into(), 1)) {
        new_badges.push(("distance", 1, "🥉", "Premier kilomètre"));
    }
    if total_km >= 10.0 && !existing_set.contains(&("distance".into(), 2)) {
        new_badges.push(("distance", 2, "🥈", "Explorateur (10 km)"));
    }
    if total_km >= 50.0 && !existing_set.contains(&("distance".into(), 3)) {
        new_badges.push(("distance", 3, "🥇", "Aventurier (50 km)"));
    }
    if total_km >= 100.0 && !existing_set.contains(&("distance".into(), 4)) {
        new_badges.push(("distance", 4, "🏆", "Marathonien (100 km)"));
    }
    if total_km >= 500.0 && !existing_set.contains(&("distance".into(), 5)) {
        new_badges.push(("distance", 5, "💎", "Légende (500 km)"));
    }

    // Session badges
    if total_sessions >= 1 && !existing_set.contains(&("sessions".into(), 1)) {
        new_badges.push(("sessions", 1, "🌱", "Première session"));
    }
    if total_sessions >= 10 && !existing_set.contains(&("sessions".into(), 2)) {
        new_badges.push(("sessions", 2, "🌿", "Habitué (10 sessions)"));
    }
    if total_sessions >= 50 && !existing_set.contains(&("sessions".into(), 3)) {
        new_badges.push(("sessions", 3, "🌳", "Expert (50 sessions)"));
    }
    if total_sessions >= 100 && !existing_set.contains(&("sessions".into(), 4)) {
        new_badges.push(("sessions", 4, "🏔️", "Maître (100 sessions)"));
    }

    // Calorie badges
    if total_cal >= 500.0 && !existing_set.contains(&("calories".into(), 1)) {
        new_badges.push(("calories", 1, "🔥", "500 calories brûlées"));
    }
    if total_cal >= 5000.0 && !existing_set.contains(&("calories".into(), 2)) {
        new_badges.push(("calories", 2, "🔥", "5000 calories brûlées"));
    }
    if total_cal >= 20000.0 && !existing_set.contains(&("calories".into(), 3)) {
        new_badges.push(("calories", 3, "🔥", "Machine à calories (20k)"));
    }

    // Streak badges
    if current_streak >= 3 && !existing_set.contains(&("streak".into(), 1)) {
        new_badges.push(("streak", 1, "⚡", "3 jours d'affilée"));
    }
    if current_streak >= 7 && !existing_set.contains(&("streak".into(), 2)) {
        new_badges.push(("streak", 2, "⚡", "Semaine parfaite"));
    }
    if current_streak >= 30 && !existing_set.contains(&("streak".into(), 3)) {
        new_badges.push(("streak", 3, "⚡", "Mois invincible"));
    }

    // Eco badges
    if co2_saved_g >= 1000.0 && !existing_set.contains(&("eco".into(), 1)) {
        new_badges.push(("eco", 1, "🌍", "Éco-citoyen (1kg CO2 économisé)"));
    }
    if co2_saved_g >= 10000.0 && !existing_set.contains(&("eco".into(), 2)) {
        new_badges.push(("eco", 2, "🌍", "Champion vert (10kg CO2)"));
    }

    // Quality badges
    if record_best_quality.as_ref().map_or(false, |r| r.0 >= 90.0)
        && !existing_set.contains(&("quality".into(), 1))
    {
        new_badges.push(("quality", 1, "⭐", "Perfection (qualité 90+)"));
    }

    // Checkpoint reporter badges
    let total_reported: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(checkpoints_reported),0)::bigint FROM navigation_activity_log WHERE user_id = $1",
    ).bind(user.id).fetch_one(&state.pg).await?;
    if total_reported >= 5 && !existing_set.contains(&("reporter".into(), 1)) {
        new_badges.push(("reporter", 1, "📡", "Vigie (5 signalements)"));
    }
    if total_reported >= 25 && !existing_set.contains(&("reporter".into(), 2)) {
        new_badges.push(("reporter", 2, "📡", "Sentinelle (25 signalements)"));
    }

    // Sauvegarder les nouveaux badges
    for (badge_type, level, _emoji, _label) in &new_badges {
        let _ = sqlx::query(
            "INSERT INTO navigation_user_achievements (user_id, badge_type, badge_level) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        ).bind(user.id).bind(*badge_type).bind(*level).execute(&state.pg).await;
    }

    // Récupérer tous les badges (anciens + nouveaux)
    let all_badges = sqlx::query_as::<_, (String, i32, chrono::DateTime<chrono::Utc>)>(
        "SELECT badge_type, badge_level, earned_at FROM navigation_user_achievements WHERE user_id = $1 ORDER BY earned_at DESC",
    ).bind(user.id).fetch_all(&state.pg).await?;

    let badges_json: Vec<serde_json::Value> = all_badges.iter().map(|(btype, level, earned)| {
        let (emoji, label) = match (btype.as_str(), *level) {
            ("distance", 1) => ("🥉", "Premier kilomètre"),
            ("distance", 2) => ("🥈", "Explorateur (10 km)"),
            ("distance", 3) => ("🥇", "Aventurier (50 km)"),
            ("distance", 4) => ("🏆", "Marathonien (100 km)"),
            ("distance", 5) => ("💎", "Légende (500 km)"),
            ("sessions", 1) => ("🌱", "Première session"),
            ("sessions", 2) => ("🌿", "Habitué (10 sessions)"),
            ("sessions", 3) => ("🌳", "Expert (50 sessions)"),
            ("sessions", 4) => ("🏔️", "Maître (100 sessions)"),
            ("calories", 1) => ("🔥", "500 calories brûlées"),
            ("calories", 2) => ("🔥", "5000 calories brûlées"),
            ("calories", 3) => ("🔥", "Machine à calories"),
            ("streak", 1) => ("⚡", "3 jours d'affilée"),
            ("streak", 2) => ("⚡", "Semaine parfaite"),
            ("streak", 3) => ("⚡", "Mois invincible"),
            ("eco", 1) => ("🌍", "Éco-citoyen"),
            ("eco", 2) => ("🌍", "Champion vert"),
            ("quality", 1) => ("⭐", "Perfection"),
            ("reporter", 1) => ("📡", "Vigie"),
            ("reporter", 2) => ("📡", "Sentinelle"),
            _ => ("🏅", "Badge"),
        };
        serde_json::json!({ "type": btype, "level": level, "emoji": emoji, "label": label, "earned_at": earned.format("%Y-%m-%d").to_string() })
    }).collect();

    // ─── 8. Défis actifs & génération automatique ────────────────────────
    let now = chrono::Utc::now();
    let week_start = now - chrono::Duration::days(now.weekday().num_days_from_monday() as i64);
    let week_end = week_start + chrono::Duration::days(7);

    // Vérifier s'il y a des défis actifs cette semaine
    let active_challenges = sqlx::query_as::<_, (uuid::Uuid, String, f64, f64, bool)>(
        r#"SELECT id, challenge_type, target_value, current_value, completed
           FROM navigation_challenges WHERE user_id = $1 AND period_end >= $2
           ORDER BY created_at DESC LIMIT 5"#,
    )
    .bind(user.id)
    .bind(now)
    .fetch_all(&state.pg)
    .await?;

    // Générer automatiquement des défis si aucun n'est actif
    if active_challenges.is_empty() && total_sessions > 0 {
        let avg_weekly_km = (all_time.1 / 1000.0) / (all_time.0 as f64).max(1.0) * 3.0; // objectif = 3x avg session
        let avg_weekly_cal = all_time.3 / (all_time.0 as f64).max(1.0) * 3.0;

        let challenges_to_create = vec![
            ("distance_km", avg_weekly_km.max(5.0).min(50.0)),
            ("calories", avg_weekly_cal.max(500.0).min(5000.0)),
            (
                "sessions",
                5.0_f64.min((total_sessions as f64 / 4.0).max(3.0)),
            ),
        ];

        for (ctype, target) in &challenges_to_create {
            let _ = sqlx::query(
                r#"INSERT INTO navigation_challenges (user_id, challenge_type, target_value, period_start, period_end)
                   VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING"#,
            ).bind(user.id).bind(*ctype).bind(*target).bind(week_start).bind(week_end).execute(&state.pg).await;
        }
    }

    // Mettre à jour la progression des défis actifs
    let current_week_stats = sqlx::query_as::<_, (f64, f64, i64)>(
        r#"SELECT COALESCE(SUM(distance_meters),0)::float8, COALESCE(SUM(calories_burned),0)::float8, COUNT(*)::bigint
           FROM navigation_activity_log WHERE user_id = $1 AND started_at >= $2"#,
    ).bind(user.id).bind(week_start).fetch_one(&state.pg).await?;

    for (id, ctype, _target, _current, _completed) in &active_challenges {
        let new_value = match ctype.as_str() {
            "distance_km" => current_week_stats.0 / 1000.0,
            "calories" => current_week_stats.1,
            "sessions" => current_week_stats.2 as f64,
            _ => 0.0,
        };
        let _ = sqlx::query(
            "UPDATE navigation_challenges SET current_value = $1, completed = ($1 >= target_value), completed_at = CASE WHEN $1 >= target_value AND completed_at IS NULL THEN NOW() ELSE completed_at END WHERE id = $2",
        ).bind(new_value).bind(id).execute(&state.pg).await;
    }

    // Relire les défis mis à jour
    let updated_challenges = sqlx::query_as::<_, (String, f64, f64, bool)>(
        r#"SELECT challenge_type, target_value, current_value, completed
           FROM navigation_challenges WHERE user_id = $1 AND period_end >= $2
           ORDER BY created_at DESC LIMIT 5"#,
    )
    .bind(user.id)
    .bind(now)
    .fetch_all(&state.pg)
    .await?;

    let challenges_json: Vec<serde_json::Value> = updated_challenges
        .iter()
        .map(|(ctype, target, current, completed)| {
            let (emoji, label) = match ctype.as_str() {
                "distance_km" => ("🎯", format!("Parcourir {:.0} km cette semaine", target)),
                "calories" => ("🔥", format!("Brûler {:.0} calories cette semaine", target)),
                "sessions" => ("🏃", format!("{:.0} sessions cette semaine", target)),
                _ => ("📊", format!("Défi {}", ctype)),
            };
            let progress = if *target > 0.0 {
                (*current / *target * 100.0).min(100.0)
            } else {
                0.0
            };
            serde_json::json!({
                "type": ctype, "emoji": emoji, "label": label,
                "target": target, "current": current, "progress": progress,
                "completed": completed,
            })
        })
        .collect();

    // ─── 9. Patterns de trajet domicile (Commute Insights) ──────────────
    let commute_patterns = sqlx::query_as::<_, (Option<String>, Option<String>, i64, f64, f64)>(
        r#"SELECT origin_address, destination_address, COUNT(*)::bigint,
                  COALESCE(AVG(duration_seconds),0)::float8, COALESCE(AVG(distance_meters),0)::float8
           FROM navigation_activity_log WHERE user_id = $1 AND started_at >= $2
           AND origin_address IS NOT NULL AND destination_address IS NOT NULL
           GROUP BY origin_address, destination_address
           HAVING COUNT(*) >= 2
           ORDER BY COUNT(*) DESC LIMIT 5"#,
    ).bind(user.id).bind(since_all).fetch_all(&state.pg).await?;

    let commute_json: Vec<serde_json::Value> = commute_patterns
        .iter()
        .map(|(orig, dest, count, avg_dur, avg_dist)| {
            serde_json::json!({
                "from": orig.as_deref().unwrap_or("?"),
                "to": dest.as_deref().unwrap_or("?"),
                "trips": count,
                "avg_duration_minutes": *avg_dur / 60.0,
                "avg_distance_km": *avg_dist / 1000.0,
            })
        })
        .collect();

    // Heures de départ les plus fréquentes
    let departure_hours = sqlx::query_as::<_, (f64, i64)>(
        r#"SELECT EXTRACT(HOUR FROM started_at)::float8, COUNT(*)::bigint
           FROM navigation_activity_log WHERE user_id = $1 AND started_at >= $2
           GROUP BY EXTRACT(HOUR FROM started_at) ORDER BY COUNT(*) DESC LIMIT 5"#,
    )
    .bind(user.id)
    .bind(since_30d)
    .fetch_all(&state.pg)
    .await?;

    let peak_hours: Vec<serde_json::Value> = departure_hours
        .iter()
        .map(|(hour, count)| serde_json::json!({ "hour": *hour as i32, "trips": count }))
        .collect();

    // ─── 10. Recommandations IA personnalisées ──────────────────────────
    let _total_dist_km = period_data.1 / 1000.0;
    let total_dur_min = period_data.2 as f64 / 60.0;
    let avg_quality = period_data.6;
    let total_cal = period_data.5;
    let sessions = period_data.0;

    let mut ai_tips: Vec<serde_json::Value> = Vec::new();

    // Conseil activité physique
    let weekly_active_min = if period == "week" {
        total_dur_min
    } else {
        total_dur_min / 4.3
    };
    if weekly_active_min < 150.0 {
        ai_tips.push(serde_json::json!({
            "category": "health", "priority": "high", "emoji": "🏃",
            "title": "Augmentez votre activité physique",
            "message": format!("L'OMS recommande 150 min/semaine d'activité modérée. Vous en êtes à {:.0} min. Essayez d'ajouter {:.0} min de marche cette semaine.", weekly_active_min, 150.0 - weekly_active_min),
        }));
    } else {
        ai_tips.push(serde_json::json!({
            "category": "health", "priority": "positive", "emoji": "💪",
            "title": "Objectif OMS atteint !",
            "message": format!("Bravo ! Vous dépassez les 150 min/semaine recommandées avec {:.0} min. Continuez ainsi !", weekly_active_min),
        }));
    }

    // Conseil CO2
    if co2_saved_g > 0.0 {
        ai_tips.push(serde_json::json!({
            "category": "eco", "priority": "positive", "emoji": "🌍",
            "title": "Impact environnemental positif",
            "message": format!("Vous avez économisé {:.1} kg de CO2 en choisissant la marche ou le vélo. C'est l'équivalent de {:.1} arbres plantés !", co2_saved_g / 1000.0, trees_equivalent),
        }));
    }

    // Conseil qualité
    if avg_quality < 50.0 && sessions > 2 {
        ai_tips.push(serde_json::json!({
            "category": "performance", "priority": "medium", "emoji": "📊",
            "title": "Améliorez votre régularité",
            "message": "Votre score de qualité est en dessous de 50. Essayez de maintenir une vitesse plus constante pendant vos déplacements pour améliorer votre score.",
        }));
    } else if avg_quality >= 75.0 && sessions > 2 {
        ai_tips.push(serde_json::json!({
            "category": "performance", "priority": "positive", "emoji": "⭐",
            "title": "Excellent niveau de régularité",
            "message": format!("Score moyen de {:.0}/100 — vous maintenez une allure très régulière. Continuez !", avg_quality),
        }));
    }

    // Conseil streak
    if current_streak >= 3 {
        ai_tips.push(serde_json::json!({
            "category": "motivation", "priority": "positive", "emoji": "🔥",
            "title": format!("{} jours d'affilée !", current_streak),
            "message": format!("Impressionnant ! Ne cassez pas la chaîne. Votre record est de {} jours consécutifs.", max_streak),
        }));
    } else if sessions > 5 && current_streak == 0 {
        ai_tips.push(serde_json::json!({
            "category": "motivation", "priority": "medium", "emoji": "⏰",
            "title": "Reprenez votre série !",
            "message": "Vous n'avez pas été actif aujourd'hui. Un petit trajet suffit pour relancer votre série de jours consécutifs !",
        }));
    }

    // Conseil économie financière
    if fuel_cost_local < 0.0 {
        ai_tips.push(serde_json::json!({
            "category": "finance", "priority": "positive", "emoji": "💰",
            "title": "Économies réalisées",
            "message": format!("En marchant/pédalant au lieu de conduire, vous avez économisé environ {:.0} {} en carburant !", fuel_cost_local.abs(), geo.currency_symbol),
        }));
    }

    // Conseil sédentarité (risque santé)
    if sessions == 0 && period == "week" {
        ai_tips.push(serde_json::json!({
            "category": "health", "priority": "critical", "emoji": "⚠️",
            "title": "Attention : semaine inactive",
            "message": "Aucune activité cette semaine. La sédentarité augmente les risques cardiovasculaires. Même 10 minutes de marche par jour font une différence !",
        }));
    }

    // Conseil VO2max
    if vo2max_estimate > 20.0 {
        ai_tips.push(serde_json::json!({
            "category": "fitness", "priority": "info", "emoji": "❤️",
            "title": format!("Condition physique : {}", fitness_level),
            "message": format!("Votre VO2max estimé est de {:.0} ml/kg/min ({}). Pour l'améliorer, augmentez progressivement l'intensité de vos marches.", vo2max_estimate, fitness_level),
        }));
    }

    // Conseil heures de pointe
    if !departure_hours.is_empty() {
        let peak = departure_hours[0].0 as i32;
        ai_tips.push(serde_json::json!({
            "category": "optimization", "priority": "info", "emoji": "🕐",
            "title": "Votre heure habituelle de départ",
            "message": format!("Vous partez le plus souvent à {}h. Pour éviter le trafic, essayez de décaler de 30 min plus tôt.", peak),
        }));
    }

    // ─── 11. Analyse IA profonde (appel LLM réel) ──────────────────────
    // Génère des insights personnalisés via le modèle IA (GPT-4o/Claude/Gemini)
    let ai_deep_analysis: Option<serde_json::Value> = {
        let geo_prompt_ctx = geo.coach_prompt_context();
        let prompt = format!(
            r#"Tu es le Coach IA Navigation Yukpo, expert en santé, mobilité et bien-être.
Adapte tes conseils au contexte géographique et culturel de l'utilisateur.

{geo_context}

DONNÉES UTILISATEUR (période: {period}):
- Sessions: {sessions} | Distance: {dist_km:.1} km | Durée: {dur_min:.0} min
- Calories: {cal:.0} kcal | Qualité moyenne: {quality:.0}/100
- Vitesse moy: {avg_speed:.1} km/h | Vitesse max: {max_speed:.1} km/h
- VO2max estimé: {vo2:.0} ml/kg/min ({fitness})
- Streak: {streak} jours consécutifs (record: {max_streak})
- CO2 économisé: {co2_saved:.1} kg | CO2 émis: {co2_emitted:.1} kg
- Économies carburant: {fuel_saved:.0} {currency}
- Badges: {badges_count} | Points: {points}
- Modes: {modes}
- Heures fréquentes: {peak_hours_str}

INSTRUCTIONS (JSON strict, pas de markdown):
1. Analyse personnalisée de la condition physique et des habitudes
2. 3 conseils concrets et actionnables adaptés au contexte local de l'utilisateur (pays, culture, climat, infrastructure de transport)
3. Évaluation du risque de sédentarité (faible/modéré/élevé/critique)
4. Prédiction d'évolution si l'utilisateur maintient ce rythme
5. Suggestion d'objectif personnalisé pour la semaine prochaine (utilise la devise locale: {currency})
6. Si tu connais le prix actuel du carburant dans ce pays, indique-le dans prix_carburant_estime (sinon omets ce champ)

FORMAT DE SORTIE:
{{
  "analyse_personnalisee": "Texte court (2-3 phrases) sur le profil de mobilité de l'utilisateur",
  "conseils": [
    {{"titre": "...", "message": "...", "priorite": "haute|moyenne|info"}},
    {{"titre": "...", "message": "...", "priorite": "haute|moyenne|info"}},
    {{"titre": "...", "message": "...", "priorite": "haute|moyenne|info"}}
  ],
  "risque_sedentarite": "faible|modere|eleve|critique",
  "prediction": "Texte court sur l'évolution attendue dans 1 mois",
  "objectif_semaine": {{"type": "distance|duree|sessions|calories", "valeur": 10, "unite": "km|min|sessions|kcal", "message": "..."}},
  "prix_carburant_estime": {{"prix_par_litre": 850.0, "devise": "FCFA", "date_estimation": "2026-03"}}
}}

IMPORTANT: Retourne UNIQUEMENT le JSON."#,
            geo_context = geo_prompt_ctx,
            period = period,
            sessions = sessions,
            dist_km = period_data.1 / 1000.0,
            dur_min = total_dur_min,
            cal = total_cal,
            quality = avg_quality,
            avg_speed = period_data.3,
            max_speed = period_data.4,
            vo2 = vo2max_estimate,
            fitness = fitness_level,
            streak = current_streak,
            max_streak = max_streak,
            co2_saved = co2_saved_g / 1000.0,
            co2_emitted = co2_emitted_g / 1000.0,
            fuel_saved = if fuel_cost_local < 0.0 {
                fuel_cost_local.abs()
            } else {
                0.0
            },
            currency = geo.currency_symbol,
            badges_count = all_badges.len(),
            points = (total_km * 10.0
                + all_time.3 * 0.1
                + total_sessions as f64 * 50.0
                + total_reported as f64 * 100.0)
                .round() as i64,
            modes = co2_data.iter().map(|(m, _)| m.as_str()).collect::<Vec<_>>().join(", "),
            peak_hours_str = departure_hours
                .iter()
                .map(|(h, c)| format!("{}h ({}x)", *h as i32, c))
                .collect::<Vec<_>>()
                .join(", "),
        );

        match state.ia.predict(&prompt).await {
            Ok((_model, response, _tokens)) => {
                // Parser le JSON de la réponse IA
                let json_str = if let Some(start) = response.find('{') {
                    if let Some(end) = response.rfind('}') {
                        &response[start..=end]
                    } else {
                        &response
                    }
                } else {
                    &response
                };
                match serde_json::from_str::<serde_json::Value>(json_str) {
                    Ok(parsed) => Some(parsed),
                    Err(e) => {
                        log::warn!(
                            "[Navigation AI] Erreur parsing réponse LLM: {} — réponse brute: {}",
                            e,
                            &response[..response.len().min(200)]
                        );
                        None
                    }
                }
            }
            Err(e) => {
                log::warn!(
                    "[Navigation AI] LLM indisponible, utilisation des règles: {}",
                    e
                );
                None
            }
        }
    };

    // ─── 11b. Auto-update prix carburant si le LLM a fourni une estimation ───
    if let Some(ref ai_json) = ai_deep_analysis {
        if let Some(prix_est) = ai_json.get("prix_carburant_estime") {
            if let Some(prix) = prix_est.get("prix_par_litre").and_then(|v| v.as_f64()) {
                if prix > 0.0
                    && (prix - geo.fuel_price_per_liter).abs() / geo.fuel_price_per_liter > 0.05
                {
                    // Écart > 5% — résoudre le code pays et mettre à jour en arrière-plan
                    let phone_cc: Option<String> = sqlx::query_scalar::<_, Option<String>>(
                        "SELECT phone_country FROM users WHERE id = $1",
                    )
                    .bind(user.id)
                    .fetch_optional(&state.pg)
                    .await
                    .ok()
                    .flatten()
                    .flatten();
                    let cc = resolve_country_code(None, None, None, phone_cc.as_deref())
                        .unwrap_or_default();
                    if !cc.is_empty() && cc != "XX" {
                        let pool = state.pg.clone();
                        let country = geo.country_hint.clone();
                        tokio::spawn(async move {
                            let _ = sqlx::query(
                                "UPDATE geo_regional_config SET fuel_price_per_liter = $1, source = 'ai_estimate', updated_by = 'llm_auto', updated_at = NOW() WHERE country_code = $2"
                            ).bind(prix).bind(&cc).execute(&pool).await;
                            log::info!("[GeoConfig] Auto-updated fuel price for {} ({}) to {:.2} via LLM estimate", country, cc, prix);
                        });
                    }
                }
            }
        }
    }

    // ─── 12. Score de santé global ──────────────────────────────────────
    let health_score = {
        let activity_pct = (weekly_active_min / 150.0 * 30.0).min(30.0); // max 30 pts
        let quality_pts = (avg_quality / 100.0 * 20.0).min(20.0); // max 20 pts
        let streak_pts = (current_streak as f64 * 3.0).min(15.0); // max 15 pts
        let eco_pts = if co2_saved_g > 0.0 { 10.0 } else { 0.0 }; // max 10 pts
        let fitness_pts = (vo2max_estimate / 50.0 * 15.0).min(15.0); // max 15 pts
        let diversity_pts = if co2_data.len() > 1 { 10.0 } else { 5.0 }; // max 10 pts
        (activity_pct + quality_pts + streak_pts + eco_pts + fitness_pts + diversity_pts)
            .min(100.0)
            .round()
    };

    let health_label = if health_score >= 80.0 {
        "Excellent"
    } else if health_score >= 60.0 {
        "Bon"
    } else if health_score >= 40.0 {
        "Moyen"
    } else if health_score >= 20.0 {
        "À améliorer"
    } else {
        "Critique"
    };

    // ─── Réponse finale ─────────────────────────────────────────────────
    Ok(Json(serde_json::json!({
        "success": true,
        "period": period,
        // Records personnels
        "records": {
            "longest_session": record_longest.map(|(d, dur, mode, date)| serde_json::json!({
                "distance_km": d / 1000.0, "duration_minutes": dur as f64 / 60.0,
                "mode": mode, "date": date.format("%Y-%m-%d").to_string()
            })),
            "fastest_km": record_fastest_km.map(|(pace, _dist, date)| serde_json::json!({
                "pace_seconds": pace, "pace_display": format!("{}:{:02}/km", (pace as i32) / 60, (pace as i32) % 60),
                "date": date.format("%Y-%m-%d").to_string()
            })),
            "best_quality": record_best_quality.map(|(q, d, dur, date)| serde_json::json!({
                "score": q, "distance_km": d / 1000.0, "duration_minutes": dur as f64 / 60.0,
                "date": date.format("%Y-%m-%d").to_string()
            })),
            "most_calories": record_most_calories.map(|(cal, d, dur, mode, date)| serde_json::json!({
                "calories": cal, "distance_km": d / 1000.0, "duration_minutes": dur as f64 / 60.0,
                "mode": mode, "date": date.format("%Y-%m-%d").to_string()
            })),
            "max_speed": record_max_speed.map(|(spd, mode, date)| serde_json::json!({
                "speed_kmh": spd, "mode": mode, "date": date.format("%Y-%m-%d").to_string()
            })),
            "total_km": total_km, "total_sessions": total_sessions, "total_calories": all_time.3,
        },
        // Impact CO2 & coûts (devise dynamique selon la région)
        "co2_impact": {
            "emitted_kg": co2_emitted_g / 1000.0,
            "saved_kg": co2_saved_g / 1000.0,
            "trees_equivalent": trees_equivalent,
            "fuel_cost_saved": if fuel_cost_local < 0.0 { fuel_cost_local.abs() } else { 0.0 },
            "fuel_cost_spent": if fuel_cost_local > 0.0 { fuel_cost_local } else { 0.0 },
            "currency_code": geo.currency_code,
            "currency_symbol": geo.currency_symbol,
        },
        // Contexte géographique détecté
        "geo_context": {
            "region": geo.region_name,
            "country": geo.country_hint,
            "currency_code": geo.currency_code,
            "currency_symbol": geo.currency_symbol,
            "language": geo.language_hint,
        },
        // Niveau de fitness
        "fitness": {
            "vo2max_estimate": (vo2max_estimate * 10.0).round() / 10.0,
            "level": fitness_level,
            "active_minutes_week": weekly_active_min.round(),
            "oms_target_minutes": 150,
            "oms_progress_pct": (weekly_active_min / 150.0 * 100.0).min(100.0).round(),
        },
        // Streak & gamification
        "gamification": {
            "current_streak": current_streak,
            "max_streak": max_streak,
            "total_points": (total_km * 10.0 + total_cal * 0.1 + total_sessions as f64 * 50.0 + total_reported as f64 * 100.0).round() as i64,
            "badges": badges_json,
            "new_badges": new_badges.iter().map(|(t, l, e, label)| serde_json::json!({
                "type": t, "level": l, "emoji": e, "label": label
            })).collect::<Vec<_>>(),
        },
        // Défis
        "challenges": challenges_json,
        // Commute insights
        "commute": {
            "frequent_routes": commute_json,
            "peak_hours": peak_hours,
        },
        // Score de santé global
        "health_score": {
            "score": health_score,
            "label": health_label,
            "breakdown": {
                "activity": (weekly_active_min / 150.0 * 30.0).min(30.0).round(),
                "quality": (avg_quality / 100.0 * 20.0).min(20.0).round(),
                "streak": (current_streak as f64 * 3.0).min(15.0).round(),
                "eco": if co2_saved_g > 0.0 { 10.0 } else { 0.0 },
                "fitness": (vo2max_estimate / 50.0 * 15.0).min(15.0).round(),
                "diversity": if co2_data.len() > 1 { 10.0 } else { 5.0 },
            },
        },
        // Recommandations IA (règles + tips)
        "ai_tips": ai_tips,
        // Analyse IA profonde (LLM réel: GPT-4o / Claude / Gemini)
        "ai_deep": ai_deep_analysis,
    })))
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ✅ NOUVEAU 2026-03-05: Push notifications IA navigation (alertes périodiques)
// Envoi de notifications push aux utilisateurs inactifs, streak cassé, résumé hebdo
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/// Vérification périodique et envoi de push notifications IA navigation
/// Appelé par un cron/scheduler ou manuellement par admin
/// Vérifie: inactivité, streak cassé, objectif OMS, résumé hebdomadaire
async fn check_and_send_navigation_push_alerts(
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let now = chrono::Utc::now();
    let since_3d = now - chrono::Duration::days(3);
    let since_7d = now - chrono::Duration::days(7);
    let mut total_sent = 0i32;
    let mut alerts_detail: Vec<serde_json::Value> = Vec::new();

    // Helper: envoie push + convertit immédiatement en Option (drop Box<dyn Error> non-Send)
    async fn send_push(
        pool: &sqlx::PgPool,
        uid: i32,
        t: String,
        b: String,
        d: Option<serde_json::Value>,
    ) -> Option<usize> {
        crate::services::push_notification_service::send_push_notification(
            pool,
            uid,
            t,
            b,
            d,
            Some("default".to_string()),
        )
        .await
        .ok()
    }

    // 1. Utilisateurs inactifs depuis 3+ jours
    let inactive_users = sqlx::query_as::<_, (i32,)>(
        r#"SELECT DISTINCT nal.user_id
           FROM navigation_activity_log nal
           WHERE nal.user_id NOT IN (
               SELECT DISTINCT user_id FROM navigation_activity_log WHERE started_at >= $1
           )
           AND nal.started_at >= $2
           LIMIT 100"#,
    )
    .bind(since_3d)
    .bind(since_7d)
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    for (user_id,) in &inactive_users {
        let last_activity = sqlx::query_as::<_, (chrono::DateTime<chrono::Utc>,)>(
            "SELECT MAX(started_at) FROM navigation_activity_log WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten();

        let days_inactive = last_activity.map(|(d,)| (now - d).num_days()).unwrap_or(99);

        let (title, body) = if days_inactive >= 7 {
            ("⚠️ Semaine inactive".to_string(),
             "Aucune activité cette semaine. Même 10 min de marche font une différence ! Ouvrez Yukpo Navigation.".to_string())
        } else if days_inactive >= 3 {
            (
                "🔥 Votre série est en danger !".to_string(),
                format!(
                    "Vous n'avez pas bougé depuis {} jours. Un petit trajet suffit ! 🏃",
                    days_inactive
                ),
            )
        } else {
            continue;
        };

        let data = serde_json::json!({
            "type": "navigation_alert",
            "alert_type": if days_inactive >= 7 { "inactive_week" } else { "streak_warning" },
            "days_inactive": days_inactive, "screen": "Navigation",
        });

        if let Some(count) =
            send_push(&state.pg, *user_id, title.clone(), body.clone(), Some(data)).await
        {
            if count > 0 {
                total_sent += count as i32;
                alerts_detail.push(serde_json::json!({"user_id": user_id, "type": "inactivity", "days": days_inactive, "sent": count}));
                let _ = crate::services::notification_service::create_notification(
                    &state.pg,
                    *user_id,
                    crate::services::notification_service::NotificationType::SystemAlert,
                    title,
                    body,
                    None,
                )
                .await;
            }
        }
    }

    // 2. Résumé hebdomadaire (mercredi)
    let weekday = now.weekday().num_days_from_monday();
    if weekday == 2 {
        let active_users = sqlx::query_as::<_, (i32, f64, i64, f64)>(
            r#"SELECT user_id, COALESCE(SUM(distance_meters),0)::float8,
                      COUNT(*)::bigint, COALESCE(SUM(calories_burned),0)::float8
               FROM navigation_activity_log WHERE started_at >= $1
               GROUP BY user_id LIMIT 200"#,
        )
        .bind(since_7d)
        .fetch_all(&state.pg)
        .await
        .unwrap_or_default();

        for (user_id, dist_m, sessions, calories) in &active_users {
            let dist_km = dist_m / 1000.0;
            let title = "📊 Votre résumé mi-semaine".to_string();
            let body = format!(
                "Cette semaine: {:.1} km · {} sessions · {:.0} kcal. Continuez ! 💪",
                dist_km, sessions, calories
            );
            let data = serde_json::json!({"type": "navigation_alert", "alert_type": "weekly_summary", "screen": "Navigation"});

            if let Some(count) = send_push(&state.pg, *user_id, title, body, Some(data)).await {
                if count > 0 {
                    total_sent += count as i32;
                    alerts_detail.push(serde_json::json!({"user_id": user_id, "type": "weekly_summary", "sent": count}));
                }
            }
        }
    }

    // 3. Badge presque atteint
    let near_badge_users = sqlx::query_as::<_, (i32, f64, i64)>(
        r#"SELECT user_id, COALESCE(SUM(distance_meters),0)::float8, COUNT(*)::bigint
           FROM navigation_activity_log GROUP BY user_id
           HAVING COALESCE(SUM(distance_meters),0) BETWEEN 8000 AND 9999
              OR COALESCE(SUM(distance_meters),0) BETWEEN 45000 AND 49999
              OR COUNT(*) BETWEEN 8 AND 9 OR COUNT(*) BETWEEN 45 AND 49
           LIMIT 50"#,
    )
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    for (user_id, dist_m, sessions) in &near_badge_users {
        let dist_km = dist_m / 1000.0;
        let (title, body) = if dist_km >= 45.0 && dist_km < 50.0 {
            (
                "🏅 Badge Aventurier à portée !".to_string(),
                format!(
                    "Plus que {:.1} km pour le badge Aventurier (50 km) ! 🥇",
                    50.0 - dist_km
                ),
            )
        } else if dist_km >= 8.0 && dist_km < 10.0 {
            (
                "🏅 Badge Explorateur bientôt !".to_string(),
                format!(
                    "Plus que {:.1} km pour le badge Explorateur (10 km) ! 🥈",
                    10.0 - dist_km
                ),
            )
        } else if *sessions >= 8 && *sessions < 10 {
            (
                "🏅 Badge Habitué en vue !".to_string(),
                format!(
                    "Plus que {} session(s) pour le badge Habitué (10) ! 🌿",
                    10 - sessions
                ),
            )
        } else {
            continue;
        };

        let data = serde_json::json!({"type": "navigation_alert", "alert_type": "near_badge", "screen": "Navigation"});
        if let Some(count) = send_push(&state.pg, *user_id, title, body, Some(data)).await {
            if count > 0 {
                total_sent += count as i32;
                alerts_detail.push(
                    serde_json::json!({"user_id": user_id, "type": "near_badge", "sent": count}),
                );
            }
        }
    }

    log::info!("[Navigation Push] ✅ {} notifications envoyées", total_sent);
    Json(
        serde_json::json!({"success": true, "total_sent": total_sent, "inactive_users_checked": inactive_users.len(), "alerts": alerts_detail}),
    )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ✅ NOUVEAU 2026-03-05: Page publique de partage performances navigation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/// Page HTML publique pour partager ses performances navigation
/// Sert une page avec OG meta tags pour un joli preview WhatsApp/Facebook/Twitter
async fn share_navigation_performance(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<i32>,
) -> impl axum::response::IntoResponse {
    // Récupérer les stats globales de l'utilisateur
    let stats = sqlx::query_as::<_, (f64, i64, f64, f64, f64)>(
        r#"SELECT COALESCE(SUM(distance_meters),0)::float8,
                  COUNT(*)::bigint,
                  COALESCE(SUM(calories_burned),0)::float8,
                  COALESCE(AVG(avg_speed_kmh),0)::float8,
                  COALESCE(MAX(max_speed_kmh),0)::float8
           FROM navigation_activity_log WHERE user_id = $1"#,
    )
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten()
    .unwrap_or((0.0, 0, 0.0, 0.0, 0.0));

    let (dist_m, sessions, calories, avg_speed, max_speed) = stats;
    let dist_km = dist_m / 1000.0;

    // Badges count
    let badges: i64 = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*)::bigint FROM navigation_user_achievements WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten()
    .map(|r| r.0)
    .unwrap_or(0);

    // Username
    let username: String = sqlx::query_as::<_, (String,)>(
        "SELECT COALESCE(name, email, 'Utilisateur Yukpo') FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten()
    .map(|r| r.0)
    .unwrap_or_else(|| "Utilisateur Yukpo".to_string());

    let title = format!("{} sur Yukpo Navigation", username);
    let description = format!(
        "{:.1} km parcourus · {} sessions · {:.0} kcal brûlées · {} badges · Vitesse max {:.1} km/h",
        dist_km, sessions, calories, badges, max_speed
    );

    let mut html = String::new();
    html.push_str("<!DOCTYPE html><html lang='fr'><head><meta charset='UTF-8'>");
    html.push_str("<meta name='viewport' content='width=device-width, initial-scale=1.0'>");
    html.push_str(&format!("<title>{}</title>", title));
    // OG Meta tags pour preview WhatsApp/Facebook/Twitter
    html.push_str(&format!("<meta property='og:title' content='{}'/>", title));
    html.push_str(&format!(
        "<meta property='og:description' content='{}'/>",
        description
    ));
    html.push_str("<meta property='og:type' content='website'/>");
    html.push_str("<meta property='og:image' content='https://storage.googleapis.com/yukpo-project-yukpo-backend-media/yukpo-logo.png'/>");
    html.push_str(&format!(
        "<meta name='twitter:card' content='summary'/><meta name='twitter:title' content='{}'/>",
        title
    ));
    html.push_str(&format!(
        "<meta name='twitter:description' content='{}'/>",
        description
    ));
    html.push_str("<style>");
    html.push_str("*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:linear-gradient(135deg,#0F172A 0%,#1E293B 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;color:#fff;padding:20px}");
    html.push_str(".card{background:rgba(255,255,255,0.08);backdrop-filter:blur(20px);border-radius:24px;padding:32px;max-width:420px;width:100%;border:1px solid rgba(255,255,255,0.1)}");
    html.push_str(".header{text-align:center;margin-bottom:24px}h1{font-size:22px;font-weight:800;margin-bottom:4px}h2{font-size:14px;color:#94A3B8;font-weight:400}");
    html.push_str(".stats{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}");
    html.push_str(".stat{background:rgba(255,255,255,0.05);border-radius:16px;padding:16px;text-align:center;border-left:3px solid}");
    html.push_str(".stat-value{font-size:28px;font-weight:900;line-height:1}.stat-label{font-size:12px;color:#94A3B8;margin-top:4px}");
    html.push_str(".cta{display:block;text-align:center;background:linear-gradient(135deg,#3B82F6,#6366F1);color:#fff;text-decoration:none;padding:14px;border-radius:14px;font-weight:700;font-size:16px;margin-top:8px}");
    html.push_str(".badge-row{display:flex;gap:8px;justify-content:center;margin:16px 0;flex-wrap:wrap}.badge{background:rgba(251,191,36,0.15);color:#FBB024;padding:6px 12px;border-radius:20px;font-size:13px;font-weight:700}");
    html.push_str("</style></head><body><div class='card'>");
    html.push_str("<div class='header'>");
    html.push_str(&format!("<h1>🏃 {}</h1>", username));
    html.push_str("<h2>Performances Navigation Yukpo</h2></div>");
    html.push_str("<div class='stats'>");
    html.push_str(&format!("<div class='stat' style='border-color:#10B981'><div class='stat-value'>{:.1}</div><div class='stat-label'>km parcourus</div></div>", dist_km));
    html.push_str(&format!("<div class='stat' style='border-color:#6366F1'><div class='stat-value'>{}</div><div class='stat-label'>sessions</div></div>", sessions));
    html.push_str(&format!("<div class='stat' style='border-color:#EF4444'><div class='stat-value'>{:.0}</div><div class='stat-label'>kcal brûlées</div></div>", calories));
    html.push_str(&format!("<div class='stat' style='border-color:#F59E0B'><div class='stat-value'>{:.1}</div><div class='stat-label'>km/h max</div></div>", max_speed));
    html.push_str("</div>");
    html.push_str(&format!("<div class='badge-row'><span class='badge'>🏅 {} badges</span><span class='badge'>⚡ {:.1} km/h moy</span></div>", badges, avg_speed));
    // Deep link: tente d'ouvrir l'app, sinon redirige vers le store
    let deep_link = format!("yukpomnang://navigation?tab=stats&userId={}", user_id);
    let intent_url = format!("intent://navigation?tab=stats&userId={}#Intent;scheme=yukpomnang;package=com.yukpomnang.mobile;end", user_id);
    let store_url = "https://play.google.com/store/apps/details?id=com.yukpomnang";
    html.push_str(&format!(
        "<a class='cta' id='openApp' href='{}'>Ouvrir dans Yukpo 🚀</a>",
        deep_link
    ));
    html.push_str(&format!(
        "<a class='cta' style='background:#475569;margin-top:8px' href='{}'>Télécharger Yukpo</a>",
        store_url
    ));
    // Auto-redirect: essaie le deep link, puis intent://, puis store
    html.push_str("<script>");
    html.push_str(&format!(
        "var dl='{}',intent='{}',store='{}';",
        deep_link, intent_url, store_url
    ));
    html.push_str("var ua=navigator.userAgent||'';");
    html.push_str("if(/android/i.test(ua)){document.getElementById('openApp').href=intent;setTimeout(function(){window.location=intent;},100);setTimeout(function(){window.location=store;},2000);}");
    html.push_str("else if(/iphone|ipad|ipod/i.test(ua)){window.location=dl;setTimeout(function(){window.location=store;},1500);}");
    html.push_str("</script>");
    html.push_str("</div></body></html>");

    axum::response::Html(html)
}

/// Page HTML publique pour partager un itinéraire navigation
/// Sert une page avec OG meta tags + deep link pour ouvrir l'app avec la destination pré-remplie
#[derive(Deserialize)]
struct ShareRouteQuery {
    dest_lat: f64,
    dest_lng: f64,
    dest_name: Option<String>,
    distance: Option<String>,
    duration: Option<String>,
    mode: Option<String>,
    origin_name: Option<String>,
}

async fn share_navigation_route(
    Query(params): Query<ShareRouteQuery>,
) -> impl axum::response::IntoResponse {
    let dest_name = params.dest_name.as_deref().unwrap_or("Destination");
    let origin_name = params.origin_name.as_deref().unwrap_or("Ma position");
    let distance = params.distance.as_deref().unwrap_or("");
    let duration = params.duration.as_deref().unwrap_or("");
    let mode = params.mode.as_deref().unwrap_or("driving");
    let mode_emoji = match mode {
        "walking" => "🚶",
        "bicycling" => "🚲",
        "transit" => "🚌",
        _ => "🚗",
    };

    let title = format!("{} Itinéraire vers {}", mode_emoji, dest_name);
    let description = if !distance.is_empty() && !duration.is_empty() {
        format!(
            "{} → {} · {} · {}",
            origin_name, dest_name, distance, duration
        )
    } else {
        format!("{} → {}", origin_name, dest_name)
    };

    let deep_link = format!(
        "yukpomnang://navigate?dest_lat={}&dest_lng={}&dest_name={}&mode={}",
        params.dest_lat,
        params.dest_lng,
        urlencoding::encode(dest_name),
        mode
    );
    let intent_url = format!(
        "intent://navigate?dest_lat={}&dest_lng={}&dest_name={}&mode={}#Intent;scheme=yukpomnang;package=com.yukpomnang.mobile;end",
        params.dest_lat, params.dest_lng, urlencoding::encode(dest_name), mode
    );
    let gmaps_url = format!(
        "https://www.google.com/maps/dir/?api=1&destination={},{}&travelmode={}",
        params.dest_lat, params.dest_lng, mode
    );
    let store_url = "https://play.google.com/store/apps/details?id=com.yukpomnang";

    let mut html = String::new();
    html.push_str("<!DOCTYPE html><html lang='fr'><head><meta charset='UTF-8'>");
    html.push_str("<meta name='viewport' content='width=device-width, initial-scale=1.0'>");
    html.push_str(&format!("<title>{}</title>", title));
    html.push_str(&format!("<meta property='og:title' content='{}'>", title));
    html.push_str(&format!(
        "<meta property='og:description' content='{}'>",
        description
    ));
    html.push_str("<meta property='og:type' content='website'>");
    html.push_str("<meta property='og:image' content='https://storage.googleapis.com/yukpo-project-yukpo-backend-media/yukpo-logo.png'>");
    html.push_str(&format!(
        "<meta name='twitter:card' content='summary'><meta name='twitter:title' content='{}'>",
        title
    ));
    html.push_str(&format!(
        "<meta name='twitter:description' content='{}'>",
        description
    ));
    html.push_str("<style>");
    html.push_str("*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:linear-gradient(135deg,#0F172A,#1E293B);min-height:100vh;display:flex;align-items:center;justify-content:center;color:#fff;padding:20px}");
    html.push_str(".card{background:rgba(255,255,255,0.08);backdrop-filter:blur(20px);border-radius:24px;padding:32px;max-width:420px;width:100%;border:1px solid rgba(255,255,255,0.1)}");
    html.push_str(".header{text-align:center;margin-bottom:20px}h1{font-size:20px;font-weight:800;margin-bottom:4px}h2{font-size:14px;color:#94A3B8;font-weight:400}");
    html.push_str(".route-info{background:rgba(255,255,255,0.05);border-radius:16px;padding:16px;margin-bottom:16px;border-left:4px solid #3B82F6}");
    html.push_str(".route-label{font-size:12px;color:#94A3B8}.route-val{font-size:16px;font-weight:700;margin-top:2px}");
    html.push_str(
        ".metrics{display:flex;gap:16px;justify-content:center;margin:16px 0;flex-wrap:wrap}",
    );
    html.push_str(".metric{background:rgba(255,255,255,0.05);padding:12px 16px;border-radius:12px;text-align:center}.metric-val{font-size:20px;font-weight:900}.metric-lbl{font-size:11px;color:#94A3B8;margin-top:2px}");
    html.push_str(".cta{display:block;text-align:center;color:#fff;text-decoration:none;padding:14px;border-radius:14px;font-weight:700;font-size:16px;margin-top:8px}");
    html.push_str("</style></head><body><div class='card'>");
    html.push_str(&format!(
        "<div class='header'><h1>{} Itinéraire</h1><h2>Partagé via Yukpo Navigation</h2></div>",
        mode_emoji
    ));
    html.push_str("<div class='route-info'>");
    html.push_str(&format!(
        "<div class='route-label'>📍 Départ</div><div class='route-val'>{}</div>",
        origin_name
    ));
    html.push_str(&format!("<div class='route-label' style='margin-top:12px'>🏁 Destination</div><div class='route-val'>{}</div>", dest_name));
    html.push_str("</div>");
    if !distance.is_empty() || !duration.is_empty() {
        html.push_str("<div class='metrics'>");
        if !distance.is_empty() {
            html.push_str(&format!("<div class='metric'><div class='metric-val'>{}</div><div class='metric-lbl'>Distance</div></div>", distance));
        }
        if !duration.is_empty() {
            html.push_str(&format!("<div class='metric'><div class='metric-val'>{}</div><div class='metric-lbl'>Durée</div></div>", duration));
        }
        html.push_str("</div>");
    }
    html.push_str(&format!("<a class='cta' id='openApp' style='background:linear-gradient(135deg,#3B82F6,#6366F1)' href='{}'>Ouvrir dans Yukpo 🚀</a>", deep_link));
    html.push_str(&format!("<a class='cta' style='background:#475569;margin-top:8px' href='{}'>Ouvrir dans Google Maps</a>", gmaps_url));
    // Auto-redirect JS
    html.push_str("<script>");
    html.push_str(&format!(
        "var dl='{}',intent='{}',gmaps='{}',store='{}';",
        deep_link, intent_url, gmaps_url, store_url
    ));
    html.push_str("var ua=navigator.userAgent||'';");
    html.push_str("if(/android/i.test(ua)){document.getElementById('openApp').href=intent;setTimeout(function(){window.location=intent;},100);setTimeout(function(){window.location=store;},2500);}");
    html.push_str("else if(/iphone|ipad|ipod/i.test(ua)){window.location=dl;setTimeout(function(){window.location=store;},1500);}");
    html.push_str("</script>");
    html.push_str("</div></body></html>");

    axum::response::Html(html)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ✅ NOUVEAU 2026-03-05: Analyse IA des checkpoints (alertes contextuelles)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/// Analyse IA contextuelle des checkpoints sur un trajet
/// Génère des alertes intelligentes basées sur la densité, l'historique et le contexte
async fn get_checkpoint_ai_analysis(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Query(params): Query<CheckpointsAlongRouteQuery>,
) -> AppResult<Json<serde_json::Value>> {
    // 1. Récupérer les checkpoints actifs dans la zone
    let min_lat = params.origin_lat.min(params.dest_lat) - 0.01;
    let max_lat = params.origin_lat.max(params.dest_lat) + 0.01;
    let min_lng = params.origin_lng.min(params.dest_lng) - 0.01;
    let max_lng = params.origin_lng.max(params.dest_lng) + 0.01;

    let checkpoints = sqlx::query_as::<
        _,
        (
            String,
            f64,
            f64,
            Option<String>,
            Option<i32>,
            i32,
            i32,
            bool,
            chrono::DateTime<chrono::Utc>,
        ),
    >(
        r#"SELECT checkpoint_type, latitude, longitude, description, speed_limit,
                  upvotes, downvotes, is_permanent, created_at
           FROM navigation_checkpoints
           WHERE is_active = true AND latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4
           ORDER BY created_at DESC LIMIT 30"#,
    )
    .bind(min_lat)
    .bind(max_lat)
    .bind(min_lng)
    .bind(max_lng)
    .fetch_all(&state.pg)
    .await?;

    // 2. Statistiques historiques de la zone (dernières 24h, 7j, 30j)
    let now = chrono::Utc::now();
    let since_24h = now - chrono::Duration::hours(24);
    let since_7d = now - chrono::Duration::days(7);

    let zone_stats_24h = sqlx::query_as::<_, (String, i64)>(
        r#"SELECT checkpoint_type, COUNT(*)::bigint
           FROM navigation_checkpoints
           WHERE latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4
             AND created_at >= $5
           GROUP BY checkpoint_type"#,
    )
    .bind(min_lat)
    .bind(max_lat)
    .bind(min_lng)
    .bind(max_lng)
    .bind(since_24h)
    .fetch_all(&state.pg)
    .await?;

    let zone_stats_7d = sqlx::query_as::<_, (String, i64)>(
        r#"SELECT checkpoint_type, COUNT(*)::bigint
           FROM navigation_checkpoints
           WHERE latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4
             AND created_at >= $5
           GROUP BY checkpoint_type"#,
    )
    .bind(min_lat)
    .bind(max_lat)
    .bind(min_lng)
    .bind(max_lng)
    .bind(since_7d)
    .fetch_all(&state.pg)
    .await?;

    // 3. Construire le contexte pour l'IA
    let cp_summary: Vec<String> = checkpoints
        .iter()
        .map(|(ctype, lat, lng, desc, _speed, up, down, perm, created)| {
            format!(
                "{} à ({:.4},{:.4}) — votes:{}/{}  perm:{} — {} — {}",
                ctype,
                lat,
                lng,
                up,
                down,
                perm,
                desc.as_deref().unwrap_or(""),
                created.format("%H:%M")
            )
        })
        .collect();

    let stats_24h_str: Vec<String> =
        zone_stats_24h.iter().map(|(t, c)| format!("{}: {}", t, c)).collect();
    let stats_7d_str: Vec<String> =
        zone_stats_7d.iter().map(|(t, c)| format!("{}: {}", t, c)).collect();

    let hour = now.format("%H:%M").to_string();

    // 4. Détection contexte géographique à partir des coordonnées du trajet
    let checkpoint_geo = GeoContext::from_lat_lng(params.origin_lat, params.origin_lng);

    // 5. Prompt IA pour analyse contextuelle des checkpoints
    let prompt = format!(
        r#"{security_intro}

CHECKPOINTS ACTIFS SUR CE TRAJET ({count} signalements):
{checkpoints_list}

STATISTIQUES DE LA ZONE:
- Dernières 24h: {stats_24h}
- Derniers 7 jours: {stats_7d}

CONTEXTE: Heure actuelle: {hour} | Trajet: ({olat:.4},{olng:.4}) → ({dlat:.4},{dlng:.4})

INSTRUCTIONS (JSON strict):
1. Évalue le niveau de risque global du trajet (1-10)
2. Identifie les zones à risque (clusters de checkpoints)
3. Génère 2-3 alertes contextuelles pertinentes pour le conducteur
4. Analyse les patterns temporels (plus de contrôles le matin? le soir?)
5. Conseil de conduite adapté à la situation

FORMAT:
{{
  "risk_level": 5,
  "risk_label": "Modéré|Faible|Élevé|Très élevé",
  "alerts": [
    {{"type": "radar|police|accident|danger|road_works", "message": "...", "severity": "info|warning|critical"}},
    {{"type": "...", "message": "...", "severity": "..."}}
  ],
  "zone_analysis": "Analyse courte de la zone (2 phrases max)",
  "driving_tip": "Conseil de conduite concret pour ce trajet",
  "pattern": "Observation sur les patterns temporels (1 phrase)"
}}

IMPORTANT: Retourne UNIQUEMENT le JSON."#,
        security_intro = checkpoint_geo.security_prompt_context(),
        count = checkpoints.len(),
        checkpoints_list = if cp_summary.is_empty() {
            "Aucun signalement actif".to_string()
        } else {
            cp_summary.join("\n")
        },
        stats_24h = if stats_24h_str.is_empty() {
            "Aucun".to_string()
        } else {
            stats_24h_str.join(", ")
        },
        stats_7d = if stats_7d_str.is_empty() {
            "Aucun".to_string()
        } else {
            stats_7d_str.join(", ")
        },
        hour = hour,
        olat = params.origin_lat,
        olng = params.origin_lng,
        dlat = params.dest_lat,
        dlng = params.dest_lng,
    );

    // 6. Appel IA
    let ai_analysis = match state.ia.predict(&prompt).await {
        Ok((_model, response, _tokens)) => {
            let json_str = if let Some(start) = response.find('{') {
                if let Some(end) = response.rfind('}') {
                    &response[start..=end]
                } else {
                    &response
                }
            } else {
                &response
            };
            serde_json::from_str::<serde_json::Value>(json_str).ok()
        }
        Err(e) => {
            log::warn!("[Checkpoint AI] LLM indisponible: {}", e);
            None
        }
    };

    // 6. Fallback règles si LLM indisponible
    let response = if let Some(analysis) = ai_analysis {
        analysis
    } else {
        let risk = checkpoints.len().min(10) as i32;
        let risk_label = if risk >= 7 {
            "Très élevé"
        } else if risk >= 4 {
            "Élevé"
        } else if risk >= 2 {
            "Modéré"
        } else {
            "Faible"
        };
        let mut alerts: Vec<serde_json::Value> = Vec::new();
        let radar_count = checkpoints.iter().filter(|(t, ..)| t == "radar").count();
        let police_count = checkpoints.iter().filter(|(t, ..)| t == "police").count();
        let accident_count = checkpoints.iter().filter(|(t, ..)| t == "accident").count();
        if radar_count > 0 {
            alerts.push(serde_json::json!({"type": "radar", "message": format!("{} radar(s) signalé(s) sur votre trajet. Respectez les limitations.", radar_count), "severity": "warning"}));
        }
        let transport_count = checkpoints.iter().filter(|(t, ..)| t == "transport_control").count();
        if police_count > 0 {
            alerts.push(serde_json::json!({"type": "police", "message": format!("{} contrôle(s) police/gendarmerie signalé(s). Vérifiez vos documents.", police_count), "severity": "warning"}));
        }
        let road_check_count = checkpoints.iter().filter(|(t, ..)| t == "road_check").count();
        if transport_count > 0 {
            alerts.push(serde_json::json!({"type": "transport_control", "message": format!("{} contrôle(s) du ministère des transports signalé(s). Préparez carte grise et assurance.", transport_count), "severity": "warning"}));
        }
        if road_check_count > 0 {
            alerts.push(serde_json::json!({"type": "road_check", "message": format!("{} contrôle(s) routier(s) signalé(s). Préparez permis, carte grise et assurance.", road_check_count), "severity": "warning"}));
        }
        if accident_count > 0 {
            alerts.push(serde_json::json!({"type": "accident", "message": format!("{} accident(s) signalé(s). Redoublez de prudence.", accident_count), "severity": "critical"}));
        }
        serde_json::json!({
            "risk_level": risk,
            "risk_label": risk_label,
            "alerts": alerts,
            "zone_analysis": format!("{} signalements actifs dans cette zone.", checkpoints.len()),
            "driving_tip": "Restez vigilant et respectez les limitations de vitesse.",
            "pattern": null,
        })
    };

    Ok(Json(serde_json::json!({
        "success": true,
        "checkpoint_count": checkpoints.len(),
        "analysis": response,
    })))
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ✅ NOUVEAU 2026-03-05: Système de signalement communautaire (radars, contrôles, dangers)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#[derive(Deserialize)]
struct ReportCheckpointRequest {
    checkpoint_type: String, // radar, police, accident, danger, road_works, speed_bump
    latitude: f64,
    longitude: f64,
    description: Option<String>,
    speed_limit: Option<i32>,
    is_permanent: Option<bool>,
}

#[derive(Serialize, sqlx::FromRow)]
struct CheckpointRow {
    id: uuid::Uuid,
    checkpoint_type: String,
    latitude: f64,
    longitude: f64,
    description: Option<String>,
    speed_limit: Option<i32>,
    is_permanent: bool,
    upvotes: i32,
    downvotes: i32,
    created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize)]
struct CheckpointResponse {
    id: String,
    checkpoint_type: String,
    latitude: f64,
    longitude: f64,
    description: Option<String>,
    speed_limit: Option<i32>,
    is_permanent: bool,
    confidence: f64, // upvotes / (upvotes + downvotes)
    distance_from_route_meters: Option<f64>,
    created_at: String,
}

#[derive(Deserialize)]
struct CheckpointsAlongRouteQuery {
    origin_lat: f64,
    origin_lng: f64,
    dest_lat: f64,
    dest_lng: f64,
    #[allow(dead_code)]
    polyline: Option<String>, // encoded polyline for precise matching
}

#[derive(Deserialize)]
struct VoteCheckpointRequest {
    vote: String, // "up" or "down"
}

/// Signaler un radar/contrôle/danger
async fn report_checkpoint(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(request): Json<ReportCheckpointRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let valid_types = [
        "radar",
        "police",
        "transport_control",
        "road_check",
        "accident",
        "danger",
        "road_works",
        "speed_bump",
    ];
    if !valid_types.contains(&request.checkpoint_type.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Type invalide. Utilisez: {}",
            valid_types.join(", ")
        )));
    }

    // Expiration différenciée par type d'alerte
    let is_permanent = request.is_permanent.unwrap_or(false);
    let expires_at = if is_permanent {
        None
    } else {
        let hours = match request.checkpoint_type.as_str() {
            "road_works" => 24, // Travaux: durent longtemps
            "speed_bump" => 0,  // Ralentisseur: permanent par nature (traité ci-dessous)
            "radar" | "police" | "transport_control" | "road_check" => 4, // Contrôles: quelques heures
            "danger" => 3,   // Danger: modérément persistant
            "accident" => 2, // Accident: transitoire
            _ => 2,          // Par défaut: 2h
        };
        if hours == 0 {
            None
        } else {
            Some(chrono::Utc::now() + chrono::Duration::hours(hours))
        }
    };

    let row = sqlx::query_as::<_, CheckpointRow>(
        r#"
        INSERT INTO navigation_checkpoints (
            reported_by, checkpoint_type, latitude, longitude,
            description, speed_limit, is_permanent, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, checkpoint_type, latitude, longitude, description,
                  speed_limit, is_permanent, upvotes, downvotes, created_at
        "#,
    )
    .bind(user.id)
    .bind(&request.checkpoint_type)
    .bind(request.latitude)
    .bind(request.longitude)
    .bind(&request.description)
    .bind(request.speed_limit)
    .bind(is_permanent)
    .bind(expires_at)
    .fetch_one(&state.pg)
    .await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "checkpoint": {
            "id": row.id.to_string(),
            "type": row.checkpoint_type,
            "latitude": row.latitude,
            "longitude": row.longitude,
        }
    })))
}

/// Obtenir les checkpoints le long d'un trajet (dans un rayon de 500m de la ligne directe)
async fn get_checkpoints_along_route(
    Query(params): Query<CheckpointsAlongRouteQuery>,
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<serde_json::Value>> {
    // Désactiver les checkpoints expirés
    let _ = sqlx::query(
        "UPDATE navigation_checkpoints SET is_active = false WHERE expires_at IS NOT NULL AND expires_at < NOW() AND is_active = true"
    ).execute(&state.pg).await;

    // Bounding box élargie autour de la route
    let min_lat = params.origin_lat.min(params.dest_lat) - 0.01;
    let max_lat = params.origin_lat.max(params.dest_lat) + 0.01;
    let min_lng = params.origin_lng.min(params.dest_lng) - 0.01;
    let max_lng = params.origin_lng.max(params.dest_lng) + 0.01;

    let rows = sqlx::query_as::<_, CheckpointRow>(
        r#"
        SELECT id, checkpoint_type, latitude, longitude, description,
               speed_limit, is_permanent, upvotes, downvotes, created_at
        FROM navigation_checkpoints
        WHERE is_active = true
          AND latitude BETWEEN $1 AND $2
          AND longitude BETWEEN $3 AND $4
          AND (downvotes < upvotes + 3)
        ORDER BY created_at DESC
        LIMIT 50
        "#,
    )
    .bind(min_lat)
    .bind(max_lat)
    .bind(min_lng)
    .bind(max_lng)
    .fetch_all(&state.pg)
    .await?;

    // Haversine pour filtrer à 500m de la ligne directe
    let haversine = |lat1: f64, lng1: f64, lat2: f64, lng2: f64| -> f64 {
        let r = 6_371_000.0;
        let d_lat = (lat2 - lat1).to_radians();
        let d_lng = (lng2 - lng1).to_radians();
        let a = (d_lat / 2.0).sin().powi(2)
            + lat1.to_radians().cos() * lat2.to_radians().cos() * (d_lng / 2.0).sin().powi(2);
        r * 2.0 * a.sqrt().asin()
    };

    // Point-to-segment distance pour chaque checkpoint
    let checkpoints: Vec<CheckpointResponse> = rows
        .into_iter()
        .filter_map(|row| {
            // Distance minimale à la ligne origin-destination
            let dist = point_to_segment_distance(
                row.latitude,
                row.longitude,
                params.origin_lat,
                params.origin_lng,
                params.dest_lat,
                params.dest_lng,
                &haversine,
            );
            if dist > 500.0 {
                return None;
            } // filtrer > 500m

            let total_votes = (row.upvotes + row.downvotes).max(1) as f64;
            let confidence = row.upvotes as f64 / total_votes;

            Some(CheckpointResponse {
                id: row.id.to_string(),
                checkpoint_type: row.checkpoint_type,
                latitude: row.latitude,
                longitude: row.longitude,
                description: row.description,
                speed_limit: row.speed_limit,
                is_permanent: row.is_permanent,
                confidence,
                distance_from_route_meters: Some(dist),
                created_at: row.created_at.format("%Y-%m-%dT%H:%M:%SZ").to_string(),
            })
        })
        .collect();

    Ok(Json(serde_json::json!({
        "success": true,
        "checkpoints": checkpoints,
        "count": checkpoints.len()
    })))
}

/// Distance d'un point à un segment (approximation)
fn point_to_segment_distance(
    px: f64,
    py: f64,
    ax: f64,
    ay: f64,
    bx: f64,
    by: f64,
    haversine: &dyn Fn(f64, f64, f64, f64) -> f64,
) -> f64 {
    let ab_len = haversine(ax, ay, bx, by);
    if ab_len < 1.0 {
        return haversine(px, py, ax, ay);
    }
    // Project point onto line, clamp to segment
    let t = (((px - ax) * (bx - ax) + (py - ay) * (by - ay))
        / ((bx - ax).powi(2) + (by - ay).powi(2)))
    .max(0.0)
    .min(1.0);
    let proj_lat = ax + t * (bx - ax);
    let proj_lng = ay + t * (by - ay);
    haversine(px, py, proj_lat, proj_lng)
}

/// Voter pour/contre un checkpoint
async fn vote_checkpoint(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(checkpoint_id): Path<Uuid>,
    Json(request): Json<VoteCheckpointRequest>,
) -> AppResult<Json<serde_json::Value>> {
    if request.vote != "up" && request.vote != "down" {
        return Err(AppError::BadRequest(
            "vote doit être 'up' ou 'down'".to_string(),
        ));
    }

    // Upsert le vote
    sqlx::query(
        r#"
        INSERT INTO navigation_checkpoint_votes (checkpoint_id, user_id, vote)
        VALUES ($1, $2, $3)
        ON CONFLICT (checkpoint_id, user_id) DO UPDATE SET vote = $3
        "#,
    )
    .bind(checkpoint_id)
    .bind(user.id)
    .bind(&request.vote)
    .execute(&state.pg)
    .await?;

    // Recalculer les compteurs
    sqlx::query(
        r#"
        UPDATE navigation_checkpoints SET
            upvotes = (SELECT COUNT(*) FROM navigation_checkpoint_votes WHERE checkpoint_id = $1 AND vote = 'up'),
            downvotes = (SELECT COUNT(*) FROM navigation_checkpoint_votes WHERE checkpoint_id = $1 AND vote = 'down'),
            updated_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(checkpoint_id)
    .execute(&state.pg)
    .await?;

    // Désactiver si trop de downvotes
    sqlx::query(
        "UPDATE navigation_checkpoints SET is_active = false WHERE id = $1 AND downvotes > upvotes + 5"
    )
    .bind(checkpoint_id)
    .execute(&state.pg)
    .await?;

    Ok(Json(serde_json::json!({ "success": true })))
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ✅ NOUVEAU 2026-03-05: Endpoints admin configuration régionale dynamique
// Permet de mettre à jour les prix carburant, CO2, etc. sans redéploiement
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/// GET /api/navigation/geo-config — Liste toutes les configurations régionales
async fn get_geo_regional_config(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<serde_json::Value>> {
    // Vérifier que l'utilisateur est admin
    let role: Option<String> = sqlx::query_scalar("SELECT role FROM users WHERE id = $1")
        .bind(user.id)
        .fetch_optional(&state.pg)
        .await?
        .flatten();
    if role.as_deref() != Some("admin") {
        return Err(AppError::Forbidden("Admin uniquement".to_string()));
    }

    let rows = sqlx::query_as::<_, (String, String, String, String, String, f64, f64, f64, f64, Option<String>, String, Option<String>, Option<chrono::DateTime<chrono::Utc>>)>(
        r#"SELECT country_code, country_name, region_name, currency_code, currency_symbol,
                  fuel_price_per_liter, fuel_consumption_l_100km, co2_car_g_per_km, co2_transit_g_per_km,
                  cultural_context, language_hint, source, updated_at
           FROM geo_regional_config ORDER BY country_name"#,
    ).fetch_all(&state.pg).await?;

    let configs: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            serde_json::json!({
                "country_code": r.0, "country_name": r.1, "region_name": r.2,
                "currency_code": r.3, "currency_symbol": r.4,
                "fuel_price_per_liter": r.5, "fuel_consumption_l_100km": r.6,
                "co2_car_g_per_km": r.7, "co2_transit_g_per_km": r.8,
                "cultural_context": r.9, "language_hint": r.10,
                "source": r.11, "updated_at": r.12,
            })
        })
        .collect();

    Ok(Json(
        serde_json::json!({ "success": true, "count": configs.len(), "configs": configs }),
    ))
}

#[derive(serde::Deserialize)]
struct UpdateGeoConfigRequest {
    fuel_price_per_liter: Option<f64>,
    fuel_consumption_l_100km: Option<f64>,
    co2_car_g_per_km: Option<f64>,
    co2_transit_g_per_km: Option<f64>,
    cultural_context: Option<String>,
    country_name: Option<String>,
    region_name: Option<String>,
    currency_code: Option<String>,
    currency_symbol: Option<String>,
    language_hint: Option<String>,
    source: Option<String>,
}

/// PUT /api/navigation/geo-config/{country_code} — Met à jour la config d'un pays
async fn update_geo_regional_config(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    axum::extract::Path(country_code): axum::extract::Path<String>,
    Json(req): Json<UpdateGeoConfigRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let role: Option<String> = sqlx::query_scalar("SELECT role FROM users WHERE id = $1")
        .bind(user.id)
        .fetch_optional(&state.pg)
        .await?
        .flatten();
    if role.as_deref() != Some("admin") {
        return Err(AppError::Forbidden("Admin uniquement".to_string()));
    }

    let cc = country_code.to_uppercase();

    // Construire les SET dynamiques
    let mut sets = Vec::new();
    let mut idx = 2u32; // $1 = country_code

    if req.fuel_price_per_liter.is_some() {
        sets.push(format!("fuel_price_per_liter = ${}", idx));
        idx += 1;
    }
    if req.fuel_consumption_l_100km.is_some() {
        sets.push(format!("fuel_consumption_l_100km = ${}", idx));
        idx += 1;
    }
    if req.co2_car_g_per_km.is_some() {
        sets.push(format!("co2_car_g_per_km = ${}", idx));
        idx += 1;
    }
    if req.co2_transit_g_per_km.is_some() {
        sets.push(format!("co2_transit_g_per_km = ${}", idx));
        idx += 1;
    }
    if req.cultural_context.is_some() {
        sets.push(format!("cultural_context = ${}", idx));
        idx += 1;
    }
    if req.country_name.is_some() {
        sets.push(format!("country_name = ${}", idx));
        idx += 1;
    }
    if req.region_name.is_some() {
        sets.push(format!("region_name = ${}", idx));
        idx += 1;
    }
    if req.currency_code.is_some() {
        sets.push(format!("currency_code = ${}", idx));
        idx += 1;
    }
    if req.currency_symbol.is_some() {
        sets.push(format!("currency_symbol = ${}", idx));
        idx += 1;
    }
    if req.language_hint.is_some() {
        sets.push(format!("language_hint = ${}", idx));
        idx += 1;
    }
    if req.source.is_some() {
        sets.push(format!("source = ${}", idx));
        idx += 1;
    }

    if sets.is_empty() {
        return Ok(Json(
            serde_json::json!({ "success": false, "error": "Aucun champ à mettre à jour" }),
        ));
    }

    sets.push(format!("updated_by = ${}", idx));
    let _idx = idx + 1;
    sets.push("updated_at = NOW()".to_string());

    let sql = format!(
        "UPDATE geo_regional_config SET {} WHERE country_code = $1",
        sets.join(", ")
    );

    let mut query = sqlx::query(&sql).bind(&cc);
    if let Some(v) = req.fuel_price_per_liter {
        query = query.bind(v);
    }
    if let Some(v) = req.fuel_consumption_l_100km {
        query = query.bind(v);
    }
    if let Some(v) = req.co2_car_g_per_km {
        query = query.bind(v);
    }
    if let Some(v) = req.co2_transit_g_per_km {
        query = query.bind(v);
    }
    if let Some(ref v) = req.cultural_context {
        query = query.bind(v);
    }
    if let Some(ref v) = req.country_name {
        query = query.bind(v);
    }
    if let Some(ref v) = req.region_name {
        query = query.bind(v);
    }
    if let Some(ref v) = req.currency_code {
        query = query.bind(v);
    }
    if let Some(ref v) = req.currency_symbol {
        query = query.bind(v);
    }
    if let Some(ref v) = req.language_hint {
        query = query.bind(v);
    }
    if let Some(ref v) = req.source {
        query = query.bind(v);
    }
    query = query.bind(format!("admin:{}", user.id));

    let result = query.execute(&state.pg).await?;

    if result.rows_affected() == 0 {
        // Pays pas encore en DB — insérer
        if let (Some(name), Some(region), Some(cur_code), Some(cur_sym)) = (
            req.country_name.as_ref(),
            req.region_name.as_ref(),
            req.currency_code.as_ref(),
            req.currency_symbol.as_ref(),
        ) {
            sqlx::query(
                r#"INSERT INTO geo_regional_config
                   (country_code, country_name, region_name, currency_code, currency_symbol,
                    fuel_price_per_liter, fuel_consumption_l_100km, co2_car_g_per_km, co2_transit_g_per_km,
                    cultural_context, language_hint, source, updated_by)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)"#,
            )
            .bind(&cc).bind(name).bind(region).bind(cur_code).bind(cur_sym)
            .bind(req.fuel_price_per_liter.unwrap_or(1.5))
            .bind(req.fuel_consumption_l_100km.unwrap_or(8.0))
            .bind(req.co2_car_g_per_km.unwrap_or(120.0))
            .bind(req.co2_transit_g_per_km.unwrap_or(50.0))
            .bind(req.cultural_context.as_deref().unwrap_or(""))
            .bind(req.language_hint.as_deref().unwrap_or("fr"))
            .bind(req.source.as_deref().unwrap_or("admin"))
            .bind(format!("admin:{}", user.id))
            .execute(&state.pg).await?;

            return Ok(Json(
                serde_json::json!({ "success": true, "action": "created", "country_code": cc }),
            ));
        }
        return Ok(Json(
            serde_json::json!({ "success": false, "error": format!("Pays {} non trouvé. Pour créer, fournir country_name, region_name, currency_code, currency_symbol.", cc) }),
        ));
    }

    log::info!("[GeoConfig] Updated {} by admin:{}", cc, user.id);
    Ok(Json(
        serde_json::json!({ "success": true, "action": "updated", "country_code": cc }),
    ))
}

pub fn navigation_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/navigation/geocode", get(geocode_address))
        .route("/api/navigation/place-details", get(get_place_details))
        .route("/api/navigation/routes", post(get_routes))
        .route(
            "/api/navigation/points-of-interest",
            get(get_points_of_interest),
        )
        .route(
            "/api/navigation/trips",
            post(save_trip).layer(middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/navigation/stats",
            get(get_stats).layer(middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/navigation/destinations",
            get(list_destinations).layer(middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/navigation/destinations",
            post(save_destination).layer(middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/navigation/destinations/by-label/{label}",
            get(get_destination_by_label).layer(middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/navigation/destinations/{id}",
            delete(delete_destination).layer(middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/navigation/autocomplete",
            get(autocomplete_with_saved).layer(middleware::from_fn(jwt_auth)),
        )
        // ✅ NOUVEAU: Activité & statistiques intelligentes
        .route(
            "/api/navigation/activity/log",
            post(log_activity).layer(middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/navigation/activity/summary",
            get(get_activity_summary).layer(middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/navigation/activity/history",
            get(get_activity_history).layer(middleware::from_fn(jwt_auth)),
        )
        // ✅ NOUVEAU: Coach IA & analyse avancée
        .route(
            "/api/navigation/activity/ai-insights",
            get(get_ai_insights).layer(middleware::from_fn(jwt_auth)),
        )
        // ✅ NOUVEAU: Checkpoints (radars, contrôles, dangers)
        .route(
            "/api/navigation/checkpoints",
            post(report_checkpoint).layer(middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/navigation/checkpoints/along-route",
            get(get_checkpoints_along_route),
        )
        // ✅ NOUVEAU: Analyse IA contextuelle des checkpoints
        .route(
            "/api/navigation/checkpoints/ai-analysis",
            get(get_checkpoint_ai_analysis).layer(middleware::from_fn(jwt_auth)),
        )
        // ✅ NOUVEAU: Push notifications périodiques navigation (cron/scheduler) — protégé par JWT
        .route(
            "/api/navigation/push-alerts/check",
            get(check_and_send_navigation_push_alerts).layer(middleware::from_fn(jwt_auth)),
        )
        // ✅ NOUVEAU: Pages publiques de partage (pas d'auth, accessible par tous)
        // IMPORTANT: /route doit être AVANT /{user_id} pour éviter que "route" soit capturé comme user_id
        .route("/navigation/share/route", get(share_navigation_route))
        .route(
            "/navigation/share/{user_id}",
            get(share_navigation_performance),
        )
        .route(
            "/api/navigation/checkpoints/{id}/vote",
            post(vote_checkpoint).layer(middleware::from_fn(jwt_auth)),
        )
        // ✅ NOUVEAU: Configuration régionale dynamique (admin)
        .route(
            "/api/navigation/geo-config",
            get(get_geo_regional_config).layer(middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/navigation/geo-config/{country_code}",
            put(update_geo_regional_config).layer(middleware::from_fn(jwt_auth)),
        )
        .with_state(state)
}
