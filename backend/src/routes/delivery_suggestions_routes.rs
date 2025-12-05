// ✅ NOUVEAU: Routes API pour suggestions produits IA
// Génère des suggestions intelligentes de produits basées sur le contexte de la livraison

use crate::{
    middlewares::jwt::{jwt_auth, AuthenticatedUser},
    state::AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::get,
    Extension, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug)]
struct BasicSuggestion {
    product_name: String,
    suggestion_reason: Option<String>,
    confidence_score: rust_decimal::Decimal,
}

#[derive(Debug, Serialize)]
pub struct ProductSuggestion {
    pub id: i32,
    pub product_id: Option<i32>,
    pub product_name: String,
    pub product_price: Option<rust_decimal::Decimal>,
    pub suggestion_reason: Option<String>,
    pub confidence_score: Option<rust_decimal::Decimal>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct SuggestionsQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    10
}

pub fn delivery_suggestions_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/api/delivery/:delivery_id/suggestions",
            get(get_delivery_suggestions)
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    jwt_auth,
                )),
        )
        .route(
            "/api/delivery/:delivery_id/suggestions/generate",
            get(generate_delivery_suggestions)
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    jwt_auth,
                )),
        )
        .route(
            "/api/delivery/:delivery_id/suggestions/:suggestion_id/accept",
            get(accept_suggestion)
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    jwt_auth,
                )),
        )
        .with_state(state)
}

