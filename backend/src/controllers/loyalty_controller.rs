/**
 * Contrôleur pour le programme de fidélité
 * Gestion des points, niveaux, récompenses
 */
use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
use axum::{
    extract::{Extension, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::{error, info};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;

// ============================================================================
// STRUCTURES
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct LoyaltyPointsResponse {
    pub total_points: i32,
    pub available_points: i32,
    pub used_points: i32,
    pub level: String, // 'bronze', 'silver', 'gold', 'platinum'
    pub next_level_points: i32,
    pub points_until_next: i32,
}

#[derive(Debug, Deserialize)]
pub struct AddPointsRequest {
    pub user_id: i32,
    pub points: i32,
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct RedeemPointsRequest {
    pub user_id: i32,
    pub points: i32,
    pub reward_id: String,
}

#[derive(Debug, Serialize)]
pub struct LoyaltyTransaction {
    pub id: String,
    pub type_: String, // 'earned', 'redeemed', 'expired'
    pub points: i32,
    pub description: String,
    pub timestamp: i64,
    pub expiry_date: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct LoyaltyReward {
    pub id: String,
    pub name: String,
    pub description: String,
    pub points_cost: i32,
    pub discount_percent: Option<i32>,
    pub discount_amount: Option<i32>,
    pub category: String, // 'discount', 'free_ticket', 'upgrade', 'cashback'
    pub available: bool,
}

// ============================================================================
// ENDPOINTS
// ============================================================================

/// Obtenir les points de fidélité d'un utilisateur
/// GET /api/loyalty/points?user_id={id}
pub async fn get_loyalty_points(
    State(state): State<Arc<AppState>>,
    Query(params): Query<serde_json::Value>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let user_id = params
        .get("user_id")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32)
        .unwrap_or(user.id);

    info!("[get_loyalty_points] User ID: {}", user_id);

    // Calculer les points depuis les transactions
    let query = r#"
        SELECT 
            COALESCE(SUM(CASE WHEN type = 'earned' THEN points ELSE 0 END), 0) as total_points,
            COALESCE(SUM(CASE WHEN type = 'earned' THEN points ELSE 0 END) - 
                     COALESCE(SUM(CASE WHEN type = 'redeemed' THEN points ELSE 0 END), 0), 0) as available_points,
            COALESCE(SUM(CASE WHEN type = 'redeemed' THEN points ELSE 0 END), 0) as used_points
        FROM loyalty_transactions
        WHERE user_id = $1
    "#;

    let row = sqlx::query(query).bind(user_id).fetch_one(&state.pg).await.map_err(|e| {
        error!("[get_loyalty_points] Erreur: {}", e);
        AppError::Internal(format!("Erreur récupération points: {}", e))
    })?;

    let total_points: i32 = row.get("total_points");
    let available_points: i32 = row.get("available_points");
    let used_points: i32 = row.get("used_points");

    // Calculer le niveau
    let level = calculate_level(total_points);
    let next_level_points = get_next_level_points(&level);
    let points_until_next = (next_level_points - total_points).max(0);

    let response = LoyaltyPointsResponse {
        total_points,
        available_points,
        used_points,
        level,
        next_level_points,
        points_until_next,
    };

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": response
        })),
    ))
}

/// Ajouter des points de fidélité
/// POST /api/loyalty/add-points
pub async fn add_loyalty_points(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<AddPointsRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[add_loyalty_points] User: {}, Points: {}, Reason: {}",
        payload.user_id, payload.points, payload.reason
    );

    // Vérifier que l'utilisateur peut ajouter des points pour lui-même
    if payload.user_id != user.id {
        return Err(AppError::Forbidden(
            "Vous ne pouvez ajouter des points que pour votre propre compte".to_string(),
        ));
    }

    // Insérer la transaction
    let query = r#"
        INSERT INTO loyalty_transactions (user_id, type, points, description, timestamp)
        VALUES ($1, 'earned', $2, $3, EXTRACT(EPOCH FROM NOW())::BIGINT)
        RETURNING id
    "#;

    let row = sqlx::query(query)
        .bind(payload.user_id)
        .bind(payload.points)
        .bind(&payload.reason)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| {
            error!("[add_loyalty_points] Erreur: {}", e);
            AppError::Internal(format!("Erreur ajout points: {}", e))
        })?;

    let transaction_id: String = row.get("id");

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "transaction_id": transaction_id,
            "message": "Points ajoutés avec succès"
        })),
    ))
}

