use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
    Extension,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::state::AppState;
use crate::middlewares::jwt::AuthenticatedUser;
// use crate::services::embedding_tracker::{EmbeddingStatus, EmbeddingTracker};

/// ? R?ponse pour le statut d'embedding d'un service
#[derive(Debug, Serialize)]
pub struct EmbeddingStatusResponse {
    pub service_id: i32,
    pub embedding_status: String,
    pub embedding_error: Option<String>,
    pub embedding_last_attempt: Option<chrono::DateTime<chrono::Utc>>,
    pub embedding_attempts: i32,
    pub successful_embeddings: i32,
    pub failed_embeddings: i32,
    pub total_embeddings: i32,
    pub processing_time_ms: Option<u64>,
    pub message: String,
}

/// ? Requ?te pour relancer l'embedding d'un service
#[derive(Debug, Deserialize)]
pub struct RetryEmbeddingRequest {
    pub force: Option<bool>,
}

/// ? Endpoint pour obtenir le statut d'embedding d'un service
pub async fn get_embedding_status(
    State(_state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Path(_service_id): Path<i32>,
) -> Result<Json<EmbeddingStatusResponse>, StatusCode> {
    // let tracker = EmbeddingTracker::new(state.pg.clone(), state.redis_client.clone());
    
    // let status = tracker.get_status(service_id).await
    //     .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // let response = EmbeddingStatusResponse {
    //     service_id: status.service_id,
    //     embedding_status: status.status.clone(),
    //     embedding_error: status.error_message,
    //     embedding_last_attempt: status.last_attempt,
    //     embedding_attempts: status.attempts,
    //     successful_embeddings: status.successful_embeddings,
    //     failed_embeddings: status.failed_embeddings,
    //     total_embeddings: status.total_embeddings,
    //     processing_time_ms: status.processing_time_ms,
    //     message: match status.status.as_str() {
    //         "pending" => "L'indexation IA est en attente".to_string(),
    //         "processing" => "L'indexation IA est en cours...".to_string(),
    //         "success" => "L'indexation IA est termin?e avec succ?s".to_string(),
    //         "failed" => "L'indexation IA a ?chou?".to_string(),
    //         "retry" => "L'indexation IA va ?tre relanc?e".to_string(),
    //         _ => "Statut d'indexation IA inconnu".to_string(),
    //     },
    // };

    // Ok(Json(response))
    Err(StatusCode::INTERNAL_SERVER_ERROR)
}

/// ? Endpoint pour relancer l'embedding d'un service
pub async fn retry_embedding(
    State(_state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Path(_service_id): Path<i32>,
    Json(_request): Json<RetryEmbeddingRequest>,
) -> Result<Json<EmbeddingStatusResponse>, StatusCode> {
    // let tracker = EmbeddingTracker::new(state.pg.clone(), state.redis_client.clone());
    
    // let status = tracker.retry_embedding(service_id, user.id).await
    //     .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // let response = EmbeddingStatusResponse {
    //     service_id: status.service_id,
    //     embedding_status: status.status.clone(),
    //     embedding_error: status.error_message,
    //     embedding_last_attempt: status.last_attempt,
    //     embedding_attempts: status.attempts,
    //     successful_embeddings: status.successful_embeddings,
    //     failed_embeddings: status.failed_embeddings,
    //     total_embeddings: status.total_embeddings,
    //     processing_time_ms: status.processing_time_ms,
    //     message: "Relance de l'indexation IA en cours...".to_string(),
    // };

    // Ok(Json(response))
    Err(StatusCode::INTERNAL_SERVER_ERROR)
}

/// ? Endpoint pour obtenir le statut d'embedding de tous les services d'un utilisateur
pub async fn get_user_services_embedding_status(
    State(_state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
) -> Result<Json<Vec<EmbeddingStatusResponse>>, StatusCode> {
    // let tracker = EmbeddingTracker::new(state.pg.clone(), state.redis_client.clone());
    
    // let statuses = tracker.get_user_services_status(user.id).await
    //     .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // let responses: Vec<EmbeddingStatusResponse> = statuses
    //     .into_iter()
    //     .map(|status| EmbeddingStatusResponse {
    //         service_id: status.service_id,
    //         embedding_status: status.status.clone(),
    //         embedding_error: status.error_message,
    //         embedding_last_attempt: status.last_attempt,
    //         embedding_attempts: status.attempts,
    //         successful_embeddings: status.successful_embeddings,
    //         failed_embeddings: status.failed_embeddings,
    //         total_embeddings: status.total_embeddings,
    //         processing_time_ms: status.processing_time_ms,
    //         message: match status.status.as_str() {
    //             "pending" => "L'indexation IA est en attente".to_string(),
    //             "processing" => "L'indexation IA est en cours...".to_string(),
    //             "success" => "L'indexation IA est termin?e avec succ?s".to_string(),
    //             "failed" => "L'indexation IA a ?chou?".to_string(),
    //             "retry" => "L'indexation IA va ?tre relanc?e".to_string(),
    //             _ => "Statut d'indexation IA inconnu".to_string(),
    //         },
    //     })
    //     .collect();

    // Ok(Json(responses))
    Err(StatusCode::INTERNAL_SERVER_ERROR)
} 
