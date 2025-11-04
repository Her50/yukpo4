// Contrôleur pour gérer les réactions/émotions sur les produits
use axum::{
    extract::{Path, State, Extension},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::state::AppState;
use crate::middlewares::jwt::AuthenticatedUser;

#[derive(Debug, Deserialize)]
pub struct ReactionPayload {
    pub reaction_type: String,
}

#[derive(Debug, Serialize)]
pub struct ReactionResponse {
    pub success: bool,
    pub action: String, // "added" ou "removed"
}

// Note: ReactionCount n'est plus utilisé directement, on utilise query! à la place

/// POST /api/products/:service_id/:product_id/react
/// Ajouter ou retirer une réaction sur un produit
pub async fn toggle_product_reaction(
    Path((service_id, product_id)): Path<(i32, String)>,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<ReactionPayload>,
) -> Result<Json<Value>, StatusCode> {
    // Valider le type de réaction
    let valid_reactions = vec!["love", "like", "wow", "interested", "thinking", "disappointed"];
    if !valid_reactions.contains(&payload.reaction_type.as_str()) {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Vérifier si l'utilisateur a déjà cette réaction
    let existing = sqlx::query(
        r#"
        SELECT id FROM product_reactions 
        WHERE user_id = $1 AND service_id = $2 
          AND product_id = $3 AND reaction_type = $4
        "#
    )
    .bind(user.id)
    .bind(service_id)
    .bind(&product_id)
    .bind(&payload.reaction_type)
    .fetch_optional(&state.pg)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if let Some(reaction) = existing {
        // Retirer la réaction
        let reaction_id: i32 = reaction.try_get("id").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        sqlx::query(
            r#"DELETE FROM product_reactions WHERE id = $1"#
        )
        .bind(reaction_id)
        .execute(&state.pg)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        Ok(Json(json!({
            "success": true,
            "action": "removed"
        })))
    } else {
        // Ajouter la réaction
        sqlx::query(
            r#"
            INSERT INTO product_reactions (user_id, service_id, product_id, reaction_type)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, service_id, product_id, reaction_type) DO NOTHING
            "#
        )
        .bind(user.id)
        .bind(service_id)
        .bind(&product_id)
        .bind(&payload.reaction_type)
        .execute(&state.pg)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        Ok(Json(json!({
            "success": true,
            "action": "added"
        })))
    }
}

/// GET /api/products/:service_id/:product_id/reactions
/// Récupérer le décompte des réactions pour un produit
pub async fn get_product_reactions(
    Path((service_id, product_id)): Path<(i32, String)>,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> Result<Json<Value>, StatusCode> {
    let reactions = sqlx::query(
        r#"
        SELECT 
            reaction_type,
            count,
            users_sample
        FROM get_product_reactions_count($1, $2)
        "#
    )
    .bind(service_id)
    .bind(&product_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[ProductReactions] Erreur récupération réactions: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Vérifier si l'utilisateur actuel a réagi
    let user_reactions = sqlx::query(
        r#"
        SELECT reaction_type 
        FROM product_reactions
        WHERE user_id = $1 AND service_id = $2 AND product_id = $3
        "#
    )
    .bind(user.id)
    .bind(service_id)
    .bind(&product_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let user_reaction_types: Vec<String> = user_reactions
        .iter()
        .filter_map(|r| r.try_get::<String, _>("reaction_type").ok())
        .collect();

    // Enrichir avec l'information si l'utilisateur a réagi
    let enriched_reactions: Vec<Value> = reactions
        .iter()
        .filter_map(|r| {
            let reaction_type: String = r.try_get("reaction_type").ok()?;
            let count: i64 = r.try_get("count").unwrap_or(0);
            let users_sample: Vec<String> = r.try_get("users_sample").unwrap_or_default();
            
            Some(json!({
                "reaction_type": reaction_type,
                "count": count,
                "users_sample": users_sample,
                "has_reacted": user_reaction_types.contains(&reaction_type)
            }))
        })
        .collect();

    Ok(Json(json!({
        "success": true,
        "data": enriched_reactions
    })))
}
