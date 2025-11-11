use axum::{
    extract::{Path, State},
    Json,
};
use log::{error, info};
use std::sync::Arc;

use crate::core::types::{AppError, AppResult};
use crate::models::history_model::ConsultationHistorique;
use crate::services::service_history_service;
use crate::state::AppState;

/// Enregistre une consultation dans l'historique et gère le débit éventuel
pub async fn enregistrer_consultation(
    State(state): State<Arc<AppState>>,
    Path((user_id, service_id)): Path<(i32, i32)>,
) -> AppResult<Json<String>> {
    info!(
        "[enregistrer_consultation] user_id={}, service_id={}",
        user_id, service_id
    );

    let result = service_history_service::enregistrer_consultation(
        &state.pg,
        state.mongo_history.clone(),
        user_id,
        service_id,
    )
    .await;

    match result {
        Ok(message) => Ok(Json(message)),
        Err(e) => {
            error!("[enregistrer_consultation] Erreur: {e:?}");
            Err(e)
        }
    }
}

/// Récupère les cinq dernières consultations d'un utilisateur
pub async fn get_consultations_utilisateur(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<i32>,
) -> AppResult<Json<Vec<ConsultationHistorique>>> {
    info!("[get_consultations_utilisateur] user_id={}", user_id);

    let consultations = service_history_service::get_consultations_utilisateur(
        &state.pg,
        state.mongo_history.clone(),
        user_id,
    )
    .await;

    match consultations {
        Ok(records) => Ok(Json(records)),
        Err(e) => {
            error!("[get_consultations_utilisateur] Erreur: {e:?}");
            Err(e)
        }
    }
}

/// Récupère les statistiques de consultation pour un service donné (sans paramètre de période)
pub async fn get_service_consultation_stats(
    State(state): State<Arc<AppState>>,
    Path(service_id): Path<i32>,
) -> AppResult<Json<serde_json::Value>> {
    fetch_service_stats(state, service_id, None).await
}

/// Récupère les statistiques de consultation pour un service avec période glissante
pub async fn get_service_consultation_stats_with_days(
    State(state): State<Arc<AppState>>,
    Path((service_id, days)): Path<(i32, i64)>,
) -> AppResult<Json<serde_json::Value>> {
    fetch_service_stats(state, service_id, Some(days)).await
}

/// Récupère les statistiques globales de consultation (toutes périodes confondues)
pub async fn get_global_consultation_stats(
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<serde_json::Value>> {
    fetch_global_stats(state, None).await
}

/// Récupère les statistiques globales de consultation pour une période donnée
pub async fn get_global_consultation_stats_with_days(
    State(state): State<Arc<AppState>>,
    Path(days): Path<i64>,
) -> AppResult<Json<serde_json::Value>> {
    fetch_global_stats(state, Some(days)).await
}

async fn fetch_service_stats(
    state: Arc<AppState>,
    service_id: i32,
    days: Option<i64>,
) -> AppResult<Json<serde_json::Value>> {
    info!(
        "[fetch_service_stats] service_id={}, days={:?}",
        service_id, days
    );

    let stats = service_history_service::get_service_consultation_stats(
        state.mongo_history.clone(),
        service_id,
        days,
    )
    .await;

    match stats {
        Ok(data) => Ok(Json(data)),
        Err(e) => {
            error!("[fetch_service_stats] Erreur: {e:?}");
            Err(e)
        }
    }
}

async fn fetch_global_stats(
    state: Arc<AppState>,
    days: Option<i64>,
) -> AppResult<Json<serde_json::Value>> {
    info!("[fetch_global_stats] days={:?}", days);

    let stats =
        service_history_service::get_global_consultation_stats(state.mongo_history.clone(), days)
            .await;

    match stats {
        Ok(data) => Ok(Json(data)),
        Err(e) => {
            error!("[fetch_global_stats] Erreur: {e:?}");
            Err(AppError::Internal(e.to_string()))
        }
    }
}
