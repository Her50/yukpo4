// ✅ NOUVEAU 2025-11-01 : Contrôleur pour l'ajout incrémental de produits
// Ce contrôleur permet d'ajouter un nouveau produit à un service existant
// sans réenvoyer tout le service, avec un coût fixe de 2000 FCFA

use crate::core::types::{AppError, AppResult};
use crate::state::AppState;
use axum::{Extension, Json, extract::{Path, State}};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{PgPool, Row};
use std::sync::Arc;
use std::path::PathBuf;
use chrono::Utc;
use crate::services::creer_service::{
    save_autocomplete_combination, 
    clean_media_recursive_final,
    process_single_image_for_product,
};

#[derive(Debug, Deserialize)]
pub struct AddProductRequest {
    pub user_id: i32,
    pub product_data: Value, // Données du nouveau produit uniquement
}

#[derive(Debug, Serialize)]
pub struct AddProductResponse {
    pub success: bool,
    pub service_id: i32,
    pub product_index: usize,
    pub cost: i64,
    pub message: String,
}

/// ✅ NOUVEAU 2026-01-02: Fonction pour traiter la création de produit (utilisée par le worker)
/// Cette fonction est appelée par le worker de la queue, pas directement par l'API
pub async fn process_product_creation(
    pool: Arc<PgPool>,
    service_id: i32,
    user_id: i32,
    product_data: &Value,
    images_to_process: &[String],
) -> AppResult<Value> {
    use crate::utils::log::{log_info, log_error};
    
    log_info(&format!("[process_product_creation] 🔄 Traitement produit pour service {} (user_id: {})", service_id, user_id));
    
    // Nettoyer les médias du JSON
    let mut product_data_cleaned = product_data.clone();
    let mut removed_count = 0;
    clean_media_recursive_final(&mut product_data_cleaned, &mut removed_count);
    
    let product_json_value = serde_json::to_value(&product_data_cleaned)
        .map_err(|e| AppError::Internal(format!("Erreur sérialisation produit: {}", e)))?;
    
    // Utiliser la fonction PostgreSQL optimisée
    let (product_index, produits_data, lieu_data) = crate::utils::db_retry::retry_query(
        &*pool,
        || {
            let product_json_clone = product_json_value.clone();
            let service_id_clone = service_id;
            let pool_clone = pool.clone();
            Box::pin(async move {
                let mut tx = pool_clone.begin().await?;
                sqlx::query("SET LOCAL statement_timeout = '180s'")
                    .execute(&mut *tx)
                    .await?;
                
                let result = sqlx::query_as::<_, (i32, Value, Value)>(
                    "SELECT product_index, produits_data, lieu_data FROM add_product_to_service_jsonb_v2($1, $2)"
                )
                .bind(service_id_clone)
                .bind(&product_json_clone)
                .fetch_one(&mut *tx)
                .await?;
                
                tx.commit().await?;
                Ok(result)
            })
        },
        10,
    ).await?;
    
    // Traiter les images en arrière-plan (déjà fait dans le contrôleur principal)
    // Ici on retourne juste le résultat
    
    Ok(json!({
        "product_index": product_index,
        "produits_data": produits_data,
        "lieu_data": lieu_data,
    }))
}

