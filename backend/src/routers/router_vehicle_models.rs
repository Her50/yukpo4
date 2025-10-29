use axum::{
    extract::{State, Json, Query, Path},
    routing::{get, post},
    Router, http::StatusCode,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::sync::Arc;
use log::{info, error};
use crate::{
    state::AppState,
    core::types::{AppResult, AppError},
    middlewares::jwt::Claims,
};

// ✅ Structures pour vehicle_models

#[derive(Debug, Serialize, Deserialize)]
pub struct VehicleModel {
    pub id: i32,
    pub brand: String,
    pub model: String,
    pub year_min: Option<i32>,
    pub year_max: Option<i32>,
    pub category: Option<String>,
    pub fuel_type: Option<String>,
    pub usage_count: i32,
}

#[derive(Debug, Deserialize)]
pub struct GetVehicleModelsQuery {
    pub brand: Option<String>,
    pub category: Option<String>,
    pub limit: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct CreateVehicleModelPayload {
    pub brand: String,
    pub model: String,
    pub category: Option<String>,
    pub fuel_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct IncrementUsagePayload {
    pub brand: String,
    pub model: String,
}

/// GET /api/vehicle-models - Récupérer modèles (filtré par marque optionnellement)
pub async fn get_vehicle_models(
    State(state): State<Arc<AppState>>,
    Query(params): Query<GetVehicleModelsQuery>,
) -> AppResult<Json<Vec<VehicleModel>>> {
    let limit = params.limit.unwrap_or(100);
    
    let models = if let Some(brand) = params.brand {
        // Filtrer par marque
        sqlx::query_as!(
            VehicleModel,
            r#"
            SELECT id, brand, model, year_min, year_max, category, fuel_type, usage_count
            FROM vehicle_models
            WHERE brand = $1
            ORDER BY usage_count DESC, model ASC
            LIMIT $2
            "#,
            brand,
            limit as i64
        )
        .fetch_all(&state.pg)
        .await
        .map_err(|e| {
            error!("Erreur récupération modèles par marque: {}", e);
            AppError::DatabaseError(e.to_string())
        })?
    } else if let Some(category) = params.category {
        // Filtrer par catégorie
        sqlx::query_as!(
            VehicleModel,
            r#"
            SELECT id, brand, model, year_min, year_max, category, fuel_type, usage_count
            FROM vehicle_models
            WHERE category = $1
            ORDER BY usage_count DESC, brand ASC, model ASC
            LIMIT $2
            "#,
            category,
            limit as i64
        )
        .fetch_all(&state.pg)
        .await
        .map_err(|e| {
            error!("Erreur récupération modèles par catégorie: {}", e);
            AppError::DatabaseError(e.to_string())
        })?
    } else {
        // Tous les modèles
        sqlx::query_as!(
            VehicleModel,
            r#"
            SELECT id, brand, model, year_min, year_max, category, fuel_type, usage_count
            FROM vehicle_models
            ORDER BY usage_count DESC, brand ASC, model ASC
            LIMIT $1
            "#,
            limit as i64
        )
        .fetch_all(&state.pg)
        .await
        .map_err(|e| {
            error!("Erreur récupération tous les modèles: {}", e);
            AppError::DatabaseError(e.to_string())
        })?
    };

    info!("✅ {} modèles récupérés", models.len());
    Ok(Json(models))
}

/// POST /api/vehicle-models - Créer un nouveau modèle de véhicule
pub async fn create_vehicle_model(
    State(state): State<Arc<AppState>>,
    claims: Claims,
    Json(payload): Json<CreateVehicleModelPayload>,
) -> AppResult<Json<VehicleModel>> {
    info!("Création modèle véhicule: {} {}", payload.brand, payload.model);

    let model = sqlx::query_as!(
        VehicleModel,
        r#"
        INSERT INTO vehicle_models (brand, model, category, fuel_type, added_by, usage_count)
        VALUES ($1, $2, $3, $4, $5, 1)
        ON CONFLICT (brand, model) DO UPDATE
        SET usage_count = vehicle_models.usage_count + 1,
            updated_at = NOW()
        RETURNING id, brand, model, year_min, year_max, category, fuel_type, usage_count
        "#,
        payload.brand,
        payload.model,
        payload.category,
        payload.fuel_type,
        claims.user_id as i32
    )
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("Erreur création modèle véhicule: {}", e);
        AppError::DatabaseError(e.to_string())
    })?;

    info!("✅ Modèle véhicule créé: {} {}", model.brand, model.model);
    Ok(Json(model))
}

/// POST /api/vehicle-models/increment - Incrémenter usage d'un modèle
pub async fn increment_model_usage(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<IncrementUsagePayload>,
) -> AppResult<StatusCode> {
    sqlx::query!(
        r#"
        UPDATE vehicle_models
        SET usage_count = usage_count + 1,
            updated_at = NOW()
        WHERE brand = $1 AND model = $2
        "#,
        payload.brand,
        payload.model
    )
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("Erreur incrémentation usage modèle: {}", e);
        AppError::DatabaseError(e.to_string())
    })?;

    Ok(StatusCode::OK)
}

/// GET /api/vehicle-models/popular - Modèles populaires
pub async fn get_popular_models(
    State(state): State<Arc<AppState>>,
    Query(params): Query<GetVehicleModelsQuery>,
) -> AppResult<Json<Vec<VehicleModel>>> {
    let limit = params.limit.unwrap_or(20);
    
    let models = sqlx::query_as!(
        VehicleModel,
        r#"
        SELECT id, brand, model, year_min, year_max, category, fuel_type, usage_count
        FROM vehicle_models
        ORDER BY usage_count DESC
        LIMIT $1
        "#,
        limit as i64
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("Erreur récupération modèles populaires: {}", e);
        AppError::DatabaseError(e.to_string())
    })?;

    Ok(Json(models))
}







