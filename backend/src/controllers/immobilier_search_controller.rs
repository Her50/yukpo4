// ✅ NOUVEAU: Contrôleur dédié pour recherche immobilière avancée
// Fonctionnalités UX exceptionnelles pour recherche de niveau mondial

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::{error, info};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;

// ============================================================================
// PHASE 1.1: Autocomplétion intelligente de localisation
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct AutocompleteLocationQuery {
    pub q: String,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub limit: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct LocationSuggestion {
    pub id: String,
    pub name: String,
    pub full_name: String,
    pub ville: Option<String>,
    pub quartier: Option<String>,
    pub pays: Option<String>,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub property_count: i64,
    pub category: String, // "ville", "quartier", "zone"
    pub popularity_score: f64,
}

pub async fn autocomplete_location(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<AutocompleteLocationQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[autocomplete_location] query={}, user_id={}", params.q, user_id);

    let limit = params.limit.unwrap_or(10).min(20);
    let search_pattern = format!("%{}%", params.q);

    // Rechercher dans les villes et quartiers des biens immobiliers
    // Prioriser par nombre de biens disponibles et proximité GPS
    let mut suggestions: Vec<LocationSuggestion> = Vec::new();

    // 1. Rechercher villes avec nombre de biens
    // Note: Calcul simplifié des coordonnées moyennes sans PostGIS
    let villes = sqlx::query(
        r#"
        SELECT 
            DISTINCT p.ville,
            COUNT(*) as property_count,
            AVG(CASE 
                WHEN s.gps IS NOT NULL AND s.gps != '' 
                THEN CAST(SPLIT_PART(s.gps, ',', 1) AS FLOAT)
                ELSE NULL
            END) as avg_lat,
            AVG(CASE 
                WHEN s.gps IS NOT NULL AND s.gps != '' 
                THEN CAST(SPLIT_PART(s.gps, ',', 2) AS FLOAT)
                ELSE NULL
            END) as avg_lng
        FROM real_estate_properties p
        INNER JOIN services s ON s.id = p.service_id
        WHERE s.is_active = true
        AND p.ville IS NOT NULL
        AND p.ville ILIKE $1
        GROUP BY p.ville
        ORDER BY property_count DESC, p.ville ASC
        LIMIT $2
        "#
    )
    .bind(&search_pattern)
    .bind(limit)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[autocomplete_location] Erreur villes: {}", e);
        AppError::Internal("Erreur recherche villes".to_string())
    })?;

    for row in villes {
        let ville: String = row.try_get("ville").unwrap_or_default();
        let property_count: i64 = row.try_get("property_count").unwrap_or(0);
        let avg_lat: Option<f64> = row.try_get("avg_lat").ok();
        let avg_lng: Option<f64> = row.try_get("avg_lng").ok();

        // Calculer score de popularité (nombre de biens + proximité GPS si disponible)
        let mut popularity_score = property_count as f64;
        if let (Some(lat), Some(lng), Some(user_lat), Some(user_lng)) = 
            (avg_lat, avg_lng, params.lat, params.lng) {
            // Bonus de proximité (distance inverse)
            let distance_km = calculate_distance_km(lat, lng, user_lat, user_lng);
            if distance_km < 50.0 {
                popularity_score += (50.0 - distance_km) * 0.1;
            }
        }

        suggestions.push(LocationSuggestion {
            id: format!("ville_{}", ville),
            name: ville.clone(),
            full_name: ville.clone(),
            ville: Some(ville),
            quartier: None,
            pays: None,
            lat: avg_lat,
            lng: avg_lng,
            property_count,
            category: "ville".to_string(),
            popularity_score,
        });
    }

    // 2. Rechercher quartiers avec nombre de biens
    let quartiers = sqlx::query(
        r#"
        SELECT 
            DISTINCT p.quartier,
            p.ville,
            COUNT(*) as property_count,
            AVG(CASE 
                WHEN s.gps IS NOT NULL AND s.gps != '' 
                THEN CAST(SPLIT_PART(s.gps, ',', 1) AS FLOAT)
                ELSE NULL
            END) as avg_lat,
            AVG(CASE 
                WHEN s.gps IS NOT NULL AND s.gps != '' 
                THEN CAST(SPLIT_PART(s.gps, ',', 2) AS FLOAT)
                ELSE NULL
            END) as avg_lng
        FROM real_estate_properties p
        INNER JOIN services s ON s.id = p.service_id
        WHERE s.is_active = true
        AND p.quartier IS NOT NULL
        AND (p.quartier ILIKE $1 OR p.ville ILIKE $1)
        GROUP BY p.quartier, p.ville
        ORDER BY property_count DESC, p.quartier ASC
        LIMIT $2
        "#
    )
    .bind(&search_pattern)
    .bind(limit)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[autocomplete_location] Erreur quartiers: {}", e);
        AppError::Internal("Erreur recherche quartiers".to_string())
    })?;

    for row in quartiers {
        let quartier: String = row.try_get("quartier").unwrap_or_default();
        let ville: Option<String> = row.try_get("ville").ok();
        let property_count: i64 = row.try_get("property_count").unwrap_or(0);
        let avg_lat: Option<f64> = row.try_get("avg_lat").ok();
        let avg_lng: Option<f64> = row.try_get("avg_lng").ok();

        let full_name = if let Some(v) = &ville {
            format!("{}, {}", quartier, v)
        } else {
            quartier.clone()
        };

        let mut popularity_score = property_count as f64;
        if let (Some(lat), Some(lng), Some(user_lat), Some(user_lng)) = 
            (avg_lat, avg_lng, params.lat, params.lng) {
            let distance_km = calculate_distance_km(lat, lng, user_lat, user_lng);
            if distance_km < 20.0 {
                popularity_score += (20.0 - distance_km) * 0.2;
            }
        }

        suggestions.push(LocationSuggestion {
            id: format!("quartier_{}_{}", quartier, ville.as_deref().unwrap_or("")),
            name: quartier.clone(),
            full_name,
            ville,
            quartier: Some(quartier),
            pays: None,
            lat: avg_lat,
            lng: avg_lng,
            property_count,
            category: "quartier".to_string(),
            popularity_score,
        });
    }

    // Trier par score de popularité
    suggestions.sort_by(|a, b| b.popularity_score.partial_cmp(&a.popularity_score).unwrap_or(std::cmp::Ordering::Equal));
    suggestions.truncate(limit as usize);

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "suggestions": suggestions
        })),
    ))
}

