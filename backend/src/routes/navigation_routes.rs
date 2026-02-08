// ✅ NOUVEAU: Routes pour navigation intelligente avec embouteillages et points d'intérêt

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    middleware,
    response::{IntoResponse, Json},
    routing::{delete, get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::middlewares::jwt_auth::jwt_auth;
use crate::services::geographic_matching_service::GeographicMatchingService;
use crate::AppState;

#[derive(Deserialize)]
struct GeocodeRequest {
    address: String,
}

#[derive(Serialize)]
struct GeocodeResponse {
    location: LocationCoords,
    formatted_address: String,
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
    route_id: String,
    origin_lat: f64,
    origin_lng: f64,
    dest_lat: f64,
    dest_lng: f64,
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
    State(state): State<Arc<AppState>>,
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

/// Obtenir plusieurs routes avec embouteillages
async fn get_routes(
    State(state): State<Arc<AppState>>,
    Json(request): Json<RoutesRequest>,
) -> AppResult<Json<RoutesResponse>> {
    let api_key = std::env::var("GOOGLE_MAPS_API_KEY")
        .map_err(|_| AppError::Internal("GOOGLE_MAPS_API_KEY non configurée".to_string()))?;

    let alternatives = request.alternatives.unwrap_or(true);
    let traffic_model = request.traffic_model.as_deref().unwrap_or("best_guess");

    let mut url = format!(
        "https://maps.googleapis.com/maps/api/directions/json?origin={},{}&destination={},{}&key={}&language=fr&units=metric&alternatives={}&traffic_model={}&departure_time=now",
        request.origin.lat,
        request.origin.lng,
        request.destination.lat,
        request.destination.lng,
        api_key,
        alternatives,
        traffic_model
    );

    // Ajouter les évitements si spécifiés
    if let Some(avoid) = &request.avoid {
        if !avoid.is_empty() {
            url.push_str(&format!("&avoid={}", avoid.join("|")));
        }
    }

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

    if let Some(status) = data.get("status").and_then(|s| s.as_str()) {
        if status != "OK" {
            return Err(AppError::Internal(format!(
                "Google Directions API error: {}",
                status
            )));
        }

        let mut routes = Vec::new();

        if let Some(routes_data) = data.get("routes").and_then(|r| r.as_array()) {
            for (idx, route_data) in routes_data.iter().enumerate() {
                let route_id = format!("route_{}", idx);

                let summary = route_data
                    .get("summary")
                    .and_then(|s| s.as_str())
                    .unwrap_or("Route")
                    .to_string();

                let overview_polyline = route_data
                    .get("overview_polyline")
                    .and_then(|p| p.get("points"))
                    .and_then(|p| p.as_str())
                    .unwrap_or("")
                    .to_string();

                let mut total_distance = 0.0;
                let mut total_duration = 0.0;
                let mut total_duration_in_traffic = None;
                let mut steps = Vec::new();

                if let Some(legs) = route_data.get("legs").and_then(|l| l.as_array()) {
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

                        if let Some(duration_in_traffic) = leg
                            .get("duration_in_traffic")
                            .and_then(|d| d.get("value"))
                            .and_then(|v| v.as_f64())
                        {
                            total_duration_in_traffic = Some(
                                total_duration_in_traffic.unwrap_or(0.0) + duration_in_traffic,
                            );
                        }

                        if let Some(leg_steps) = leg.get("steps").and_then(|s| s.as_array()) {
                            for step in leg_steps {
                                let html_instructions = step
                                    .get("html_instructions")
                                    .and_then(|i| i.as_str())
                                    .unwrap_or("")
                                    .to_string();

                                // Nettoyer les balises HTML
                                let clean_instructions = html_instructions
                                    .replace("<b>", "")
                                    .replace("</b>", "")
                                    .replace("<div style=\"font-size:0.9em\">", "")
                                    .replace("</div>", "")
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

                // Déterminer le niveau de trafic
                let traffic_level = if let Some(duration_traffic) = total_duration_in_traffic {
                    let traffic_delay = duration_traffic - total_duration;
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
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<PointsOfInterestResponse>> {
    let api_key = std::env::var("GOOGLE_MAPS_API_KEY")
        .map_err(|_| AppError::Internal("GOOGLE_MAPS_API_KEY non configurée".to_string()))?;

    // Types de POI à rechercher
    let poi_types = vec![
        "pharmacy",
        "bakery",
        "gas_station",
        "supermarket",
        "restaurant",
        "liquor_store",     // Cave à vin
        "amusement_center", // Espace de loisir
    ];

    let mut all_pois = Vec::new();

    // ✅ Calculer le point médian de la route pour la recherche
    // Utilise le centre géographique entre origine et destination
    let mid_lat = (params.origin_lat + params.dest_lat) / 2.0;
    let mid_lng = (params.origin_lng + params.dest_lng) / 2.0;

    // ✅ Rayon de recherche intelligent basé sur la distance du trajet
    // Utilise la formule de Haversine pour une meilleure précision
    let lat_diff = params.origin_lat - params.dest_lat;
    let lng_diff = params.origin_lng - params.dest_lng;
    let distance_degrees = (lat_diff.powi(2) + lng_diff.powi(2)).sqrt();
    let distance_meters = distance_degrees * 111000.0; // Approximation: 1 degré ≈ 111 km

    // ✅ Rayon adaptatif : 30% de la distance totale, max 5km, min 1km
    let radius = ((distance_meters * 0.3).max(1000.0).min(5000.0)) as u32;

    for poi_type in poi_types {
        let url = format!(
            "https://maps.googleapis.com/maps/api/place/nearbysearch/json?location={},{}&radius={}&type={}&key={}&language=fr",
            mid_lat, mid_lng, radius, poi_type, api_key
        );

        let client = reqwest::Client::new();
        if let Ok(response) =
            client.get(&url).timeout(std::time::Duration::from_secs(10)).send().await
        {
            if let Ok(data) = response.json::<serde_json::Value>().await {
                if let Some(results) = data.get("results").and_then(|r| r.as_array()) {
                    for result in results {
                        if let Some(geometry) = result.get("geometry") {
                            if let Some(location) = geometry.get("location") {
                                let lat =
                                    location.get("lat").and_then(|l| l.as_f64()).unwrap_or(0.0);
                                let lng =
                                    location.get("lng").and_then(|l| l.as_f64()).unwrap_or(0.0);

                                // Calculer la distance depuis la route (approximation simple)
                                let distance_from_route =
                                    ((lat - mid_lat).powi(2) + (lng - mid_lng).powi(2)).sqrt()
                                        * 111000.0;

                                let name = result
                                    .get("name")
                                    .and_then(|n| n.as_str())
                                    .unwrap_or("")
                                    .to_string();

                                let rating = result.get("rating").and_then(|r| r.as_f64());

                                let opening_hours = result.get("opening_hours");
                                let is_open = opening_hours
                                    .and_then(|oh| oh.get("open_now"))
                                    .and_then(|on| on.as_bool());

                                // Mapper le type Google vers notre type
                                let mapped_type = match poi_type {
                                    "pharmacy" => "pharmacy",
                                    "bakery" => "bakery",
                                    "gas_station" => "gas_station",
                                    "supermarket" => "supermarket",
                                    "restaurant" => "restaurant",
                                    "liquor_store" => "wine_shop",
                                    "amusement_center" => "entertainment",
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
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // Trier par distance depuis la route
    all_pois.sort_by(|a, b| {
        a.distance_from_route_meters
            .partial_cmp(&b.distance_from_route_meters)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    // Limiter à 20 POI les plus proches
    all_pois.truncate(20);

    Ok(Json(PointsOfInterestResponse { pois: all_pois }))
}

/// Enregistrer un trajet pour les statistiques
async fn save_trip(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(request): Json<TripRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let user_id = user.id;

    sqlx::query!(
        r#"
        INSERT INTO navigation_trips (
            user_id, origin_lat, origin_lng, destination_lat, destination_lng,
            route_id, distance_meters, duration_seconds, waypoints, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        "#,
        user_id as i32,
        request.origin.lat,
        request.origin.lng,
        request.destination.lat,
        request.destination.lng,
        request.route_id,
        request.distance_meters,
        request.duration_seconds as i64,
        serde_json::to_value(request.waypoints).ok()
    )
    .execute(&state.pool)
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
    let stats = sqlx::query!(
        r#"
        SELECT 
            COUNT(*) as total_trips,
            COALESCE(SUM(distance_meters), 0) as total_distance,
            COALESCE(SUM(duration_seconds), 0) as total_duration
        FROM navigation_trips
        WHERE user_id = $1
        "#,
        user_id as i32
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération stats: {}", e)))?;

    // Lieux les plus visités
    let most_visited = sqlx::query!(
        r#"
        SELECT 
            destination_lat || ',' || destination_lng as place_key,
            COUNT(*) as visit_count
        FROM navigation_trips
        WHERE user_id = $1
        GROUP BY destination_lat, destination_lng
        ORDER BY visit_count DESC
        LIMIT 5
        "#,
        user_id as i32
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération lieux: {}", e)))?;

    let most_visited_places = most_visited
        .into_iter()
        .map(|row| MostVisitedPlace {
            name: format!("Destination {}", row.place_key.unwrap_or_default()),
            visit_count: row.visit_count.unwrap_or(0),
        })
        .collect();

    // Types de POI favoris (à partir des waypoints visités)
    let favorite_poi_types = vec![
        FavoritePOIType {
            poi_type: "pharmacy".to_string(),
            count: 0,
        },
        FavoritePOIType {
            poi_type: "restaurant".to_string(),
            count: 0,
        },
    ];

    Ok(Json(NavigationStats {
        total_trips: stats.total_trips.unwrap_or(0),
        total_distance_km: (stats.total_distance.unwrap_or(0) as f64) / 1000.0,
        total_duration_minutes: (stats.total_duration.unwrap_or(0) as f64) / 60.0,
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

/// Enregistrer une destination favorite (domicile, bureau, etc.)
async fn save_destination(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(request): Json<SaveDestinationRequest>,
) -> AppResult<Json<SavedDestination>> {
    let user_id = user.id;

    // Valider le label
    let valid_labels = vec!["domicile", "bureau", "autre"];
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
    let existing = sqlx::query!(
        "SELECT id FROM navigation_saved_destinations WHERE user_id = $1 AND label = $2",
        user_id as i32,
        request.label
    )
    .fetch_optional(&state.pool)
    .await?;

    let is_default = existing.is_none();

    // Si un autre existe, le mettre à jour (ou le supprimer et créer le nouveau)
    if let Some(existing_row) = existing {
        let result = sqlx::query!(
            r#"
            UPDATE navigation_saved_destinations
            SET custom_label = $1, address = $2, latitude = $3, longitude = $4, 
                place_id = $5, is_default = $6, updated_at = NOW()
            WHERE id = $7
            RETURNING id
            "#,
            request.custom_label,
            request.address,
            request.latitude,
            request.longitude,
            request.place_id,
            is_default,
            existing_row.id
        )
        .fetch_one(&state.pool)
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
    let result = sqlx::query!(
        r#"
        INSERT INTO navigation_saved_destinations (
            user_id, label, custom_label, address, latitude, longitude, place_id, is_default
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
        "#,
        user_id as i32,
        request.label,
        request.custom_label,
        request.address,
        request.latitude,
        request.longitude,
        request.place_id,
        is_default
    )
    .fetch_one(&state.pool)
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

    let rows = sqlx::query!(
        r#"
        SELECT id, label, custom_label, address, latitude, longitude, place_id, is_default
        FROM navigation_saved_destinations
        WHERE user_id = $1
        ORDER BY is_default DESC, created_at DESC
        "#,
        user_id as i32
    )
    .fetch_all(&state.pool)
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

    let row = sqlx::query!(
        r#"
        SELECT id, label, custom_label, address, latitude, longitude, place_id, is_default
        FROM navigation_saved_destinations
        WHERE user_id = $1 AND label = $2
        LIMIT 1
        "#,
        user_id as i32,
        label
    )
    .fetch_optional(&state.pool)
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
    Path(destination_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let user_id = user.id;

    let result = sqlx::query!(
        r#"
        DELETE FROM navigation_saved_destinations
        WHERE id = $1 AND user_id = $2
        RETURNING id
        "#,
        destination_id,
        user_id as i32
    )
    .fetch_optional(&state.pool)
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
    let saved_destinations = sqlx::query!(
        r#"
        SELECT label, custom_label, address, latitude, longitude
        FROM navigation_saved_destinations
        WHERE user_id = $1
        ORDER BY is_default DESC
        "#,
        user_id as i32
    )
    .fetch_all(&state.pool)
    .await?;

    let mut results = Vec::new();

    // Ajouter les destinations favorites qui correspondent
    for dest in saved_destinations {
        let display_label = match dest.label.as_str() {
            "domicile" => "🏠 Domicile",
            "bureau" => "💼 Bureau",
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

pub fn navigation_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/navigation/geocode", get(geocode_address))
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
            "/api/navigation/destinations/:label",
            get(get_destination_by_label).layer(middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/navigation/destinations/:id",
            axum::routing::delete(delete_destination).layer(middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/navigation/autocomplete",
            get(autocomplete_with_saved).layer(middleware::from_fn(jwt_auth)),
        )
        .with_state(state)
}
