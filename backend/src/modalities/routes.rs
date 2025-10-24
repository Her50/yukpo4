use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::Deserialize;
use uuid::Uuid;
use std::sync::Arc;

use crate::state::AppState;
use crate::modalities::models::{
    CreateCustomModalityRequest, CustomModality, CustomModalityResponse, 
    IncrementUsageRequest, PopularModalitiesRequest, ModalityStats
};

#[derive(Debug, Deserialize)]
pub struct ModalityQuery {
    pub product_type: Option<String>,
    pub field_name: Option<String>,
    pub limit: Option<i32>,
}

/// Obtenir toutes les modalités personnalisées ou filtrées
pub async fn get_custom_modalities(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ModalityQuery>,
) -> Result<Json<CustomModalityResponse>, StatusCode> {
    let pool = &state.db;
    let result = if let (Some(product_type), Some(field_name)) = (params.product_type, params.field_name) {
        // Obtenir les modalités pour un champ spécifique
        match CustomModality::get_by_field(pool, &product_type, &field_name).await {
            Ok(modalities) => {
                // Convertir en CustomModality pour la réponse
                let custom_modalities = modalities.into_iter().map(|modality| CustomModality {
                    id: Uuid::new_v4(), // ID temporaire pour la réponse
                    product_type: product_type.clone(),
                    field_name: field_name.clone(),
                    modality,
                    added_by: None,
                    added_at: chrono::Utc::now(),
                    usage_count: 0,
                    created_at: chrono::Utc::now(),
                    updated_at: chrono::Utc::now(),
                }).collect();

                CustomModalityResponse {
                    success: true,
                    data: Some(custom_modalities),
                    error: None,
                }
            }
            Err(e) => {
                log::error!("Erreur lors de la récupération des modalités: {}", e);
                CustomModalityResponse {
                    success: false,
                    data: None,
                    error: Some("Erreur lors de la récupération des modalités".to_string()),
                }
            }
        }
    } else {
        // Obtenir toutes les modalités
        match CustomModality::get_all(pool).await {
            Ok(modalities) => CustomModalityResponse {
                success: true,
                data: Some(modalities),
                error: None,
            },
            Err(e) => {
                log::error!("Erreur lors de la récupération des modalités: {}", e);
                CustomModalityResponse {
                    success: false,
                    data: None,
                    error: Some("Erreur lors de la récupération des modalités".to_string()),
                }
            }
        }
    };

    Ok(Json(result))
}

/// Créer une nouvelle modalité personnalisée
pub async fn create_custom_modality(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateCustomModalityRequest>,
) -> Result<Json<CustomModalityResponse>, StatusCode> {
    let pool = &state.db;
    // Valider les données
    if request.product_type.trim().is_empty() || 
       request.field_name.trim().is_empty() || 
       request.modality.trim().is_empty() {
        return Ok(Json(CustomModalityResponse {
            success: false,
            data: None,
            error: Some("Tous les champs sont obligatoires".to_string()),
        }));
    }

    // Vérifier si la modalité existe déjà
    match CustomModality::exists(
        pool,
        &request.product_type,
        &request.field_name,
        &request.modality,
    ).await {
        Ok(exists) => {
            if exists {
                return Ok(Json(CustomModalityResponse {
                    success: false,
                    data: None,
                    error: Some("Cette modalité existe déjà".to_string()),
                }));
            }
        }
        Err(e) => {
            log::error!("Erreur lors de la vérification de l'existence: {}", e);
            return Ok(Json(CustomModalityResponse {
                success: false,
                data: None,
                error: Some("Erreur lors de la vérification".to_string()),
            }));
        }
    }

    // Créer la modalité
    match CustomModality::create(pool, request).await {
        Ok(modality) => {
            log::info!("Nouvelle modalité créée: {} - {} - {}", 
                      modality.product_type, modality.field_name, modality.modality);
            
            Ok(Json(CustomModalityResponse {
                success: true,
                data: Some(vec![modality]),
                error: None,
            }))
        }
        Err(e) => {
            log::error!("Erreur lors de la création de la modalité: {}", e);
            Ok(Json(CustomModalityResponse {
                success: false,
                data: None,
                error: Some("Erreur lors de la création de la modalité".to_string()),
            }))
        }
    }
}

/// Incrémenter le compteur d'utilisation d'une modalité
pub async fn increment_usage(
    State(state): State<Arc<AppState>>,
    Json(request): Json<IncrementUsageRequest>,
) -> Result<Json<CustomModalityResponse>, StatusCode> {
    let pool = &state.db;
    match CustomModality::increment_usage(pool, request).await {
        Ok(_) => Ok(Json(CustomModalityResponse {
            success: true,
            data: None,
            error: None,
        })),
        Err(e) => {
            log::error!("Erreur lors de l'incrémentation: {}", e);
            Ok(Json(CustomModalityResponse {
                success: false,
                data: None,
                error: Some("Erreur lors de l'incrémentation".to_string()),
            }))
        }
    }
}

/// Obtenir les modalités les plus populaires
pub async fn get_popular_modalities(
    State(state): State<Arc<AppState>>,
    Query(params): Query<PopularModalitiesRequest>,
) -> Result<Json<CustomModalityResponse>, StatusCode> {
    let pool = &state.db;
    match CustomModality::get_popular(pool, params).await {
        Ok(modalities) => Ok(Json(CustomModalityResponse {
            success: true,
            data: Some(modalities),
            error: None,
        })),
        Err(e) => {
            log::error!("Erreur lors de la récupération des modalités populaires: {}", e);
            Ok(Json(CustomModalityResponse {
                success: false,
                data: None,
                error: Some("Erreur lors de la récupération des modalités populaires".to_string()),
            }))
        }
    }
}

/// Obtenir les statistiques des modalités
pub async fn get_modality_stats(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ModalityStats>, StatusCode> {
    let pool = &state.db;
    match CustomModality::get_stats(pool).await {
        Ok(stats) => Ok(Json(stats)),
        Err(e) => {
            log::error!("Erreur lors de la récupération des statistiques: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Supprimer une modalité personnalisée
pub async fn delete_custom_modality(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<CustomModalityResponse>, StatusCode> {
    let pool = &state.db;
    match CustomModality::delete(pool, id).await {
        Ok(_) => {
            log::info!("Modalité supprimée: {}", id);
            Ok(Json(CustomModalityResponse {
                success: true,
                data: None,
                error: None,
            }))
        }
        Err(e) => {
            log::error!("Erreur lors de la suppression de la modalité: {}", e);
            Ok(Json(CustomModalityResponse {
                success: false,
                data: None,
                error: Some("Erreur lors de la suppression de la modalité".to_string()),
            }))
        }
    }
}

/// Créer le routeur pour les modalités
pub fn create_modalities_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/modalities/custom", get(get_custom_modalities))
        .route("/api/modalities/custom", post(create_custom_modality))
        .route("/api/modalities/usage", post(increment_usage))
        .route("/api/modalities/popular", get(get_popular_modalities))
        .route("/api/modalities/stats", get(get_modality_stats))
        .route("/api/modalities/custom/:id", axum::routing::delete(delete_custom_modality))
}
