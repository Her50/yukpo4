/**
 * Contrôleur pour les avis et notations de tickets de bus
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

#[derive(Debug, Deserialize)]
pub struct RateTicketRequest {
    pub ticket_id: String,
    pub payment_id: String,
    pub rating: i32, // 1-5
    pub comment: Option<String>,
    pub categories: Option<Vec<String>>, // ['punctuality', 'comfort', 'cleanliness', 'staff', 'value']
}

#[derive(Debug, Serialize)]
pub struct TicketRating {
    pub id: i32,
    pub ticket_id: String,
    pub payment_id: String,
    pub user_id: i32,
    pub rating: i32,
    pub comment: Option<String>,
    pub categories: Option<serde_json::Value>,
    pub created_at: i64,
}

#[derive(Debug, Serialize)]
pub struct TicketRatingStats {
    pub average_rating: f64,
    pub total_ratings: i32,
    pub rating_distribution: serde_json::Value, // {1: count, 2: count, ...}
    pub category_ratings: Option<serde_json::Value>,
}

// ============================================================================
// ENDPOINTS
// ============================================================================

/// Noter un ticket de bus
/// POST /api/bus-tickets/rate
pub async fn rate_bus_ticket(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<RateTicketRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[rate_bus_ticket] User: {}, Ticket: {}, Rating: {}",
        user.id, payload.ticket_id, payload.rating
    );

    // Valider la note (1-5)
    if payload.rating < 1 || payload.rating > 5 {
        return Err(AppError::BadRequest(
            "La note doit être entre 1 et 5".to_string(),
        ));
    }

    // Vérifier que le ticket appartient à l'utilisateur
    let ticket_check = r#"
        SELECT payment_id, user_id
        FROM bus_reservations
        WHERE id::text = $1 OR payment_id = $2
    "#;

    let ticket_row = sqlx::query(ticket_check)
        .bind(&payload.ticket_id)
        .bind(&payload.payment_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| {
            error!("[rate_bus_ticket] Erreur vérification ticket: {}", e);
            AppError::Internal(format!("Erreur vérification ticket: {}", e))
        })?;

    if ticket_row.is_none() {
        return Err(AppError::NotFound("Ticket introuvable".to_string()));
    }

    let ticket_user_id: i32 = ticket_row.as_ref().unwrap().get("user_id");
    if ticket_user_id != user.id {
        return Err(AppError::Forbidden(
            "Ce ticket ne vous appartient pas".to_string(),
        ));
    }

    // Vérifier si l'utilisateur a déjà noté ce ticket
    let existing_check = r#"
        SELECT id
        FROM bus_ticket_ratings
        WHERE ticket_id = $1 AND user_id = $2
    "#;

    let existing = sqlx::query(existing_check)
        .bind(&payload.ticket_id)
        .bind(user.id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| {
            error!("[rate_bus_ticket] Erreur vérification existante: {}", e);
            AppError::Internal(format!("Erreur vérification: {}", e))
        })?;

    let categories_json = payload.categories.as_ref().map(|cats| json!(cats));

    if existing.is_some() {
        // Mettre à jour l'avis existant
        let update_query = r#"
            UPDATE bus_ticket_ratings
            SET rating = $1,
                comment = $2,
                categories = $3,
                updated_at = NOW()
            WHERE ticket_id = $4 AND user_id = $5
            RETURNING id, ticket_id, payment_id, user_id, rating, comment, categories,
                      EXTRACT(EPOCH FROM created_at)::BIGINT as created_at
        "#;

        let row = sqlx::query(update_query)
            .bind(payload.rating)
            .bind(&payload.comment)
            .bind(categories_json.as_ref().map(|j| j.to_string()))
            .bind(&payload.ticket_id)
            .bind(user.id)
            .fetch_one(&state.pg)
            .await
            .map_err(|e| {
                error!("[rate_bus_ticket] Erreur mise à jour: {}", e);
                AppError::Internal(format!("Erreur mise à jour avis: {}", e))
            })?;

        let rating = TicketRating {
            id: row.get("id"),
            ticket_id: row.get("ticket_id"),
            payment_id: row.get("payment_id"),
            user_id: row.get("user_id"),
            rating: row.get("rating"),
            comment: row.get("comment"),
            categories: categories_json,
            created_at: row.get("created_at"),
        };

        Ok((
            StatusCode::OK,
            Json(json!({
                "success": true,
                "message": "Avis mis à jour avec succès",
                "rating": rating
            })),
        ))
    } else {
        // Créer un nouvel avis
        let insert_query = r#"
            INSERT INTO bus_ticket_ratings (ticket_id, payment_id, user_id, rating, comment, categories)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, ticket_id, payment_id, user_id, rating, comment, categories,
                      EXTRACT(EPOCH FROM created_at)::BIGINT as created_at
        "#;

        let row = sqlx::query(insert_query)
            .bind(&payload.ticket_id)
            .bind(&payload.payment_id)
            .bind(user.id)
            .bind(payload.rating)
            .bind(&payload.comment)
            .bind(categories_json.as_ref().map(|j| j.to_string()))
            .fetch_one(&state.pg)
            .await
            .map_err(|e| {
                error!("[rate_bus_ticket] Erreur insertion: {}", e);
                AppError::Internal(format!("Erreur enregistrement avis: {}", e))
            })?;

        let rating = TicketRating {
            id: row.get("id"),
            ticket_id: row.get("ticket_id"),
            payment_id: row.get("payment_id"),
            user_id: row.get("user_id"),
            rating: row.get("rating"),
            comment: row.get("comment"),
            categories: categories_json,
            created_at: row.get("created_at"),
        };

        Ok((
            StatusCode::OK,
            Json(json!({
                "success": true,
                "message": "Avis enregistré avec succès",
                "rating": rating
            })),
        ))
    }
}

/// Obtenir les statistiques d'avis pour un produit/agence
/// GET /api/bus-tickets/ratings/stats?product_id={id}&agency_id={id}
pub async fn get_ticket_rating_stats(
    State(state): State<Arc<AppState>>,
    Query(params): Query<serde_json::Value>,
) -> AppResult<impl IntoResponse> {
    let product_id = params.get("product_id").and_then(|v| v.as_str());
    let agency_id = params.get("agency_id").and_then(|v| v.as_i64()).map(|v| v as i32);

    info!(
        "[get_ticket_rating_stats] Product: {:?}, Agency: {:?}",
        product_id, agency_id
    );

    // Construire la requête selon les filtres
    let mut query = String::from(
        r#"
        SELECT 
            AVG(rating)::FLOAT as average_rating,
            COUNT(*)::INTEGER as total_ratings,
            jsonb_object_agg(rating::text, count) as rating_distribution
        FROM (
            SELECT rating, COUNT(*) as count
            FROM bus_ticket_ratings r
            JOIN bus_reservations br ON r.ticket_id = br.id::text OR r.payment_id = br.payment_id
        "#,
    );

    let mut conditions = Vec::new();
    if let Some(pid) = product_id {
        query.push_str(" JOIN products p ON br.product_id = p.id ");
        conditions.push(format!("p.id = '{}'", pid));
    }
    if let Some(aid) = agency_id {
        query.push_str(" JOIN agences_voyage av ON br.agency_id = av.id ");
        conditions.push(format!("av.id = {}", aid));
    }

    if !conditions.is_empty() {
        query.push_str(" WHERE ");
        query.push_str(&conditions.join(" AND "));
    }

    query.push_str(
        r#"
            GROUP BY rating
        ) subq
        "#,
    );

    let row = sqlx::query(&query).fetch_one(&state.pg).await.map_err(|e| {
        error!("[get_ticket_rating_stats] Erreur: {}", e);
        AppError::Internal(format!("Erreur récupération stats: {}", e))
    })?;

    let average_rating: Option<f64> = row.get("average_rating");
    let total_ratings: i32 = row.get("total_ratings");
    let rating_distribution: Option<serde_json::Value> = row.get("rating_distribution");

    let stats = TicketRatingStats {
        average_rating: average_rating.unwrap_or(0.0),
        total_ratings,
        rating_distribution: rating_distribution.unwrap_or(json!({})),
        category_ratings: None, // TODO: Implémenter si nécessaire
    };

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "stats": stats
        })),
    ))
}
