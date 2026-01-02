// ✅ NOUVEAU 2025-11-01 : Contrôleur pour l'ajout incrémental de produits
// Ce contrôleur permet d'ajouter un nouveau produit à un service existant
// sans réenvoyer tout le service, avec un coût fixe de 2000 FCFA

use crate::core::types::{AppError, AppResult};
use crate::state::AppState;
use axum::{Extension, Json, extract::{Path, State}};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;
use std::path::PathBuf;
use chrono::Utc;
use futures::future::join_all;
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

/// Ajouter un nouveau produit à un service existant
/// Route : POST /api/services/{service_id}/products
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
    let pool = state.pg.clone();
    let service_row = crate::utils::db_retry::retry_query(
        &pool,
        || {
            let service_id_clone = service_id;
            let pool_clone = pool.clone();
            Box::pin(async move {
                sqlx::query(
                    "SELECT user_id, data FROM services WHERE id = $1 AND is_active = true"
                )
                .bind(service_id_clone)
                .fetch_optional(&pool_clone)
                .await
            })
        },
        3, // 3 tentatives max
    )
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération service: {}", e)))?;
    
    let owner_id: i32 = match service_row {
        Some(row) => row.try_get("user_id").map_err(|e| AppError::Internal(e.to_string()))?,
        None => {
            log_error(&format!("[add_product_to_service] Service {} introuvable", service_id));
            return Err(AppError::NotFound(format!("Service {} introuvable", service_id)));
        }
    };
    
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
    
    // ✅ CRITIQUE 2025-12-27: Extraire et sauvegarder les médias AVANT de nettoyer le JSON
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
    
    // ✅ OPTIMISÉ 2025-12-27: Utiliser fonction PostgreSQL optimisée pour éviter erreurs 500
    // Au lieu de lire le JSONB en mémoire puis le réécrire, on utilise une fonction PostgreSQL
    // qui fait tout en une seule opération atomique, évitant les timeouts et réduisant la latence
    let pool = state.pg.clone();
    let product_json_value = serde_json::to_value(&product_data_cleaned)
        .map_err(|e| AppError::Internal(format!("Erreur sérialisation produit: {}", e)))?;
    
    // ✅ CORRIGÉ 2026-01-01: Utiliser retry_query pour gérer les erreurs TLS correctement
    // retry_query gère automatiquement les erreurs TLS avec backoff adaptatif
    let db_time = start_time.elapsed();
    log_info(&format!("[add_product_to_service] ⏱️ Temps avant UPDATE PostgreSQL: {:?}", db_time));
    
    // ✅ CORRIGÉ 2026-01-01: Augmenter à 10 tentatives pour gérer les erreurs TLS persistantes
    // Les requêtes longues (50s+) sont sujettes aux fermetures de connexion TLS
    // Avec 10 tentatives et backoff 3-10s, on donne plus de temps pour que la connexion se rétablisse
    let update_result = crate::utils::db_retry::retry_query(
        &pool,
        || {
            let product_json_clone = product_json_value.clone();
            let service_id_clone = service_id;
            let pool_clone = pool.clone();
            Box::pin(async move {
                sqlx::query_as::<_, (i32, Value, Value)>(
                    "SELECT product_index, produits_data, lieu_data FROM add_product_to_service_jsonb_v2($1, $2)"
                )
                .bind(service_id_clone)
                .bind(&product_json_clone)
                .fetch_one(&pool_clone)
                .await
            })
        },
        10, // ✅ CORRIGÉ: 10 tentatives max avec backoff adaptatif pour TLS (3-10s entre tentatives)
    ).await;
    
    let (product_index, produits_data_for_indexation, lieu_data_for_indexation) = match update_result {
        Ok((index, produits_data, lieu_data)) => {
            let idx = index as usize;
            let total_time = start_time.elapsed();
            log_info(&format!("[add_product_to_service] ✅ Produit ajouté au service {} (index: {}) en {:?}", service_id, idx, total_time));
            
            // ✅ OPTIMISÉ 2025-12-31: Les données nécessaires sont déjà retournées par la fonction
            // Plus besoin de faire un SELECT complet du JSONB !
            (idx, produits_data, lieu_data)
        },
        Err(e) => {
            // ✅ AMÉLIORÉ 2025-12-31: Gérer spécifiquement les erreurs de blocage
            let error_msg = e.to_string();
            
            // Si c'est un blocage (verrouillé), retourner une erreur spécifique
            if error_msg.contains("verrouillé") || error_msg.contains("locked") || error_msg.contains("lock_not_available") {
                log_error(&format!("[add_product_to_service] ❌ Service {} verrouillé après {} tentatives", service_id, 10));
                
                // ✅ ROLLBACK : Rembourser l'utilisateur en cas de blocage persistant
                let pool = state.pg.clone();
                let _ = crate::utils::db_retry::retry_query(
                    &pool,
                    || {
                        let cout_ajout_clone = cout_ajout;
                        let user_id_clone = user.id;
                        let pool_clone = pool.clone();
                        Box::pin(async move {
                            sqlx::query(
                                "UPDATE users SET tokens_balance = tokens_balance + $1 WHERE id = $2"
                            )
                            .bind(cout_ajout_clone)
                            .bind(user_id_clone)
                            .execute(&pool_clone)
                            .await
                        })
                    },
                    3,
                )
                .await;
                
                return Err(AppError::Internal(format!(
                    "Le service est actuellement en cours de modification par une autre opération. Veuillez réessayer dans quelques instants. Votre solde a été remboursé ({} FCFA).",
                    cout_ajout
                )));
            }
            
            // ✅ Fallback: Essayer avec l'ancienne fonction si v2 n'existe pas
            if error_msg.contains("does not exist") || error_msg.contains("function") {
                log_info(&format!("[add_product_to_service] ⚠️ Fonction v2 non disponible, fallback vers v1"));
                
                // Utiliser l'ancienne fonction avec plus de tentatives
                let fallback_result = crate::utils::db_retry::retry_query(
                    &pool,
                    || {
                        let product_json_clone = product_json_value.clone();
                        let service_id_clone = service_id;
                        let pool_clone = pool.clone();
                        Box::pin(async move {
                            sqlx::query_scalar::<_, i32>(
                                "SELECT add_product_to_service_jsonb($1, $2)"
                            )
                            .bind(service_id_clone)
                            .bind(&product_json_clone)
                            .fetch_one(&pool_clone)
                            .await
                        })
                    },
                    10, // ✅ CORRIGÉ: Augmenté à 10 tentatives pour fallback aussi
                ).await;
                
                match fallback_result {
                    Ok(index) => {
                        let idx = index as usize;
                        log_info(&format!("[add_product_to_service] ✅ Produit ajouté au service {} (index: {}) via fallback", service_id, idx));
                        
                        // ⚠️ Fallback: Récupérer les données pour indexation (plus lent mais fonctionne)
                        let service_data_result = crate::utils::db_retry::retry_query(
                            &pool,
                            || {
                                let service_id_clone = service_id;
                                let pool_clone = pool.clone();
                                Box::pin(async move {
                                    sqlx::query("SELECT data->'produits' as produits, data->'lieu_produit' as lieu FROM services WHERE id = $1")
                                        .bind(service_id_clone)
                                        .fetch_one(&pool_clone)
                                        .await
                                })
                            },
                            3,
                        ).await;
                        
                        let (produits_data, lieu_data) = match service_data_result {
                            Ok(row) => (
                                row.try_get::<Value, _>("produits").unwrap_or(serde_json::json!({})),
                                row.try_get::<Value, _>("lieu").unwrap_or(serde_json::json!({}))
                            ),
                            Err(e) => {
                                log_error(&format!("[add_product_to_service] ⚠️ Erreur récupération données pour indexation (fallback): {}", e));
                                (serde_json::json!({}), serde_json::json!({}))
                            }
                        };
                        
                        (idx, produits_data, lieu_data)
                    },
                    Err(e) => {
                        let error_msg = e.to_string();
                        log_error(&format!("[add_product_to_service] Erreur fonction PostgreSQL (fallback): {}", error_msg));
                        
                        // ✅ ROLLBACK : Rembourser l'utilisateur en cas d'échec
                        let pool = state.pg.clone();
                        let _ = crate::utils::db_retry::retry_query(
                            &pool,
                            || {
                                let cout_ajout_clone = cout_ajout;
                                let user_id_clone = user.id;
                                let pool_clone = pool.clone();
                                Box::pin(async move {
                                    sqlx::query(
                                        "UPDATE users SET tokens_balance = tokens_balance + $1 WHERE id = $2"
                                    )
                                    .bind(cout_ajout_clone)
                                    .bind(user_id_clone)
                                    .execute(&pool_clone)
                                    .await
                                })
                            },
                            3,
                        )
                        .await;
                        
                        // ✅ AMÉLIORÉ: Message d'erreur plus détaillé
                        let detailed_error = if error_msg.contains("timeout") || error_msg.contains("deadlock") {
                            format!("La base de données est temporairement surchargée. Veuillez réessayer dans quelques instants. (Erreur: {})", error_msg)
                        } else if error_msg.contains("constraint") || error_msg.contains("duplicate") {
                            format!("Erreur de validation des données. Veuillez vérifier les informations du produit. (Erreur: {})", error_msg)
                        } else {
                            format!("Erreur lors de l'ajout du produit au service. Veuillez réessayer. Si le problème persiste, contactez le support. (Erreur: {})", error_msg)
                        };
                        
                        return Err(AppError::Internal(detailed_error));
                    }
                }
            } else {
                // Autre erreur PostgreSQL (non-blocage)
                let error_msg = e.to_string();
                let error_details = format!("[add_product_to_service] ❌ Erreur fonction PostgreSQL: {} (service_id: {}, user_id: {}, temps écoulé: {:?})", 
                    error_msg, service_id, user.id, start_time.elapsed());
                log_error(&error_details);
                
                // ✅ ROLLBACK : Rembourser l'utilisateur en cas d'échec
                let pool = state.pg.clone();
                let _ = crate::utils::db_retry::retry_query(
                    &pool,
                    || {
                        let cout_ajout_clone = cout_ajout;
                        let user_id_clone = user.id;
                        let pool_clone = pool.clone();
                        Box::pin(async move {
                            sqlx::query(
                                "UPDATE users SET tokens_balance = tokens_balance + $1 WHERE id = $2"
                            )
                            .bind(cout_ajout_clone)
                            .bind(user_id_clone)
                            .execute(&pool_clone)
                            .await
                        })
                    },
                    3,
                )
                .await;
                
                // ✅ AMÉLIORÉ: Message d'erreur plus détaillé selon le type d'erreur
                let detailed_error = if error_msg.contains("timeout") || error_msg.contains("deadlock") {
                    format!("La base de données est temporairement surchargée. Veuillez réessayer dans quelques instants. (Erreur: {})", error_msg)
                } else if error_msg.contains("constraint") || error_msg.contains("duplicate") {
                    format!("Erreur de validation des données. Veuillez vérifier les informations du produit. (Erreur: {})", error_msg)
                } else if error_msg.contains("does not exist") || error_msg.contains("relation") {
                    format!("Erreur de configuration de la base de données. Veuillez contacter le support. (Erreur: {})", error_msg)
                } else {
                    format!("Erreur lors de l'ajout du produit au service. Veuillez réessayer. Si le problème persiste, contactez le support. (Erreur: {})", error_msg)
                };
                
                return Err(AppError::Internal(detailed_error));
            }
        },
        Err(_) => {
            // Timeout après 30s
            let elapsed_time = start_time.elapsed();
            log_error(&format!("[add_product_to_service] ⏱️ Timeout après 30s lors de l'ajout du produit (fonction PostgreSQL trop lente ou base de données surchargée, temps écoulé: {:?})", elapsed_time));
            
            // ✅ ROLLBACK : Rembourser l'utilisateur en cas de timeout
            let pool = state.pg.clone();
            let refund_result = crate::utils::db_retry::retry_query(
                &pool,
                || {
                    let cout_ajout_clone = cout_ajout;
                    let user_id_clone = user.id;
                    let pool_clone = pool.clone();
                    Box::pin(async move {
                        sqlx::query(
                            "UPDATE users SET tokens_balance = tokens_balance + $1 WHERE id = $2"
                        )
                        .bind(cout_ajout_clone)
                        .bind(user_id_clone)
                        .execute(&pool_clone)
                        .await
                    })
                },
                3,
            )
            .await;
            
            if refund_result.is_ok() {
                log_info(&format!("[add_product_to_service] ✅ Remboursement effectué pour user {} ({} FCFA)", user.id, cout_ajout));
            } else {
                log_error(&format!("[add_product_to_service] ⚠️ Échec remboursement pour user {} ({} FCFA)", user.id, cout_ajout));
            }
            
            // ✅ AMÉLIORÉ: Message d'erreur plus détaillé pour timeout
            return Err(AppError::Internal(format!(
                "Timeout lors de l'ajout du produit après 30s. La base de données est peut-être temporairement surchargée.\n\nVotre solde a été remboursé ({} FCFA).\n\nVeuillez réessayer dans quelques instants. Si le problème persiste, contactez le support.",
                cout_ajout
            )));
        }
    };
    
    // ✅ CRITIQUE 2025-12-31: Traiter les médias du produit EN ARRIÈRE-PLAN (asynchrone)
    // Le traitement des images peut prendre 20-40s (upload Wasabi), donc on le fait après avoir retourné la réponse
    // Cela évite les timeouts de 60s+ et améliore l'expérience utilisateur
    // ✅ CORRIGÉ 2026-01-01: Séparer URLs déjà uploadées (sauvegarde directe) des base64 (traitement)
    if !images_to_process.is_empty() {
        let images_to_process_clone = images_to_process.clone();
        let product_data_cleaned_clone = product_data_cleaned.clone();
        let service_id_clone = service_id;
        let product_index_clone = product_index;
        let pool_clone = pool.clone();
        let media_storage_clone = state.media_storage.clone();
        let storage_root = std::env::var("UPLOAD_STORAGE_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("uploads"));
        let storage_root_clone = storage_root.clone();
        
        // ✅ NOUVEAU: Traiter les images en arrière-plan (tokio::spawn)
        tokio::spawn(async move {
            use crate::services::creer_service::{is_url, is_probable_base64};
            
            log_info(&format!("[add_product_to_service] 🖼️ [ASYNC] Traitement de {} image(s) pour le produit (index: {})", images_to_process_clone.len(), product_index_clone));
            
            let product_id = product_data_cleaned_clone
                .as_object()
                .and_then(|obj| obj.get("id"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| format!("prod_{}", product_index_clone));
            
            // ✅ CORRIGÉ 2026-01-01: Séparer URLs (sauvegarde directe) et base64 (traitement)
            for (image_index, image_data) in images_to_process_clone.iter().enumerate() {
                if image_data.is_empty() {
                    continue;
                }
                
                let is_main = image_index == 0;
                let image_data_clone = image_data.clone();
                let storage_root_clone = storage_root_clone.clone();
                let product_id_clone = product_id.clone();
                let media_storage_clone = media_storage_clone.clone();
                
                // Si c'est une URL déjà uploadée, sauvegarder directement dans la table media
                if is_url(&image_data_clone) {
                    log_info(&format!("[add_product_to_service] 🔗 [ASYNC] Image {} est une URL, sauvegarde directe dans media: {}", image_index, image_data_clone));
                    
                    // Sauvegarder l'URL directement dans la table media
                    if let Err(e) = sqlx::query(
                        r#"
                        INSERT INTO media (
                            service_id, product_id, product_index, type, path,
                            is_main_image, display_order, uploaded_at
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        ON CONFLICT DO NOTHING
                        "#
                    )
                    .bind(service_id_clone)
                    .bind(&product_id_clone)
                    .bind(product_index_clone as i32)
                    .bind("image")
                    .bind(&image_data_clone) // ✅ URL directement comme path
                    .bind(is_main)
                    .bind(image_index as i32)
                    .bind(Utc::now().naive_utc())
                    .execute(&pool_clone)
                    .await {
                        log_error(&format!("[add_product_to_service] ❌ [ASYNC] Erreur insertion URL media produit {} (index {}): {}", product_id_clone, product_index_clone, e));
                    } else {
                        log_info(&format!("[add_product_to_service] ✅ [ASYNC] URL image {} sauvegardée pour produit {} (index: {})", image_index, product_id_clone, product_index_clone));
                    }
                } else if is_probable_base64(&image_data_clone) {
                    // Base64: traiter normalement avec upload/téléchargement
                    log_info(&format!("[add_product_to_service] 📦 [ASYNC] Image {} est base64, traitement avec upload...", image_index));
                    
                    match process_single_image_for_product(
                        &storage_root_clone,
                        service_id_clone,
                        &product_id_clone,
                        product_index_clone,
                        image_index,
                        &image_data_clone,
                        media_storage_clone,
                    ).await {
                        Ok(Some(processed)) => {
                            // Insérer dans la table media
                            if let Err(e) = sqlx::query(
                                r#"
                                INSERT INTO media (
                                    service_id, product_id, product_index, type, path,
                                    is_main_image, display_order, uploaded_at,
                                    image_signature, image_hash, image_metadata
                                )
                                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                                ON CONFLICT DO NOTHING
                                "#
                            )
                            .bind(service_id_clone)
                            .bind(&product_id_clone)
                            .bind(product_index_clone as i32)
                            .bind("image")
                            .bind(&processed.file_path)
                            .bind(is_main)
                            .bind(image_index as i32)
                            .bind(Utc::now().naive_utc())
                            .bind(&processed.image_signature)
                            .bind(&processed.image_hash)
                            .bind(&processed.image_metadata)
                            .execute(&pool_clone)
                            .await {
                                log_error(&format!("[add_product_to_service] ❌ [ASYNC] Erreur insertion media produit {} (index {}): {}", product_id_clone, product_index_clone, e));
                            } else {
                                log_info(&format!("[add_product_to_service] ✅ [ASYNC] Image {} sauvegardée pour produit {} (index: {})", image_index, product_id_clone, product_index_clone));
                            }
                        }
                        Ok(None) => {
                            log_info(&format!("[add_product_to_service] ⚠️ [ASYNC] Image {} ignorée pour produit {} (format non supporté)", image_index, product_id_clone));
                        }
                        Err(e) => {
                            log_error(&format!("[add_product_to_service] ❌ [ASYNC] Erreur traitement image {} pour produit {}: {}", image_index, product_id_clone, e));
                        }
                    }
                } else {
                    log_warn(&format!("[add_product_to_service] ⚠️ [ASYNC] Image {} ignorée (ni URL ni base64 valide): {}", image_index, image_data_clone));
                }
            }
            
            log_info(&format!("[add_product_to_service] ✅ [ASYNC] Traitement des images terminé pour produit {} (index: {})", product_id, product_index_clone));
        });
        
        log_info(&format!("[add_product_to_service] ✅ Traitement de {} image(s) lancé en arrière-plan pour le produit (index: {})", images_to_process.len(), product_index));
    }
    
    // ✅ OPTIMISÉ 2025-12-31: Construire service_data minimal pour indexation
    // Les données nécessaires sont déjà retournées par la fonction PostgreSQL v2
    // Plus besoin de faire un SELECT complet du JSONB (gain de 1-3 secondes !)
    let service_data_for_autocomplete = json!({
        "produits": produits_data_for_indexation,
        "lieu_produit": lieu_data_for_indexation
    });
    
    // ✅ CRITIQUE 2025-12-23: Mettre à jour autocomplete_characteristics SYNCHRONEMENT pour garantir l'indexation
    // La recherche utilise autocomplete_characteristics, donc si on ne met pas à jour cette table, le produit ne sera pas trouvé !
    // PROBLÈME IDENTIFIÉ: L'indexation asynchrone (tokio::spawn) peut échouer silencieusement, rendant les produits introuvables
    // SOLUTION: Indexation synchrone avec timeout pour éviter de bloquer trop longtemps
    // ✅ OPTIMISÉ 2025-12-31: Indexation avec timeout réduit (max 3s) car données déjà préparées
    // Si l'indexation échoue, on log l'erreur mais on ne fait pas échouer la requête (le produit est déjà dans services.data)
    let pool_for_autocomplete = state.pg.clone();
    let indexation_result = tokio::time::timeout(
        std::time::Duration::from_secs(3),  // ✅ RÉDUIT de 5s à 3s car données déjà préparées
        save_autocomplete_combination(&pool_for_autocomplete, service_id, &service_data_for_autocomplete)
    ).await;
        
    match indexation_result {
        Ok(Ok(_)) => {
            log_info(&format!("[add_product_to_service] ✅ autocomplete_characteristics mis à jour pour service {} (produit indexé pour recherche)", service_id));
        }
        Ok(Err(e)) => {
            log_error(&format!("[add_product_to_service] ⚠️ Erreur mise à jour autocomplete_characteristics (produit toujours dans services.data mais non indexé): {}", e));
            // Ne pas faire échouer la requête si autocomplete échoue, le produit est déjà dans services.data
            // MAIS il ne sera pas trouvable dans la recherche jusqu'à ce que autocomplete soit mis à jour
        }
        Err(_) => {
            log_error(&format!("[add_product_to_service] ⚠️ Timeout indexation autocomplete_characteristics pour service {} (produit toujours dans services.data mais non indexé)", service_id));
            // Timeout après 5s - on continue quand même car le produit est déjà dans services.data
        }
    }
    
    // ✅ Créer notification
    let _ = crate::services::notification_service::create_notification(
        &state.pg,
        user.id,
        crate::services::notification_service::NotificationType::ProductAdded,
        "✅ Produit ajouté".to_string(),
        format!("Votre produit #{} a été ajouté avec succès (coût: {} FCFA).", product_index + 1, cout_ajout),
        Some(json!({
            "service_id": service_id,
            "product_index": product_index,
            "cost": cout_ajout
        }))
    ).await;
    
    Ok(Json(json!({
        "success": true,
        "service_id": service_id,
        "product_index": product_index,
        "cost": cout_ajout,
        "message": format!("Produit ajouté avec succès (coût: {} FCFA)", cout_ajout),
        "new_balance": new_balance
    })))
}

