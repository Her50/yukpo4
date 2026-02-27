// 📦 Contrôleur pour récupérer les médias par produit spécifique
use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::Row;
use std::sync::Arc;

use crate::core::types::{AppError, AppResult};
use crate::state::AppState;
use crate::utils::log::{log_error, log_info};

#[derive(Debug, Serialize, Clone)]
pub struct ProductMediaItem {
    pub id: i32,
    pub service_id: i32,
    pub product_id: Option<String>,
    pub product_index: Option<i32>,
    pub media_type: String,
    pub path: String,
    pub is_main_image: bool,
    pub display_order: i32,
    pub uploaded_at: String,
    pub ai_description: Option<String>,
    pub ai_tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct ProductMediaResponse {
    pub success: bool,
    pub data: Vec<ProductMediaItem>,
    pub count: usize,
    pub product_id: Option<String>,
    pub product_index: i32,
}

/// ✅ NOUVEAU 2026-02-27: Récupérer TOUS les médias d'un service (tous produits confondus)
/// Route: GET /api/services/{service_id}/media
pub async fn get_service_media(
    State(state): State<Arc<AppState>>,
    Path(service_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    log_info(&format!(
        "[MediaProduct] Récupération de TOUS les médias du service: service_id={}",
        service_id
    ));

    let pool = &state.pg;

    let rows = sqlx::query(
        r#"
        SELECT 
            id,
            service_id,
            product_id,
            product_index,
            type as media_type,
            path,
            COALESCE(is_main_image, FALSE) as is_main_image,
            COALESCE(display_order, 0) as display_order,
            uploaded_at,
            ai_description,
            ai_tags
        FROM media
        WHERE service_id = $1
        ORDER BY 
            product_index ASC NULLS FIRST,
            COALESCE(is_main_image, FALSE) DESC,
            COALESCE(display_order, 0) ASC,
            id ASC
        "#,
    )
    .bind(service_id)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        log_error(&format!(
            "[MediaProduct] Erreur SQL get_service_media: {}",
            e
        ));
        AppError::Internal(format!("Erreur récupération médias service: {}", e))
    })?;

    log_info(&format!(
        "[MediaProduct] {} médias trouvés pour service {}",
        rows.len(),
        service_id
    ));

    let media: Vec<ProductMediaItem> = rows
        .iter()
        .map(|row| {
            let path: String = row.get::<String, _>("path");
            let full_url = if path.starts_with("http://") || path.starts_with("https://") {
                path
            } else if state.media_storage.is_remote() {
                state.media_storage.build_public_url(&path)
            } else {
                let api_base_url = std::env::var("PUBLIC_BASE_URL")
                    .or_else(|_| std::env::var("UPLOAD_BASE_URL"))
                    .unwrap_or_else(|_| "https://yukpomnang.onrender.com".to_string());
                let clean_path = path.trim_start_matches('/');
                format!(
                    "{}/api/media/files/{}",
                    api_base_url.trim_end_matches('/'),
                    clean_path
                )
            };

            ProductMediaItem {
                id: row.get::<i32, _>("id"),
                service_id: row.get::<i32, _>("service_id"),
                product_id: row.get::<Option<String>, _>("product_id"),
                product_index: row.get::<Option<i32>, _>("product_index"),
                media_type: row.get::<String, _>("media_type"),
                path: full_url,
                is_main_image: row.get::<bool, _>("is_main_image"),
                display_order: row.get::<i32, _>("display_order"),
                uploaded_at: row.get::<DateTime<Utc>, _>("uploaded_at").to_rfc3339(),
                ai_description: row.get::<Option<String>, _>("ai_description"),
                ai_tags: row.get::<Option<Vec<String>>, _>("ai_tags"),
            }
        })
        .collect();

    let count = media.len();

    Ok(Json(serde_json::json!({
        "success": true,
        "data": media,
        "count": count,
        "service_id": service_id
    })))
}

