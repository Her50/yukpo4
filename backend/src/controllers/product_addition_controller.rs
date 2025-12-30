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
    use crate::utils::log::{log_info, log_error};
    
    log_info(&format!("[add_product_to_service] 📦 Ajout d'un produit au service {}", service_id));
    
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
    
    // ✅ AMÉLIORÉ 2025-12-30: Timeout explicite pour éviter les requêtes trop longues
    // ✅ AUGMENTÉ 2025-12-30: 60s pour permettre le traitement des images (upload Wasabi peut prendre 20-40s)
    // Le timeout de 60s permet d'éviter que la requête ne bloque indéfiniment tout en laissant le temps au traitement des images
    let update_result = tokio::time::timeout(
        std::time::Duration::from_secs(60),
        crate::utils::db_retry::retry_query(
            &pool,
            || {
                let product_json_clone = product_json_value.clone();
                let service_id_clone = service_id;
                let pool_clone = pool.clone();
                Box::pin(async move {
                    // ✅ OPTIMISATION CRITIQUE: Utilise fonction PostgreSQL qui insère directement dans le tableau
                    // Évite de charger le JSONB en mémoire et fait tout en une seule opération atomique
                    // Réduit la latence de 7-12s à <1s
                    sqlx::query_scalar::<_, i32>(
                        "SELECT add_product_to_service_jsonb($1, $2)"
                    )
                    .bind(service_id_clone)
                    .bind(&product_json_clone)
                    .fetch_one(&pool_clone)
                    .await
                })
            },
            7, // ✅ AUGMENTÉ 2025-12-27: 7 tentatives max pour gérer les erreurs TLS de Render DB
        )
    )
    .await;
    
    // ✅ Exécuter l'UPDATE avec la fonction PostgreSQL optimisée
    let product_index = match update_result {
        Ok(Ok(index)) => {
            let idx = index as usize;
            log_info(&format!("[add_product_to_service] ✅ Produit ajouté au service {} (index: {})", service_id, idx));
            
            // ✅ CRITIQUE 2025-12-27: Traiter et sauvegarder les médias du produit
            if !images_to_process.is_empty() {
                log_info(&format!("[add_product_to_service] 🖼️ Traitement de {} image(s) pour le produit (index: {})", images_to_process.len(), idx));
                
                // Obtenir le storage_root et product_id
                let storage_root = std::env::var("UPLOAD_STORAGE_PATH")
                    .map(PathBuf::from)
                    .unwrap_or_else(|_| PathBuf::from("uploads"));
                
                let product_id = product_data_cleaned
                    .as_object()
                    .and_then(|obj| obj.get("id"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| format!("prod_{}", idx));
                
                // ✅ OPTIMISÉ 2025-12-30: Traiter les images EN PARALLÈLE au lieu de séquentiellement
                // Cela réduit le temps total de 3×30s=90s à ~30s (le temps de la plus lente)
                let image_processing_futures: Vec<_> = images_to_process.iter()
                    .enumerate()
                    .filter(|(_, image_data)| !image_data.is_empty())
                    .map(|(image_index, image_data)| {
                        let storage_root_clone = storage_root.clone();
                        let product_id_clone = product_id.clone();
                        let media_storage_clone = state.media_storage.clone();
                        
                        async move {
                            let result = process_single_image_for_product(
                                &storage_root_clone,
                                service_id,
                                &product_id_clone,
                                idx,
                                image_index,
                                image_data,
                                media_storage_clone,
                            ).await;
                            
                            (image_index, result)
                        }
                    })
                    .collect();
                
                // Traiter toutes les images en parallèle
                let processing_results = join_all(image_processing_futures).await;
                
                // Insérer les résultats dans la DB (on peut aussi paralléliser ça si nécessaire)
                for (image_index, result) in processing_results {
                    match result {
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
                                "#
                            )
                            .bind(service_id)
                            .bind(&product_id)
                            .bind(idx as i32)
                            .bind("image")
                            .bind(&processed.file_path)
                            .bind(image_index == 0)
                            .bind(image_index as i32)
                            .bind(Utc::now().naive_utc())
                            .bind(&processed.image_signature)
                            .bind(&processed.image_hash)
                            .bind(&processed.image_metadata)
                            .execute(&pool)
                            .await {
                                log_error(&format!("[add_product_to_service] ❌ Erreur insertion media produit {} (index {}): {}", product_id, idx, e));
                            } else {
                                log_info(&format!("[add_product_to_service] ✅ Image {} sauvegardée pour produit {} (index: {})", image_index, product_id, idx));
                            }
                        }
                        Ok(None) => {
                            log_info(&format!("[add_product_to_service] ⚠️ Image {} ignorée pour produit {} (format non supporté)", image_index, product_id));
                        }
                        Err(e) => {
                            log_error(&format!("[add_product_to_service] ❌ Erreur traitement image {} pour produit {}: {}", image_index, product_id, e));
                            // Ne pas faire échouer la requête si une image échoue
                        }
                    }
                }
            }
            
            idx
        },
        Ok(Err(e)) => {
            log_error(&format!("[add_product_to_service] Erreur fonction PostgreSQL: {}", e));
            
            // ✅ Fallback: utiliser l'ancienne méthode si la fonction n'existe pas encore
            // (peut arriver si la migration n'a pas encore été appliquée)
            let error_msg = e.to_string();
            if error_msg.contains("does not exist") || error_msg.contains("function") {
                log_info(&format!("[add_product_to_service] ⚠️ Fallback vers méthode ancienne (migration non appliquée?)"));
                
                // Ancienne méthode (fallback) - récupérer service_data depuis la DB
                let service_data_result = crate::utils::db_retry::retry_query(
                    &pool,
                    || {
                        let service_id_clone = service_id;
                        let pool_clone = pool.clone();
                        Box::pin(async move {
                            sqlx::query("SELECT data FROM services WHERE id = $1")
                                .bind(service_id_clone)
                                .fetch_one(&pool_clone)
                                .await
                        })
                    },
                    3,
                ).await;
                
                let mut service_data = match service_data_result {
                    Ok(row) => row.try_get::<Value, _>("data")
                        .unwrap_or_else(|_| serde_json::json!({})),
                    Err(e) => {
                        log_error(&format!("[add_product_to_service] ⚠️ Erreur récupération service_data pour fallback: {}", e));
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
                        return Err(AppError::Internal(format!("Erreur récupération service_data: {}", e)));
                    }
                };
                
                // ✅ CRITIQUE: Utiliser product_data_cleaned (sans base64) dans le fallback aussi
                let produits_array = service_data
                    .as_object_mut()
                    .and_then(|obj| obj.get_mut("produits"))
                    .and_then(|p| p.as_object_mut())
                    .and_then(|obj| obj.get_mut("valeur"))
                    .and_then(|v| v.as_array_mut());
                
                let fallback_index = match produits_array {
                    Some(arr) => {
                        arr.push(product_data_cleaned.clone());
                        arr.len() - 1
                    },
                    None => {
                        if let Some(obj) = service_data.as_object_mut() {
                            obj.insert("produits".to_string(), json!({
                                "type_donnee": "autocomplete",
                                "valeur": vec![product_data_cleaned.clone()],
                                "separateur": ",",
                                "sous_caracteristiques": {},
                                "filtrable": true,
                                "origine_champs": "formulaire"
                            }));
                        }
                        0
                    }
                };
                
                let produits_value = service_data.get("produits").cloned().unwrap_or(serde_json::json!({}));
                let fallback_result = crate::utils::db_retry::retry_query(
                    &pool,
                    || {
                        let produits_json_clone = produits_value.clone();
                        let service_id_clone = service_id;
                        let pool_clone = pool.clone();
                        Box::pin(async move {
                            sqlx::query(
                                "UPDATE services SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{produits}', $1::jsonb, true), updated_at = NOW() WHERE id = $2"
                            )
                            .bind(&produits_json_clone)
                            .bind(service_id_clone)
                            .execute(&pool_clone)
                            .await
                        })
                    },
                    7, // ✅ AUGMENTÉ 2025-12-27: 7 tentatives max pour gérer les erreurs TLS
                )
                .await;
                
                match fallback_result {
                    Ok(_) => fallback_index,
                    Err(e) => {
                        log_error(&format!("[add_product_to_service] Erreur mise à jour service (fallback): {}", e));
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
                        return Err(AppError::Internal(format!("Erreur mise à jour service: {}", e)));
                    }
                }
            } else {
                // Erreur autre que "fonction n'existe pas" - retourner l'erreur avec rollback
                log_error(&format!("[add_product_to_service] Erreur mise à jour service: {}", e));
                
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
                
                return Err(AppError::Internal(format!("Erreur mise à jour service: {}", e)));
            }
        }
        Err(_) => {
            // Timeout après 60s
            log_error(&format!("[add_product_to_service] ⏱️ Timeout après 60s lors de l'ajout du produit"));
            
            // ✅ ROLLBACK : Rembourser l'utilisateur en cas de timeout
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
            
            return Err(AppError::Internal("Timeout lors de l'ajout du produit après 60s. Le traitement des images peut prendre du temps. Veuillez réessayer avec moins d'images.".to_string()));
        }
    };
    
    // ✅ Récupérer service_data après l'UPDATE pour l'indexation autocomplete
    let pool_for_autocomplete = state.pg.clone();
    let service_data_for_autocomplete = match crate::utils::db_retry::retry_query(
        &pool_for_autocomplete,
        || {
            let service_id_clone = service_id;
            let pool_clone = pool_for_autocomplete.clone();
            Box::pin(async move {
                sqlx::query("SELECT data FROM services WHERE id = $1")
                    .bind(service_id_clone)
                    .fetch_one(&pool_clone)
                    .await
            })
        },
        3,
    ).await {
        Ok(row) => row.try_get::<Value, _>("data")
            .unwrap_or_else(|_| serde_json::json!({})),
        Err(e) => {
            log_error(&format!("[add_product_to_service] ⚠️ Erreur récupération service_data pour indexation: {}", e));
            serde_json::json!({}) // Utiliser objet vide en fallback (indexation échouera mais produit est déjà dans DB)
        }
    };
    
    // ✅ CRITIQUE 2025-12-23: Mettre à jour autocomplete_characteristics SYNCHRONEMENT pour garantir l'indexation
    // La recherche utilise autocomplete_characteristics, donc si on ne met pas à jour cette table, le produit ne sera pas trouvé !
    // PROBLÈME IDENTIFIÉ: L'indexation asynchrone (tokio::spawn) peut échouer silencieusement, rendant les produits introuvables
    // SOLUTION: Indexation synchrone avec timeout pour éviter de bloquer trop longtemps
    // ✅ OPTIMISÉ 2025-12-23: Indexation synchrone avec timeout (max 5s) pour garantir l'indexation
    // Si l'indexation échoue, on log l'erreur mais on ne fait pas échouer la requête (le produit est déjà dans services.data)
    let indexation_result = tokio::time::timeout(
        std::time::Duration::from_secs(5),
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

