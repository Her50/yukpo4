// Contrôleur pour la gestion des tickets bus avec agences de voyage
// Intègre le système de réservation existant avec les agences spécialisées

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
// RECHERCHE TICKETS BUS
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct SearchBusTicketsQuery {
    pub departure_city: Option<String>,
    pub arrival_city: Option<String>,
    pub departure_date: Option<String>, // Format: YYYY-MM-DD
    pub user_lat: Option<f64>,
    pub user_lng: Option<f64>,
    pub radius_km: Option<f64>,
    pub min_seats: Option<i32>,
    pub agency_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BusTicketSearchResult {
    pub agency_id: i32,
    pub agency_service_id: i32,
    pub agency_nom: String,
    pub agency_adresse: Option<String>,
    pub agency_quartier: Option<String>,
    pub agency_ville: Option<String>,
    pub agency_gps: Option<String>,
    pub agency_telephone: Option<String>,
    pub agency_whatsapp: Option<String>,
    pub agency_email: Option<String>,
    
    pub product_id: String,
    pub product_name: String,
    pub bus_model_name: Option<String>,
    pub total_seats: Option<i32>,
    pub available_seats: i32,
    pub reserved_seats: i32,
    pub bus_number: Option<String>,
    pub departure_city: Option<String>,
    pub arrival_city: Option<String>,
    pub departure_date: Option<chrono::NaiveDate>,
    pub departure_time: Option<chrono::NaiveTime>,
    pub ticket_price: Option<i32>,
    pub currency: Option<String>,
    pub bus_configuration: Option<serde_json::Value>,
    pub seat_map: Option<serde_json::Value>,
    
    pub distance_km: Option<f64>,
    pub relevance_score: f64,
}

/// Rechercher des tickets bus avec disponibilité en temps réel
pub async fn search_bus_tickets(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SearchBusTicketsQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[search_bus_tickets] Recherche: {:?}", params);

    let departure_date = if let Some(date_str) = &params.departure_date {
        Some(
            chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d")
                .map_err(|_| AppError::BadRequest("Format date invalide (YYYY-MM-DD requis)".to_string()))?,
        )
    } else {
        None
    };

    let query = r#"
        SELECT 
            agency_id,
            agency_service_id,
            agency_nom,
            agency_adresse,
            agency_quartier,
            agency_ville,
            agency_gps,
            agency_telephone,
            agency_whatsapp,
            agency_email,
            product_id,
            product_name,
            bus_model_name,
            total_seats,
            available_seats,
            reserved_seats,
            bus_number,
            departure_city,
            arrival_city,
            departure_date,
            departure_time,
            ticket_price,
            currency,
            bus_configuration,
            seat_map,
            distance_km,
            relevance_score
        FROM search_bus_tickets_with_availability(
            $1,  -- p_departure_city
            $2,  -- p_arrival_city
            $3,  -- p_departure_date
            $4,  -- p_user_lat
            $5,  -- p_user_lng
            $6,  -- p_radius_km
            $7,  -- p_min_seats
            $8   -- p_agency_name
        )
    "#;

    let rows = sqlx::query(query)
        .bind(&params.departure_city)
        .bind(&params.arrival_city)
        .bind(&departure_date)
        .bind(&params.user_lat)
        .bind(&params.user_lng)
        .bind(params.radius_km.unwrap_or(50.0))
        .bind(params.min_seats.unwrap_or(1))
        .bind(&params.agency_name)
        .fetch_all(&state.pg)
        .await
        .map_err(|e| {
            error!("[search_bus_tickets] Erreur recherche: {}", e);
            AppError::Internal(format!("Erreur recherche tickets bus: {}", e))
        })?;

    let mut results = Vec::new();
    for row in rows {
        let result = BusTicketSearchResult {
            agency_id: row.get("agency_id"),
            agency_service_id: row.get("agency_service_id"),
            agency_nom: row.get("agency_nom"),
            agency_adresse: row.get("agency_adresse"),
            agency_quartier: row.get("agency_quartier"),
            agency_ville: row.get("agency_ville"),
            agency_gps: row.get("agency_gps"),
            agency_telephone: row.get("agency_telephone"),
            agency_whatsapp: row.get("agency_whatsapp"),
            agency_email: row.get("agency_email"),
            product_id: row.get("product_id"),
            product_name: row.get("product_name"),
            bus_model_name: row.get("bus_model_name"),
            total_seats: row.get("total_seats"),
            available_seats: row.get("available_seats"),
            reserved_seats: row.get("reserved_seats"),
            bus_number: row.get("bus_number"),
            departure_city: row.get("departure_city"),
            arrival_city: row.get("arrival_city"),
            departure_date: row.get("departure_date"),
            departure_time: row.get("departure_time"),
            ticket_price: row.get("ticket_price"),
            currency: row.get("currency"),
            bus_configuration: row.get("bus_configuration"),
            seat_map: row.get("seat_map"),
            distance_km: row.get("distance_km"),
            relevance_score: row.get("relevance_score"),
        };
        results.push(result);
    }

    Ok((StatusCode::OK, Json(json!({ "results": results }))))
}

// ============================================================================
// DISPONIBILITÉ PLACES
// ============================================================================

#[derive(Debug, Serialize)]
pub struct SeatAvailabilityResponse {
    pub success: bool,
    pub availability: Option<serde_json::Value>,
    pub error: Option<String>,
}

/// Obtenir la disponibilité des places d'un bus en temps réel
pub async fn get_seat_availability(
    State(state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
) -> AppResult<impl IntoResponse> {
    info!("[get_seat_availability] Product ID: {}", product_id);

    let result: serde_json::Value = sqlx::query_scalar(
        "SELECT get_bus_seat_availability($1)"
    )
        .bind(&product_id)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| {
            error!("[get_seat_availability] Erreur: {}", e);
            AppError::Internal(format!("Erreur récupération disponibilité: {}", e))
        })?;

    let success = result.get("success").and_then(|v| v.as_bool()).unwrap_or(false);
    let availability = result.get("availability").cloned();
    let error = result.get("error").and_then(|v| v.as_str()).map(|s| s.to_string());

    let response = SeatAvailabilityResponse {
        success,
        availability,
        error,
    };

    if success {
        Ok((StatusCode::OK, Json(json!(response))))
    } else {
        Ok((StatusCode::NOT_FOUND, Json(json!(response))))
    }
}

// ============================================================================
// LIER PRODUIT À AGENCE
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct LinkBusProductRequest {
    pub agency_id: i32,
    pub product_id: String,
    pub nom_modele: String,
    pub classe: Option<String>,
    pub equipements: Option<Vec<String>>,
}

/// Lier un produit (ticket_voyage) à une agence de voyage
pub async fn link_bus_product_to_agency(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<LinkBusProductRequest>,
) -> AppResult<impl IntoResponse> {
    info!("[link_bus_product] User ID: {}, Agency ID: {}, Product ID: {}", user_id, payload.agency_id, payload.product_id);

    // Vérifier que l'agence appartient à l'utilisateur
    let agency_exists: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM agences_voyage WHERE id = $1 AND user_id = $2"
    )
        .bind(payload.agency_id)
        .bind(user_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| {
            error!("[link_bus_product] Erreur vérification agence: {}", e);
            AppError::Internal(format!("Erreur vérification agence: {}", e))
        })?;

    if agency_exists.is_none() {
        return Err(AppError::NotFound("Agence non trouvée ou n'appartient pas à l'utilisateur".to_string()));
    }

    // Vérifier que le produit existe et appartient à l'utilisateur
    let product_exists: Option<(String, i32)> = sqlx::query_as::<_, (String, i32)>(
        "SELECT id::text, user_id FROM products WHERE id::text = $1 AND user_id = $2 AND type = 'ticket_voyage' AND is_active = TRUE"
    )
        .bind(&payload.product_id)
        .bind(user_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| {
            error!("[link_bus_product] Erreur vérification produit: {}", e);
            AppError::Internal(format!("Erreur vérification produit: {}", e))
        })?;

    if product_exists.is_none() {
        return Err(AppError::NotFound("Produit non trouvé ou n'est pas un ticket_voyage".to_string()));
    }

    // Récupérer la config actuelle
    let current_config: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT bus_products_config FROM agences_voyage WHERE id = $1"
    )
        .bind(payload.agency_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| {
            error!("[link_bus_product] Erreur récupération config: {}", e);
            AppError::Internal(format!("Erreur récupération config: {}", e))
        })?;

    // Construire le nouveau modèle
    let new_model = json!({
        "product_id": payload.product_id,
        "nom_modele": payload.nom_modele,
        "classe": payload.classe.unwrap_or_else(|| "Standard".to_string()),
        "equipements": payload.equipements.unwrap_or_default()
    });

    // Mettre à jour la config
    let updated_config = if let Some(mut config) = current_config {
        // S'assurer que modeles_bus existe
        if !config.get("modeles_bus").is_some() {
            config["modeles_bus"] = json!([]);
        }
        
        // Obtenir la référence mutable aux modèles
        let modeles = config.get_mut("modeles_bus")
            .and_then(|v| v.as_array_mut())
            .expect("modeles_bus devrait être un tableau");
        
        // Vérifier si le produit est déjà lié
        if let Some(existing) = modeles.iter_mut().find(|m| m.get("product_id") == Some(&json!(payload.product_id))) {
            // Mettre à jour le modèle existant
            *existing = new_model;
        } else {
            // Ajouter le nouveau modèle
            modeles.push(new_model);
        }
        config
    } else {
        // Créer une nouvelle config
        json!({
            "modeles_bus": [new_model]
        })
    };

    // Sauvegarder
    sqlx::query(
        "UPDATE agences_voyage SET bus_products_config = $1, updated_at = NOW() WHERE id = $2"
    )
        .bind(&updated_config)
        .bind(payload.agency_id)
        .execute(&state.pg)
        .await
        .map_err(|e| {
            error!("[link_bus_product] Erreur mise à jour: {}", e);
            AppError::Internal(format!("Erreur mise à jour config: {}", e))
        })?;

    Ok((StatusCode::OK, Json(json!({
        "success": true,
        "message": "Produit lié à l'agence avec succès",
        "config": updated_config
    }))))
}

