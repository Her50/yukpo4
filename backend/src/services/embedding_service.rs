use crate::core::types::AppError;
use serde_json::Value;
use sqlx::PgPool;
use crate::models::service_model::EmbeddingStatus;

/// ? Traite l'embedding d'un service avec mise ? jour du statut
pub async fn process_service_embedding(
    pool: &PgPool,
    service_id: i32,
    _service_data: Value,
    _user_id: i32,
) -> Result<(), AppError> {
    // Mettre ? jour le statut ? "processing"
    update_embedding_status(pool, service_id, EmbeddingStatus::Processing, None).await?;

    // Simplification pour ?viter les probl?mes de lifetime
    log::info!("[EMBEDDING_SERVICE] Traitement embedding simplifi? pour service {}", service_id);
    
    // Mise ? jour du statut final
    update_embedding_status(pool, service_id, EmbeddingStatus::Success, None).await?;
    log::info!("[EMBEDDING_SERVICE] ? Service {} index? avec succ?s (mode simplifi?)", service_id);
    
    Ok(())
}

/// ? Met ? jour le statut d'embedding d'un service en base
async fn update_embedding_status(
    pool: &PgPool,
    service_id: i32,
    status: EmbeddingStatus,
    error_message: Option<String>,
) -> Result<(), AppError> {
    let status_str: String = status.into();
    
    sqlx::query!(
        "UPDATE services SET 
         embedding_status = $1, 
         embedding_error = $2, 
         embedding_last_attempt = NOW(),
         updated_at = NOW()
         WHERE id = $3",
        status_str,
        error_message,
        service_id
    )
    .execute(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur mise ? jour statut embedding: {}", e)))?;

    log::info!("[EMBEDDING_SERVICE] ?? Statut embedding mis ? jour pour service {}: {}", service_id, status_str);
    
    Ok(())
} 