/// Récupérer tous les médias d'un produit spécifique
pub async fn get_product_media(
    State(state): State<Arc<AppState>>,
    Path((service_id, product_index)): Path<(i32, i32)>,
) -> AppResult<impl IntoResponse> {
    log_info(&format!(
        "[MediaProduct] Récupération médias: service_id={}, product_index={}",
        service_id, product_index
    ));

    let pool = &state.pg;

    // Récupérer les médias du produit spécifique
    let rows = sqlx::query(
        r#"
        SELECT 
            id,
            service_id,
            product_id,
            product_index,
            type as media_type,
            path,
            COALESCE(is_main_image, FALSE) as is_main_image,
            COALESCE(display_order, 0) as display_order,
            uploaded_at,
            ai_description,
            ai_tags
        FROM media
        WHERE service_id = $1 
        AND product_index = $2
        ORDER BY 
            COALESCE(is_main_image, FALSE) DESC,  -- Image principale en premier
            COALESCE(display_order, 0) ASC,        -- Puis par ordre
            id ASC                                  -- Puis par ID
        "#,
    )
    .bind(service_id)
    .bind(product_index)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        log_error(&format!("[MediaProduct] Erreur SQL: {}", e));
        AppError::Internal(format!("Erreur récupération médias: {}", e))
    })?;

    log_info(&format!("[MediaProduct] {} médias trouvés", rows.len()));

    // ✅ CORRIGÉ: Transformer les chemins en URLs publiques S3/Wasabi
    // Convertir les résultats
    let media: Vec<ProductMediaItem> = rows
        .iter()
        .map(|row| {
            let path: String = row.get::<String, _>("path");
            // Si c'est déjà une URL complète, la retourner telle quelle
            let full_url = if path.starts_with("http://") || path.starts_with("https://") {
                path
            } else if state.media_storage.is_remote() {
                // ✅ CORRIGÉ: Utiliser MediaStorageService pour construire URL S3/Wasabi
                state.media_storage.build_public_url(&path)
            } else {
                // ✅ Fallback pour anciens médias locaux (temporaire, migration)
                let api_base_url = std::env::var("PUBLIC_BASE_URL")
                    .or_else(|_| std::env::var("UPLOAD_BASE_URL"))
                    .unwrap_or_else(|_| "https://yukpomnang.onrender.com".to_string());
                let clean_path = path.trim_start_matches('/');
                format!(
                    "{}/api/media/files/{}",
                    api_base_url.trim_end_matches('/'),
                    clean_path
                )
            };

            ProductMediaItem {
                id: row.get::<i32, _>("id"),
                service_id: row.get::<i32, _>("service_id"),
                product_id: row.get::<Option<String>, _>("product_id"),
                product_index: row.get::<Option<i32>, _>("product_index"),
                media_type: row.get::<String, _>("media_type"),
                path: full_url,
                is_main_image: row.get::<bool, _>("is_main_image"),
                display_order: row.get::<i32, _>("display_order"),
                uploaded_at: row.get::<DateTime<Utc>, _>("uploaded_at").to_rfc3339(),
                ai_description: row.get::<Option<String>, _>("ai_description"),
                ai_tags: row.get::<Option<Vec<String>>, _>("ai_tags"),
            }
        })
        .collect();

    // Extraire product_id (prendre le premier si disponible)
    let product_id = media.first().and_then(|m| m.product_id.clone());

    Ok(Json(ProductMediaResponse {
        success: true,
        data: media.clone(),
        count: media.len(),
        product_id,
        product_index,
    }))
}

/// Récupérer uniquement les images d'un produit (filtré par type)
pub async fn get_product_images(
    State(state): State<Arc<AppState>>,
    Path((service_id, product_index)): Path<(i32, i32)>,
) -> AppResult<impl IntoResponse> {
    log_info(&format!(
        "[MediaProduct] Récupération images: service_id={}, product_index={}",
        service_id, product_index
    ));

    let pool = &state.pg;

    let rows = sqlx::query(
        r#"
        SELECT path, COALESCE(is_main_image, FALSE) as is_main_image
        FROM media
        WHERE service_id = $1 
        AND product_index = $2
        AND type = 'image'
        ORDER BY 
            COALESCE(is_main_image, FALSE) DESC,
            COALESCE(display_order, 0) ASC,
            id ASC
        "#,
    )
    .bind(service_id)
    .bind(product_index)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        log_error(&format!("[MediaProduct] Erreur SQL images: {}", e));
        AppError::Internal(format!("Erreur récupération images: {}", e))
    })?;

    // ✅ CORRIGÉ 2025-11-30: Transformer les chemins en URLs complètes
    let api_base_url = std::env::var("PUBLIC_BASE_URL")
        .or_else(|_| std::env::var("UPLOAD_BASE_URL"))
        .unwrap_or_else(|_| "https://yukpomnang.onrender.com".to_string());

    let images: Vec<String> = rows
        .iter()
        .map(|row| {
            let path: String = row.get::<String, _>("path");
            // Si c'est déjà une URL complète, la retourner telle quelle
            if path.starts_with("http://") || path.starts_with("https://") {
                return path;
            }
            // Construire l'URL complète avec l'endpoint /api/media/files
            let clean_path = path.trim_start_matches('/');
            format!(
                "{}/api/media/files/{}",
                api_base_url.trim_end_matches('/'),
                clean_path
            )
        })
        .collect();

    Ok(Json(serde_json::json!({
        "success": true,
        "images": images,
        "count": images.len()
    })))
}