fn calculate_distance_km(lat1: f64, lng1: f64, lat2: f64, lng2: f64) -> f64 {
    let r = 6371.0; // Rayon de la Terre en km
    let d_lat = (lat2 - lat1).to_radians();
    let d_lng = (lng2 - lng1).to_radians();
    let a = (d_lat / 2.0).sin().powi(2) +
            lat1.to_radians().cos() * lat2.to_radians().cos() *
            (d_lng / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().asin();
    r * c
}

// ============================================================================
// PHASE 3.1: Alertes de recherche sauvegardées
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateSearchAlertRequest {
    pub filters: serde_json::Value,
    pub name: Option<String>,
    pub notify_email: Option<bool>,
    pub notify_push: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct SearchAlert {
    pub id: i32,
    pub user_id: i32,
    pub name: Option<String>,
    pub filters: serde_json::Value,
    pub is_active: bool,
    pub notify_email: bool,
    pub notify_push: bool,
    pub last_checked_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub new_properties_count: i64,
}

pub async fn create_search_alert(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<CreateSearchAlertRequest>,
) -> AppResult<impl IntoResponse> {
    info!("[create_search_alert] user_id={}", user_id);

    let alert_id = sqlx::query_scalar::<_, i32>(
        r#"
        INSERT INTO property_search_alerts 
        (user_id, name, filters, is_active, notify_email, notify_push)
        VALUES ($1, $2, $3, true, $4, $5)
        RETURNING id
        "#
    )
    .bind(user_id)
    .bind(request.name)
    .bind(&request.filters)
    .bind(request.notify_email.unwrap_or(true))
    .bind(request.notify_push.unwrap_or(true))
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_search_alert] Erreur: {}", e);
        AppError::Internal("Erreur création alerte".to_string())
    })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "alert_id": alert_id
        })),
    ))
}

