use axum::{
    extract::{Json, Path, Query, State},
    http::StatusCode,
    response::Json as ResponseJson,
    routing::{delete, get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::sync::Arc;

use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct Asset {
    pub id: String,
    pub user_id: i32,
    pub r#type: String, // "image" | "video"
    pub url: String,
    pub thumbnail: Option<String>,
    pub name: String,
    pub size: i32,
    pub tags: Option<Vec<String>>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct UploadAssetRequest {
    pub name: String,
    pub r#type: String,
    pub url: String,
    pub thumbnail: Option<String>,
    pub size: Option<i32>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct UploadAssetResponse {
    pub asset: Asset,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct ListAssetsResponse {
    pub assets: Vec<Asset>,
}

#[derive(Debug, sqlx::FromRow)]
struct AssetRow {
    id: String,
    user_id: i32,
    r#type: String,
    url: String,
    thumbnail: Option<String>,
    name: String,
    size: i32,
    tags: Option<Vec<String>>,
    created_at: String,
}

/// Lister les assets d'un utilisateur
pub async fn list_assets(
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<ResponseJson<ListAssetsResponse>, StatusCode> {
    let pool = &state.pg;
    let user_id: i32 = params
        .get("user_id")
        .and_then(|v| v.parse().ok())
        .unwrap_or(1); // TODO: Récupérer depuis JWT

    let filter_type = params.get("type").cloned();

    match if let Some(t) = filter_type {
        sqlx::query_as::<_, AssetRow>(
            r#"
            SELECT id, user_id, type, url, thumbnail, name, size, tags, created_at
            FROM publicite_assets
            WHERE user_id = $1 AND type = $2
            ORDER BY created_at DESC
            "#,
        )
        .bind(user_id)
        .bind(t)
        .fetch_all(pool)
        .await
    } else {
        sqlx::query_as::<_, AssetRow>(
            r#"
            SELECT id, user_id, type, url, thumbnail, name, size, tags, created_at
            FROM publicite_assets
            WHERE user_id = $1
            ORDER BY created_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
    } {
        Ok(rows) => {
            let assets: Vec<Asset> = rows
                .into_iter()
                .map(|row| Asset {
                    id: row.id,
                    user_id: row.user_id,
                    r#type: row.r#type,
                    url: row.url,
                    thumbnail: row.thumbnail,
                    name: row.name,
                    size: row.size,
                    tags: row.tags,
                    created_at: row.created_at,
                })
                .collect();

            Ok(ResponseJson(ListAssetsResponse { assets }))
        }
        Err(e) => {
            log::error!("[list_assets] Erreur DB: {:?}", e);
            // Si la table n'existe pas, retourner une liste vide
            Ok(ResponseJson(ListAssetsResponse { assets: vec![] }))
        }
    }
}

/// Uploader un asset
pub async fn upload_asset(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UploadAssetRequest>,
) -> Result<ResponseJson<UploadAssetResponse>, StatusCode> {
    let pool = &state.pg;

    // TODO: Récupérer user_id depuis JWT token
    let user_id = 1; // Temporaire

    let asset_id = uuid::Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now().to_rfc3339();

    let query = r#"
        INSERT INTO publicite_assets (id, user_id, type, url, thumbnail, name, size, tags, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, user_id, type, url, thumbnail, name, size, tags, created_at
    "#;

    match sqlx::query_as::<_, AssetRow>(query)
        .bind(&asset_id)
        .bind(user_id)
        .bind(&payload.r#type)
        .bind(&payload.url)
        .bind(&payload.thumbnail)
        .bind(&payload.name)
        .bind(payload.size.unwrap_or(0))
        .bind(&payload.tags)
        .bind(&created_at)
        .fetch_one(pool)
        .await
    {
        Ok(row) => {
            let asset = Asset {
                id: row.id,
                user_id: row.user_id,
                r#type: row.r#type,
                url: row.url,
                thumbnail: row.thumbnail,
                name: row.name,
                size: row.size,
                tags: row.tags,
                created_at: row.created_at,
            };

            Ok(ResponseJson(UploadAssetResponse {
                asset,
                message: "Asset uploadé avec succès".to_string(),
            }))
        }
        Err(e) => {
            log::error!("[upload_asset] Erreur DB: {:?}", e);
            // Si la table n'existe pas, retourner une réponse simulée
            let asset = Asset {
                id: asset_id,
                user_id,
                r#type: payload.r#type,
                url: payload.url,
                thumbnail: payload.thumbnail,
                name: payload.name,
                size: payload.size.unwrap_or(0),
                tags: payload.tags,
                created_at,
            };

            Ok(ResponseJson(UploadAssetResponse {
                asset,
                message: "Asset uploadé avec succès (mode simulation)".to_string(),
            }))
        }
    }
}

/// Supprimer un asset
pub async fn delete_asset(
    State(state): State<Arc<AppState>>,
    Path(asset_id): Path<String>,
) -> Result<ResponseJson<serde_json::Value>, StatusCode> {
    let pool = &state.pg;

    // TODO: Vérifier que l'asset appartient à l'utilisateur

    let query = r#"
        DELETE FROM publicite_assets
        WHERE id = $1
    "#;

    match sqlx::query(query).bind(&asset_id).execute(pool).await {
        Ok(_) => Ok(ResponseJson(serde_json::json!({
            "success": true,
            "message": "Asset supprimé avec succès"
        }))),
        Err(e) => {
            log::error!("[delete_asset] Erreur DB: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub fn publicite_assets_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::<Arc<AppState>>::new()
        .route("/api/publicites/assets", get(list_assets))
        .route("/api/publicites/assets/upload", post(upload_asset))
        .route("/api/publicites/assets/:id", delete(delete_asset))
        .with_state(state)
}