/// Ajouter un nouveau produit à un service existant
/// Route : POST /api/services/{service_id}/products
/// ✅ NOUVEAU 2026-01-02: Utilise maintenant une queue asynchrone pour éviter les timeouts
#[axum::debug_handler]
pub async fn add_product_to_service(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<crate::middlewares::jwt::AuthenticatedUser>,
    Path(service_id): Path<i32>,
    Json(request): Json<AddProductRequest>,
) -> AppResult<Json<Value>> {
    use crate::utils::log::{log_info, log_error, log_warn};
    
    log_info(&format!("[add_product_to_service] 📦 Ajout d'un produit au service {} (user_id: {})", service_id, user.id));
    
    let start_time = std::time::Instant::now();
    
    // ✅ Vérification : L'utilisateur est-il le propriétaire du service ? (avec retry)
    // ✅ NOUVEAU 2026-01-02: Utiliser le cache Redis pour les services volumineux
    use crate::services::service_data_cache::ServiceDataCache;
    let service_cache = ServiceDataCache::new(state.cache_service.clone());
    let pool = state.pg.clone();
    
    // ✅ Utiliser le cache pour récupérer les données du service (pour diagnostic taille)
    let (_service_data_value, existing_data_size, from_cache) = service_cache
        .get_service_data(
            service_id,
            async {
                // Fonction pour récupérer depuis la DB si cache miss
                let row = crate::utils::db_retry::retry_query(
                    &pool,
                    || {
                        let service_id_clone = service_id;
                        let pool_clone = pool.clone();
                        Box::pin(async move {
                            sqlx::query(
                                "SELECT data, pg_column_size(data) as data_size FROM services WHERE id = $1 AND is_active = true"
                            )
                            .bind(service_id_clone)
                            .fetch_optional(&pool_clone)
                            .await
                        })
                    },
                    3,
                )
                .await
                .map_err(|e| AppError::Internal(format!("Erreur récupération service: {}", e)))?;
                
                match row {
                    Some(row) => {
                        let data: serde_json::Value = row.try_get("data")
                            .map_err(|e| AppError::Internal(format!("Erreur récupération data: {}", e)))?;
                        let size: i64 = row.try_get("data_size")
                            .unwrap_or(0);
                        Ok((data, size))
                    },
                    None => Err(AppError::NotFound(format!("Service {} introuvable", service_id)))
                }
            },
        )
        .await?;
    
    // ✅ Récupérer user_id séparément (pas besoin de cache pour ça, c'est rapide)
    let owner_id: i32 = crate::utils::db_retry::retry_query(
        &pool,
        || {
            let service_id_clone = service_id;
            let pool_clone = pool.clone();
            Box::pin(async move {
                sqlx::query_scalar::<_, i32>(
                    "SELECT user_id FROM services WHERE id = $1 AND is_active = true"
                )
                .bind(service_id_clone)
                .fetch_optional(&pool_clone)
                .await
            })
        },
        3,
    )
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération user_id: {}", e)))?
    .ok_or_else(|| AppError::NotFound(format!("Service {} introuvable", service_id)))?;
    
    // ✅ NOUVEAU 2026-01-02: Logger la taille du JSONB et si c'était depuis le cache
    if let Some(size) = Some(existing_data_size) {
        let size_kb = size as f64 / 1024.0;
        let size_mb = size_kb / 1024.0;
        let cache_status = if from_cache { "✅ depuis cache Redis" } else { "📊 depuis DB" };
        if size_mb > 1.0 {
            log_warn(&format!(
                "[add_product_to_service] ⚠️ Service {} a un JSONB volumineux: {:.2} MB ({} KB, {} bytes) - {}",
                service_id, size_mb, size_kb, size, cache_status
            ));
        } else {
            log_info(&format!(
                "[add_product_to_service] 📊 Taille JSONB service existant: {:.2} KB ({} bytes) - {}",
                size_kb, size, cache_status
            ));
        }
    }
    
    // Vérifier que l'utilisateur authentifié est bien le propriétaire
    if owner_id != user.id {
        log_error(&format!("[add_product_to_service] User {} n'est pas propriétaire du service {}", user.id, service_id));
        return Err(AppError::Unauthorized("Vous n'êtes pas le propriétaire de ce service".to_string()));
    }
    
    // ✅ Coût fixe : 2000 FCFA pour ajouter un produit (cohérent avec creer_service.rs)
    mod service_costs {
        pub const COST_NEW_PRODUCT_DUPLICATE_XAF: i64 = 2000;
    }
    let cout_ajout = service_costs::COST_NEW_PRODUCT_DUPLICATE_XAF;
    
    // ✅ Vérifier le solde (avec retry)
    let pool = state.pg.clone();
    let current_balance_result = crate::utils::db_retry::retry_query(
        &pool,
        || {
            let user_id_clone = user.id;
            let pool_clone = pool.clone();
            Box::pin(async move {
                sqlx::query("SELECT tokens_balance FROM users WHERE id = $1")
                    .bind(user_id_clone)
                    .fetch_one(&pool_clone)
                    .await
            })
        },
        3, // 3 tentatives max
    )
    .await;
    
    let current_balance = match current_balance_result {
        Ok(row) => row.try_get::<i64, _>("tokens_balance").unwrap_or(0),
        Err(e) => {
            log_error(&format!("[add_product_to_service] Erreur récupération solde: {}", e));
            return Err(AppError::Internal(format!("Erreur récupération solde: {}", e)));
        }
    };
    
    if current_balance < cout_ajout {
        log_error(&format!("[add_product_to_service] Solde insuffisant: {} < {}", current_balance, cout_ajout));
        return Err(AppError::BadRequest(format!(
            "Solde insuffisant: {} FCFA disponible, {} FCFA requis",
            current_balance, cout_ajout
        )));
    }
    
    // ✅ Débiter le solde (avec retry)
    let pool = state.pg.clone();
    let debit_result = crate::utils::db_retry::retry_query(
        &pool,
        || {
            let cout_ajout_clone = cout_ajout;
            let user_id_clone = user.id;
            let pool_clone = pool.clone();
            Box::pin(async move {
                sqlx::query(
                    "UPDATE users SET tokens_balance = tokens_balance - $1 WHERE id = $2 RETURNING tokens_balance"
                )
                .bind(cout_ajout_clone)
                .bind(user_id_clone)
                .fetch_one(&pool_clone)
                .await
            })
        },
        3, // 3 tentatives max
    )
    .await;
    
    let new_balance = match debit_result {
        Ok(row) => row.try_get::<i64, _>("tokens_balance").unwrap_or(0),
        Err(e) => {
            log_error(&format!("[add_product_to_service] Échec débit solde: {}", e));
            return Err(AppError::Internal(format!("Erreur débit solde: {}", e)));
        }
    };
    
    log_info(&format!("[add_product_to_service] ✅ Solde débité: {} FCFA (ancien: {}, nouveau: {})", 
        cout_ajout, current_balance, new_balance));
    
    // ✅ NOUVEAU 2026-01-02: Utiliser la queue asynchrone au lieu de traiter directement
    // Cela évite les timeouts et erreurs TLS en traitant les créations en arrière-plan
    use crate::services::product_creation_queue::ProductCreationQueueService;
    let queue_service = ProductCreationQueueService::new(Arc::new(state.pg.clone()));
    
    // Extraire les images du produit AVANT nettoyage
    // Les médias doivent être uploadés vers Wasabi et stockés dans la table media, PAS dans services.data
    // Sinon le JSONB devient énorme, causant des UPDATE lents (7-12s) et des timeouts
    
    // Extraire les images du produit AVANT nettoyage
    let product_data_original = request.product_data.clone();
    let mut images_to_process: Vec<String> = Vec::new();
    
    // Chercher les images dans différents champs (comme dans creer_service)
    if let Some(prod_obj) = product_data_original.as_object() {
        if let Some(image_urls) = prod_obj.get("imageUrls").and_then(|v| v.as_array()) {
            images_to_process.extend(
                image_urls.iter().filter_map(|v| v.as_str().map(|s| s.to_string()))
            );
        }
        if let Some(product_images) = prod_obj.get("images").and_then(|v| v.as_array()) {
            images_to_process.extend(
                product_images.iter().filter_map(|v| v.as_str().map(|s| s.to_string()))
            );
        }
        if let Some(base64_image) = prod_obj.get("base64_image") {
            if let Some(base64_array) = base64_image.as_array() {
                images_to_process.extend(
                    base64_array.iter().filter_map(|v| v.as_str().map(|s| s.to_string()))
                );
            } else if let Some(base64_str) = base64_image.as_str() {
                images_to_process.push(base64_str.to_string());
            }
        }
        if let Some(images_base64) = prod_obj.get("images_base64").and_then(|v| v.as_array()) {
            images_to_process.extend(
                images_base64.iter().filter_map(|v| v.as_str().map(|s| s.to_string()))
            );
        }
        if let Some(image_base64) = prod_obj.get("image_base64").and_then(|v| v.as_str()) {
            images_to_process.push(image_base64.to_string());
        }
    }
    
    // ✅ Nettoyer les médias du JSON (seront sauvegardés séparément)
    let mut product_data_cleaned = request.product_data.clone();
    let mut removed_count = 0;
    clean_media_recursive_final(&mut product_data_cleaned, &mut removed_count);
    
    if removed_count > 0 {
        log_info(&format!("[add_product_to_service] ✅ Nettoyage de {} média(s) base64 du produit (seront sauvegardés dans table media)", removed_count));
    }
    
    // Ajouter le job à la queue
    let job_id = queue_service
        .enqueue(
            service_id,
            user.id,
            request.product_data.clone(),
            images_to_process.clone(),
            Some(5), // Priority normale
        )
        .await?;
    
    log_info(&format!(
        "[add_product_to_service] ✅ Job {} ajouté à la queue (sera traité en arrière-plan)",
        job_id
    ));
    
    // Retourner immédiatement avec le job_id
    // Le client pourra interroger le statut via GET /api/services/{service_id}/products/queue/{job_id}
    Ok(Json(json!({
        "success": true,
        "job_id": job_id,
        "status": "pending",
        "message": "Produit en cours de création. Utilisez le job_id pour vérifier le statut.",
        "cost": cout_ajout,
        "new_balance": new_balance
    })))
}

