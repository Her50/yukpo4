use std::{
    fs::{create_dir_all, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

use axum::body::Body;
use axum::{
    extract::{Extension, Multipart, Path as AxumPath, State},
    http::{header, StatusCode},
    response::Response,
    Json,
};
use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgPool};
use std::sync::Arc;
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
    state::AppState,
};
use log::{error, info, warn};

/// ? Repr?sente un m?dia dans la base
#[derive(Debug, FromRow, serde::Serialize)]
pub struct MediaItem {
    pub id: i32,
    pub service_id: i32,
    #[sqlx(rename = "type")] // ✅ Mapping explicite pour éviter les conflits avec mot-clé Rust
    pub r#type: String,
    pub path: String,
    // ✅ TIMESTAMPTZ dans PostgreSQL -> DateTime<Utc> en Rust (NOT NULL dans la DB)
    pub uploaded_at: DateTime<Utc>,
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

/// ✅ CORRIGÉ: Upload d'un fichier (audio, image, vidéo) avec S3/Wasabi
/// Utilise MediaStorageService pour stocker dans le cloud (comme les autres uploads)
pub async fn upload_media(
    AxumPath(service_id): AxumPath<i32>,
    State(state): State<Arc<AppState>>,
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
    // ✅ CORRIGÉ: Utiliser MediaStorageService (S3/Wasabi) au lieu du stockage local
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

        let media_type = if name.contains("audio") {
            "audio"
        } else if name.contains("video") {
            "video"
        } else {
            "image"
        };

        let content_type = match media_type {
            "audio" => "audio/mpeg",
            "video" => "video/mp4",
            _ => "image/jpeg",
        };

        let bytes = field.bytes().await?;

        // ✅ CORRIGÉ: Utiliser MediaStorageService (S3/Wasabi)
        let storage_key = format!("services/{}/{}", service_id, unique_name);
        let relative_path = match state
            .media_storage
            .store_bytes(&bytes, &storage_key, Some(content_type))
            .await
        {
            Ok(location) => {
                // ✅ URL publique S3/Wasabi générée automatiquement
                // location.storage_path = "uploads/services/123/file.jpg"
                // location.public_url = "https://s3.amazonaws.com/bucket/uploads/services/123/file.jpg"
                // On stocke le storage_path dans la DB (référence), l'URL publique est générée à la volée
                location.storage_path.clone()
            }
            Err(e) => {
                error!(
                    "[upload_media] ❌ Erreur upload S3/Wasabi: {}. Fallback vers stockage local.",
                    e
                );
                warn!("[upload_media] ⚠️ Fallback vers stockage local (S3/Wasabi non disponible ou erreur)");

                // Fallback vers stockage local si S3 échoue
                let storage_root = upload_storage_root();
                let services_dir = storage_root.join("services");
                if let Err(e) = create_dir_all(&services_dir) {
                    error!("[upload_media] create_dir_all error: {e:?}");
                    return Err(AppError::from(e));
                }
                let absolute_path = services_dir.join(&unique_name);
                let mut file = File::create(&absolute_path).await?;
                file.write_all(&bytes).await?;
                format!("uploads/services/{}", unique_name)
            }
        };

        let record: MediaIdTypeRow = sqlx::query_as(
            "INSERT INTO media (service_id, type, path) VALUES ($1, $2, $3) RETURNING id, type",
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
            relative_path
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
    State(state): State<Arc<crate::state::AppState>>,
) -> AppResult<Json<Vec<MediaItem>>> {
    info!("[get_service_media] Called for service_id={}", service_id);
    let pool = &state.pg;

    // ✅ Vérifier d'abord si le service existe pour éviter des erreurs inutiles
    let service_exists: bool = match sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM services WHERE id = $1)",
    )
    .bind(service_id)
    .fetch_one(pool)
    .await
    {
        Ok(exists) => exists,
        Err(e) => {
            error!(
                "[get_service_media] Erreur vérification service {}: {e:?}",
                service_id
            );
            // Si la vérification échoue, on continue quand même (peut être un problème temporaire)
            warn!("[get_service_media] Impossible de vérifier l'existence du service, continuation...");
            true // Assume que le service existe pour continuer
        }
    };

    if !service_exists {
        warn!(
            "[get_service_media] Service {} n'existe pas, retour liste vide",
            service_id
        );
        return Ok(Json(vec![])); // Retourner liste vide au lieu d'erreur
    }

