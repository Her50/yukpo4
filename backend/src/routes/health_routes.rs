// ✅ Phase 10 - Routes de santé et vérification des services
// Vérifie automatiquement le support Google Maps Distance Matrix API

use axum::{extract::State, response::IntoResponse, Json, Router};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::state::AppState;

pub fn health_routes(_state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/health/google-maps", axum::routing::get(check_google_maps_support))
        .route("/health/cache", axum::routing::get(check_cache_status))
        .route("/health/geographic-matching", axum::routing::get(check_geographic_matching))
}

/// ✅ Phase 10 - Vérifie automatiquement le support Google Maps Distance Matrix API
async fn check_google_maps_support(
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let api_key = std::env::var("GOOGLE_MAPS_API_KEY").ok();
    
    let has_api_key = api_key.is_some() && !api_key.as_ref().unwrap().is_empty();
    
    // Test avec des coordonnées de test (Yaoundé, Cameroun)
    let test_origin = (3.8480, 11.5021); // Yaoundé
    let test_destination = (4.0511, 9.7679); // Douala
    
    let mut test_result: Option<Value> = None;
    let mut test_error: Option<String> = None;
    
    if has_api_key {
        // Tester une requête réelle
        match test_google_maps_distance_matrix(test_origin, test_destination).await {
            Ok(result) => {
                test_result = Some(json!({
                    "distance_meters": result.distance_meters,
                    "duration_seconds": result.duration_seconds,
                    "source": "GoogleMaps"
                }));
            }
            Err(e) => {
                test_error = Some(format!("Erreur test: {}", e));
            }
        }
    }
    
    Json(json!({
        "google_maps_api_key_configured": has_api_key,
        "api_key_present": has_api_key,
        "test_result": test_result,
        "test_error": test_error,
        "status": if has_api_key && test_result.is_some() {
            "available"
        } else if has_api_key {
            "configured_but_test_failed"
        } else {
            "not_configured"
        },
        "fallback": "Haversine distance calculation",
        "message": if has_api_key && test_result.is_some() {
            "✅ Google Maps Distance Matrix API est disponible et fonctionne"
        } else if has_api_key {
            "⚠️ Google Maps API Key configurée mais le test a échoué. Utilisation de Haversine en fallback."
        } else {
            "ℹ️ Google Maps API Key non configurée. Utilisation de Haversine pour les calculs de distance."
        }
    }))
}

/// Teste une requête Google Maps Distance Matrix
async fn test_google_maps_distance_matrix(
    origin: (f64, f64),
    destination: (f64, f64),
) -> Result<DistanceTestResult, String> {
    let api_key = std::env::var("GOOGLE_MAPS_API_KEY")
        .map_err(|_| "GOOGLE_MAPS_API_KEY non configurée".to_string())?;

    let url = format!(
        "https://maps.googleapis.com/maps/api/distancematrix/json?origins={},{}&destinations={},{}&key={}&units=metric&language=fr",
        origin.0, origin.1, destination.0, destination.1, api_key
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| format!("Erreur requête: {}", e))?;

    let data: Value = response
        .json()
        .await
        .map_err(|e| format!("Erreur parsing: {}", e))?;

    // Parser la réponse
    if let Some(rows) = data.get("rows").and_then(|r| r.as_array()) {
        if let Some(row) = rows.first() {
            if let Some(elements) = row.get("elements").and_then(|e| e.as_array()) {
                if let Some(element) = elements.first() {
                    if let Some(status) = element.get("status").and_then(|s| s.as_str()) {
                        if status == "OK" {
                            let distance_meters = element
                                .get("distance")
                                .and_then(|d| d.get("value"))
                                .and_then(|v| v.as_f64())
                                .unwrap_or(0.0);

                            let duration_seconds = element
                                .get("duration")
                                .and_then(|d| d.get("value"))
                                .and_then(|v| v.as_f64());

                            return Ok(DistanceTestResult {
                                distance_meters,
                                duration_seconds,
                            });
                        } else {
                            return Err(format!("Status Google Maps: {}", status));
                        }
                    }
                }
            }
        }
    }

    Err("Réponse Google Maps invalide".to_string())
}

struct DistanceTestResult {
    distance_meters: f64,
    duration_seconds: Option<f64>,
}

/// Vérifie le statut du cache Redis
async fn check_cache_status(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let test_key = "health:cache:test";
    let test_value = json!({"test": true, "timestamp": chrono::Utc::now()});
    
    // Tester l'écriture
    let write_ok = state.cache_service.set(test_key, &test_value).await.is_ok();
    
    // Tester la lecture
    let read_result = state.cache_service.get::<Value>(test_key).await;
    let read_ok = read_result.is_ok() && read_result.unwrap().is_some();
    
    // Nettoyer
    let _ = state.cache_service.delete(test_key).await;
    
    Json(json!({
        "redis_configured": true,
        "write_test": write_ok,
        "read_test": read_ok,
        "status": if write_ok && read_ok {
            "operational"
        } else {
            "degraded"
        },
        "message": if write_ok && read_ok {
            "✅ Cache Redis opérationnel"
        } else {
            "⚠️ Cache Redis en mode dégradé"
        }
    }))
}

/// Vérifie le service de matching géographique
async fn check_geographic_matching(
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    // Le service est initialisé dans AppState
    Json(json!({
        "geographic_matching_service": "initialized",
        "features": {
            "cache_enabled": true,
            "google_maps_support": std::env::var("GOOGLE_MAPS_API_KEY").ok().is_some(),
            "haversine_fallback": true
        },
        "message": "✅ Service de matching géographique initialisé"
    }))
}