/// ✅ NOUVEAU 2026-01-02: Endpoint pour vérifier le statut d'un job de création de produit
/// Route : GET /api/services/{service_id}/products/queue/{job_id}
#[axum::debug_handler]
pub async fn get_product_creation_status(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<crate::middlewares::jwt::AuthenticatedUser>,
    Path((service_id, job_id)): Path<(i32, i64)>,
) -> AppResult<Json<Value>> {
    use crate::utils::log::log_info;
    use crate::services::product_creation_queue::ProductCreationQueueService;
    
    let queue_service = ProductCreationQueueService::new(Arc::new(state.pg.clone()));
    
    match queue_service.get_job_status(job_id).await? {
        Some(job) => {
            // Vérifier que le job appartient au bon service et utilisateur
            if job.service_id != service_id || job.user_id != user.id {
                return Err(AppError::Unauthorized(
                    "Ce job ne vous appartient pas".to_string()
                ));
            }
            
            let response = json!({
                "job_id": job.id,
                "status": job.status,
                "service_id": job.service_id,
                "created_at": job.created_at,
                "started_at": job.started_at,
                "completed_at": job.completed_at,
                "attempt_count": job.attempt_count,
                "max_attempts": job.max_attempts,
                "error_message": job.error_message,
                "result": job.result_data,
            });
            
            Ok(Json(response))
        }
        None => Err(AppError::NotFound(format!("Job {} introuvable", job_id)))
    }
}

