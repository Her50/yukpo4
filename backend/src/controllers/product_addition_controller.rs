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
use crate::services::creer_service::{
    clean_media_recursive_final,
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
/// ✅ CORRIGÉ 2026-01-04: Traite maintenant les médias avec le vrai product_id
pub async fn process_product_creation(
    pool: Arc<PgPool>,
    service_id: i32,
    user_id: i32,
    product_data: &Value,
    images_to_process: &[String], // ✅ CORRIGÉ: Ne plus ignorer les images
) -> AppResult<Value> {
    use crate::utils::log::log_info;
    
    log_info(&format!("[process_product_creation] 🔄 Traitement produit pour service {} (user_id: {})", service_id, user_id));
    
    // ✅ DEBUG 2026-01-21: Logger la description reçue avant nettoyage
    let product_name = product_data
        .get("nom")
        .or_else(|| product_data.get("nom_produit"))
        .and_then(|v| v.as_str())
        .unwrap_or("Nouveau produit");
    let product_description = product_data
        .get("description_produit")
        .or_else(|| product_data.get("description"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    log::info!(
        "[process_product_creation] 📝 Produit reçu - Nom: '{}', Description: '{}'",
        product_name,
        if product_description.is_empty() { "ABSENTE" } else { product_description }
    );
    
    // Nettoyer les médias du JSON
    let mut product_data_cleaned = product_data.clone();
    let mut removed_count = 0;
    clean_media_recursive_final(&mut product_data_cleaned, &mut removed_count);
    
    // ✅ DEBUG 2026-01-21: Logger la description après nettoyage pour vérifier qu'elle est toujours là
    let product_description_after = product_data_cleaned
        .get("description_produit")
        .or_else(|| product_data_cleaned.get("description"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    log::info!(
        "[process_product_creation] 📝 Produit après nettoyage - Description: '{}'",
        if product_description_after.is_empty() { "ABSENTE" } else { product_description_after }
    );
    
    // ✅ PHASE 1: Écriture UNIQUEMENT dans table products (JSONB supprimé)
    // Calculer le product_index depuis le nombre de produits existants
    use crate::services::products_service::ProductsService;
    let products_service = ProductsService::new(pool.clone());
    
    // Récupérer les produits existants pour déterminer le prochain index
    let existing_products = products_service.get_products_by_service(service_id).await
        .map_err(|e| AppError::Internal(format!("Erreur récupération produits existants: {}", e)))?;
    
    let product_index = existing_products.len() as i32;
    
    // Créer le produit dans la table products
    let product_result = products_service.create_product(
        service_id,
        product_index,
        &product_data_cleaned,
    ).await;
    
    match product_result {
        Ok(product) => {
            log::info!(
                "[process_product_creation] ✅ Produit {} créé dans table products (service_id: {}, product_id: {})",
                product_index,
                service_id,
                product.id
            );
            
            // ✅ CORRIGÉ 2026-01-06: Créer une notification pour le prestataire
            let product_name = product_data
                .get("nom")
                .or_else(|| product_data.get("nom_produit"))
                .and_then(|v| v.as_str())
                .unwrap_or("Nouveau produit");
            
            let notification_data = json!({
                "service_id": service_id,
                "product_id": product.id,
                "product_index": product_index,
                "product_name": product_name
            });
            
            if let Err(e) = crate::services::notification_service::create_notification(
                &pool,
                user_id,
                crate::services::notification_service::NotificationType::ProductAdded,
                format!("✅ Nouveau produit créé: {}", product_name),
                format!(
                    "Votre produit \"{}\" a été créé avec succès dans votre service.\n\n📦 Index: {}\n🆔 ID: {}",
                    product_name,
                    product_index,
                    product.id
                ),
                Some(notification_data),
            ).await {
                log::warn!(
                    "[process_product_creation] ⚠️ Erreur création notification produit: {}",
                    e
                );
            } else {
                log::info!(
                    "[process_product_creation] 📧 Notification créée pour produit {} (user_id: {})",
                    product_index,
                    user_id
                );
            }
            
            // ✅ NOUVEAU 2026-01-04: Traiter les médias APRÈS création du produit avec le vrai product_id
            let real_product_id = product.id.to_string();
            if !images_to_process.is_empty() {
                log::info!(
                    "[process_product_creation] 🖼️ Traitement de {} image(s) pour produit {} (product_id: {})",
                    images_to_process.len(),
                    product_index,
                    real_product_id
                );
                
                use crate::services::optimized_media_processor::{
                    MediaItem, OptimizedMediaProcessor, OptimizedMediaProcessorConfig,
                };
                use crate::services::media_storage_service::MediaStorageService;
                use std::path::PathBuf;
                
                // Configuration du processeur de médias
                let config = OptimizedMediaProcessorConfig {
                    max_concurrent: 10,
                    db_batch_size: 20,
                    generate_thumbnails: true,
                    adaptive_compression: true,
                    use_signature_cache: true,
                };
                
                // Créer MediaStorageService (nécessaire pour OptimizedMediaProcessor)
                let storage_root = PathBuf::from(std::env::var("UPLOAD_STORAGE_ROOT")
                    .unwrap_or_else(|_| "uploads".to_string()));
                use crate::config::storage::MediaStorageConfig;
                let storage_config = MediaStorageConfig::from_env();
                let media_storage = Arc::new(MediaStorageService::new(storage_config));
                
                let processor = OptimizedMediaProcessor::new(
                    pool.clone(),
                    storage_root,
                    media_storage,
                    config,
                );
                
                // Convertir les images en MediaItem
                let mut media_items: Vec<MediaItem> = Vec::new();
                for image_data in images_to_process {
                    if image_data.is_empty() {
                        continue;
                    }
                    // Vérifier si c'est une URL ou du base64
                    let is_base64 = !image_data.starts_with("http://") 
                        && !image_data.starts_with("https://")
                        && image_data.len() > 100; // Heuristique simple
                    media_items.push(MediaItem::new_image(image_data.clone(), is_base64));
                }
                
                if !media_items.is_empty() {
                    // Traiter les médias en batch
                    match processor.process_media_batch(
                        service_id,
                        Some(product_index.try_into().unwrap()),
                        media_items
                    ).await {
                        Ok(processed) => {
                            // Insérer les médias dans la table media avec le vrai product_id
                            let mut tx = pool.begin().await
                                .map_err(|e| AppError::Internal(format!("Erreur début transaction: {}", e)))?;
                            
                            for (image_index, media) in processed.iter().enumerate() {
                                let is_main = image_index == 0;
                                
                                if let Err(e) = sqlx::query(
                                    r#"
                                    INSERT INTO media (
                                        service_id, product_id, product_index, type, path,
                                        is_main_image, display_order, uploaded_at,
                                        image_signature, image_hash, image_metadata
                                    )
                                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                                    "#,
                                )
                                .bind(service_id)
                                .bind(&real_product_id) // ✅ Utiliser le vrai product_id
                                .bind(product_index)
                                .bind("image")
                                .bind(&media.file_path)
                                .bind(is_main)
                                .bind(image_index as i32)
                                .bind(chrono::Utc::now().naive_utc())
                                .bind(&media.image_signature)
                                .bind(&media.image_hash)
                                .bind(&media.image_metadata)
                                .execute(&mut *tx)
                                .await
                                {
                                    log::error!(
                                        "[process_product_creation] ❌ Erreur insertion media {} pour produit {}: {}",
                                        image_index,
                                        product_index,
                                        e
                                    );
                                } else {
                                    log::info!(
                                        "[process_product_creation] ✅ Media {} inséré pour produit {} (product_id: {})",
                                        image_index,
                                        product_index,
                                        real_product_id
                                    );
                                }
                            }
                            
                            // Commit la transaction
                            if let Err(e) = tx.commit().await {
                                log::error!(
                                    "[process_product_creation] ❌ Erreur commit transaction médias: {}",
                                    e
                                );
                            } else {
                                log::info!(
                                    "[process_product_creation] ✅ {} média(x) sauvegardé(s) pour produit {}",
                                    processed.len(),
                                    product_index
                                );
                            }
                        }
                        Err(e) => {
                            log::error!(
                                "[process_product_creation] ❌ Erreur traitement médias: {} (non bloquant)",
                                e
                            );
                            // Ne pas faire échouer la création du produit si les médias échouent
                        }
                    }
                }
            }
            
            // ✅ PHASE 1: Mettre à jour autocomplete_characteristics avec le product_id de la table products
            // Récupérer les données du service pour save_autocomplete_combination
            let service_data: Option<serde_json::Value> = sqlx::query_scalar(
                "SELECT data FROM services WHERE id = $1"
            )
            .bind(service_id)
            .fetch_optional(&*pool)
            .await
            .ok()
            .flatten();
            
            if let Some(mut data) = service_data {
                // Ajouter temporairement le produit dans data pour save_autocomplete_combination
                // (la fonction lit depuis la table products, mais a besoin de la structure data)
                if let Some(data_map) = data.as_object_mut() {
                    // Construire la structure produits pour compatibilité
                    let produits_structure = json!({
                        "type_donnee": "listeproduit",
                        "valeur": [product_data_cleaned.clone()]
                    });
                    data_map.insert("produits".to_string(), produits_structure);
                }
                
                // Appeler save_autocomplete_combination avec timeout (non bloquant)
                let indexation_result = tokio::time::timeout(
                    std::time::Duration::from_secs(5),
                    crate::services::creer_service::save_autocomplete_combination(
                        &pool,
                        service_id,
                        &data
                    )
                ).await;
                
                match indexation_result {
                    Ok(Ok(_)) => {
                        log::info!(
                            "[process_product_creation] ✅ autocomplete_characteristics mis à jour avec product_id {}",
                            product.id
                        );
                    }
                    Ok(Err(e)) => {
                        log::warn!(
                            "[process_product_creation] ⚠️ Erreur mise à jour autocomplete_characteristics: {} (non bloquant)",
                            e
                        );
                    }
                    Err(_) => {
                        log::warn!(
                            "[process_product_creation] ⚠️ Timeout mise à jour autocomplete_characteristics (non bloquant)"
                        );
                    }
                }
            }
            
            // Retourner le résultat (format compatible avec l'ancien code)
            Ok(json!({
                "product_index": product_index,
                "product_id": product.id,
                "service_id": service_id,
                "produits_data": json!({
                    "type_donnee": "listeproduit",
                    "valeur": [product_data_cleaned]
                }),
                "lieu_data": json!(null) // Lieu géré au niveau service
            }))
        }
        Err(e) => {
            log::error!(
                "[process_product_creation] ❌ Erreur création produit dans table products: {}",
                e
            );
            Err(AppError::Internal(format!("Erreur création produit: {}", e)))
        }
    }
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
        return Err(AppError::Forbidden("Vous n'êtes pas le propriétaire de ce service".to_string()));
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
    _user_id: i32,
    product_data: Value,
    _images_to_process: Vec<String>,
) -> AppResult<Value> {
    let pool = state.pg.clone();
    let _product_json_value = serde_json::to_value(&product_data)
        .map_err(|e| AppError::Internal(format!("Erreur sérialisation produit: {}", e)))?;
    
    // ✅ PHASE 1: Écriture UNIQUEMENT dans table products (JSONB supprimé)
    // Cette fonction est du code mort mais on la garde pour compatibilité
    // Utiliser la même logique que process_product_creation
    use crate::services::products_service::ProductsService;
    let products_service = ProductsService::new(Arc::new(pool.clone()));
    
    // Nettoyer les médias
    let mut product_data_cleaned = product_data.clone();
    let mut removed_count = 0;
    clean_media_recursive_final(&mut product_data_cleaned, &mut removed_count);
    
    // Récupérer les produits existants pour déterminer le prochain index
    let existing_products = products_service.get_products_by_service(service_id).await
        .map_err(|e| AppError::Internal(format!("Erreur récupération produits existants: {}", e)))?;
    
    let product_index = existing_products.len() as i32;
    
    // Récupérer le user_id du service pour la notification
    let service_user_id: Option<i32> = sqlx::query_scalar!(
        "SELECT user_id FROM services WHERE id = $1",
        service_id
    )
    .fetch_optional(&pool)
    .await
    .ok()
    .flatten();
    
    // Créer le produit dans la table products
    match products_service.create_product(
        service_id,
        product_index,
        &product_data_cleaned,
    ).await {
        Ok(product) => {
            // ✅ CORRIGÉ 2026-01-06: Créer une notification pour le prestataire (si user_id disponible)
            if let Some(user_id) = service_user_id {
                let product_name = product_data_cleaned
                    .get("nom")
                    .or_else(|| product_data_cleaned.get("nom_produit"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("Nouveau produit");
                
                let notification_data = json!({
                    "service_id": service_id,
                    "product_id": product.id,
                    "product_index": product_index,
                    "product_name": product_name
                });
                
                if let Err(e) = crate::services::notification_service::create_notification(
                    &pool,
                    user_id,
                    crate::services::notification_service::NotificationType::ProductAdded,
                    format!("✅ Nouveau produit créé: {}", product_name),
                    format!(
                        "Votre produit \"{}\" a été créé avec succès dans votre service.\n\n📦 Index: {}\n🆔 ID: {}",
                        product_name,
                        product_index,
                        product.id
                    ),
                    Some(notification_data),
                ).await {
                    use crate::utils::log::log_warn;
                    log_warn(&format!(
                        "[_old_add_product_logic] ⚠️ Erreur création notification produit: {}",
                        e
                    ));
                }
            }
            
            Ok(json!({
                "product_index": product_index,
                "product_id": product.id,
                "produits_data": json!({
                    "type_donnee": "listeproduit",
                    "valeur": [product_data_cleaned]
                }),
                "lieu_data": json!(null)
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