    // ✅ Utiliser query_as avec gestion d'erreur améliorée
    // ✅ CORRECTION: Utiliser media.type avec le nom de table pour éviter les conflits avec le mot-clé réservé
    // Le mapping se fait via #[sqlx(rename = "type")] dans MediaItem
    let rows = match sqlx::query_as::<_, MediaItem>(
        r#"SELECT id, service_id, media.type, path, uploaded_at FROM media WHERE service_id = $1 ORDER BY uploaded_at DESC NULLS LAST"#
    )
    .bind(service_id)
    .fetch_all(pool)
    .await {
        Ok(r) => {
            info!("[get_service_media] {} médias trouvés pour service_id={}", r.len(), service_id);
            // ✅ CORRIGÉ: Transformer path en URL publique S3/Wasabi avec fallback local
            r.into_iter()
                .map(|mut item| {
                    // Si path n'est pas déjà une URL complète
                    if !item.path.starts_with("http://") && !item.path.starts_with("https://") {
                        // Si S3/Wasabi configuré, utiliser URL publique
                        if state.media_storage.is_remote() {
                            item.path = state.media_storage.build_public_url(&item.path);
                        } else {
                            // Fallback pour anciens médias locaux (temporaire, migration)
                            let api_base_url = std::env::var("PUBLIC_BASE_URL")
                                .or_else(|_| std::env::var("UPLOAD_BASE_URL"))
                                .unwrap_or_else(|_| "https://yukpomnang.onrender.com".to_string());
                            let clean_path = item.path.trim_start_matches('/');
                            item.path = format!("{}/api/media/files/{}", api_base_url.trim_end_matches('/'), clean_path);
                        }
                    }
                    item
                })
                .collect()
        },
        Err(e) => {
            // ✅ Log détaillé pour debugging
            error!(
                "[get_service_media] Query error pour service_id={}: {e:?}",
                service_id
            );
            
            // ✅ Gérer différents types d'erreurs
            match &e {
                sqlx::Error::RowNotFound => {
                    // Pas d'erreur si aucun média trouvé, juste retourner liste vide
                    info!("[get_service_media] Aucun média trouvé pour service_id={}", service_id);
                    return Ok(Json(vec![]));
                }
                sqlx::Error::PoolClosed | sqlx::Error::PoolTimedOut => {
                    error!("[get_service_media] Pool de connexions saturé pour service_id={}", service_id);
                    return Err(AppError::Database(
                        "Service temporairement indisponible, veuillez réessayer".to_string()
                    ));
                }
                sqlx::Error::Io(io_err) => {
                    error!("[get_service_media] Erreur I/O pour service_id={}: {io_err:?}", service_id);
                    // Vérifier si c'est une erreur de connexion TLS
                    if io_err.to_string().contains("TLS close_notify") 
                        || io_err.to_string().contains("crash of another server process") {
                        return Err(AppError::Database(
                            "Erreur de connexion à la base de données, veuillez réessayer".to_string()
                        ));
                    }
                }
                _ => {}
            }
            
            // ✅ Pour les autres erreurs, retourner une erreur générique mais informative
            return Err(AppError::Database(format!(
                "Erreur lors de la récupération des médias: {}",
                e
            )));
        }
    };

    Ok(Json(rows))
}

