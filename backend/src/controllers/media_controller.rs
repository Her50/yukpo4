use std::{
    fs::{create_dir_all, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

use axum::{
    extract::{Extension, Multipart, Path as AxumPath},
    http::{header, StatusCode},
    response::Response,
    Json,
};
use axum::body::Body;
use chrono::{NaiveDateTime, Utc};
use sqlx::{FromRow, PgPool};
use tokio::fs::{self, File};
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

#[derive(FromRow)]
struct MediaIdTypeRow {
    id: i32,
    #[sqlx(rename = "type")]
    media_type: String,
}

#[derive(FromRow)]
#[allow(dead_code)] // Structure utilisée pour désérialisation SQLx mais jamais construite directement
struct MediaPathRow {
    path: String,
    service_id: i32,
    #[sqlx(rename = "type")]
    media_type: String,
}

use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::AuthenticatedUser,
};
use log::{error, info, warn};

/// ? Repr?sente un m?dia dans la base
#[derive(Debug, FromRow, serde::Serialize)]
pub struct MediaItem {
    pub id: i32,
    pub service_id: i32,
    pub r#type: String,
    pub path: String,
    pub uploaded_at: Option<NaiveDateTime>,
}

#[derive(Debug, serde::Serialize)]
pub struct UploadedMediaResponse {
    pub id: i32,
    pub path: String,
    pub media_type: String,
}

fn upload_storage_root() -> PathBuf {
    std::env::var("UPLOAD_STORAGE_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("uploads"))
}

fn absolute_media_path(relative: &str) -> PathBuf {
    let root = upload_storage_root();
    let relative_path = Path::new(relative);
    if relative_path.is_absolute() {
        relative_path.to_path_buf()
    } else if let Ok(stripped) = relative_path.strip_prefix("uploads") {
        root.join(stripped)
    } else {
        root.join(relative_path)
    }
}

/// ?? Upload d?un fichier (audio, image, vid?o) prot?g?
pub async fn upload_media(
    AxumPath(service_id): AxumPath<i32>,
    Extension(pool): Extension<PgPool>,
    Extension(user): Extension<AuthenticatedUser>,
    mut multipart: Multipart,
) -> AppResult<Json<Vec<UploadedMediaResponse>>> {
    info!(
        "[upload_media] Called for user_id={}, service_id={}",
        user.id, service_id
    );
    let owner = match sqlx::query_scalar!("SELECT user_id FROM services WHERE id = $1", service_id)
        .fetch_optional(&pool)
        .await
    {
        Ok(o) => o,
        Err(e) => {
            error!("[upload_media] DB error (service owner): {e:?}");
            return Err(AppError::from(e));
        }
    };
    if owner != Some(user.id) {
        error!(
            "[upload_media] Unauthorized upload attempt by user_id={}",
            user.id
        );
        return Err(AppError::Unauthorized(
            "❌ Vous n’êtes pas propriétaire de ce service.".to_string(),
        ));
    }
    let storage_root = upload_storage_root();
    let services_dir = storage_root.join("services");
    if let Err(e) = create_dir_all(&services_dir) {
        error!("[upload_media] create_dir_all error: {e:?}");
        return Err(AppError::from(e));
    }
    create_dir_all("logs").ok();
    let mut log_file = match OpenOptions::new()
        .create(true)
        .append(true)
        .open("logs/media.log")
    {
        Ok(f) => f,
        Err(e) => {
            error!("[upload_media] log file open error: {e:?}");
            return Err(AppError::from(e));
        }
    };

    let mut uploaded_items: Vec<UploadedMediaResponse> = Vec::new();

    while let Some(field) = multipart.next_field().await? {
        let name = field.name().unwrap_or("unknown").to_string();
        let filename = field.file_name().unwrap_or("file").to_string();
        let ext = filename.split('.').next_back().unwrap_or("bin").to_string();
        let unique_name = format!("{}.{}", Uuid::new_v4(), ext);
        let relative_path = format!("uploads/services/{}", unique_name);
        let absolute_path = services_dir.join(&unique_name);

        let bytes = field.bytes().await?;
        let mut file = File::create(&absolute_path).await?;
        file.write_all(&bytes).await?;

        let media_type = if name.contains("audio") {
            "audio"
        } else if name.contains("video") {
            "video"
        } else {
            "image"
        };

        let record: MediaIdTypeRow = sqlx::query_as(
            "INSERT INTO media (service_id, type, path) VALUES ($1, $2, $3) RETURNING id, type"
        )
        .bind(service_id)
        .bind(&media_type)
        .bind(&relative_path)
        .fetch_one(&pool)
        .await
        .map_err(|e| {
            error!("[upload_media] DB error (insert media): {e:?}");
            AppError::from(e)
        })?;

        writeln!(
            log_file,
            "[{}] UPLOAD - user_id={} - service_id={} - type={} - path={}",
            Utc::now().to_rfc3339(),
            user.id,
            service_id,
            media_type,
            absolute_path.to_string_lossy()
        )
        .ok();

        uploaded_items.push(UploadedMediaResponse {
            id: record.id,
            path: relative_path,
            media_type: record.media_type,
        });
    }

    info!(
        "[upload_media] Uploaded {} files for service_id={}",
        uploaded_items.len(),
        service_id
    );
    Ok(Json(uploaded_items))
}

/// ?? R?cup?re les m?dias li?s ? un service donn?
pub async fn get_service_media(
    AxumPath(service_id): AxumPath<i32>,
    Extension(pool): Extension<PgPool>,
) -> AppResult<Json<Vec<MediaItem>>> {
    info!("[get_service_media] Called for service_id={}", service_id);
    // Utiliser query_as au lieu de query_as! pour gérer correctement les types optionnels
    let rows = match sqlx::query_as::<_, MediaItem>(
        r#"SELECT id, service_id, type, path, uploaded_at FROM media WHERE service_id = $1 ORDER BY uploaded_at DESC"#
    )
    .bind(service_id)
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
pub async fn get_all_media(Extension(pool): Extension<PgPool>) -> AppResult<Json<Vec<MediaItem>>> {
    info!("[get_all_media] Called");
    let rows = match sqlx::query_as!(
        MediaItem,
        r#"SELECT id, service_id, type, path, uploaded_at AS "uploaded_at: Option<NaiveDateTime>" FROM media ORDER BY uploaded_at DESC"#
    )
    .fetch_all(&pool)
    .await
    {
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
    AxumPath(media_id): AxumPath<i32>,
    Extension(pool): Extension<PgPool>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<&'static str>> {
    info!(
        "[delete_media] Called for media_id={}, user_id={}",
        media_id, user.id
    );
    #[derive(sqlx::FromRow)]
    struct MediaRecord {
        path: String,
        service_id: i32,
        r#type: String,
    }
    
    let record = match sqlx::query_as::<_, MediaRecord>(
        "SELECT path, service_id, type FROM media WHERE id = $1"
    )
    .bind(media_id)
    .fetch_optional(&pool)
    .await
    {
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
    .await
    {
        Ok(o) => o,
        Err(e) => {
            error!("[delete_media] DB error (service owner): {e:?}");
            return Err(AppError::from(e));
        }
    };
    if owner != Some(user.id) {
        error!(
            "[delete_media] Unauthorized delete attempt by user_id={}",
            user.id
        );
        return Err(AppError::Unauthorized(
            "❌ Suppression interdite : vous n’êtes pas propriétaire du service.".to_string(),
        ));
    }
    let absolute_path = absolute_media_path(&record.path);
    if let Err(e) = fs::remove_file(&absolute_path).await {
        error!(
            "[delete_media] remove_file error for {:?}: {e:?}",
            absolute_path
        );
    }
    if let Err(e) = sqlx::query("DELETE FROM media WHERE id = $1")
        .bind(media_id)
        .execute(&pool)
        .await
    {
        error!("[delete_media] DB error (delete media): {e:?}");
        return Err(AppError::from(e));
    }
    create_dir_all("logs").ok();
    let mut log_file = match OpenOptions::new()
        .create(true)
        .append(true)
        .open("logs/media.log")
    {
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
    Ok(Json("✅ Média supprimé"))
}

/// ✅ PHASE 2: Servir la vidéo exemple de création vidéo
/// Endpoint: GET /api/media/examples/video-creation-demo.mp4
/// Route publique (pas d'authentification requise)
pub async fn serve_example_video() -> Result<Response<Body>, AppError> {
    info!("[serve_example_video] Requête pour la vidéo exemple");
    
    // Chemin vers la vidéo exemple
    let upload_dir = std::env::var("UPLOAD_STORAGE_PATH")
        .unwrap_or_else(|_| "./uploads".to_string());
    
    // Créer le dossier examples s'il n'existe pas
    let examples_dir = Path::new(&upload_dir).join("examples");
    if !examples_dir.exists() {
        if let Err(e) = std::fs::create_dir_all(&examples_dir) {
            warn!("[serve_example_video] Impossible de créer le dossier examples: {}", e);
        }
    }
    
    let video_path = examples_dir.join("video-creation-demo.mp4");
    
    // Vérifier si le fichier existe
    if !video_path.exists() {
        warn!(
            "[serve_example_video] Vidéo exemple introuvable: {:?}",
            video_path
        );
        // Retourner 404 avec un message informatif
        return Ok(Response::builder()
            .status(StatusCode::NOT_FOUND)
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(
                serde_json::json!({
                    "error": "Vidéo exemple non disponible",
                    "message": "La vidéo exemple n'a pas encore été uploadée. Veuillez placer video-creation-demo.mp4 dans uploads/examples/",
                    "path": video_path.to_string_lossy()
                })
                .to_string(),
            ))
            .map_err(|e| AppError::Internal(format!("Erreur création réponse: {}", e)))?);
    }
    
    // Lire le fichier vidéo
    let file_data = std::fs::read(&video_path)
        .map_err(|e| {
            error!("[serve_example_video] Erreur lecture fichier: {}", e);
            AppError::Internal(format!("Erreur lecture vidéo: {}", e))
        })?;
    
    info!(
        "[serve_example_video] Vidéo exemple servie: {} bytes",
        file_data.len()
    );
    
    // Retourner la vidéo avec les bons headers
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "video/mp4")
        .header(header::CONTENT_LENGTH, file_data.len())
        .header(header::CACHE_CONTROL, "public, max-age=3600") // Cache 1h
        .header(header::ACCEPT_RANGES, "bytes") // Support range requests pour streaming
        .body(Body::from(file_data))
        .map_err(|e| AppError::Internal(format!("Erreur création réponse: {}", e)))?)
}