/// Utiliser des points pour une récompense
/// POST /api/loyalty/redeem
pub async fn redeem_loyalty_points(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<RedeemPointsRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[redeem_loyalty_points] User: {}, Points: {}, Reward: {}",
        payload.user_id, payload.points, payload.reward_id
    );

    // Vérifier que l'utilisateur peut utiliser ses propres points
    if payload.user_id != user.id {
        return Err(AppError::Forbidden(
            "Vous ne pouvez utiliser que vos propres points".to_string(),
        ));
    }

    // Vérifier que l'utilisateur a assez de points
    let points_query = r#"
        SELECT 
            COALESCE(SUM(CASE WHEN type = 'earned' THEN points ELSE 0 END) - 
                     COALESCE(SUM(CASE WHEN type = 'redeemed' THEN points ELSE 0 END), 0), 0) as available_points
        FROM loyalty_transactions
        WHERE user_id = $1
    "#;

    let points_row = sqlx::query(points_query)
        .bind(payload.user_id)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| {
            error!("[redeem_loyalty_points] Erreur vérification points: {}", e);
            AppError::Internal(format!("Erreur vérification points: {}", e))
        })?;

    let available_points: i32 = points_row.get("available_points");

    if available_points < payload.points {
        return Err(AppError::BadRequest(format!(
            "Points insuffisants. Disponible: {}, Demandé: {}",
            available_points, payload.points
        )));
    }

    // Vérifier que la récompense existe
    let reward_query = r#"
        SELECT id, points_cost, available
        FROM loyalty_rewards
        WHERE id = $1
    "#;

    let reward_result = sqlx::query(reward_query)
        .bind(&payload.reward_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| {
            error!(
                "[redeem_loyalty_points] Erreur vérification récompense: {}",
                e
            );
            AppError::Internal(format!("Erreur vérification récompense: {}", e))
        })?;

    if reward_result.is_none() {
        return Err(AppError::NotFound("Récompense introuvable".to_string()));
    }

    // Enregistrer la transaction de rédemption
    let redeem_query = r#"
        INSERT INTO loyalty_transactions (user_id, type, points, description, timestamp)
        VALUES ($1, 'redeemed', $2, $3, EXTRACT(EPOCH FROM NOW())::BIGINT)
        RETURNING id
    "#;

    let description = format!(
        "Échange de {} points pour récompense: {}",
        payload.points, payload.reward_id
    );

    let row = sqlx::query(redeem_query)
        .bind(payload.user_id)
        .bind(payload.points)
        .bind(&description)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| {
            error!("[redeem_loyalty_points] Erreur: {}", e);
            AppError::Internal(format!("Erreur échange points: {}", e))
        })?;

    let transaction_id: String = row.get("id");

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "transaction_id": transaction_id,
            "message": "Points échangés avec succès"
        })),
    ))
}

/// Obtenir l'historique des transactions
/// GET /api/loyalty/transactions?user_id={id}&limit={limit}
pub async fn get_loyalty_transactions(
    State(state): State<Arc<AppState>>,
    Query(params): Query<serde_json::Value>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let user_id = params
        .get("user_id")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32)
        .unwrap_or(user.id);
    let limit = params.get("limit").and_then(|v| v.as_i64()).map(|v| v as i32).unwrap_or(50);

    info!(
        "[get_loyalty_transactions] User ID: {}, Limit: {}",
        user_id, limit
    );

    let query = r#"
        SELECT 
            id::text as id,
            type,
            points,
            description,
            timestamp,
            expiry_date
        FROM loyalty_transactions
        WHERE user_id = $1
        ORDER BY timestamp DESC
        LIMIT $2
    "#;

    let rows = sqlx::query(query)
        .bind(user_id)
        .bind(limit)
        .fetch_all(&state.pg)
        .await
        .map_err(|e| {
            error!("[get_loyalty_transactions] Erreur: {}", e);
            AppError::Internal(format!("Erreur récupération transactions: {}", e))
        })?;

    let transactions: Vec<LoyaltyTransaction> = rows
        .iter()
        .map(|row| LoyaltyTransaction {
            id: row.get("id"),
            type_: row.get("type"),
            points: row.get("points"),
            description: row.get("description"),
            timestamp: row.get::<i64, _>("timestamp"),
            expiry_date: row.get("expiry_date"),
        })
        .collect();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "transactions": transactions
        })),
    ))
}

/// Obtenir les récompenses disponibles
/// GET /api/loyalty/rewards
pub async fn get_loyalty_rewards(
    State(state): State<Arc<AppState>>,
) -> AppResult<impl IntoResponse> {
    info!("[get_loyalty_rewards] Récupération récompenses");

    let query = r#"
        SELECT 
            id,
            name,
            description,
            points_cost,
            discount_percent,
            discount_amount,
            category,
            available
        FROM loyalty_rewards
        WHERE available = true
        ORDER BY points_cost ASC
    "#;

    let rows = sqlx::query(query).fetch_all(&state.pg).await.map_err(|e| {
        error!("[get_loyalty_rewards] Erreur: {}", e);
        AppError::Internal(format!("Erreur récupération récompenses: {}", e))
    })?;

    let rewards: Vec<LoyaltyReward> = rows
        .iter()
        .map(|row| LoyaltyReward {
            id: row.get("id"),
            name: row.get("name"),
            description: row.get("description"),
            points_cost: row.get("points_cost"),
            discount_percent: row.get("discount_percent"),
            discount_amount: row.get("discount_amount"),
            category: row.get("category"),
            available: row.get("available"),
        })
        .collect();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "rewards": rewards
        })),
    ))
}

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

fn calculate_level(total_points: i32) -> String {
    if total_points >= 10000 {
        "platinum".to_string()
    } else if total_points >= 5000 {
        "gold".to_string()
    } else if total_points >= 1000 {
        "silver".to_string()
    } else {
        "bronze".to_string()
    }
}

fn get_next_level_points(current_level: &str) -> i32 {
    match current_level {
        "bronze" => 1000,
        "silver" => 5000,
        "gold" => 10000,
        "platinum" => i32::MAX,
        _ => 1000,
    }
}
