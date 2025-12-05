// Contrôleur pour la gestion manuelle des places non disponibles
// Permet aux agences de bloquer/débloquer des places

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::{error, info};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;

// ============================================================================
// STRUCTURES DE REQUÊTE/RÉPONSE
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct BlockSeatRequest {
    pub product_id: String,
    pub seat_id: String,
    pub seat_number: i32,
    pub reason: Option<String>, // maintenance, damaged, reserved, other
    pub reason_details: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UnblockSeatRequest {
    pub product_id: String,
    pub seat_id: String,
}

#[derive(Debug, Serialize)]
pub struct SeatBlockInfo {
    pub id: String,
    pub product_id: String,
    pub seat_id: String,
    pub seat_number: i32,
    pub reason: String,
    pub reason_details: Option<String>,
    pub blocked_by: i32,
    pub blocked_at: String,
    pub blocked_by_name: Option<String>,
    pub product_name: Option<String>,
    pub bus_number: Option<String>,
}

// ============================================================================
// BLOQUER UNE PLACE
// ============================================================================

/// Bloquer manuellement une place
pub async fn block_seat(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<BlockSeatRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[block_seat] User ID: {}, Product ID: {}, Seat ID: {}",
        user_id, payload.product_id, payload.seat_id
    );

    // Vérifier que l'utilisateur est propriétaire de l'agence
    let is_owner: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM products p
            JOIN services s ON s.id = p.service_id
            WHERE p.id::text = $1
                AND s.user_id = $2
        )
        "#,
    )
    .bind(&payload.product_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[block_seat] Erreur vérification propriété: {}", e);
        AppError::Internal(format!("Erreur vérification: {}", e))
    })?;

    if !is_owner {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas propriétaire de cette agence".to_string(),
        ));
    }

    // Appeler la fonction SQL
    let reason = payload.reason.unwrap_or_else(|| "maintenance".to_string());
    let result: Value =
        sqlx::query_scalar("SELECT block_bus_seat_manually($1, $2, $3, $4, $5, $6)")
            .bind(&payload.product_id)
            .bind(&payload.seat_id)
            .bind(payload.seat_number)
            .bind(&reason)
            .bind(&payload.reason_details)
            .bind(user_id)
            .fetch_one(&state.pg)
            .await
            .map_err(|e| {
                error!("[block_seat] Erreur: {}", e);
                AppError::Internal(format!("Erreur blocage place: {}", e))
            })?;

    let success = result
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    if !success {
        let error_msg = result
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("Erreur blocage place");
        return Err(AppError::BadRequest(error_msg.to_string()));
    }

    Ok((StatusCode::OK, Json(result)))
}

// ============================================================================
// DÉBLOQUER UNE PLACE
// ============================================================================

/// Débloquer une place
pub async fn unblock_seat(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<UnblockSeatRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[unblock_seat] User ID: {}, Product ID: {}, Seat ID: {}",
        user_id, payload.product_id, payload.seat_id
    );

    // Vérifier que l'utilisateur est propriétaire de l'agence
    let is_owner: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM products p
            JOIN services s ON s.id = p.service_id
            WHERE p.id::text = $1
                AND s.user_id = $2
        )
        "#,
    )
    .bind(&payload.product_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[unblock_seat] Erreur vérification propriété: {}", e);
        AppError::Internal(format!("Erreur vérification: {}", e))
    })?;

    if !is_owner {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas propriétaire de cette agence".to_string(),
        ));
    }

    // Appeler la fonction SQL
    let result: Value = sqlx::query_scalar("SELECT unblock_bus_seat_manually($1, $2, $3)")
        .bind(&payload.product_id)
        .bind(&payload.seat_id)
        .bind(user_id)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| {
            error!("[unblock_seat] Erreur: {}", e);
            AppError::Internal(format!("Erreur déblocage place: {}", e))
        })?;

    let success = result
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    if !success {
        let error_msg = result
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("Erreur déblocage place");
        return Err(AppError::BadRequest(error_msg.to_string()));
    }

    Ok((StatusCode::OK, Json(result)))
}

// ============================================================================
// LISTE DES BLOCAGES
// ============================================================================

/// Obtenir la liste des places bloquées pour un produit
pub async fn get_blocked_seats(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(product_id): Path<String>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_blocked_seats] User ID: {}, Product ID: {}",
        user_id, product_id
    );

    // Vérifier que l'utilisateur est propriétaire de l'agence
    let is_owner: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM products p
            JOIN services s ON s.id = p.service_id
            WHERE p.id::text = $1
                AND s.user_id = $2
        )
        "#,
    )
    .bind(&product_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_blocked_seats] Erreur vérification propriété: {}", e);
        AppError::Internal(format!("Erreur vérification: {}", e))
    })?;

    if !is_owner {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas propriétaire de cette agence".to_string(),
        ));
    }

    // Récupérer depuis la vue
    let rows = sqlx::query(
        r#"
        SELECT 
            id,
            product_id,
            seat_id,
            seat_number,
            reason,
            reason_details,
            blocked_by,
            blocked_at,
            blocked_by_name,
            product_name,
            numero_bus
        FROM bus_active_seat_blocks
        WHERE product_id = $1
        ORDER BY seat_number ASC
        "#,
    )
    .bind(&product_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_blocked_seats] Erreur: {}", e);
        AppError::Internal(format!("Erreur récupération blocages: {}", e))
    })?;

    let mut blocks = Vec::new();
    for row in rows {
        let block = SeatBlockInfo {
            id: row.get::<String, _>("id"),
            product_id: row.get::<String, _>("product_id"),
            seat_id: row.get::<String, _>("seat_id"),
            seat_number: row.get::<i32, _>("seat_number"),
            reason: row
                .get::<Option<String>, _>("reason")
                .unwrap_or_else(|| "maintenance".to_string()),
            reason_details: row.get::<Option<String>, _>("reason_details"),
            blocked_by: row.get::<i32, _>("blocked_by"),
            blocked_at: row
                .get::<chrono::DateTime<chrono::Utc>, _>("blocked_at")
                .to_rfc3339(),
            blocked_by_name: row.get::<Option<String>, _>("blocked_by_name"),
            product_name: row.get::<Option<String>, _>("product_name"),
            bus_number: row.get::<Option<String>, _>("numero_bus"),
        };
        blocks.push(block);
    }

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "blocks": blocks })),
    ))
}

// ============================================================================
// DISPONIBILITÉ AVEC BLOCAGES
// ============================================================================

/// Obtenir la disponibilité des places incluant les blocages
pub async fn get_seat_availability_with_blocks(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(product_id): Path<String>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_seat_availability_with_blocks] User ID: {}, Product ID: {}",
        user_id, product_id
    );

    // Vérifier que l'utilisateur est propriétaire de l'agence
    let is_owner: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM products p
            JOIN services s ON s.id = p.service_id
            WHERE p.id::text = $1
                AND s.user_id = $2
        )
        "#,
    )
    .bind(&product_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!(
            "[get_seat_availability_with_blocks] Erreur vérification propriété: {}",
            e
        );
        AppError::Internal(format!("Erreur vérification: {}", e))
    })?;

    if !is_owner {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas propriétaire de cette agence".to_string(),
        ));
    }

    // Appeler la fonction SQL
    let result: Value = sqlx::query_scalar("SELECT get_bus_seat_availability_with_blocks($1)")
        .bind(&product_id)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| {
            error!("[get_seat_availability_with_blocks] Erreur: {}", e);
            AppError::Internal(format!("Erreur récupération disponibilité: {}", e))
        })?;

    Ok((StatusCode::OK, Json(result)))
}
