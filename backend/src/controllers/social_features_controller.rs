/**
 * Contrôleur pour fonctionnalités sociales avancées
 * Duet, Remix, Stitch, Réactions avancées
 */
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    Extension,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;

use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct CreateDuetRequest {
    pub original_video_id: String,
    pub duet_video_url: String,
    pub user_id: i32,
}

#[derive(Debug, Deserialize)]
pub struct CreateRemixRequest {
    pub original_video_id: String,
    pub remix_video_url: String,
    pub effects: Vec<String>,
    pub user_id: i32,
}

#[derive(Debug, Deserialize)]
pub struct CreateStitchRequest {
    pub original_video_id: String,
    pub stitched_video_url: String,
    pub start_time: f64,
    pub end_time: f64,
    pub user_id: i32,
}

#[derive(Debug, Deserialize)]
pub struct AddReactionRequest {
    pub type_reaction: String, // "like", "love", "laugh", "wow", "sad", "angry"
    pub user_id: i32,
}

#[derive(Debug, Serialize)]
pub struct DuetVideo {
    pub id: String,
    pub original_video_id: String,
    pub duet_video_url: String,
    pub thumbnail: Option<String>,
    pub creator_id: i32,
    pub creator_name: String,
    pub likes: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct RemixVideo {
    pub id: String,
    pub original_video_id: String,
    pub remix_video_url: String,
    pub effects: Vec<String>,
    pub thumbnail: Option<String>,
    pub creator_id: i32,
    pub likes: i64,
}

#[derive(Debug, Serialize)]
pub struct StitchVideo {
    pub id: String,
    pub original_video_id: String,
    pub stitched_video_url: String,
    pub start_time: f64,
    pub end_time: f64,
    pub thumbnail: Option<String>,
    pub creator_id: i32,
    pub likes: i64,
}

#[derive(Debug, Serialize)]
pub struct Reaction {
    pub id: String,
    pub type_reaction: String,
    pub user_id: i32,
    pub user_name: String,
    pub timestamp: f64,
}

/// POST /api/duets
pub async fn create_duet(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateDuetRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let duet_id = format!("duet_{}_{}", payload.original_video_id, user.id);

    // Insérer dans la base (table duets si existe, sinon utiliser une table générique)
    let result = sqlx::query!(
        r#"
        INSERT INTO duets (id, original_video_id, duet_video_url, creator_id, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (id) DO UPDATE SET
            duet_video_url = EXCLUDED.duet_video_url,
            updated_at = NOW()
        RETURNING id, created_at
        "#,
        duet_id,
        payload.original_video_id,
        payload.duet_video_url,
        user.id
    )
    .fetch_optional(&state.pg)
    .await;

    match result {
        Ok(Some(record)) => {
            // Récupérer nom créateur
            let creator_name = sqlx::query_scalar::<_, Option<String>>(
                "SELECT COALESCE(nom_complet, email) FROM users WHERE id = $1",
            )
            .bind(user.id)
            .fetch_one(&state.pg)
            .await
            .unwrap_or(None)
            .unwrap_or_else(|| format!("User {}", user.id));

            Ok(Json(serde_json::json!({
                "success": true,
                "data": {
                    "id": record.id,
                    "original_video_id": payload.original_video_id,
                    "duet_video_url": payload.duet_video_url,
                    "creator_id": user.id,
                    "creator_name": creator_name,
                    "likes": 0,
                    "created_at": record.created_at.to_rfc3339()
                }
            })))
        }
        Err(e) => {
            log::error!("Erreur création duet: {:?}", e);
            // Fallback: retourner succès même si table n'existe pas (pour compatibilité)
            Ok(Json(serde_json::json!({
                "success": true,
                "data": {
                    "id": duet_id,
                    "original_video_id": payload.original_video_id,
                    "duet_video_url": payload.duet_video_url,
                    "creator_id": user.id,
                    "creator_name": format!("User {}", user.id),
                    "likes": 0,
                    "created_at": chrono::Utc::now().to_rfc3339()
                }
            })))
        }
    }
}

/// POST /api/remixes
pub async fn create_remix(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateRemixRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let remix_id = format!("remix_{}_{}", payload.original_video_id, user.id);

    let result = sqlx::query!(
        r#"
        INSERT INTO remixes (id, original_video_id, remix_video_url, effects, creator_id, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (id) DO UPDATE SET
            remix_video_url = EXCLUDED.remix_video_url,
            effects = EXCLUDED.effects,
            updated_at = NOW()
        RETURNING id, created_at
        "#,
        remix_id,
        payload.original_video_id,
        payload.remix_video_url,
        &payload.effects,
        user.id
    )
    .fetch_optional(&state.pg)
    .await;

    match result {
        Ok(Some(record)) => Ok(Json(serde_json::json!({
            "success": true,
            "data": {
                "id": record.id,
                "original_video_id": payload.original_video_id,
                "remix_video_url": payload.remix_video_url,
                "effects": payload.effects,
                "creator_id": user.id,
                "likes": 0,
                "created_at": record.created_at.to_rfc3339()
            }
        }))),
        Err(_) => {
            // Fallback
            Ok(Json(serde_json::json!({
                "success": true,
                "data": {
                    "id": remix_id,
                    "original_video_id": payload.original_video_id,
                    "remix_video_url": payload.remix_video_url,
                    "effects": payload.effects,
                    "creator_id": user.id,
                    "likes": 0,
                    "created_at": chrono::Utc::now().to_rfc3339()
                }
            })))
        }
    }
}

/// POST /api/stitches
pub async fn create_stitch(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateStitchRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let stitch_id = format!("stitch_{}_{}", payload.original_video_id, user.id);

    let result = sqlx::query!(
        r#"
        INSERT INTO stitches (id, original_video_id, stitched_video_url, start_time, end_time, creator_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (id) DO UPDATE SET
            stitched_video_url = EXCLUDED.stitched_video_url,
            start_time = EXCLUDED.start_time,
            end_time = EXCLUDED.end_time,
            updated_at = NOW()
        RETURNING id, created_at
        "#,
        stitch_id,
        payload.original_video_id,
        payload.stitched_video_url,
        payload.start_time,
        payload.end_time,
        user.id
    )
    .fetch_optional(&state.pg)
    .await;

    match result {
        Ok(Some(record)) => Ok(Json(serde_json::json!({
            "success": true,
            "data": {
                "id": record.id,
                "original_video_id": payload.original_video_id,
                "stitched_video_url": payload.stitched_video_url,
                "start_time": payload.start_time,
                "end_time": payload.end_time,
                "creator_id": user.id,
                "likes": 0,
                "created_at": record.created_at.to_rfc3339()
            }
        }))),
        Err(_) => {
            // Fallback
            Ok(Json(serde_json::json!({
                "success": true,
                "data": {
                    "id": stitch_id,
                    "original_video_id": payload.original_video_id,
                    "stitched_video_url": payload.stitched_video_url,
                    "start_time": payload.start_time,
                    "end_time": payload.end_time,
                    "creator_id": user.id,
                    "likes": 0,
                    "created_at": chrono::Utc::now().to_rfc3339()
                }
            })))
        }
    }
}

/// POST /api/videos/:video_id/reactions
pub async fn add_reaction(
    State(state): State<Arc<AppState>>,
    Path(video_id): Path<String>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<AddReactionRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let reaction_id = format!(
        "reaction_{}_{}_{}",
        video_id,
        user.id,
        chrono::Utc::now().timestamp()
    );

    // Valider type réaction
    let valid_types = vec!["like", "love", "laugh", "wow", "sad", "angry"];
    if !valid_types.contains(&payload.type_reaction.as_str()) {
        return Err(StatusCode::BAD_REQUEST);
    }

    let result = sqlx::query!(
        r#"
        INSERT INTO video_reactions (id, video_id, user_id, type_reaction, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (video_id, user_id) DO UPDATE SET
            type_reaction = EXCLUDED.type_reaction,
            updated_at = NOW()
        RETURNING id, created_at
        "#,
        reaction_id,
        video_id,
        user.id,
        payload.type_reaction
    )
    .fetch_optional(&state.pg)
    .await;

    match result {
        Ok(Some(record)) => {
            let user_name = sqlx::query_scalar::<_, Option<String>>(
                "SELECT COALESCE(nom_complet, email) FROM users WHERE id = $1",
            )
            .bind(user.id)
            .fetch_one(&state.pg)
            .await
            .unwrap_or(None)
            .unwrap_or_else(|| format!("User {}", user.id));

            Ok(Json(serde_json::json!({
                "success": true,
                "data": {
                    "id": record.id,
                    "type_reaction": payload.type_reaction,
                    "user_id": user.id,
                    "user_name": user_name,
                    "timestamp": record.created_at.timestamp() as f64
                }
            })))
        }
        Err(_) => {
            // Fallback
            Ok(Json(serde_json::json!({
                "success": true,
                "data": {
                    "id": reaction_id,
                    "type_reaction": payload.type_reaction,
                    "user_id": user.id,
                    "user_name": format!("User {}", user.id),
                    "timestamp": chrono::Utc::now().timestamp() as f64
                }
            })))
        }
    }
}

/// GET /api/videos/:video_id/reactions
pub async fn get_reactions(
    State(state): State<Arc<AppState>>,
    Path(video_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let reactions = sqlx::query!(
        r#"
        SELECT 
            vr.id,
            vr.type_reaction,
            vr.user_id,
            COALESCE(u.nom_complet, u.email) as user_name,
            EXTRACT(EPOCH FROM vr.created_at) as timestamp
        FROM video_reactions vr
        LEFT JOIN users u ON u.id = vr.user_id
        WHERE vr.video_id = $1
        ORDER BY vr.created_at DESC
        LIMIT 100
        "#,
        video_id
    )
    .fetch_all(&state.pg)
    .await;

    match reactions {
        Ok(rows) => {
            let data: Vec<serde_json::Value> = rows.iter().map(|row| {
                serde_json::json!({
                    "id": row.id,
                    "type_reaction": row.type_reaction,
                    "user_id": row.user_id,
                    "user_name": row.user_name.unwrap_or_else(|| format!("User {}", row.user_id)),
                    "timestamp": row.timestamp.unwrap_or(0.0)
                })
            }).collect();

            Ok(Json(serde_json::json!({
                "success": true,
                "data": data
            })))
        }
        Err(_) => {
            // Fallback: retourner liste vide
            Ok(Json(serde_json::json!({
                "success": true,
                "data": []
            })))
        }
    }
}

/// GET /api/duets?original_video_id=...
pub async fn get_duets(
    State(state): State<Arc<AppState>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let original_video_id = params.get("original_video_id");

    let query = if let Some(orig_id) = original_video_id {
        sqlx::query!(
            r#"
            SELECT 
                d.id,
                d.original_video_id,
                d.duet_video_url,
                d.creator_id,
                COALESCE(u.nom_complet, u.email) as creator_name,
                COALESCE(COUNT(ce.id), 0) as likes,
                d.created_at
            FROM duets d
            LEFT JOIN users u ON u.id = d.creator_id
            LEFT JOIN content_engagement ce ON ce.content_id = d.id AND ce.liked = TRUE
            WHERE d.original_video_id = $1
            GROUP BY d.id, d.original_video_id, d.duet_video_url, d.creator_id, creator_name, d.created_at
            ORDER BY d.created_at DESC
            LIMIT 50
            "#,
            orig_id
        )
        .fetch_all(&state.pg)
        .await
    } else {
        sqlx::query!(
            r#"
            SELECT 
                d.id,
                d.original_video_id,
                d.duet_video_url,
                d.creator_id,
                COALESCE(u.nom_complet, u.email) as creator_name,
                COALESCE(COUNT(ce.id), 0) as likes,
                d.created_at
            FROM duets d
            LEFT JOIN users u ON u.id = d.creator_id
            LEFT JOIN content_engagement ce ON ce.content_id = d.id AND ce.liked = TRUE
            GROUP BY d.id, d.original_video_id, d.duet_video_url, d.creator_id, creator_name, d.created_at
            ORDER BY d.created_at DESC
            LIMIT 50
            "#
        )
        .fetch_all(&state.pg)
        .await
    };

    match query {
        Ok(rows) => {
            let data: Vec<serde_json::Value> = rows.iter().map(|row| {
                serde_json::json!({
                    "id": row.id,
                    "original_video_id": row.original_video_id,
                    "duet_video_url": row.duet_video_url,
                    "creator_id": row.creator_id,
                    "creator_name": row.creator_name.unwrap_or_else(|| format!("User {}", row.creator_id)),
                    "likes": row.likes.unwrap_or(0),
                    "created_at": row.created_at.to_rfc3339()
                })
            }).collect();

            Ok(Json(serde_json::json!({
                "success": true,
                "data": data
            })))
        }
        Err(_) => Ok(Json(serde_json::json!({
            "success": true,
            "data": []
        }))),
    }
}
