// Controller pour la gestion des modèles de smartphones
// Compatible avec autocomplete frontend

use crate::state::AppState;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct PhoneModelQuery {
    pub brand: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PhoneModel {
    pub id: i32,
    pub brand: String,
    pub model: String,
}

#[derive(Debug, Deserialize)]
pub struct CreatePhoneModel {
    pub brand: String,
    pub model: String,
}

/// GET /phone-models?brand=Apple
/// Récupère les modèles de smartphones, optionnellement filtrés par marque
pub async fn get_phone_models(
    Query(params): Query<PhoneModelQuery>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<PhoneModel>>, (StatusCode, String)> {
    let pool = &state.pg;
    let rows = if let Some(brand) = params.brand {
        // Recherche par marque spécifique
        sqlx::query("SELECT id, brand, model FROM phone_models WHERE brand = $1 ORDER BY model")
            .bind(brand)
            .fetch_all(pool)
            .await
            .map_err(|e| {
                eprintln!(
                    "Erreur lors de la récupération des modèles par marque: {}",
                    e
                );
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Erreur base de données: {}", e),
                )
            })?
    } else {
        // Tous les modèles
        sqlx::query("SELECT id, brand, model FROM phone_models ORDER BY brand, model")
            .fetch_all(pool)
            .await
            .map_err(|e| {
                eprintln!("Erreur lors de la récupération de tous les modèles: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Erreur base de données: {}", e),
                )
            })?
    };

    use sqlx::Row;
    let models: Vec<PhoneModel> = rows
        .iter()
        .map(|row| PhoneModel {
            id: row.get::<i32, _>("id"),
            brand: row.get::<String, _>("brand"),
            model: row.get::<String, _>("model"),
        })
        .collect();

    Ok(Json(models))
}

/// POST /phone-models
/// Crée un nouveau modèle de smartphone (ou met à jour updated_at si existe déjà)
pub async fn create_phone_model(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreatePhoneModel>,
) -> Result<Json<PhoneModel>, (StatusCode, String)> {
    let pool = &state.pg;
    // Validation des données
    if payload.brand.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "La marque ne peut pas être vide".to_string(),
        ));
    }

    if payload.model.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Le modèle ne peut pas être vide".to_string(),
        ));
    }

    // Insertion avec ON CONFLICT pour éviter les doublons
    let row = sqlx::query(
        r#"
        INSERT INTO phone_models (brand, model) 
        VALUES ($1, $2)
        ON CONFLICT (brand, model) 
        DO UPDATE SET updated_at = CURRENT_TIMESTAMP
        RETURNING id, brand, model
        "#,
    )
    .bind(payload.brand.trim())
    .bind(payload.model.trim())
    .fetch_one(pool)
    .await
    .map_err(|e| {
        eprintln!("Erreur lors de la création du modèle: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Erreur base de données: {}", e),
        )
    })?;

    use sqlx::Row;
    let model = PhoneModel {
        id: row.get::<i32, _>("id"),
        brand: row.get::<String, _>("brand"),
        model: row.get::<String, _>("model"),
    };

    Ok(Json(model))
}