// ✅ ANCIEN CODE (gardé pour référence, mais remplacé par la queue)
#[allow(dead_code)]
async fn _old_add_product_logic(
    state: Arc<AppState>,
    service_id: i32,
    user_id: i32,
    product_data: Value,
    images_to_process: Vec<String>,
) -> AppResult<Value> {
    let pool = state.pg.clone();
    let product_json_value = serde_json::to_value(&product_data)
        .map_err(|e| AppError::Internal(format!("Erreur sérialisation produit: {}", e)))?;
    
    let update_result = crate::utils::db_retry::retry_query(
        &pool,
        || {
            let product_json_clone = product_json_value.clone();
            let service_id_clone = service_id;
            let pool_clone = pool.clone();
            Box::pin(async move {
                let mut tx = pool_clone.begin().await?;
                sqlx::query("SET LOCAL statement_timeout = '180s'")
                    .execute(&mut *tx)
                    .await?;
                
                let result = sqlx::query_as::<_, (i32, Value, Value)>(
                    "SELECT product_index, produits_data, lieu_data FROM add_product_to_service_jsonb_v2($1, $2)"
                )
                .bind(service_id_clone)
                .bind(&product_json_clone)
                .fetch_one(&mut *tx)
                .await?;
                
                tx.commit().await?;
                Ok(result)
            })
        },
        10,
    ).await;
    
    match update_result {
        Ok((index, produits_data, lieu_data)) => {
            // Code mort - fonction remplacée par la queue
            Ok(json!({
                "product_index": index,
                "produits_data": produits_data,
                "lieu_data": lieu_data,
            }))
        }
        Err(e) => {
            use crate::utils::log::log_error;
            let error_msg = e.to_string();
            log_error(&format!("[old_add_product_logic] Erreur: {}", error_msg));
            Err(AppError::Internal(format!("Erreur ajout produit: {}", error_msg)))
        }
    }
}

