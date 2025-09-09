use axum::{
    extract::{State, Path},
    Json,
};
use std::sync::Arc;
use log::info;

use crate::{
    core::types::AppResult,
};
use crate::state::AppState;

/// ? Enregistre une consultation dans l'historique
pub async fn enregistrer_consultation(
    State(_state): State<Arc<AppState>>,
    Path((user_id, service_id)): Path<(i32, i32)>,
) -> AppResult<Json<String>> {
    info!("[enregistrer_consultation] Called for user_id={}, service_id={}", user_id, service_id);
    
    // let result = service_history_service::enregistrer_consultation(
    //     &state.pg,
    //     state.mongo_history.clone(),
    //     user_id,
    //     service_id,
    // ).await;

    // match result {
    //     Ok(message) => Ok(Json(message)),
    //     Err(e) => {
    //         error!("[enregistrer_consultation] Error: {e:?}");
    //         Err(e)
    //     }
    // }
    Ok(axum::Json("Service temporairement d?sactiv?".to_string()))
}

/// ? R?cup?re les 5 derni?res consultations d'un utilisateur
pub async fn get_consultations_utilisateur(
    State(_state): State<Arc<AppState>>,
    Path(user_id): Path<i32>,
) -> AppResult<Json<Vec<serde_json::Value>>> {
    info!("[get_consultations_utilisateur] Called for user_id={}", user_id);
    
    // let consultations = service_history_service::get_consultations_utilisateur(
    //     state.mongo_history.clone(),
    //     user_id,
    // ).await;

    // match consultations {
    //     Ok(records) => Ok(Json(records)),
    //     Err(e) => {
    //         error!("[get_consultations_utilisateur] Error: {e:?}");
    //         Err(e)
    //     }
    // }
    Err(crate::core::types::AppError::Internal(String::from("Service temporairement d?sactiv?")))
}

/// ?? R?cup?re les statistiques de consultation d'un service
pub async fn get_service_consultation_stats(
    State(_state): State<Arc<AppState>>,
    Path((service_id, days)): Path<(i32, Option<i64>)>,
) -> AppResult<Json<serde_json::Value>> {
    info!("[get_service_consultation_stats] Called for service_id={}, days={:?}", service_id, days);
    
    // let stats = service_history_service::get_service_consultation_stats(
    //     state.mongo_history.clone(),
    //     service_id,
    //     days,
    // ).await;

    // match stats {
    //     Ok(stats_data) => Ok(Json(stats_data)),
    //     Err(e) => {
    //         error!("[get_service_consultation_stats] Error: {e:?}");
    //         Err(e)
    //     }
    // }
    Err(crate::core::types::AppError::Internal(String::from("Service temporairement d?sactiv?")))
}

/// ?? R?cup?re les statistiques globales de consultation
pub async fn get_global_consultation_stats(
    State(_state): State<Arc<AppState>>,
    Path(days): Path<Option<i64>>,
) -> AppResult<Json<serde_json::Value>> {
    info!("[get_global_consultation_stats] Called for days={:?}", days);
    
    // let stats = state.mongo_history
    //     .get_global_consultation_stats(days)
    //     .await;

    // match stats {
    //     Ok(stats_data) => Ok(Json(stats_data)),
    //     Err(e) => {
    //         error!("[get_global_consultation_stats] Error: {e:?}");
    //         Err(crate::core::types::AppError::Internal(e.to_string()))
    //     }
    // }
    Err(crate::core::types::AppError::Internal(String::from("Service temporairement d?sactiv?")))
}