pub async fn get_my_search_alerts(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[get_my_search_alerts] user_id={}", user_id);

    let alerts = sqlx::query(
        r#"
        SELECT 
            id, user_id, name, filters, is_active, 
            notify_email, notify_push, last_checked_at, created_at
        FROM property_search_alerts
        WHERE user_id = $1
        ORDER BY created_at DESC
        "#
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_my_search_alerts] Erreur: {}", e);
        AppError::Internal("Erreur récupération alertes".to_string())
    })?;

    let mut alerts_json = Vec::new();
    for row in alerts {
        let alert_id: i32 = row.try_get("id").unwrap_or(0);
        
        // Compter nouveaux biens depuis last_checked_at
        let new_count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM real_estate_properties p
            INNER JOIN services s ON s.id = p.service_id
            WHERE s.is_active = true
            AND p.created_at > COALESCE((SELECT last_checked_at FROM property_search_alerts WHERE id = $1), NOW() - INTERVAL '30 days')
            "#
        )
        .bind(alert_id)
        .fetch_one(&state.pg)
        .await
        .unwrap_or(0);

        alerts_json.push(json!({
            "id": alert_id,
            "user_id": row.try_get::<i32, _>("user_id").unwrap_or(0),
            "name": row.try_get::<Option<String>, _>("name").ok().flatten(),
            "filters": row.try_get::<serde_json::Value, _>("filters").ok(),
            "is_active": row.try_get::<bool, _>("is_active").unwrap_or(true),
            "notify_email": row.try_get::<bool, _>("notify_email").unwrap_or(true),
            "notify_push": row.try_get::<bool, _>("notify_push").unwrap_or(true),
            "last_checked_at": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("last_checked_at").ok(),
            "created_at": row.try_get::<chrono::DateTime<chrono::Utc>, _>("created_at").ok(),
            "new_properties_count": new_count,
        }));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "alerts": alerts_json
        })),
    ))
}

// ============================================================================
// PHASE 3.3: Historique de recherche
// ============================================================================

#[derive(Debug, Serialize)]
pub struct SearchHistoryItem {
    pub id: i32,
    pub user_id: i32,
    pub search_query: Option<String>,
    pub filters: serde_json::Value,
    pub results_count: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn save_search_history(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<serde_json::Value>,
) -> AppResult<impl IntoResponse> {
    info!("[save_search_history] user_id={}", user_id);

    let search_query = request.get("search_query").and_then(|v| v.as_str()).map(|s| s.to_string());
    let filters = request.get("filters").cloned().unwrap_or(json!({}));
    let results_count = request.get("results_count").and_then(|v| v.as_i64()).unwrap_or(0) as i32;

    sqlx::query(
        r#"
        INSERT INTO property_search_history 
        (user_id, search_query, filters, results_count)
        VALUES ($1, $2, $3, $4)
        "#
    )
    .bind(user_id)
    .bind(search_query)
    .bind(&filters)
    .bind(results_count)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("[save_search_history] Erreur: {}", e);
        AppError::Internal("Erreur sauvegarde historique".to_string())
    })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true
        })),
    ))
}

pub async fn get_search_history(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> AppResult<impl IntoResponse> {
    info!("[get_search_history] user_id={}", user_id);

    let limit = params.get("limit")
        .and_then(|v| v.parse::<i32>().ok())
        .unwrap_or(20)
        .min(50);

    let history = sqlx::query(
        r#"
        SELECT id, user_id, search_query, filters, results_count, created_at
        FROM property_search_history
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        "#
    )
    .bind(user_id)
    .bind(limit)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_search_history] Erreur: {}", e);
        AppError::Internal("Erreur récupération historique".to_string())
    })?;

    let history_json: Vec<serde_json::Value> = history
        .iter()
        .map(|row| {
            json!({
                "id": row.try_get::<i32, _>("id").unwrap_or(0),
                "user_id": row.try_get::<i32, _>("user_id").unwrap_or(0),
                "search_query": row.try_get::<Option<String>, _>("search_query").ok().flatten(),
                "filters": row.try_get::<serde_json::Value, _>("filters").ok(),
                "results_count": row.try_get::<i32, _>("results_count").unwrap_or(0),
                "created_at": row.try_get::<chrono::DateTime<chrono::Utc>, _>("created_at").ok(),
            })
        })
        .collect();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "history": history_json
        })),
    ))
}

