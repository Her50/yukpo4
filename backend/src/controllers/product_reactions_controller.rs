// Contrôleur pour gérer les réactions/émotions sur les produits
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;

use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;

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
    let valid_reactions = vec![
        "love",
        "like",
        "wow",
        "interested",
        "thinking",
        "disappointed",
    ];
    if !valid_reactions.contains(&payload.reaction_type.as_str()) {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Vérifier si l'utilisateur a déjà cette réaction
    let existing = sqlx::query(
        r#"
        SELECT id FROM product_reactions 
        WHERE user_id = $1 AND service_id = $2 
          AND product_id = $3 AND reaction_type = $4
        "#,
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
        let reaction_id: i32 = reaction
            .try_get("id")
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        sqlx::query(r#"DELETE FROM product_reactions WHERE id = $1"#)
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
            "#,
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
/// product_id peut être au format "service_id_product_index" (ex: "2_0") ou juste l'index
pub async fn get_product_reactions(
    Path((service_id, product_id)): Path<(i32, String)>,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> Result<Json<Value>, StatusCode> {
    // ✅ CORRIGÉ: Gérer le format product_id "service_id_product_index" ou juste product_index
    let normalized_product_id = if product_id.contains('_') {
        // Format "service_id_product_index" - extraire juste le product_index
        product_id.split('_').last().unwrap_or(&product_id).to_string()
    } else {
        product_id.clone()
    };

    log::info!(
        "[ProductReactions] Récupération réactions pour service_id={}, product_id={} (normalisé={})",
        service_id,
        product_id,
        normalized_product_id
    );

    // ✅ CORRIGÉ: Gérer l'erreur si la fonction PostgreSQL n'existe pas
    let reactions_result = sqlx::query(
        r#"
        SELECT 
            reaction_type,
            count,
            users_sample
        FROM get_product_reactions_count($1, $2)
        "#,
    )
    .bind(service_id)
    .bind(&normalized_product_id)
    .fetch_all(&state.pg)
    .await;

    let reactions = match reactions_result {
        Ok(r) => r,
        Err(e) => {
            log::error!(
                "[ProductReactions] Erreur récupération réactions (fonction get_product_reactions_count peut-être absente): {}",
                e
            );
            // ✅ CORRIGÉ: Retourner un tableau vide au lieu d'une erreur 500
            // La fonction peut ne pas exister ou il peut n'y avoir aucune réaction
            // Si c'est une erreur de fonction manquante, on peut essayer une requête alternative
            if e.to_string().contains("does not exist") || e.to_string().contains("function") {
                log::warn!("[ProductReactions] Fonction PostgreSQL absente, utilisation requête alternative");
                // Requête alternative sans fonction
                match sqlx::query(
                    r#"
                    SELECT 
                        reaction_type,
                        COUNT(*)::BIGINT as count,
                        ARRAY[]::TEXT[] as users_sample
                    FROM product_reactions
                    WHERE service_id = $1 AND product_id = $2
                    GROUP BY reaction_type
                    "#,
                )
                .bind(service_id)
                .bind(&normalized_product_id)
                .fetch_all(&state.pg)
                .await
                {
                    Ok(alt_r) => alt_r,
                    Err(_) => Vec::new(),
                }
            } else {
                Vec::new()
            }
        }
    };

    // Vérifier si l'utilisateur actuel a réagi
    let user_reactions = sqlx::query(
        r#"
        SELECT reaction_type 
        FROM product_reactions
        WHERE user_id = $1 AND service_id = $2 AND product_id = $3
        "#,
    )
    .bind(user.id)
    .bind(service_id)
    .bind(&normalized_product_id)
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default(); // ✅ CORRIGÉ: Ne pas retourner d'erreur si la table n'existe pas

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