/// Récupérer uniquement les vidéos d'un produit
pub async fn get_product_videos(
    State(state): State<Arc<AppState>>,
    Path((service_id, product_index)): Path<(i32, i32)>,
) -> AppResult<impl IntoResponse> {
    log_info(&format!(
        "[MediaProduct] Récupération vidéos: service_id={}, product_index={}",
        service_id, product_index
    ));

    let pool = &state.pg;

    let rows = sqlx::query(
        r#"
        SELECT path
        FROM media
        WHERE service_id = $1 
        AND product_index = $2
        AND type = 'video'
        ORDER BY 
            COALESCE(display_order, 0) ASC,
            id ASC
        "#,
    )
    .bind(service_id)
    .bind(product_index)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        log_error(&format!("[MediaProduct] Erreur SQL vidéos: {}", e));
        AppError::Internal(format!("Erreur récupération vidéos: {}", e))
    })?;

    // ✅ CORRIGÉ 2025-11-30: Transformer les chemins en URLs complètes
    let api_base_url = std::env::var("PUBLIC_BASE_URL")
        .or_else(|_| std::env::var("UPLOAD_BASE_URL"))
        .unwrap_or_else(|_| "https://yukpomnang.onrender.com".to_string());

    let videos: Vec<String> = rows
        .iter()
        .map(|row| {
            let path: String = row.get::<String, _>("path");
            // Si c'est déjà une URL complète, la retourner telle quelle
            if path.starts_with("http://") || path.starts_with("https://") {
                return path;
            }
            // Construire l'URL complète avec l'endpoint /api/media/files
            let clean_path = path.trim_start_matches('/');
            format!(
                "{}/api/media/files/{}",
                api_base_url.trim_end_matches('/'),
                clean_path
            )
        })
        .collect();

    Ok(Json(serde_json::json!({
        "success": true,
        "videos": videos,
        "count": videos.len()
    })))
}

/// Définir l'image principale d'un produit
pub async fn set_main_image(
    State(state): State<Arc<AppState>>,
    Path(media_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    log_info(&format!(
        "[MediaProduct] Définir image principale: media_id={}",
        media_id
    ));

    let pool = &state.pg;

    // Récupérer les infos du média
    let media_info = sqlx::query("SELECT service_id, product_index FROM media WHERE id = $1")
        .bind(media_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| {
            log_error(&format!("[MediaProduct] Erreur récupération média: {}", e));
            AppError::Internal(format!("Média introuvable: {}", e))
        })?;

    if let Some(row) = media_info {
        let service_id: i32 = row.get::<i32, _>("service_id");
        let product_index: Option<i32> = row.get::<Option<i32>, _>("product_index");

        if let Some(prod_idx) = product_index {
            // Désactiver toutes les images principales de ce produit
            sqlx::query(
                r#"
                UPDATE media
                SET is_main_image = FALSE
                WHERE service_id = $1
                AND product_index = $2
                AND type = 'image'
                "#,
            )
            .bind(service_id)
            .bind(prod_idx)
            .execute(pool)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur désactivation: {}", e)))?;

            // Définir cette image comme principale
            sqlx::query("UPDATE media SET is_main_image = TRUE WHERE id = $1")
                .bind(media_id)
                .execute(pool)
                .await
                .map_err(|e| AppError::Internal(format!("Erreur activation: {}", e)))?;

            log_info(&format!(
                "[MediaProduct] ✅ Image {} définie comme principale",
                media_id
            ));

            return Ok(Json(serde_json::json!({
                "success": true,
                "message": "Image principale définie avec succès"
            })));
        }
    }

    Err(AppError::NotFound(
        "Média introuvable ou sans product_index".to_string(),
    ))
}