/// GET /api/delivery/:delivery_id/suggestions
/// Récupère les suggestions de produits pour une livraison
async fn get_delivery_suggestions(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<String>,
    Query(params): Query<SuggestionsQuery>,
) -> Result<Json<Vec<ProductSuggestion>>, StatusCode> {
    let delivery_uuid = match Uuid::parse_str(&delivery_id) {
        Ok(uuid) => uuid,
        Err(_) => {
            log::warn!("[DeliverySuggestionsAPI] ID de livraison invalide: {}", delivery_id);
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    log::info!(
        "[DeliverySuggestionsAPI] 📦 Récupération suggestions - Delivery: {}, User: {}",
        delivery_uuid,
        user.id
    );

    // Vérifier l'accès
    let has_access = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM delivery_requests dr
            WHERE dr.id = $1
            AND (
                dr.client_id = $2
                OR dr.courier_id = $2
                OR EXISTS(
                    SELECT 1 FROM services s
                    WHERE s.id = dr.service_id
                    AND s.user_id = $2
                )
            )
        )
        "#,
    )
    .bind(delivery_uuid)
    .bind(user.id)
    .fetch_one(&state.pg)
    .await;

    match has_access {
        Ok(true) => {}
        Ok(false) => return Err(StatusCode::FORBIDDEN),
        Err(e) => {
            log::error!("[DeliverySuggestionsAPI] ❌ Erreur vérification accès: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    }

    // Récupérer les suggestions
    let rows = sqlx::query(
        r#"
        SELECT 
            id,
            suggested_product_id,
            suggested_product_name,
            suggested_product_price,
            suggestion_reason,
            confidence_score,
            created_at
        FROM delivery_product_suggestions
        WHERE delivery_id = $1
        ORDER BY confidence_score DESC, created_at DESC
        LIMIT $2
        "#,
    )
    .bind(delivery_uuid)
    .bind(params.limit)
    .fetch_all(&state.pg)
    .await;

    match rows {
        Ok(rows) => {
            let suggestions: Vec<ProductSuggestion> = rows
                .into_iter()
                .map(|row| ProductSuggestion {
                    id: row.get("id"),
                    product_id: row.get("suggested_product_id"),
                    product_name: row.get("suggested_product_name"),
                    product_price: row.get("suggested_product_price"),
                    suggestion_reason: row.get("suggestion_reason"),
                    confidence_score: row.get("confidence_score"),
                    created_at: row.get("created_at"),
                })
                .collect();

            Ok(Json(suggestions))
        }
        Err(e) => {
            log::error!("[DeliverySuggestionsAPI] ❌ Erreur récupération suggestions: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// GET /api/delivery/:delivery_id/suggestions/generate
/// Génère de nouvelles suggestions de produits via IA
async fn generate_delivery_suggestions(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let delivery_uuid = match Uuid::parse_str(&delivery_id) {
        Ok(uuid) => uuid,
        Err(_) => return Err(StatusCode::BAD_REQUEST),
    };

    log::info!(
        "[DeliverySuggestionsAPI] 🤖 Génération suggestions IA - Delivery: {}, User: {}",
        delivery_uuid,
        user.id
    );

    // Vérifier l'accès
    let has_access = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM delivery_requests dr
            WHERE dr.id = $1
            AND dr.client_id = $2
        )
        "#,
    )
    .bind(delivery_uuid)
    .bind(user.id)
    .fetch_one(&state.pg)
    .await;

    match has_access {
        Ok(true) => {}
        Ok(false) => return Err(StatusCode::FORBIDDEN),
        Err(e) => {
            log::error!("[DeliverySuggestionsAPI] ❌ Erreur vérification accès: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    }

    // Récupérer les informations de la livraison
    let delivery_info = sqlx::query(
        r#"
        SELECT 
            dr.id,
            dr.client_id,
            dr.metadata,
            s.id as service_id,
            s.title as service_title
        FROM delivery_requests dr
        LEFT JOIN services s ON s.id = dr.service_id
        WHERE dr.id = $1
        "#,
    )
    .bind(delivery_uuid)
    .fetch_optional(&state.pg)
    .await;

    let delivery = match delivery_info {
        Ok(Some(row)) => row,
        Ok(None) => return Err(StatusCode::NOT_FOUND),
        Err(e) => {
            log::error!("[DeliverySuggestionsAPI] ❌ Erreur récupération livraison: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Récupérer le panier actuel si c'est une livraison shopping
    let basket_items_result = sqlx::query(
        r#"
        SELECT 
            si.id,
            si.label,
            si.quantity,
            si.unit_price
        FROM shopping_basket_items si
        JOIN shopping_orders so ON so.id = si.order_id
        WHERE so.delivery_id = $1
        ORDER BY si.created_at DESC
        LIMIT 50
        "#,
    )
    .bind(delivery_uuid)
    .fetch_all(&state.pg)
    .await;

    let basket_items = match basket_items_result {
        Ok(items) => items,
        Err(_) => Vec::new(), // Pas de panier ou erreur, continuer quand même
    };

    // TODO: Intégrer avec l'IA pour générer des suggestions intelligentes
    // Pour l'instant, on génère des suggestions basiques basées sur le panier
    let suggestions = generate_basic_suggestions(&basket_items, &state).await;

    // Sauvegarder les suggestions
    let mut saved_count = 0;
    for suggestion in &suggestions {
        let _ = sqlx::query(
            r#"
            INSERT INTO delivery_product_suggestions
            (delivery_id, user_id, suggested_product_name, suggestion_reason, confidence_score, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(delivery_uuid)
        .bind(user.id)
        .bind(&suggestion.product_name)
        .bind(&suggestion.suggestion_reason)
        .bind(&suggestion.confidence_score)
        .execute(&state.pg)
        .await;

        saved_count += 1;
    }

    log::info!(
        "[DeliverySuggestionsAPI] ✅ {} suggestions générées pour delivery {}",
        saved_count,
        delivery_uuid
    );

    Ok(Json(json!({
        "success": true,
        "suggestions_count": saved_count,
        "delivery_id": delivery_uuid
    })))
}

/// GET /api/delivery/:delivery_id/suggestions/:suggestion_id/accept
/// Marque une suggestion comme acceptée
async fn accept_suggestion(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path((delivery_id, suggestion_id)): Path<(String, i32)>,
) -> Result<Json<Value>, StatusCode> {
    let delivery_uuid = match Uuid::parse_str(&delivery_id) {
        Ok(uuid) => uuid,
        Err(_) => return Err(StatusCode::BAD_REQUEST),
    };

    // Marquer la suggestion comme acceptée
    let result = sqlx::query(
        r#"
        UPDATE delivery_product_suggestions
        SET was_accepted = TRUE
        WHERE id = $1 AND delivery_id = $2 AND user_id = $3
        "#,
    )
    .bind(suggestion_id)
    .bind(delivery_uuid)
    .bind(user.id)
    .execute(&state.pg)
    .await;

    match result {
        Ok(res) if res.rows_affected() > 0 => {
            Ok(Json(json!({
                "success": true,
                "suggestion_id": suggestion_id
            })))
        }
        _ => Err(StatusCode::NOT_FOUND),
    }
}

/// Génère des suggestions basiques basées sur le panier
async fn generate_basic_suggestions(
    basket_items: &[sqlx::postgres::PgRow],
    _state: &Arc<AppState>,
) -> Vec<BasicSuggestion> {
    // Suggestions basiques basées sur les catégories du panier
    let mut suggestions = Vec::new();

    // Analyser les catégories dans le panier
    let categories: Vec<String> = basket_items
        .iter()
        .filter_map(|row| {
            row.try_get::<Option<String>, _>("label")
                .ok()
                .flatten()
        })
        .collect();

    // Générer des suggestions basées sur des patterns communs
    // TODO: Remplacer par une vraie IA
    if categories.iter().any(|c| c.to_lowercase().contains("pain")) {
        suggestions.push(BasicSuggestion {
            product_name: "Beurre".to_string(),
            suggestion_reason: Some("Souvent acheté avec du pain".to_string()),
            confidence_score: rust_decimal::Decimal::from_str_exact("0.7").unwrap(),
        });
    }

    suggestions
}

