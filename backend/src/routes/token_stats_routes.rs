// Routes pour les statistiques de consommation de tokens
use axum::{
    extract::{Extension, State, Query},
    routing::get,
    Json, Router,
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use log::{info, error};
use sqlx::Row; // ✅ Pour .get() sur les rows

use crate::{
    state::AppState,
    middlewares::jwt::AuthenticatedUser,
};

#[derive(Debug, Deserialize)]
pub struct TokenStatsQuery {
    pub days: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct TokenStatsResponse {
    pub total_requests: i64,
    pub total_tokens_consumed: i64,
    pub total_cost_xaf: i64,
    pub avg_tokens_per_request: f64,
    pub by_intention: Value,
    pub by_source: Value,
    pub daily_consumption: Value,
    pub current_balance: i64,
    pub recent_usage: Vec<RecentUsageItem>,
}

#[derive(Debug, Serialize)]
pub struct RecentUsageItem {
    pub id: i32,
    pub intention: String,
    pub tokens_ia_consumed: i32,
    pub tokens_cost_xaf: i32,
    pub tokens_deducted: i32,
    pub balance_after: i64,
    pub processing_time_ms: Option<i32>,
    pub response_source: Option<String>,
    pub endpoint: Option<String>,
    pub created_at: chrono::NaiveDateTime,
}

/// GET /api/tokens/stats - Récupère les statistiques de consommation de tokens
pub async fn get_token_stats(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(params): Query<TokenStatsQuery>,
) -> Result<Json<TokenStatsResponse>, (StatusCode, Json<Value>)> {
    let user_id = user.id;
    let days = params.days.unwrap_or(30).max(1).min(365); // Entre 1 et 365 jours
    
    info!("[TokenStats] Récupération stats pour utilisateur {} (derniers {} jours)", user_id, days);
    
    // ✅ Utiliser sqlx::query() au lieu de query!() pour compatibilité SQLX_OFFLINE
    let stats_row = sqlx::query(
        r#"
        SELECT 
            COALESCE(SUM(tokens_ia_consumed), 0)::BIGINT as total_tokens_consumed,
            COALESCE(SUM(tokens_cost_xaf), 0)::BIGINT as total_cost_xaf,
            COUNT(*)::BIGINT as total_requests,
            COALESCE(AVG(tokens_ia_consumed), 0.0) as avg_tokens_per_request
        FROM token_usage_logs
        WHERE user_id = $1
          AND created_at >= CURRENT_TIMESTAMP - ($2 || ' days')::INTERVAL
        "#
    )
    .bind(user_id)
    .bind(days.to_string())
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[TokenStats] Erreur récupération stats globales: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({
            "error": "Erreur lors de la récupération des statistiques"
        })))
    })?;
    
    // Extraire manuellement les valeurs
    let total_tokens_consumed = stats_row.get::<i64, _>("total_tokens_consumed");
    let total_cost_xaf = stats_row.get::<i64, _>("total_cost_xaf");
    let total_requests = stats_row.get::<i64, _>("total_requests");
    let avg_tokens_per_request = stats_row.get::<f64, _>("avg_tokens_per_request");
    
    // Stats par intention
    let by_intention_rows = sqlx::query(
        r#"
        SELECT 
            intention,
            COUNT(*)::BIGINT as count,
            COALESCE(SUM(tokens_ia_consumed), 0)::BIGINT as total_tokens,
            COALESCE(SUM(tokens_cost_xaf), 0)::BIGINT as total_cost_xaf
        FROM token_usage_logs
        WHERE user_id = $1
          AND created_at >= CURRENT_TIMESTAMP - ($2 || ' days')::INTERVAL
        GROUP BY intention
        ORDER BY total_tokens DESC
        "#
    )
    .bind(user_id)
    .bind(days.to_string())
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[TokenStats] Erreur stats par intention: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({
            "error": "Erreur lors de la récupération des stats par intention"
        })))
    })?;
    
    let by_intention: Value = by_intention_rows.iter().map(|row| {
        use sqlx::Row;
        (
            row.get::<String, _>("intention"),
            json!({
                "count": row.get::<i64, _>("count"),
                "tokens": row.get::<i64, _>("total_tokens"),
                "cost_xaf": row.get::<i64, _>("total_cost_xaf")
            })
        )
    }).collect();
    
    // Stats par source
    let by_source_rows = sqlx::query(
        r#"
        SELECT 
            COALESCE(response_source, 'unknown') as source,
            COUNT(*)::BIGINT as count,
            COALESCE(SUM(tokens_ia_consumed), 0)::BIGINT as total_tokens
        FROM token_usage_logs
        WHERE user_id = $1
          AND created_at >= CURRENT_TIMESTAMP - ($2 || ' days')::INTERVAL
        GROUP BY response_source
        ORDER BY total_tokens DESC
        "#
    )
    .bind(user_id)
    .bind(days.to_string())
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[TokenStats] Erreur stats par source: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({
            "error": "Erreur lors de la récupération des stats par source"
        })))
    })?;
    
    let by_source: Value = by_source_rows.iter().map(|row| {
        use sqlx::Row;
        (
            row.get::<String, _>("source"),
            json!({
                "count": row.get::<i64, _>("count"),
                "tokens": row.get::<i64, _>("total_tokens")
            })
        )
    }).collect();
    
    // Consommation journalière
    let daily_rows = sqlx::query(
        r#"
        SELECT 
            DATE(created_at) as consumption_date,
            COUNT(*)::BIGINT as count,
            COALESCE(SUM(tokens_ia_consumed), 0)::BIGINT as total_tokens,
            COALESCE(SUM(tokens_cost_xaf), 0)::BIGINT as total_cost_xaf
        FROM token_usage_logs
        WHERE user_id = $1
          AND created_at >= CURRENT_TIMESTAMP - ($2 || ' days')::INTERVAL
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at) DESC
        "#
    )
    .bind(user_id)
    .bind(days.to_string())
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[TokenStats] Erreur stats journalières: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({
            "error": "Erreur lors de la récupération des stats journalières"
        })))
    })?;
    
    let daily_consumption: Value = daily_rows.iter().map(|row| {
        use sqlx::Row;
        (
            row.get::<Option<chrono::NaiveDate>, _>("consumption_date")
                .map(|d| d.to_string())
                .unwrap_or_else(|| "unknown".to_string()),
            json!({
                "count": row.get::<i64, _>("count"),
                "tokens": row.get::<i64, _>("total_tokens"),
                "cost_xaf": row.get::<i64, _>("total_cost_xaf")
            })
        )
    }).collect();
    
    // 10 dernières utilisations
    let recent_usage_rows = sqlx::query(
        r#"
        SELECT 
            id,
            intention,
            tokens_ia_consumed,
            tokens_cost_xaf,
            tokens_deducted,
            balance_after,
            processing_time_ms,
            response_source,
            endpoint,
            created_at
        FROM token_usage_logs
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 10
        "#
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[TokenStats] Erreur récupération historique récent: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({
            "error": "Erreur lors de la récupération de l'historique"
        })))
    })?;
    
    let recent_usage: Vec<RecentUsageItem> = recent_usage_rows.iter().map(|row| {
        use sqlx::Row;
        RecentUsageItem {
            id: row.get("id"),
            intention: row.get("intention"),
            tokens_ia_consumed: row.get("tokens_ia_consumed"),
            tokens_cost_xaf: row.get("tokens_cost_xaf"),
            tokens_deducted: row.get("tokens_deducted"),
            balance_after: row.get("balance_after"),
            processing_time_ms: row.get("processing_time_ms"),
            response_source: row.get("response_source"),
            endpoint: row.get("endpoint"),
            created_at: row.get("created_at"),
        }
    }).collect();
    
    // Récupérer le solde actuel
    let balance_row = sqlx::query(
        "SELECT tokens_balance FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[TokenStats] Erreur récupération solde: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({
            "error": "Erreur lors de la récupération du solde"
        })))
    })?;
    
    let current_balance = balance_row.get::<i64, _>("tokens_balance");
    
    let response = TokenStatsResponse {
        total_requests,
        total_tokens_consumed,
        total_cost_xaf,
        avg_tokens_per_request,
        by_intention,
        by_source,
        daily_consumption,
        current_balance,
        recent_usage,
    };
    
    info!("[TokenStats] ✅ Stats récupérées: {} requêtes, {} tokens consommés", 
        response.total_requests, response.total_tokens_consumed);
    
    Ok(Json(response))
}

/// Créer le router pour les stats de tokens
pub fn token_stats_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/tokens/stats", get(get_token_stats))
        .layer(axum::middleware::from_fn(crate::middlewares::jwt::jwt_auth))
}

