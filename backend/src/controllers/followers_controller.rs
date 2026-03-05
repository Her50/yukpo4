// Contrôleur pour le système de suivi (follow/unfollow) des vendeurs
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use serde::Serialize;
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;

use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct FollowStatusResponse {
    pub is_following: bool,
    pub followers_count: i64,
}

/// POST /api/users/:user_id/follow - Suivre un utilisateur (toggle)
pub async fn toggle_follow(
    Path(target_user_id): Path<i32>,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> Result<Json<Value>, StatusCode> {
    let pool = &state.pg;
    let follower_id = user.id;

    // Empêcher de se suivre soi-même
    if follower_id == target_user_id {
        return Ok(Json(json!({
            "success": false,
            "message": "Vous ne pouvez pas vous suivre vous-même"
        })));
    }

    // Vérifier si déjà suivi
    let existing =
        sqlx::query("SELECT id FROM user_follows WHERE follower_id = $1 AND followed_id = $2")
            .bind(follower_id)
            .bind(target_user_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| {
                eprintln!("[followers] DB error checking follow: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    if existing.is_some() {
        // Unfollow
        sqlx::query("DELETE FROM user_follows WHERE follower_id = $1 AND followed_id = $2")
            .bind(follower_id)
            .bind(target_user_id)
            .execute(pool)
            .await
            .map_err(|e| {
                eprintln!("[followers] DB error unfollowing: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

        let count = get_followers_count(pool, target_user_id).await;

        Ok(Json(json!({
            "success": true,
            "action": "unfollowed",
            "is_following": false,
            "followers_count": count
        })))
    } else {
        // Follow
        sqlx::query(
            "INSERT INTO user_follows (follower_id, followed_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        )
        .bind(follower_id)
        .bind(target_user_id)
        .execute(pool)
        .await
        .map_err(|e| {
            eprintln!("[followers] DB error following: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        let count = get_followers_count(pool, target_user_id).await;

        Ok(Json(json!({
            "success": true,
            "action": "followed",
            "is_following": true,
            "followers_count": count
        })))
    }
}

/// GET /api/users/:user_id/follow-status - Vérifier si l'utilisateur courant suit un vendeur
pub async fn check_follow_status(
    Path(target_user_id): Path<i32>,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> Result<Json<Value>, StatusCode> {
    let pool = &state.pg;

    let existing =
        sqlx::query("SELECT id FROM user_follows WHERE follower_id = $1 AND followed_id = $2")
            .bind(user.id)
            .bind(target_user_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| {
                eprintln!("[followers] DB error checking status: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    let count = get_followers_count(pool, target_user_id).await;

    Ok(Json(json!({
        "success": true,
        "is_following": existing.is_some(),
        "followers_count": count
    })))
}

/// GET /api/users/:user_id/followers-count - Nombre de followers (public)
pub async fn followers_count(
    Path(target_user_id): Path<i32>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, StatusCode> {
    let count = get_followers_count(&state.pg, target_user_id).await;

    Ok(Json(json!({
        "success": true,
        "followers_count": count
    })))
}

/// GET /api/services/:service_id/follow-status - Vérifier le suivi via service_id
/// Résout le user_id du propriétaire du service, puis vérifie le suivi
pub async fn check_follow_by_service(
    Path(service_id): Path<i32>,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> Result<Json<Value>, StatusCode> {
    let pool = &state.pg;

    // Trouver le propriétaire du service
    let owner = sqlx::query("SELECT user_id FROM services WHERE id = $1")
        .bind(service_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| {
            eprintln!("[followers] DB error finding service owner: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let owner_id = match owner {
        Some(row) => row.get::<i32, _>("user_id"),
        None => {
            return Ok(Json(json!({
                "success": false,
                "message": "Service non trouvé",
                "is_following": false,
                "followers_count": 0
            })));
        }
    };

    let existing =
        sqlx::query("SELECT id FROM user_follows WHERE follower_id = $1 AND followed_id = $2")
            .bind(user.id)
            .bind(owner_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| {
                eprintln!("[followers] DB error checking service follow: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    let count = get_followers_count(pool, owner_id).await;

    Ok(Json(json!({
        "success": true,
        "is_following": existing.is_some(),
        "followers_count": count,
        "owner_id": owner_id
    })))
}

/// POST /api/services/:service_id/follow - Suivre/ne plus suivre via service_id
pub async fn toggle_follow_by_service(
    Path(service_id): Path<i32>,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> Result<Json<Value>, StatusCode> {
    let pool = &state.pg;

    // Trouver le propriétaire du service
    let owner = sqlx::query("SELECT user_id FROM services WHERE id = $1")
        .bind(service_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| {
            eprintln!("[followers] DB error finding service owner: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let owner_id = match owner {
        Some(row) => row.get::<i32, _>("user_id"),
        None => {
            return Ok(Json(json!({
                "success": false,
                "message": "Service non trouvé"
            })));
        }
    };

    // Déléguer à toggle_follow
    toggle_follow(Path(owner_id), State(state), Extension(user)).await
}

/// GET /api/users/me/following - Liste des vendeurs/prestataires suivis par l'utilisateur connecté
pub async fn get_my_following(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> Result<Json<Value>, StatusCode> {
    let pool = &state.pg;

    let rows = sqlx::query(
        r#"
        SELECT 
            uf.id as follow_id,
            uf.followed_id,
            uf.created_at as followed_at,
            u.name as seller_name,
            u.email as seller_email,
            s.id as service_id,
            s.category,
            s.data
        FROM user_follows uf
        JOIN users u ON u.id = uf.followed_id
        LEFT JOIN services s ON s.user_id = uf.followed_id AND s.is_active = true
        WHERE uf.follower_id = $1
        ORDER BY uf.created_at DESC
        "#,
    )
    .bind(user.id)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        eprintln!("[followers] DB error fetching following: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let mut following: Vec<Value> = Vec::new();
    let mut seen_users: std::collections::HashSet<i32> = std::collections::HashSet::new();

    for row in rows {
        let followed_id: i32 = row.get("followed_id");
        if seen_users.contains(&followed_id) {
            continue; // Éviter les doublons (un user peut avoir plusieurs services)
        }
        seen_users.insert(followed_id);

        let seller_name: Option<String> = row.get("seller_name");
        let service_id: Option<i32> = row.get("service_id");
        let category: Option<String> = row.get("category");
        let data: Option<serde_json::Value> = row.get("data");
        let followed_at: chrono::DateTime<chrono::Utc> = row.get("followed_at");

        // Extraire le titre du service depuis data JSON
        let service_title = data.as_ref().and_then(|d| {
            d.get("titre").and_then(|t| {
                if let Some(s) = t.as_str() {
                    Some(s.to_string())
                } else {
                    t.get("valeur").and_then(|v| v.as_str()).map(|s| s.to_string())
                }
            })
        });

        // Extraire la description depuis data JSON
        let service_description = data.as_ref().and_then(|d| {
            d.get("description").and_then(|t| {
                if let Some(s) = t.as_str() {
                    Some(s.to_string())
                } else {
                    t.get("valeur").and_then(|v| v.as_str()).map(|s| s.to_string())
                }
            })
        });

        let followers_count = get_followers_count(pool, followed_id).await;

        following.push(json!({
            "followed_id": followed_id,
            "seller_name": seller_name.unwrap_or_default(),
            "service_id": service_id,
            "service_title": service_title,
            "service_description": service_description,
            "category": category,
            "followers_count": followers_count,
            "followed_at": followed_at.to_rfc3339(),
        }));
    }

    Ok(Json(json!({
        "success": true,
        "following": following,
        "total": following.len()
    })))
}

// Helper: compter les followers
async fn get_followers_count(pool: &sqlx::PgPool, user_id: i32) -> i64 {
    sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM user_follows WHERE followed_id = $1")
        .bind(user_id)
        .fetch_one(pool)
        .await
        .unwrap_or(0)
}
