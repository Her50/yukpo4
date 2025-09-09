use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use std::sync::Arc;
use crate::state::AppState;
use crate::services::prestataire_service::{get_prestataire_info, get_prestataires_info_batch};

/// GET /prestataires/:id - Récupère les informations d'un prestataire
pub async fn get_prestataire(
    Path(prestataire_id): Path<i32>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    match get_prestataire_info(&state.pg, prestataire_id).await {
        Ok(Some(prestataire)) => Ok(Json(prestataire)),
        Ok(None) => Err((StatusCode::NOT_FOUND, Json(serde_json::json!({
            "error": "Prestataire non trouvé"
        })))),
        Err(e) => {
            log::error!("Erreur récupération prestataire {}: {:?}", prestataire_id, e);
            Err((StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "error": "Erreur serveur"
            }))))
        }
    }
}

#[derive(Deserialize)]
pub struct BatchPrestatairesRequest {
    pub user_ids: Vec<i32>,
}

/// POST /prestataires/batch - Récupère les informations de plusieurs prestataires
pub async fn get_prestataires_batch(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<BatchPrestatairesRequest>,
) -> impl IntoResponse {
    match get_prestataires_info_batch(&state.pg, &payload.user_ids).await {
        Ok(prestataires) => Ok(Json(serde_json::json!({
            "prestataires": prestataires,
            "count": prestataires.len()
        }))),
        Err(e) => {
            log::error!("Erreur récupération batch prestataires: {:?}", e);
            Err((StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "error": "Erreur serveur"
            }))))
        }
    }
} 