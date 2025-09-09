use std::{
    fs::{create_dir_all, remove_file, OpenOptions},
    io::Write,
};

use axum::{
    extract::{Extension, Multipart, Path},
    Json,
};
use chrono::{NaiveDateTime, Utc};
use sqlx::{FromRow, PgPool};
use tokio::fs::File;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::AuthenticatedUser,
};
use log::{info, error};

/// ? Repr?sente un m?dia dans la base
#[derive(Debug, FromRow, serde::Serialize)]
pub struct MediaItem {
    pub id: i32,
    pub service_id: i32,
    pub r#type: String,
    pub path: String,
    pub uploaded_at: Option<NaiveDateTime>,
}

/// ?? Upload d?un fichier (audio, image, vid?o) prot?g?
pub async fn upload_media(
    Path(service_id): Path<i32>,
    Extension(pool): Extension<PgPool>,
    Extension(user): Extension<AuthenticatedUser>,
    mut multipart: Multipart,
) -> AppResult<Json<Vec<String>>> {
    info!("[upload_media] Called for user_id={}, service_id={}", user.id, service_id);
    let owner = match sqlx::query_scalar!(
        "SELECT user_id FROM services WHERE id = $1",
        service_id
    )
    .fetch_optional(&pool)
    .await {
        Ok(o) => o,
        Err(e) => {
            error!("[upload_media] DB error (service owner): {e:?}");
            return Err(AppError::from(e));
        }
    };
    if owner != Some(user.id) {
        error!("[upload_media] Unauthorized upload attempt by user_id={}", user.id);
        return Err(AppError::Unauthorized("? Vous n??tes pas propri?taire de ce service.".to_string()));
    }
    if let Err(e) = create_dir_all("uploads/services") {
        error!("[upload_media] create_dir_all error: {e:?}");
        return Err(AppError::from(e));
    }
    create_dir_all("logs").ok();
    let mut log_file = match OpenOptions::new().create(true).append(true).open("logs/media.log") {
        Ok(f) => f,
        Err(e) => {
            error!("[upload_media] log file open error: {e:?}");
            return Err(AppError::from(e));
        }
    };
    let mut saved_paths = vec![];
    while let Some(field) = multipart.next_field().await? {
        let name = field.name().unwrap_or("unknown").to_string();
        let filename = field.file_name().unwrap_or("file").to_string();
        let ext = filename.split('.').next_back().unwrap_or("bin").to_string();
        let new_path = format!("uploads/services/{}.{}", Uuid::new_v4(), ext);
        let bytes = field.bytes().await?;
        let mut file = File::create(&new_path).await?;
        file.write_all(&bytes).await?;
        let media_type = if name.contains("audio") {
            "audio"
        } else if name.contains("video") {
            "video"
        } else {
            "image"
        };
        if let Err(e) = sqlx::query!(
            "INSERT INTO media (service_id, type, path) VALUES ($1, $2, $3)",
            service_id,
            media_type,
            new_path
        )
        .execute(&pool)
        .await {
            error!("[upload_media] DB error (insert media): {e:?}");
            return Err(AppError::from(e));
        }
        writeln!(
            log_file,
            "[{}] UPLOAD - user_id={} - service_id={} - type={} - path={}",
            Utc::now().to_rfc3339(),
            user.id,
            service_id,
            media_type,
            new_path
        )
        .ok();
        saved_paths.push(new_path);
    }
    info!("[upload_media] Uploaded {} files for service_id={}", saved_paths.len(), service_id);
    Ok(Json(saved_paths))
}

/// ?? R?cup?re les m?dias li?s ? un service donn?
pub async fn get_service_media(
    Path(service_id): Path<i32>,
    Extension(pool): Extension<PgPool>,
) -> AppResult<Json<Vec<MediaItem>>> {
    info!("[get_service_media] Called for service_id={}", service_id);
    let rows = match sqlx::query_as!(
        MediaItem,
        "SELECT id, service_id, type, path, uploaded_at FROM media WHERE service_id = $1 ORDER BY uploaded_at DESC",
        service_id
    )
    .fetch_all(&pool)
    .await {
        Ok(r) => r,
        Err(e) => {
            error!("[get_service_media] Query error: {e:?}");
            return Err(AppError::from(e));
        }
    };
    Ok(Json(rows))
}

/// ?? R?cup?re tous les m?dias
pub async fn get_all_media(
    Extension(pool): Extension<PgPool>,
) -> AppResult<Json<Vec<MediaItem>>> {
    info!("[get_all_media] Called");
    let rows = match sqlx::query_as!(
        MediaItem,
        "SELECT id, service_id, type, path, uploaded_at FROM media ORDER BY uploaded_at DESC"
    )
    .fetch_all(&pool)
    .await {
        Ok(r) => r,
        Err(e) => {
            error!("[get_all_media] Query error: {e:?}");
            return Err(AppError::from(e));
        }
    };
    Ok(Json(rows))
}

/// ??? Supprime un m?dia si le user est propri?taire du service
pub async fn delete_media(
    Path(media_id): Path<i32>,
    Extension(pool): Extension<PgPool>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<&'static str>> {
    info!("[delete_media] Called for media_id={}, user_id={}", media_id, user.id);
    let record = match sqlx::query!(
        "SELECT path, service_id, type FROM media WHERE id = $1",
        media_id
    )
    .fetch_optional(&pool)
    .await {
        Ok(Some(r)) => r,
        Ok(None) => {
            error!("[delete_media] Media not found: id={}", media_id);
            return Err(AppError::NotFound("? M?dia introuvable".to_string()));
        }
        Err(e) => {
            error!("[delete_media] Query error: {e:?}");
            return Err(AppError::from(e));
        }
    };
    let owner = match sqlx::query_scalar!(
        "SELECT user_id FROM services WHERE id = $1",
        record.service_id
    )
    .fetch_optional(&pool)
    .await {
        Ok(o) => o,
        Err(e) => {
            error!("[delete_media] DB error (service owner): {e:?}");
            return Err(AppError::from(e));
        }
    };
    if owner != Some(user.id) {
        error!("[delete_media] Unauthorized delete attempt by user_id={}", user.id);
        return Err(AppError::Unauthorized("? Suppression interdite : vous n??tes pas propri?taire du service.".to_string()));
    }
    let _ = remove_file(&record.path);
    if let Err(e) = sqlx::query!(
        "DELETE FROM media WHERE id = $1",
        media_id
    )
    .execute(&pool)
    .await {
        error!("[delete_media] DB error (delete media): {e:?}");
        return Err(AppError::from(e));
    }
    create_dir_all("logs").ok();
    let mut log_file = match OpenOptions::new().create(true).append(true).open("logs/media.log") {
        Ok(f) => f,
        Err(e) => {
            error!("[delete_media] log file open error: {e:?}");
            return Err(AppError::from(e));
        }
    };
    writeln!(
        log_file,
        "[{}] DELETE - user_id={} - service_id={} - type={} - path={}",
        Utc::now().to_rfc3339(),
        user.id,
        record.service_id,
        record.r#type,
        record.path
    )
    .ok();
    info!("[delete_media] Deleted media_id={}", media_id);
    Ok(Json("? M?dia supprim?"))
}
