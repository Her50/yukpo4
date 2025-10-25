use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct VehicleModelQuery {
    pub brand: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateVehicleModel {
    pub brand: String,
    pub model: String,
}

#[derive(Debug, Serialize)]
pub struct VehicleModel {
    pub id: i32,
    pub brand: String,
    pub model: String,
    pub created_at: String,
}

/// Récupérer les modèles de véhicules par marque
pub async fn get_vehicle_models(
    Query(query): Query<VehicleModelQuery>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pool = &state.pg;
    let rows = if let Some(brand) = query.brand {
        sqlx::query(
            "SELECT id, brand, model, created_at FROM vehicle_models WHERE brand = $1 ORDER BY model ASC"
        )
        .bind(brand)
        .fetch_all(pool)
        .await
        .map_err(|e| {
            eprintln!("❌ Erreur récupération modèles pour marque: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Erreur récupération modèles: {}", e),
            )
        })?
    } else {
        // Tous les modèles
        sqlx::query(
            "SELECT id, brand, model, created_at FROM vehicle_models ORDER BY brand ASC, model ASC"
        )
        .fetch_all(pool)
        .await
        .map_err(|e| {
            eprintln!("❌ Erreur récupération tous les modèles: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Erreur récupération: {}", e),
            )
        })?
    };
    
    use sqlx::Row;
    let models: Vec<VehicleModel> = rows.iter().map(|row| {
        let created_at: chrono::NaiveDateTime = row.get("created_at");
        VehicleModel {
            id: row.get("id"),
            brand: row.get("brand"),
            model: row.get("model"),
            created_at: created_at.to_string(),
        }
    }).collect();

    Ok(Json(serde_json::json!({
        "success": true,
        "data": models,
        "count": models.len()
    })))
}

/// Créer un nouveau modèle de véhicule
pub async fn create_vehicle_model(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateVehicleModel>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pool = &state.pg;
    // Valider
    if payload.model.trim().len() < 2 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Le modèle doit contenir au moins 2 caractères".to_string(),
        ));
    }

    if payload.brand.trim().len() < 2 {
        return Err((
            StatusCode::BAD_REQUEST,
            "La marque doit être renseignée".to_string(),
        ));
    }

    // Vérifier si existe déjà
    let existing = sqlx::query(
        "SELECT id FROM vehicle_models WHERE brand = $1 AND LOWER(model) = LOWER($2)"
    )
    .bind(&payload.brand)
    .bind(payload.model.trim())
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        eprintln!("❌ Erreur vérification modèle existant: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Erreur vérification: {}", e),
        )
    })?;

    if existing.is_some() {
        return Ok(Json(serde_json::json!({
            "success": true,
            "message": "Modèle déjà existant",
            "already_exists": true
        })));
    }

    // Créer
    let row = sqlx::query(
        "INSERT INTO vehicle_models (brand, model) VALUES ($1, $2) RETURNING id, brand, model, created_at"
    )
    .bind(&payload.brand)
    .bind(payload.model.trim())
    .fetch_one(pool)
    .await
    .map_err(|e| {
        eprintln!("❌ Erreur création modèle: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Erreur création: {}", e),
        )
    })?;
    
    use sqlx::Row;
    let created_at: chrono::NaiveDateTime = row.get("created_at");
    let model = VehicleModel {
        id: row.get("id"),
        brand: row.get("brand"),
        model: row.get("model"),
        created_at: created_at.to_string(),
    };

    println!("✅ Modèle créé: {} {}", model.brand, model.model);

    Ok(Json(serde_json::json!({
        "success": true,
        "data": model,
        "message": "Modèle créé avec succès"
    })))
}