/// ?? R?cup?re tous les m?dias
pub async fn get_all_media(Extension(pool): Extension<PgPool>) -> AppResult<Json<Vec<MediaItem>>> {
    info!("[get_all_media] Called");
    // ✅ Utiliser query_as au lieu de query_as! pour cohérence avec get_service_media
    let rows = match sqlx::query_as::<_, MediaItem>(
        r#"SELECT id, service_id, type, path, uploaded_at FROM media ORDER BY uploaded_at DESC"#,
    )
    .fetch_all(&pool)
    .await
    {
        Ok(r) => {
            info!("[get_all_media] {} médias trouvés", r.len());
            r
        }
        Err(e) => {
            error!("[get_all_media] Query error: {e:?}");
            return Err(AppError::Database(format!(
                "Erreur lors de la récupération des médias: {}",
                e
            )));
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
        "SELECT path, service_id, type FROM media WHERE id = $1",
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
    let upload_dir =
        std::env::var("UPLOAD_STORAGE_PATH").unwrap_or_else(|_| "./uploads".to_string());

    // Créer le dossier examples s'il n'existe pas
    let examples_dir = Path::new(&upload_dir).join("examples");
    if !examples_dir.exists() {
        if let Err(e) = std::fs::create_dir_all(&examples_dir) {
            warn!(
                "[serve_example_video] Impossible de créer le dossier examples: {}",
                e
            );
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
    let file_data = std::fs::read(&video_path).map_err(|e| {
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

// ✅ NOUVEAU 2025-01-27: Fonctions pour bibliothèque d'effets étendue

use crate::services::effect_library_service::EffectLibraryService;
use axum::extract::Query;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct EffectsQuery {
    pub category: Option<String>,
    pub tags: Option<String>,
    pub q: Option<String>,
    pub premium: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Liste tous les effets avec filtres optionnels
pub async fn list_effects(
    State(state): State<Arc<AppState>>,
    Query(query): Query<EffectsQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let service = EffectLibraryService::new(state.pg.clone());

    let tags = query
        .tags
        .map(|t| t.split(',').map(|s| s.trim().to_string()).collect());

    let (effects, total) = service
        .list_effects(
            query.category.as_deref(),
            tags.as_deref(),
            query.q.as_deref(),
            query.premium,
            query.limit.unwrap_or(50),
            query.offset.unwrap_or(0),
        )
        .await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "effects": effects,
        "total": total,
        "limit": query.limit.unwrap_or(50),
        "offset": query.offset.unwrap_or(0),
    })))
}

/// Récupère un effet par son nom
pub async fn get_effect(
    State(state): State<Arc<AppState>>,
    AxumPath(name): AxumPath<String>,
) -> AppResult<Json<serde_json::Value>> {
    let service = EffectLibraryService::new(state.pg.clone());

    match service.get_effect_by_name(&name).await? {
        Some(effect) => Ok(Json(serde_json::json!({
            "success": true,
            "effect": effect,
        }))),
        None => Err(AppError::NotFound(format!("Effet '{}' non trouvé", name))),
    }
}

/// Récupère les effets par catégorie
pub async fn get_effects_by_category(
    State(state): State<Arc<AppState>>,
    AxumPath(category): AxumPath<String>,
) -> AppResult<Json<serde_json::Value>> {
    let service = EffectLibraryService::new(state.pg.clone());

    let effects = service.get_effects_by_category(&category).await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "effects": effects,
    })))
}

// ✅ NOUVEAU 2025-01-27: Fonctions pour bibliothèque de templates

use crate::services::template_service::TemplateService;

#[derive(Debug, serde::Deserialize)]
pub struct TemplatesQuery {
    pub industry: Option<String>,
    pub subcategory: Option<String>,
    pub q: Option<String>,
    pub premium: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Liste tous les templates avec filtres optionnels
pub async fn list_templates(
    State(state): State<Arc<AppState>>,
    Query(query): Query<TemplatesQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let service = TemplateService::new(state.pg.clone());

    let (templates, total) = service
        .list_templates(
            query.industry.as_deref(),
            query.subcategory.as_deref(),
            query.q.as_deref(),
            query.premium,
            query.limit.unwrap_or(50),
            query.offset.unwrap_or(0),
        )
        .await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "templates": templates,
        "total": total,
        "limit": query.limit.unwrap_or(50),
        "offset": query.offset.unwrap_or(0),
    })))
}

/// Récupère un template par son nom
pub async fn get_template(
    State(state): State<Arc<AppState>>,
    AxumPath(name): AxumPath<String>,
) -> AppResult<Json<serde_json::Value>> {
    let service = TemplateService::new(state.pg.clone());

    match service.get_template_by_name(&name).await? {
        Some(template) => {
            // Incrémenter le compteur d'utilisation
            let _ = service.increment_usage(template.id).await;

            Ok(Json(serde_json::json!({
                "success": true,
                "template": template,
            })))
        }
        None => Err(AppError::NotFound(format!(
            "Template '{}' non trouvé",
            name
        ))),
    }
}

/// Récupère les templates par industrie
pub async fn get_templates_by_industry(
    State(state): State<Arc<AppState>>,
    AxumPath(industry): AxumPath<String>,
) -> AppResult<Json<serde_json::Value>> {
    let service = TemplateService::new(state.pg.clone());

    let templates = service.get_templates_by_industry(&industry).await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "templates": templates,
    })))
}
