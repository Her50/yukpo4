// ✅ Phase 9 - Amélioration : Routes pour l'upload de médias de preuve de livraison
use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::models::delivery_model::DeliveryProofMediaInput;
use crate::services::delivery_service::DeliveryService;
use crate::AppState;
use axum::{
    body::Body,
    extract::{Multipart, Path, State},
    http::StatusCode,
    response::{Json, Response},
    Extension,
};
use chrono::Utc;
use log::warn;
use serde_json::{json, Value};
use std::path::Path as StdPath;
use std::sync::Arc;
use uuid::Uuid;

/// ✅ Phase 9 - Amélioration : Fonction helper pour uploader vers S3/Wasabi
/// Réutilise le service MediaStorageService existant utilisé pour les vidéos
async fn upload_to_s3_wasabi(
    state: &AppState,
    key: &str,
    data: &[u8],
    content_type: Option<&str>,
) -> Result<String, String> {
    // Utiliser le MediaStorageService existant via AppState
    let storage_key = key.trim_start_matches('/');
    
    match state.media_storage.store_bytes(data, storage_key, content_type).await {
        Ok(location) => Ok(location.public_url),
        Err(e) => Err(format!("Erreur upload S3/Wasabi: {}", e)),
    }
}

/// ✅ Phase 9 - Amélioration : Upload d'un fichier média (image ou vidéo) pour preuve de livraison
/// 
/// Endpoint: POST /api/media/upload-proof
/// Body: multipart/form-data avec:
///   - file: le fichier image/vidéo
///   - delivery_id: UUID de la livraison
///   - proof_type: 'pickup' ou 'delivery'
///   - metadata (optionnel): JSON avec métadonnées supplémentaires
pub async fn upload_proof_media_file(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    mut multipart: Multipart,
) -> AppResult<Json<Value>> {
    let mut file_data: Option<Vec<u8>> = None;
    let mut file_name: Option<String> = None;
    let mut content_type: Option<String> = None;
    let mut delivery_id: Option<String> = None;
    let mut proof_type: Option<String> = None;
    let mut metadata: Option<Value> = None;

    // Parser le multipart form data
    while let Some(field) = multipart.next_field().await
        .map_err(|e| AppError::BadRequest(format!("Erreur parsing multipart: {}", e)))?
    {
        let field_name = field.name().unwrap_or("").to_string();

        match field_name.as_str() {
            "file" => {
                file_name = field.file_name().map(|s| s.to_string());
                content_type = field.content_type().map(|s| s.to_string());
                let data = field.bytes().await
                    .map_err(|e| AppError::BadRequest(format!("Erreur lecture fichier: {}", e)))?;
                file_data = Some(data.to_vec());
            }
            "delivery_id" => {
                let value = field.text().await
                    .map_err(|e| AppError::BadRequest(format!("Erreur lecture delivery_id: {}", e)))?;
                delivery_id = Some(value);
            }
            "proof_type" => {
                let value = field.text().await
                    .map_err(|e| AppError::BadRequest(format!("Erreur lecture proof_type: {}", e)))?;
                proof_type = Some(value);
            }
            "metadata" => {
                let value = field.text().await
                    .map_err(|e| AppError::BadRequest(format!("Erreur lecture metadata: {}", e)))?;
                metadata = serde_json::from_str(&value).ok();
            }
            _ => {}
        }
    }

    // Valider les champs requis
    let delivery_id = delivery_id.ok_or_else(|| AppError::BadRequest("delivery_id requis".into()))?;
    let proof_type = proof_type.ok_or_else(|| AppError::BadRequest("proof_type requis".into()))?;
    let file_data = file_data.ok_or_else(|| AppError::BadRequest("fichier requis".into()))?;
    let file_name = file_name.unwrap_or_else(|| format!("proof_{}.bin", Utc::now().timestamp()));

    // Valider le proof_type
    if proof_type != "pickup" && proof_type != "delivery" {
        return Err(AppError::BadRequest("proof_type doit être 'pickup' ou 'delivery'".into()));
    }

    // Valider le type de fichier
    let media_type = if let Some(ct) = &content_type {
        if ct.starts_with("image/") {
            "image"
        } else if ct.starts_with("video/") {
            "video"
        } else {
            return Err(AppError::BadRequest("Type de fichier non supporté. Utilisez une image ou une vidéo".into()));
        }
    } else {
        // Essayer de deviner depuis l'extension
        let ext = StdPath::new(&file_name)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        
        match ext.as_str() {
            "jpg" | "jpeg" | "png" | "gif" | "webp" | "heic" => "image",
            "mp4" | "mov" | "avi" | "mkv" | "webm" => "video",
            _ => return Err(AppError::BadRequest("Extension de fichier non reconnue. Utilisez une image ou une vidéo".into())),
        }
    };

    // Valider la taille du fichier (max 50MB pour vidéos, 10MB pour images)
    let max_size = if media_type == "video" { 50 * 1024 * 1024 } else { 10 * 1024 * 1024 };
    if file_data.len() > max_size {
        return Err(AppError::BadRequest(format!(
            "Fichier trop volumineux. Taille max: {}MB",
            max_size / (1024 * 1024)
        )));
    }

    // Parser le delivery_id
    let delivery_uuid = Uuid::parse_str(&delivery_id)
        .map_err(|_| AppError::BadRequest("delivery_id invalide".into()))?;

    // Vérifier les permissions
    let service = state.delivery_service.clone();
    let summary = service
        .get_delivery_summary(delivery_uuid)
        .await?;
    
    // Vérifier que l'utilisateur est le coursier assigné
    let courier = service.repository().find_courier_by_user(user.id).await?;
    let courier_id = courier.map(|c| c.id);
    
    if summary.courier_id.is_none() || summary.courier_id != courier_id {
        return Err(AppError::Forbidden(
            "Seul le coursier assigné peut ajouter des médias de preuve".into(),
        ));
    }

    // Valider le proof_type selon le statut de la livraison
    if proof_type == "pickup" {
        if summary.status != crate::models::delivery_model::DeliveryStatus::EnRoutePickup
            && summary.status != crate::models::delivery_model::DeliveryStatus::ShoppingCompleted
        {
            return Err(AppError::BadRequest(
                "Les médias de pickup ne peuvent être ajoutés qu'après la récupération".into(),
            ));
        }
    } else if proof_type == "delivery" {
        if summary.status != crate::models::delivery_model::DeliveryStatus::EnRouteDelivery
            && summary.status != crate::models::delivery_model::DeliveryStatus::Delivered
        {
            return Err(AppError::BadRequest(
                "Les médias de delivery ne peuvent être ajoutés qu'après la livraison".into(),
            ));
        }
    }

    // ✅ Phase 9 - Amélioration : Uploader vers S3/Wasabi (réutiliser le service existant)
    // Générer un nom de fichier unique
    let file_ext = StdPath::new(&file_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or(if media_type == "image" { "jpg" } else { "mp4" });
    
    let unique_filename = format!(
        "delivery_proof/{}/{}_{}_{}.{}",
        delivery_uuid,
        proof_type,
        Utc::now().timestamp_millis(),
        uuid::Uuid::new_v4().to_string()[..8].to_string(),
        file_ext
    );

    // ✅ Utiliser le service S3/Wasabi existant (même que pour les vidéos)
    // Chercher le service d'upload dans les services existants
    let media_url = match upload_to_s3_wasabi(&state, &unique_filename, &file_data, content_type.as_deref()).await {
        Ok(url) => url,
        Err(e) => {
            // Fallback: stocker localement si S3 échoue
            warn!("Erreur upload S3/Wasabi: {}. Fallback vers stockage local.", e);
            
            let upload_dir = std::env::var("MEDIA_UPLOAD_DIR")
                .unwrap_or_else(|_| "./uploads/proof_media".to_string());
            
            std::fs::create_dir_all(&upload_dir)
                .map_err(|e| AppError::Internal(format!("Erreur création dossier upload: {}", e)))?;
            
            let file_path = StdPath::new(&upload_dir).join(&unique_filename);
            std::fs::create_dir_all(file_path.parent().unwrap())
                .map_err(|e| AppError::Internal(format!("Erreur création dossier: {}", e)))?;
            
            std::fs::write(&file_path, &file_data)
                .map_err(|e| AppError::Internal(format!("Erreur écriture fichier: {}", e)))?;
            
            // URL locale
            format!("/api/media/proof/{}", unique_filename.replace("delivery_proof/", ""))
        }
    };

    // Sauvegarder dans la base de données
    let media = sqlx::query_as::<_, crate::models::delivery_model::DeliveryProofMedia>(
        r#"
        INSERT INTO delivery_proof_media (delivery_id, media_type, media_url, proof_type, uploaded_by, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, delivery_id, media_type, media_url, proof_type, uploaded_by, uploaded_at, metadata, created_at
        "#
    )
    .bind(delivery_uuid)
    .bind(media_type)
    .bind(&media_url)
    .bind(&proof_type)
    .bind(user.id)
    .bind(metadata.unwrap_or_else(|| json!({})))
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur sauvegarde média: {}", e)))?;

    Ok(Json(json!({
        "success": true,
        "media": media,
        "message": "Média uploadé avec succès",
    })))
}

/// ✅ Phase 9 - Amélioration : Servir les fichiers média uploadés
/// 
/// Endpoint: GET /api/media/proof/{filename}
/// Note: Si les fichiers sont sur S3/Wasabi, cette route peut rediriger vers l'URL publique
/// ou servir depuis le cache local si nécessaire
pub async fn serve_proof_media_file(
    _state: State<Arc<AppState>>,
    Path(filename): Path<String>,
) -> Result<Response<Body>, AppError> {
    // ✅ Si les fichiers sont sur S3/Wasabi, on peut soit:
    // 1. Rediriger vers l'URL publique S3/Wasabi (recommandé)
    // 2. Servir depuis le cache local si disponible
    
    // Pour l'instant, on vérifie si c'est une URL S3/Wasabi (commence par http/https)
    if filename.starts_with("http://") || filename.starts_with("https://") {
        // C'est déjà une URL publique, rediriger
        return Ok(Response::builder()
            .status(StatusCode::TEMPORARY_REDIRECT)
            .header("Location", filename)
            .body(Body::empty())
            .map_err(|e| AppError::Internal(format!("Erreur création réponse: {}", e)))?);
    }
    
    // Sinon, servir depuis le stockage local (fallback)
    let safe_filename = filename
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '_' || *c == '-' || *c == '/')
        .collect::<String>();
    
    // Sécurité: empêcher les path traversal
    if safe_filename.contains("..") || safe_filename.starts_with('/') {
        return Err(AppError::BadRequest("Nom de fichier invalide".into()));
    }

    let upload_dir = std::env::var("MEDIA_UPLOAD_DIR")
        .unwrap_or_else(|_| "./uploads/proof_media".to_string());
    
    let file_path = StdPath::new(&upload_dir).join(&safe_filename);
    
    // Vérifier que le fichier existe
    if !file_path.exists() {
        return Err(AppError::NotFound("Fichier introuvable".into()));
    }

    // Lire le fichier
    let file_data = std::fs::read(&file_path)
        .map_err(|e| AppError::Internal(format!("Erreur lecture fichier: {}", e)))?;

    // Déterminer le content-type
    let content_type = if safe_filename.ends_with(".mp4") || safe_filename.ends_with(".mov") {
        "video/mp4"
    } else if safe_filename.ends_with(".webm") {
        "video/webm"
    } else if safe_filename.ends_with(".jpg") || safe_filename.ends_with(".jpeg") {
        "image/jpeg"
    } else if safe_filename.ends_with(".png") {
        "image/png"
    } else if safe_filename.ends_with(".gif") {
        "image/gif"
    } else if safe_filename.ends_with(".webp") {
        "image/webp"
    } else {
        "application/octet-stream"
    };

    // Retourner la réponse avec le fichier
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", content_type)
        .header("Content-Length", file_data.len())
        .header("Cache-Control", "public, max-age=31536000") // Cache 1 an
        .body(Body::from(file_data))
        .map_err(|e| AppError::Internal(format!("Erreur création réponse: {}", e)))?)
}

