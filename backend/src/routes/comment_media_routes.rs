// ✅ FINALISÉ: Routes pour upload de médias dans commentaires
// Utilise MediaStorageService pour S3/Wasabi (comme les autres uploads)
use axum::{
    extract::{Extension, Multipart, Path, State},
    http::StatusCode,
    Json,
};
use log::{error, info, warn};
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

use crate::{middlewares::jwt::AuthenticatedUser, state::AppState};

/// POST /api/comments/{comment_id}/media - Upload médias pour un commentaire
pub async fn upload_comment_media(
    Path(comment_id): Path<i32>,
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    mut multipart: Multipart,
) -> Result<Json<Value>, StatusCode> {
    info!(
        "[CommentMedia] 📤 Upload médias pour commentaire {} par user {}",
        comment_id, auth_user.id
    );

    // Vérifier que le commentaire appartient à l'utilisateur
    let comment_check = sqlx::query("SELECT user_id FROM product_comments WHERE id = $1")
        .bind(comment_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|err| {
            error!("[CommentMedia] ❌ Erreur DB: {}", err);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let comment_user_id: i32 = match comment_check {
        Some(row) => row.get::<i32, _>("user_id"),
        None => return Err(StatusCode::NOT_FOUND),
    };

    if comment_user_id != auth_user.id {
        return Err(StatusCode::FORBIDDEN);
    }

    let mut media_urls = Vec::new();

    // ✅ FINALISÉ: Traiter chaque fichier uploadé avec MediaStorageService (S3/Wasabi)
    while let Some(field) = multipart.next_field().await.map_err(|err| {
        error!("[CommentMedia] ❌ Erreur multipart: {}", err);
        StatusCode::BAD_REQUEST
    })? {
        let _field_name = field.name().unwrap_or("file").to_string();
        let file_name = field.file_name().unwrap_or("unknown").to_string();
        let content_type = field
            .content_type()
            .unwrap_or("application/octet-stream")
            .to_string();

        // Vérifier le type de fichier
        if !content_type.starts_with("image/") && !content_type.starts_with("video/") {
            warn!("[CommentMedia] ⚠️ Type de fichier ignoré: {}", content_type);
            continue; // Ignorer les fichiers non-médias
        }

        let data = field.bytes().await.map_err(|err| {
            error!("[CommentMedia] ❌ Erreur lecture données: {}", err);
            StatusCode::BAD_REQUEST
        })?;

        // Générer un nom de fichier unique pour le storage key
        let file_ext =
            file_name
                .split('.')
                .last()
                .unwrap_or(if content_type.starts_with("image/") {
                    "jpg"
                } else {
                    "mp4"
                });
        let unique_name = format!("comment_{}_{}.{}", comment_id, Uuid::new_v4(), file_ext);
        let storage_key = format!("comments/{}/{}", comment_id, unique_name);

        // ✅ FINALISÉ: Utiliser MediaStorageService (S3/Wasabi) comme les autres uploads
        match state
            .media_storage
            .store_bytes(&data, &storage_key, Some(&content_type))
            .await
        {
            Ok(location) => {
                // ✅ FINALISÉ: Utiliser l'URL publique S3/Wasabi
                media_urls.push(json!({
                    "url": location.public_url,
                    "storage_path": location.storage_path,
                    "type": if content_type.starts_with("image/") { "image" } else { "video" },
                    "content_type": content_type,
                    "size": location.content_length,
                }));

                info!(
                    "[CommentMedia] ✅ Fichier uploadé vers S3/Wasabi: {} ({} bytes) -> {}",
                    unique_name,
                    data.len(),
                    location.public_url
                );
            }
            Err(e) => {
                error!(
                    "[CommentMedia] ❌ Erreur upload S3/Wasabi pour {}: {}",
                    unique_name, e
                );
                // Ne pas ajouter ce fichier à la liste, mais continuer avec les autres
                warn!("[CommentMedia] ⚠️ Fichier ignoré à cause de l'erreur d'upload");
            }
        }
    }

    if media_urls.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Mettre à jour le commentaire avec les nouvelles URLs
    let current_media: Value = sqlx::query("SELECT media_urls FROM product_comments WHERE id = $1")
        .bind(comment_id)
        .fetch_one(&state.pg)
        .await
        .map_err(|err| {
            error!("[CommentMedia] ❌ Erreur récupération médias: {}", err);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .get("media_urls");

    let mut existing_media = current_media.as_array().cloned().unwrap_or_else(|| vec![]);
    existing_media.extend(media_urls.clone());

    sqlx::query("UPDATE product_comments SET media_urls = $1 WHERE id = $2")
        .bind(&json!(existing_media))
        .bind(comment_id)
        .execute(&state.pg)
        .await
        .map_err(|err| {
            error!("[CommentMedia] ❌ Erreur mise à jour DB: {}", err);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    info!(
        "[CommentMedia] ✅ {} médias ajoutés au commentaire {}",
        media_urls.len(),
        comment_id
    );

    Ok(Json(json!({
        "success": true,
        "media_urls": media_urls,
        "total_media": existing_media.len()
    })))
}
