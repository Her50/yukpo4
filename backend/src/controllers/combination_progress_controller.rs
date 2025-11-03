// Controller pour suivre la progression de génération de combinaisons
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Serialize;
use std::sync::Arc;
use crate::state::AppState;
use crate::core::types::AppError;

#[derive(Debug, Serialize)]
pub struct ProgressResponse {
    pub status: String,  // "in_progress" | "completed" | "error" | "not_found"
    pub current: Option<usize>,
    pub total: Option<usize>,
    pub percentage: Option<f64>,
    pub seeds_available: bool,
    pub estimated_remaining_seconds: Option<u64>,
    pub updated_at: Option<String>,
}

/// GET /api/combinations/progress/:session_id
pub async fn get_combination_progress(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> Result<Json<ProgressResponse>, (StatusCode, String)> {
    
    log::info!(
        "[ProgressController] Vérification progression session: {}",
        session_id
    );
    
    // 1. Vérifier dans Redis si génération en cours
    if let Some(ref redis_client) = state.redis_client {
        match get_progress_from_redis(redis_client, &session_id).await {
            Ok(Some(progress)) => {
                log::info!(
                    "[ProgressController] Redis: {} ({:.1}%)",
                    progress.status,
                    progress.percentage.unwrap_or(0.0)
                );
                return Ok(Json(progress));
            }
            Ok(None) => {
                // Pas dans Redis, vérifier DB
            }
            Err(e) => {
                log::warn!("[ProgressController] Erreur Redis: {}", e);
                // Continue vers DB
            }
        }
    }
    
    // 2. Vérifier dans la DB si terminé
    match check_completion_in_db(&state.pg, &session_id).await {
        Ok(Some(count)) => {
            log::info!(
                "[ProgressController] DB: {} combinaisons trouvées (completed)",
                count
            );
            
            Ok(Json(ProgressResponse {
                status: "completed".to_string(),
                current: Some(count),
                total: Some(count),
                percentage: Some(100.0),
                seeds_available: true,
                estimated_remaining_seconds: Some(0),
                updated_at: Some(chrono::Utc::now().to_rfc3339()),
            }))
        }
        Ok(None) => {
            log::warn!(
                "[ProgressController] Session {} non trouvée",
                session_id
            );
            
            Ok(Json(ProgressResponse {
                status: "not_found".to_string(),
                current: None,
                total: None,
                percentage: None,
                seeds_available: false,
                estimated_remaining_seconds: None,
                updated_at: None,
            }))
        }
        Err(e) => {
            log::error!("[ProgressController] Erreur DB: {}", e);
            
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Erreur vérification DB: {}", e)
            ))
        }
    }
}

/// Récupérer la progression depuis Redis
async fn get_progress_from_redis(
    redis_client: &redis::Client,
    session_id: &str,
) -> Result<Option<ProgressResponse>, AppError> {
    let mut conn = redis_client.get_multiplexed_async_connection().await
        .map_err(|e| AppError::Internal(format!("Erreur connexion Redis: {}", e)))?;
    
    let key = format!("combination_progress:{}", session_id);
    
    let progress_str: Option<String> = redis::cmd("GET")
        .arg(&key)
        .query_async(&mut conn)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur Redis GET: {}", e)))?;
    
    if let Some(progress_json) = progress_str {
        let progress: serde_json::Value = serde_json::from_str(&progress_json)
            .map_err(|e| AppError::Internal(format!("Erreur parse JSON: {}", e)))?;
        
        let status = progress["status"].as_str().unwrap_or("unknown").to_string();
        let current = progress["current"].as_u64().map(|v| v as usize);
        let total = progress["total"].as_u64().map(|v| v as usize);
        let percentage = progress["percentage"].as_f64();
        let updated_at = progress["updated_at"].as_str().map(String::from);
        
        // Estimer temps restant
        let estimated_remaining = if let (Some(curr), Some(tot)) = (current, total) {
            if curr < tot {
                let remaining = tot - curr;
                Some((remaining as f64 / 10000.0).ceil() as u64) // 10k comb/s estimé
            } else {
                Some(0)
            }
        } else {
            None
        };
        
        Ok(Some(ProgressResponse {
            status,
            current,
            total,
            percentage,
            seeds_available: true,
            estimated_remaining_seconds: estimated_remaining,
            updated_at,
        }))
    } else {
        Ok(None)
    }
}

/// Vérifier la complétion dans la DB
async fn check_completion_in_db(
    pool: &sqlx::PgPool,
    session_id: &str,
) -> Result<Option<usize>, AppError> {
    let count: Option<i64> = sqlx::query_scalar(
        "SELECT COUNT(*) FROM autocomplete_combinations WHERE session_id = $1"
    )
    .bind(session_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur query DB: {}", e)))?;
    
    Ok(count.map(|c| c as usize))
}

