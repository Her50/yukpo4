use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
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
        if payload.is_active { "actif" } else { "inactif" }
    );

    // Mettre à jour le statut du produit
    let result = sqlx::query!(
        r#"
        UPDATE products
        SET is_active = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING id
        "#,
        payload.is_active,
        product_id
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

    log::info!("✅ Produit {} {}", product_id, if payload.is_active { "activé" } else { "désactivé" });

    Ok(Json(ApiResponse {
        success: true,
        message: format!("Produit {}", if payload.is_active { "activé" } else { "désactivé" }),
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

    // Supprimer le produit
    let result = sqlx::query!(
        r#"
        DELETE FROM products
        WHERE id = $1
        RETURNING id
        "#,
        product_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        log::error!("❌ Erreur suppression product: {:?}", e);
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
            p.id,
            p.nom,
            p.type,
            p.prix,
            p.devise,
            p.description,
            p.is_active,
            s.id as service_id
        FROM products p
        JOIN services s ON p.service_id = s.id
        WHERE s.user_id = $1
        ORDER BY p.created_at DESC
        "#,
        1 // TODO: Remplacer par user_id du JWT
    )
    .fetch_all(pool)
    .await
    .map_err(|e| {
        log::error!("❌ Erreur récupération produits: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(ApiResponse {
        success: true,
        message: format!("{} produits récupérés", products.len()),
        data: Some(serde_json::json!(products)),
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
            obj.insert("produits".to_string(), serde_json::json!({
                "type_donnee": "listeproduit",
                "valeur": [payload.product],
                "origine_champs": "formulaire"
            }));
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

pub async fn update_product(
    State(state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
    Json(payload): Json<UpdateProductRequest>,
) -> Result<Json<ApiResponse>, StatusCode> {
    let pool = &state.pg;
    
    log::info!("✏️ Modification produit {} dans service {}", product_id, payload.service_id);

    // Récupérer le service
    let service = sqlx::query!(
        r#"
        SELECT data
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

    // Parser le JSON data
    let mut service_data: serde_json::Value = service.unwrap().data;
    
    // Mettre à jour le produit dans produits.valeur[index]
    if let Some(produits) = service_data.get_mut("produits") {
        if let Some(valeur) = produits.get_mut("valeur") {
            if let Some(arr) = valeur.as_array_mut() {
                if payload.product_index >= 0 && (payload.product_index as usize) < arr.len() {
                    arr[payload.product_index as usize] = payload.updated_product.clone();
                    log::info!("✅ Produit modifié à l'index {}", payload.product_index);
                } else {
                    log::error!("❌ Index {} invalide (total: {})", payload.product_index, arr.len());
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

    log::info!("✅ Produit {} modifié avec succès (GRATUIT)", product_id);

    Ok(Json(ApiResponse {
        success: true,
        message: "Produit modifié avec succès (gratuit)".to_string(),
        data: None,
    }))
}


