use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct ToggleProductRequest {
    pub is_active: bool,
}

#[derive(Debug, Serialize)]
pub struct ApiResponse {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

/// Activer/Désactiver un produit spécifique
/// PATCH /api/products/:id/toggle-status
pub async fn toggle_product_status(
    State(state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
    Json(payload): Json<ToggleProductRequest>,
) -> Result<Json<ApiResponse>, StatusCode> {
    let pool = &state.pg;

    log::info!(
        "🔄 Toggle produit {} -> {}",
        product_id,
        if payload.is_active {
            "actif"
        } else {
            "inactif"
        }
    );

    // Mettre à jour le statut du produit dans products_lifecycle
    let result = sqlx::query!(
        r#"
        UPDATE products_lifecycle
        SET is_active = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING id
        "#,
        payload.is_active,
        product_id.parse::<i32>().unwrap_or(0)
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        log::error!("❌ Erreur toggle product: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if result.is_none() {
        log::warn!("⚠️ Produit {} non trouvé", product_id);
        return Ok(Json(ApiResponse {
            success: false,
            message: "Produit non trouvé".to_string(),
            data: None,
        }));
    }

    log::info!(
        "✅ Produit {} {}",
        product_id,
        if payload.is_active {
            "activé"
        } else {
            "désactivé"
        }
    );

    Ok(Json(ApiResponse {
        success: true,
        message: format!(
            "Produit {}",
            if payload.is_active {
                "activé"
            } else {
                "désactivé"
            }
        ),
        data: None,
    }))
}

/// Supprimer un produit spécifique
/// DELETE /api/products/:id
pub async fn delete_product(
    State(state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
) -> Result<Json<ApiResponse>, StatusCode> {
    let pool = &state.pg;

    log::info!("🗑️ Suppression produit {}", product_id);

    let product_id_i32 = product_id.parse::<i32>().map_err(|_| {
        log::warn!("⚠️ Identifiant produit invalide: {}", product_id);
        StatusCode::BAD_REQUEST
    })?;

    // Supprimer le produit de products_lifecycle
    let result = sqlx::query!(
        r#"
        DELETE FROM products_lifecycle
        WHERE id = $1
        RETURNING id, service_id, product_index
        "#,
        product_id_i32
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        log::error!("❌ Erreur suppression product: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let deleted_row = match result {
        Some(row) => row,
        None => {
        log::warn!("⚠️ Produit {} non trouvé", product_id);
        return Ok(Json(ApiResponse {
            success: false,
            message: "Produit non trouvé".to_string(),
            data: None,
        }));
        }
    };

    let service_id = deleted_row.service_id;
    let removed_index = deleted_row.product_index;

    // Supprimer les médias associés au produit supprimé
    if let Err(media_error) = sqlx::query!(
        r#"
        DELETE FROM media
        WHERE service_id = $1 AND product_index = $2
        "#,
        service_id,
        removed_index
    )
    .execute(pool)
    .await
    {
        log::warn!(
            "⚠️ Impossible de supprimer les médias du produit {}: {:?}",
            product_id_i32,
            media_error
        );
    }

    // Re-indexer les médias restants
    if let Err(media_shift_error) = sqlx::query!(
        r#"
        UPDATE media
        SET product_index = product_index - 1
        WHERE service_id = $1
          AND product_index IS NOT NULL
          AND product_index > $2
        "#,
        service_id,
        removed_index
    )
    .execute(pool)
    .await
    {
        log::warn!(
            "⚠️ Impossible de ré-indexer les médias du service {} après suppression: {:?}",
            service_id,
            media_shift_error
        );
    }

    // Mettre à jour les produits dans le JSON du service
    if let Ok(service_row) = sqlx::query!(
        r#"
        SELECT data
        FROM services
        WHERE id = $1
        "#,
        service_id
    )
    .fetch_optional(pool)
    .await
    {
        if let Some(row) = service_row {
            let mut service_data: serde_json::Value = row.data;
            let mut updated = false;

            if let Some(produits) = service_data.get_mut("produits") {
                if let Some(valeur) = produits.get_mut("valeur") {
                    if let Some(arr) = valeur.as_array_mut() {
                        let mut removal_index: Option<usize> = arr
                            .iter()
                            .position(|item| {
                                let lifecycle_id = item
                                    .get("product_lifecycle_id")
                                    .and_then(|v| v.as_i64())
                                    .map(|v| v as i32);
                                let legacy_id = item
                                    .get("lifecycle_id")
                                    .and_then(|v| v.as_i64())
                                    .map(|v| v as i32);
                                let product_id_field = item
                                    .get("product_id")
                                    .and_then(|v| v.as_i64())
                                    .map(|v| v as i32);

                                lifecycle_id == Some(product_id_i32)
                                    || legacy_id == Some(product_id_i32)
                                    || product_id_field == Some(product_id_i32)
                            });

                        if removal_index.is_none()
                            && removed_index >= 0
                            && (removed_index as usize) < arr.len()
                        {
                            removal_index = Some(removed_index as usize);
                        }

                        if let Some(idx) = removal_index {
                            arr.remove(idx);
                            updated = true;

                            for (index, product_value) in arr.iter_mut().enumerate() {
                                if let Some(obj) = product_value.as_object_mut() {
                                    obj.insert(
                                        "product_index".to_string(),
                                        serde_json::json!(index),
                                    );
                                    obj.insert(
                                        "lifecycle_index".to_string(),
                                        serde_json::json!(index),
                                    );
                                }
                            }
                        }
                    }
                }
            }

            if updated {
                if let Err(update_error) = sqlx::query!(
                    r#"
                    UPDATE services
                    SET data = $1,
                        updated_at = NOW()
                    WHERE id = $2
                    "#,
                    service_data,
                    service_id
                )
                .execute(pool)
                .await
                {
                    log::error!(
                        "❌ Erreur mise à jour JSON service {} après suppression produit {}: {:?}",
                        service_id,
                        product_id_i32,
                        update_error
                    );
                }
            }
        }
    }

    // Ré-indexer les produits restants dans products_lifecycle
    if let Err(reindex_error) = sqlx::query!(
        r#"
        UPDATE products_lifecycle
        SET product_index = product_index - 1,
            updated_at = NOW()
        WHERE service_id = $1
          AND product_index > $2
        "#,
        service_id,
        removed_index
    )
    .execute(pool)
    .await
    {
        log::error!(
            "❌ Erreur ré-indexation products_lifecycle pour service {}: {:?}",
            service_id,
            reindex_error
        );
    }

    log::info!("✅ Produit {} supprimé", product_id);

    Ok(Json(ApiResponse {
        success: true,
        message: "Produit supprimé avec succès".to_string(),
        data: None,
    }))
}

/// Récupérer tous les produits d'un prestataire (tous services confondus)
/// GET /api/prestataire/products
pub async fn get_all_prestataire_products(
    State(state): State<Arc<AppState>>,
    // TODO: Extraire user_id du JWT
) -> Result<Json<ApiResponse>, StatusCode> {
    let pool = &state.pg;

    // Pour l'instant, exemple simplifié
    // Dans la vraie implémentation, extraire user_id du JWT

    log::info!("📦 Récupération produits prestataire");

    // Note: Cette requête sera améliorée avec extraction JWT
    let products = sqlx::query!(
        r#"
        SELECT 
            pl.id,
            pl.product_nom as nom,
            pl.product_type as type,
            pl.is_active,
            pl.service_id
        FROM products_lifecycle pl
        JOIN services s ON pl.service_id = s.id
        WHERE s.user_id = $1
        ORDER BY pl.created_at DESC
        "#,
        1 // TODO: Remplacer par user_id du JWT
    )
    .fetch_all(pool)
    .await
    .map_err(|e| {
        log::error!("❌ Erreur récupération produits: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Mapper vers une structure sérialisable
    let products_json: Vec<serde_json::Value> = products
        .iter()
        .map(|p| {
            serde_json::json!({
                "id": p.id,
                "nom": p.nom,
                "type": p.r#type,
                "is_active": p.is_active,
                "service_id": p.service_id
            })
        })
        .collect();

    Ok(Json(ApiResponse {
        success: true,
        message: format!("{} produits récupérés", products_json.len()),
        data: Some(serde_json::json!(products_json)),
    }))
}

/// Ajouter un produit dupliqué à un service (pour duplication)
/// PATCH /api/services/:id/add-product
#[derive(Debug, Deserialize)]
pub struct AddProductRequest {
    pub product: serde_json::Value,
}

pub async fn add_product_to_service(
    State(state): State<Arc<AppState>>,
    Path(service_id): Path<String>,
    Json(payload): Json<AddProductRequest>,
) -> Result<Json<ApiResponse>, StatusCode> {
    let pool = &state.pg;

    log::info!("➕ Ajout produit au service {}", service_id);

    // Récupérer le service
    let service = sqlx::query!(
        r#"
        SELECT data
        FROM services
        WHERE id = $1
        "#,
        service_id.parse::<i32>().unwrap_or(0)
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        log::error!("❌ Erreur récupération service: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if service.is_none() {
        log::warn!("⚠️ Service {} non trouvé", service_id);
        return Ok(Json(ApiResponse {
            success: false,
            message: "Service non trouvé".to_string(),
            data: None,
        }));
    }

    // Parser le JSON data
    let mut service_data: serde_json::Value = service.unwrap().data;

    // Ajouter le produit à produits.valeur
    if let Some(produits) = service_data.get_mut("produits") {
        if let Some(valeur) = produits.get_mut("valeur") {
            if let Some(arr) = valeur.as_array_mut() {
                arr.push(payload.product.clone());
                log::info!("✅ Produit ajouté, total: {} produits", arr.len());
            } else {
                // Si valeur n'est pas un array, le créer
                *valeur = serde_json::json!([payload.product]);
                log::info!("✅ Premier produit ajouté");
            }
        } else {
            // Si produits n'a pas de valeur, l'initialiser
            if let Some(obj) = produits.as_object_mut() {
                obj.insert("valeur".to_string(), serde_json::json!([payload.product]));
                log::info!("✅ Champ valeur créé avec premier produit");
            }
        }
    } else {
        // Si produits n'existe pas du tout, le créer
        if let Some(obj) = service_data.as_object_mut() {
            obj.insert(
                "produits".to_string(),
                serde_json::json!({
                    "type_donnee": "listeproduit",
                    "valeur": [payload.product],
                    "origine_champs": "formulaire"
                }),
            );
            log::info!("✅ Champ produits créé avec premier produit");
        }
    }

    // Mettre à jour le service
    sqlx::query!(
        r#"
        UPDATE services
        SET data = $1,
            updated_at = NOW()
        WHERE id = $2
        "#,
        service_data,
        service_id.parse::<i32>().unwrap_or(0)
    )
    .execute(pool)
    .await
    .map_err(|e| {
        log::error!("❌ Erreur mise à jour service: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    log::info!("✅ Produit dupliqué et ajouté au service {}", service_id);

    Ok(Json(ApiResponse {
        success: true,
        message: "Produit dupliqué avec succès".to_string(),
        data: None,
    }))
}

/// Modifier un produit spécifique dans un service (GRATUIT)
/// PATCH /api/products/:id/update
#[derive(Debug, Deserialize)]
pub struct UpdateProductRequest {
    pub service_id: String,
    pub product_index: i32, // Index dans produits.valeur[]
    pub updated_product: serde_json::Value,
}

#[axum::debug_handler]
pub async fn update_product(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<crate::middlewares::jwt::AuthenticatedUser>,
    Path(product_id): Path<String>,
    Json(payload): Json<UpdateProductRequest>,
) -> Result<Json<ApiResponse>, StatusCode> {
    let pool = &state.pg;
    let user_id = user.id;

    log::info!(
        "✏️ Modification produit {} dans service {} par user {}",
        product_id,
        payload.service_id,
        user_id
    );

    // Récupérer le service avec user_id pour vérification
    let service = sqlx::query!(
        r#"
        SELECT data, user_id
        FROM services
        WHERE id = $1
        "#,
        payload.service_id.parse::<i32>().unwrap_or(0)
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        log::error!("❌ Erreur récupération service: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if service.is_none() {
        log::warn!("⚠️ Service {} non trouvé", payload.service_id);
        return Ok(Json(ApiResponse {
            success: false,
            message: "Service non trouvé".to_string(),
            data: None,
        }));
    }

    let service_row = service.unwrap();

    // ✅ Vérifier que le service appartient à l'utilisateur
    if service_row.user_id != user_id {
        log::warn!(
            "⚠️ Utilisateur {} n'est pas propriétaire du service {}",
            user_id,
            payload.service_id
        );
        return Ok(Json(ApiResponse {
            success: false,
            message: "Non autorisé".to_string(),
            data: None,
        }));
    }

    // Parser le JSON data
    let mut service_data: serde_json::Value = service_row.data;

    // ✅ Sauvegarder l'ancienne version du produit pour historique
    let old_product: Option<serde_json::Value> =
        if let Some(produits) = service_data.get("produits") {
            if let Some(valeur) = produits.get("valeur") {
                if let Some(arr) = valeur.as_array() {
                    if payload.product_index >= 0 && (payload.product_index as usize) < arr.len() {
                        Some(arr[payload.product_index as usize].clone())
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        };

    // Mettre à jour le produit dans produits.valeur[index]
    if let Some(produits) = service_data.get_mut("produits") {
        if let Some(valeur) = produits.get_mut("valeur") {
            if let Some(arr) = valeur.as_array_mut() {
                if payload.product_index >= 0 && (payload.product_index as usize) < arr.len() {
                    arr[payload.product_index as usize] = payload.updated_product.clone();
                    log::info!("✅ Produit modifié à l'index {}", payload.product_index);
                } else {
                    log::error!(
                        "❌ Index {} invalide (total: {})",
                        payload.product_index,
                        arr.len()
                    );
                    return Ok(Json(ApiResponse {
                        success: false,
                        message: "Index de produit invalide".to_string(),
                        data: None,
                    }));
                }
            }
        }
    }

    // Mettre à jour le service (GRATUIT - pas de déduction de tokens)
    sqlx::query!(
        r#"
        UPDATE services
        SET data = $1,
            updated_at = NOW()
        WHERE id = $2
        "#,
        service_data,
        payload.service_id.parse::<i32>().unwrap_or(0)
    )
    .execute(pool)
    .await
    .map_err(|e| {
        log::error!("❌ Erreur mise à jour service: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // ✅ NOUVEAU: Enregistrer l'historique dans service_logs
    if let Some(old_prod) = old_product {
        let product_name = payload
            .updated_product
            .get("nom")
            .and_then(|v| v.as_str())
            .unwrap_or("Produit sans nom");

        let modification_details = serde_json::json!({
            "action": "product_update",
            "product_id": product_id,
            "product_index": payload.product_index,
            "product_name": product_name,
            "old_version": old_prod,
            "new_version": payload.updated_product
        });

        sqlx::query!(
            r#"
            INSERT INTO service_logs (service_id, user_id, action, modification)
            VALUES ($1, $2, $3, $4::jsonb)
            "#,
            payload.service_id.parse::<i32>().unwrap_or(0),
            user_id,
            "product_modified",
            modification_details
        )
        .execute(pool)
        .await
        .map_err(|e| {
            log::warn!(
                "⚠️ Erreur enregistrement historique (non bloquant): {:?}",
                e
            );
        })
        .ok();

        log::info!(
            "✅ Historique de modification enregistré pour produit {}",
            product_name
        );
    }

    log::info!("✅ Produit {} modifié avec succès (GRATUIT)", product_id);

    Ok(Json(ApiResponse {
        success: true,
        message: "Produit modifié avec succès (gratuit)".to_string(),
        data: None,
    }))
}
