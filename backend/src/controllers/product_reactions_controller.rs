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
use crate::utils::db_retry::retry_query;

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
    let valid_reactions = [
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

    // ✅ CORRIGÉ 2025-12-11: Ajouter retry pour gérer les erreurs de connexion DB
    let pool = state.pg.clone();
    let user_id = user.id;
    let product_id_clone = product_id.clone();
    let reaction_type_clone = payload.reaction_type.clone();

    // Vérifier si l'utilisateur a déjà cette réaction
    let existing = retry_query(
        &pool,
        || {
            let pool = pool.clone();
            let user_id = user_id;
            let service_id = service_id;
            let product_id = product_id_clone.clone();
            let reaction_type = reaction_type_clone.clone();
            Box::pin(async move {
                sqlx::query(
                    r#"
                    SELECT id FROM product_reactions 
                    WHERE user_id = $1 AND service_id = $2 
                      AND product_id = $3 AND reaction_type = $4
                    "#,
                )
                .bind(user_id)
                .bind(service_id)
                .bind(&product_id)
                .bind(&reaction_type)
                .fetch_optional(&pool)
                .await
            })
        },
        3, // 3 tentatives avec backoff exponentiel
    )
    .await
    .map_err(|e| {
        log::error!(
            "[ProductReactions] Erreur après retries lors de la vérification de réaction: {}",
            e
        );
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if let Some(reaction) = existing {
        // L'utilisateur a déjà cette réaction → la retirer (toggle off)
        let reaction_id: i32 =
            reaction.try_get("id").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        retry_query(
            &pool,
            || {
                let pool = pool.clone();
                let reaction_id = reaction_id;
                Box::pin(async move {
                    sqlx::query(r#"DELETE FROM product_reactions WHERE id = $1"#)
                        .bind(reaction_id)
                        .execute(&pool)
                        .await
                })
            },
            3,
        )
        .await
        .map_err(|e| {
            log::error!(
                "[ProductReactions] Erreur après retries lors de la suppression de réaction: {}",
                e
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        Ok(Json(json!({
            "success": true,
            "action": "removed"
        })))
    } else {
        // ✅ CORRIGÉ 2026-03-14: Une seule réaction par utilisateur par produit
        // Supprimer toute réaction existante d'un autre type avant d'ajouter la nouvelle
        let product_id_del = product_id_clone.clone();
        retry_query(
            &pool,
            || {
                let pool = pool.clone();
                let user_id = user_id;
                let service_id = service_id;
                let product_id = product_id_del.clone();
                Box::pin(async move {
                    sqlx::query(
                        r#"
                        DELETE FROM product_reactions
                        WHERE user_id = $1 AND service_id = $2 AND product_id = $3
                        "#,
                    )
                    .bind(user_id)
                    .bind(service_id)
                    .bind(&product_id)
                    .execute(&pool)
                    .await
                })
            },
            3,
        )
        .await
        .map_err(|e| {
            log::error!(
                "[ProductReactions] Erreur suppression ancienne réaction: {}",
                e
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        // Insérer la nouvelle réaction
        retry_query(
            &pool,
            || {
                let pool = pool.clone();
                let user_id = user_id;
                let service_id = service_id;
                let product_id = product_id_clone.clone();
                let reaction_type = reaction_type_clone.clone();
                Box::pin(async move {
                    sqlx::query(
                        r#"
                        INSERT INTO product_reactions (user_id, service_id, product_id, reaction_type)
                        VALUES ($1, $2, $3, $4)
                        ON CONFLICT (user_id, service_id, product_id, reaction_type) DO NOTHING
                        "#,
                    )
                    .bind(user_id)
                    .bind(service_id)
                    .bind(&product_id)
                    .bind(&reaction_type)
                    .execute(&pool)
                    .await
                })
            },
            3,
        )
        .await
        .map_err(|e| {
            log::error!("[ProductReactions] Erreur après retries lors de l'ajout de réaction: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

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

    // ✅ CORRIGÉ 2025-12-11: Ajouter retry pour gérer les erreurs de connexion DB
    let pool = state.pg.clone();
    let service_id_clone = service_id;
    let normalized_product_id_clone = normalized_product_id.clone();

    // ✅ CORRIGÉ: Gérer l'erreur si la fonction PostgreSQL n'existe pas
    let reactions_result = retry_query(
        &pool,
        || {
            let pool = pool.clone();
            let service_id = service_id_clone;
            let normalized_product_id = normalized_product_id_clone.clone();
            Box::pin(async move {
                sqlx::query(
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
                .fetch_all(&pool)
                .await
            })
        },
        3,
    )
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
                // ✅ CORRIGÉ 2025-12-11: Ajouter retry pour la requête alternative
                match retry_query(
                    &pool,
                    || {
                        let pool = pool.clone();
                        let service_id = service_id_clone;
                        let normalized_product_id = normalized_product_id_clone.clone();
                        Box::pin(async move {
                            sqlx::query(
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
                            .fetch_all(&pool)
                            .await
                        })
                    },
                    3,
                )
                .await
                {
                    Ok(alt_r) => alt_r,
                    Err(e) => {
                        log::error!(
                            "[ProductReactions] Erreur après retries sur requête alternative: {}",
                            e
                        );
                        Vec::new()
                    }
                }
            } else {
                Vec::new()
            }
        }
    };

    // ✅ CORRIGÉ 2025-12-11: Ajouter retry pour vérifier les réactions de l'utilisateur
    let user_id_clone = user.id;
    let user_reactions = retry_query(
        &pool,
        || {
            let pool = pool.clone();
            let user_id = user_id_clone;
            let service_id = service_id_clone;
            let normalized_product_id = normalized_product_id_clone.clone();
            Box::pin(async move {
                sqlx::query(
                    r#"
                    SELECT reaction_type 
                    FROM product_reactions
                    WHERE user_id = $1 AND service_id = $2 AND product_id = $3
                    "#,
                )
                .bind(user_id)
                .bind(service_id)
                .bind(&normalized_product_id)
                .fetch_all(&pool)
                .await
            })
        },
        3,
    )
    .await
    .unwrap_or_default(); // ✅ CORRIGÉ: Ne pas retourner d'erreur si la table n'existe pas ou après retries

    let user_reaction_types: Vec<String> = user_reactions
        .iter()
        .filter_map(|r| r.get::<Option<String>, _>("reaction_type"))
        .collect();

    // Enrichir avec l'information si l'utilisateur a réagi
    let enriched_reactions: Vec<Value> = reactions
        .iter()
        .filter_map(|r| {
            let reaction_type: String = r.get::<Option<_>, _>("reaction_type")?;
            let count: i64 = r.get::<Option<_>, _>("count").unwrap_or(0);
            let users_sample: Vec<String> =
                r.get::<Option<_>, _>("users_sample").unwrap_or_default();

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