// ============================================================================
// PHASE 4.1: Statistiques de marché
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct MarketStatsQuery {
    pub ville: Option<String>,
    pub quartier: Option<String>,
    pub type_bien: Option<String>,
    pub radius_km: Option<f64>,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct MarketStats {
    pub average_price_per_m2: f64,
    pub median_price: f64,
    pub min_price: f64,
    pub max_price: f64,
    pub total_properties: i64,
    pub average_superficie: f64,
    pub price_trend: String, // "up", "down", "stable"
    pub days_on_market_avg: f64,
    pub price_per_m2_by_type: serde_json::Value,
}

pub async fn get_market_stats(
    State(state): State<Arc<AppState>>,
    Query(params): Query<MarketStatsQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[get_market_stats] ville={:?}", params.ville);

    // Construire la requête avec filtres en utilisant QueryBuilder
    use sqlx::QueryBuilder;
    
    let mut query_builder = QueryBuilder::new(
        r#"
        SELECT 
            AVG(CASE WHEN prix_vente > 0 THEN prix_vente / NULLIF(superficie_m2, 0) ELSE NULL END) as avg_price_per_m2,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY prix_vente) as median_price,
            MIN(prix_vente) as min_price,
            MAX(prix_vente) as max_price,
            COUNT(*) as total_properties,
            AVG(superficie_m2) as avg_superficie,
            AVG(EXTRACT(EPOCH FROM (NOW() - s.created_at)) / 86400) as days_on_market_avg
        FROM real_estate_properties p
        INNER JOIN services s ON s.id = p.service_id
        WHERE s.is_active = true
        AND p.statut IN ('vente', 'les_deux')
        AND p.prix_vente > 0
        "#
    );

    if let Some(ref ville) = params.ville {
        query_builder.push(" AND p.ville = ");
        query_builder.push_bind(ville);
    }

    if let Some(ref quartier) = params.quartier {
        query_builder.push(" AND p.quartier = ");
        query_builder.push_bind(quartier);
    }

    if let Some(ref type_bien) = params.type_bien {
        query_builder.push(" AND p.type_bien = ");
        query_builder.push_bind(type_bien);
    }

    let stats_row = query_builder
        .build()
        .fetch_one(&state.pg)
        .await
        .map_err(|e| {
            error!("[get_market_stats] Erreur: {}", e);
            AppError::Internal("Erreur calcul statistiques".to_string())
        })?;

    let avg_price_per_m2: Option<f64> = stats_row.try_get("avg_price_per_m2").ok();
    let median_price: Option<f64> = stats_row.try_get("median_price").ok();
    let min_price: Option<f64> = stats_row.try_get("min_price").ok();
    let max_price: Option<f64> = stats_row.try_get("max_price").ok();
    let total_properties: i64 = stats_row.try_get("total_properties").unwrap_or(0);
    let avg_superficie: Option<f64> = stats_row.try_get("avg_superficie").ok();
    let days_on_market_avg: Option<f64> = stats_row.try_get("days_on_market_avg").ok();

    // Calculer tendance (comparer avec moyenne des 30 derniers jours)
    let price_trend = "stable".to_string(); // TODO: Implémenter calcul de tendance

    // Prix par m² par type de bien
    let price_by_type = sqlx::query(
        r#"
        SELECT 
            type_bien,
            AVG(prix_vente / NULLIF(superficie_m2, 0)) as avg_price_per_m2
        FROM real_estate_properties p
        INNER JOIN services s ON s.id = p.service_id
        WHERE s.is_active = true
        AND p.statut IN ('vente', 'les_deux')
        AND p.prix_vente > 0
        GROUP BY type_bien
        "#
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_market_stats] Erreur prix par type: {}", e);
        AppError::Internal("Erreur calcul prix par type".to_string())
    })?;

    let mut price_per_m2_by_type = serde_json::Map::new();
    for row in price_by_type {
        let type_bien: String = row.try_get("type_bien").unwrap_or_default();
        let avg_price: Option<f64> = row.try_get("avg_price_per_m2").ok();
        if let Some(price) = avg_price {
            price_per_m2_by_type.insert(type_bien, json!(price));
        }
    }

    let stats = MarketStats {
        average_price_per_m2: avg_price_per_m2.unwrap_or(0.0),
        median_price: median_price.unwrap_or(0.0),
        min_price: min_price.unwrap_or(0.0),
        max_price: max_price.unwrap_or(0.0),
        total_properties,
        average_superficie: avg_superficie.unwrap_or(0.0),
        price_trend,
        days_on_market_avg: days_on_market_avg.unwrap_or(0.0),
        price_per_m2_by_type: json!(price_per_m2_by_type),
    };

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "stats": stats
        })),
    ))
}

