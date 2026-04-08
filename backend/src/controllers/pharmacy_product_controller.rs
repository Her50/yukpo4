// ✅ NOUVEAU: Contrôleur pour produits de pharmacie

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::pharmacy_product_service::PharmacyProductService as Service;
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::{error, info};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use std::collections::HashMap;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct CreateProductRequest {
    pub pharmacy_service_id: i32,
    pub nom_produit: String,
    pub description: Option<String>,
    pub prix: Decimal,
    pub stock: i32,
    pub unite: String,
    pub code_barre: Option<String>,
    pub categorie: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProductRequest {
    pub nom_produit: Option<String>,
    pub description: Option<String>,
    pub prix: Option<Decimal>,
    pub stock: Option<i32>,
    pub code_barre: Option<String>,
    pub categorie: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SearchProductsQuery {
    pub query: Option<String>,
    pub categorie: Option<String>,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub radius_km: Option<f64>,
    pub min_price: Option<Decimal>,
    pub max_price: Option<Decimal>,
    pub only_available: Option<bool>,
    pub limit: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct NearbyMedicinesQuery {
    pub q: String,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub radius_km: Option<f64>,
    pub quantity: Option<i32>,
    pub max_price: Option<Decimal>,
    pub on_duty_only: Option<bool>,
    pub limit: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct CalculateBudgetRequest {
    pub items: Vec<BudgetItem>, // {product_id, quantity}
}

#[derive(Debug, Deserialize)]
pub struct BudgetItem {
    pub product_id: i32,
    pub quantity: i32,
}

/// POST /api/pharmacies/products
/// Créer un produit
pub async fn create_product(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateProductRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_product] User ID: {}, Pharmacy ID: {}",
        user_id, payload.pharmacy_service_id
    );

    // ✅ FIX 2026-04-08: Vérification de propriété élargie.
    // Ancienne version : vérifiait uniquement services.specialized_type = 'pharmacie',
    // ce qui bloquait les partenaires dont la pharmacie était créée avant d'appeler create_pharmacy
    // (le flag specialized_type n'était pas encore posé).
    // Nouvelle version : accepte si l'une OU l'autre condition est vraie.
    let is_owner: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS (
            -- Vérification via la table services (chemin normal)
            SELECT 1 FROM services
            WHERE id = $1 AND user_id = $2
              AND specialized_type = 'pharmacie'
            UNION ALL
            -- Vérification directe via pharmacies.user_id (partenaires validés sans service complet)
            SELECT 1 FROM pharmacies
            WHERE service_id = $1 AND user_id = $2
        )
        "#,
    )
    .bind(payload.pharmacy_service_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur vérification propriétaire: {}", e)))?;

    if !is_owner {
        error!(
            "[create_product] Accès refusé: user_id={} n'est pas propriétaire du service_id={}",
            user_id, payload.pharmacy_service_id
        );
        return Err(AppError::Forbidden(
            "Vous n'êtes pas propriétaire de cette pharmacie".to_string(),
        ));
    }

    let service = Service::new(Arc::new(state.pg.clone()));
    let product = service
        .create_product(
            payload.pharmacy_service_id,
            payload.nom_produit,
            payload.prix,
            payload.stock,
            payload.unite,
            payload.description,
            payload.code_barre,
            payload.categorie,
        )
        .await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({ "success": true, "product": product })),
    ))
}

/// GET /api/pharmacies/products/search
/// Rechercher des produits par nom ou catégorie
pub async fn search_products(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SearchProductsQuery>,
) -> AppResult<impl IntoResponse> {
    let q = params.query.as_deref().unwrap_or("").trim().to_string();
    let categorie = params.categorie.as_deref().map(|s| s.trim().to_lowercase());

    if q.is_empty() && categorie.is_none() {
        return Err(AppError::BadRequest(
            "Le paramètre query ou categorie est requis".to_string(),
        ));
    }

    info!("[search_products] query={:?} categorie={:?}", q, categorie);

    let service = Service::new(Arc::new(state.pg.clone()));
    // Si seulement catégorie sans nom, passer "*" comme wildcard
    let effective_query = if q.is_empty() { "".to_string() } else { q };
    let mut products = service
        .search_products(
            &effective_query,
            params.lat,
            params.lng,
            params.radius_km,
            params.min_price,
            params.max_price,
            params.only_available.unwrap_or(true),
            params.limit,
        )
        .await?;

    // Post-filtre par catégorie si fournie
    if let Some(ref cat) = categorie {
        products.retain(|p| {
            p.product
                .categorie
                .as_deref()
                .map(|c| c.to_lowercase().contains(cat.as_str()))
                .unwrap_or(false)
        });
    }

    Ok(Json(json!({ "success": true, "products": products })))
}

/// GET /api/medicines/nearby
/// Recherche unifiee "disponible + proche"
pub async fn search_nearby_medicines(
    State(state): State<Arc<AppState>>,
    Query(params): Query<NearbyMedicinesQuery>,
) -> AppResult<impl IntoResponse> {
    let q = params.q.trim();
    if q.is_empty() {
        return Err(AppError::BadRequest(
            "Le parametre q est requis".to_string(),
        ));
    }

    let service = Service::new(Arc::new(state.pg.clone()));
    let items = service
        .search_available_medicines_nearby(
            q,
            params.lat,
            params.lng,
            params.radius_km,
            params.quantity.unwrap_or(1),
            params.max_price,
            params.on_duty_only.unwrap_or(false),
            params.limit,
        )
        .await?;

    Ok(Json(json!({ "success": true, "items": items })))
}

/// POST /api/pharmacies/products/budget
/// Calculer le budget global
pub async fn calculate_budget(
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
    Json(payload): Json<CalculateBudgetRequest>,
) -> AppResult<impl IntoResponse> {
    info!("[calculate_budget] Items: {}", payload.items.len());

    let user_lat = params.get("lat").and_then(|s| s.parse::<f64>().ok());
    let user_lng = params.get("lng").and_then(|s| s.parse::<f64>().ok());

    let service = Service::new(Arc::new(state.pg.clone()));
    let items: Vec<(i32, i32)> =
        payload.items.into_iter().map(|item| (item.product_id, item.quantity)).collect();

    let comparison = service.calculate_budget(items, user_lat, user_lng).await?;

    Ok(Json(json!({ "success": true, "comparison": comparison })))
}

/// GET /api/pharmacies/:id/products
/// Récupérer les produits d'une pharmacie
pub async fn get_pharmacy_products(
    State(state): State<Arc<AppState>>,
    Path(pharmacy_service_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    let service = Service::new(Arc::new(state.pg.clone()));
    let products = service.get_products_by_pharmacy(pharmacy_service_id).await?;

    Ok(Json(json!({ "success": true, "products": products })))
}

/// PATCH /api/pharmacies/products/:id
/// Mettre à jour un produit
pub async fn update_product(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(product_id): Path<i32>,
    Json(payload): Json<UpdateProductRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[update_product] User ID: {}, Product ID: {}",
        user_id, product_id
    );

    // Récupérer le pharmacy_service_id du produit
    let pharmacy_service_id: i32 = sqlx::query_scalar(
        r#"
        SELECT pharmacy_service_id FROM pharmacy_products WHERE id = $1
        "#,
    )
    .bind(product_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération produit: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Produit non trouvé".to_string()))?;

    // Vérifier propriétaire
    let is_owner: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS (
            SELECT 1 FROM services
            WHERE id = $1 AND user_id = $2
        )
        "#,
    )
    .bind(pharmacy_service_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur vérification: {}", e)))?;

    if !is_owner {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas propriétaire".to_string(),
        ));
    }

    let service = Service::new(Arc::new(state.pg.clone()));
    let product = service
        .update_product(
            product_id,
            pharmacy_service_id,
            payload.nom_produit,
            payload.prix,
            payload.stock,
            payload.description,
            payload.code_barre,
            payload.categorie,
        )
        .await?;

    Ok(Json(json!({ "success": true, "product": product })))
}

/// POST /api/pharmacies/products/bulk-import
/// Import en masse de produits (CSV, JSON)
#[derive(Debug, Deserialize)]
pub struct BulkImportRequest {
    pub pharmacy_service_id: i32,
    pub products: Vec<BulkProductItem>,
    pub overwrite_existing: Option<bool>, // Si true, met à jour les produits existants
}

#[derive(Debug, Deserialize)]
pub struct BulkProductItem {
    pub nom_produit: String,
    pub description: Option<String>,
    pub prix: Decimal,
    pub stock: i32,
    pub unite: Option<String>,
    pub code_barre: Option<String>,
    pub categorie: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BulkImportResponse {
    pub success: bool,
    pub created: i32,
    pub updated: i32,
    pub errors: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct ExternalCatalogSyncRequest {
    pub pharmacy_service_id: i32,
    pub api_url: String,
    pub overwrite_existing: Option<bool>,
    pub items_path: Option<String>, // ex: "data.items"
    pub headers: Option<HashMap<String, String>>,
    pub auth_bearer_token: Option<String>,
    pub field_mapping: Option<HashMap<String, String>>,
}

/// POST /api/pharmacies/products/bulk-import
/// Import en masse de produits
pub async fn bulk_import_products(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<BulkImportRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[bulk_import_products] User ID: {}, Pharmacy ID: {}, Products: {}",
        user_id,
        payload.pharmacy_service_id,
        payload.products.len()
    );

    // Vérifier propriétaire
    let is_owner: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS (
            SELECT 1 FROM services
            WHERE id = $1 AND user_id = $2 AND specialized_type = 'pharmacie'
        )
        "#,
    )
    .bind(payload.pharmacy_service_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur vérification: {}", e)))?;

    if !is_owner {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas propriétaire de cette pharmacie".to_string(),
        ));
    }

    let service = Service::new(Arc::new(state.pg.clone()));
    let overwrite = payload.overwrite_existing.unwrap_or(false);
    let mut created = 0;
    let mut updated = 0;
    let mut errors = Vec::new();

    for (index, item) in payload.products.iter().enumerate() {
        match service
            .bulk_import_product(
                payload.pharmacy_service_id,
                item.nom_produit.clone(),
                item.prix,
                item.stock,
                item.unite.clone().unwrap_or_else(|| "unité".to_string()),
                item.description.clone(),
                item.code_barre.clone(),
                item.categorie.clone(),
                overwrite,
            )
            .await
        {
            Ok(result) => {
                if result.created {
                    created += 1;
                } else {
                    updated += 1;
                }
            }
            Err(e) => {
                errors.push(format!(
                    "Produit {} (ligne {}): {}",
                    item.nom_produit,
                    index + 1,
                    e
                ));
            }
        }
    }

    Ok(Json(json!({
        "success": errors.is_empty(),
        "created": created,
        "updated": updated,
        "errors": errors
    })))
}

fn extract_by_path<'a>(value: &'a serde_json::Value, path: &str) -> Option<&'a serde_json::Value> {
    let mut current = value;
    for segment in path.split('.').filter(|s| !s.trim().is_empty()) {
        current = current.get(segment)?;
    }
    Some(current)
}

/// POST /api/pharmacies/products/sync-external
/// Synchroniser le catalogue depuis une API externe JSON.
pub async fn sync_products_from_external_api(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<ExternalCatalogSyncRequest>,
) -> AppResult<impl IntoResponse> {
    let is_owner: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS (
            SELECT 1 FROM services
            WHERE id = $1 AND user_id = $2 AND specialized_type = 'pharmacie'
        )
        "#,
    )
    .bind(payload.pharmacy_service_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur vérification: {}", e)))?;

    if !is_owner {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas propriétaire de cette pharmacie".to_string(),
        ));
    }

    let mut req = reqwest::Client::new().get(payload.api_url.trim());
    if let Some(token) =
        payload.auth_bearer_token.as_ref().map(|v| v.trim()).filter(|v| !v.is_empty())
    {
        req = req.bearer_auth(token);
    }
    if let Some(headers) = &payload.headers {
        for (k, v) in headers {
            req = req.header(k, v);
        }
    }

    let upstream_json: serde_json::Value = req
        .send()
        .await
        .map_err(|e| AppError::BadRequest(format!("Erreur appel API externe: {}", e)))?
        .error_for_status()
        .map_err(|e| AppError::BadRequest(format!("API externe en erreur: {}", e)))?
        .json()
        .await
        .map_err(|e| AppError::BadRequest(format!("Réponse JSON invalide: {}", e)))?;

    let items_path = payload
        .items_path
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .unwrap_or("items");
    let items_value = extract_by_path(&upstream_json, items_path).unwrap_or(&upstream_json);
    let items = items_value.as_array().ok_or_else(|| {
        AppError::BadRequest(
            "Impossible de trouver la liste de produits dans la réponse API".to_string(),
        )
    })?;

    let mapping = payload.field_mapping.unwrap_or_default();
    let name_key = mapping.get("nom_produit").cloned().unwrap_or_else(|| "nom_produit".to_string());
    let price_key = mapping.get("prix").cloned().unwrap_or_else(|| "prix".to_string());
    let stock_key = mapping.get("stock").cloned().unwrap_or_else(|| "stock".to_string());
    let unit_key = mapping.get("unite").cloned().unwrap_or_else(|| "unite".to_string());
    let code_key = mapping.get("code_barre").cloned().unwrap_or_else(|| "code_barre".to_string());
    let category_key = mapping.get("categorie").cloned().unwrap_or_else(|| "categorie".to_string());
    let description_key =
        mapping.get("description").cloned().unwrap_or_else(|| "description".to_string());

    let service = Service::new(Arc::new(state.pg.clone()));
    let overwrite = payload.overwrite_existing.unwrap_or(false);
    let mut created = 0;
    let mut updated = 0;
    let mut errors: Vec<String> = Vec::new();

    for (idx, raw_item) in items.iter().enumerate() {
        let obj = match raw_item.as_object() {
            Some(v) => v,
            None => {
                errors.push(format!("Ligne {}: item non objet JSON", idx + 1));
                continue;
            }
        };

        let name = obj
            .get(&name_key)
            .and_then(|v| v.as_str())
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty());
        let Some(nom_produit) = name else {
            errors.push(format!("Ligne {}: nom_produit manquant", idx + 1));
            continue;
        };

        let price_dec = obj
            .get(&price_key)
            .and_then(|v| {
                v.as_f64()
                    .or_else(|| v.as_str().and_then(|s| s.replace(',', ".").parse::<f64>().ok()))
            })
            .and_then(Decimal::from_f64_retain)
            .unwrap_or(Decimal::ZERO);
        let stock = obj
            .get(&stock_key)
            .and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse::<i64>().ok())))
            .unwrap_or(0)
            .max(0) as i32;
        let unite = obj
            .get(&unit_key)
            .and_then(|v| v.as_str())
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty())
            .unwrap_or_else(|| "unité".to_string());
        let code_barre = obj.get(&code_key).and_then(|v| v.as_str()).map(|v| v.trim().to_string());
        let categorie =
            obj.get(&category_key).and_then(|v| v.as_str()).map(|v| v.trim().to_string());
        let description =
            obj.get(&description_key).and_then(|v| v.as_str()).map(|v| v.trim().to_string());

        match service
            .bulk_import_product(
                payload.pharmacy_service_id,
                nom_produit,
                price_dec,
                stock,
                unite,
                description,
                code_barre,
                categorie,
                overwrite,
            )
            .await
        {
            Ok(result) => {
                if result.created {
                    created += 1;
                } else {
                    updated += 1;
                }
            }
            Err(e) => errors.push(format!("Ligne {}: {}", idx + 1, e)),
        }
    }

    Ok(Json(json!({
        "success": errors.is_empty(),
        "created": created,
        "updated": updated,
        "errors": errors,
        "source_count": items.len()
    })))
}

/// DELETE /api/pharmacies/products/:id
/// Supprimer un produit
pub async fn delete_product(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(product_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[delete_product] User ID: {}, Product ID: {}",
        user_id, product_id
    );

    // Récupérer le pharmacy_service_id
    let pharmacy_service_id: i32 = sqlx::query_scalar(
        r#"
        SELECT pharmacy_service_id FROM pharmacy_products WHERE id = $1
        "#,
    )
    .bind(product_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Produit non trouvé".to_string()))?;

    // Vérifier propriétaire
    let is_owner: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS (
            SELECT 1 FROM services WHERE id = $1 AND user_id = $2
        )
        "#,
    )
    .bind(pharmacy_service_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    if !is_owner {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas propriétaire".to_string(),
        ));
    }

    let service = Service::new(Arc::new(state.pg.clone()));
    service.delete_product(product_id, pharmacy_service_id).await?;

    Ok(Json(
        json!({ "success": true, "message": "Produit supprimé" }),
    ))
}

/// GET /api/pharmacies/{id}/partner-orders
/// Partenaire : liste les commandes reçues pour sa pharmacie
pub async fn get_partner_orders(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(pharmacy_id): Path<i32>,
    Query(params): Query<HashMap<String, String>>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_partner_orders] pharmacy_id={}, user_id={}",
        pharmacy_id, user_id
    );

    // Vérifier propriété : la pharmacie appartient bien à cet utilisateur
    let is_owner: bool = sqlx::query_scalar(
        r#"SELECT EXISTS(SELECT 1 FROM pharmacies WHERE id = $1 AND user_id = $2)"#,
    )
    .bind(pharmacy_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur vérification: {}", e)))?;

    if !is_owner {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas propriétaire de cette pharmacie".to_string(),
        ));
    }

    let status_filter = params.get("status").cloned();
    let page: i64 = params.get("page").and_then(|v| v.parse().ok()).unwrap_or(1).max(1);
    let limit: i64 = params.get("limit").and_then(|v| v.parse().ok()).unwrap_or(20).min(100);
    let offset = (page - 1) * limit;

    let rows = if let Some(ref s) = status_filter {
        sqlx::query(
            r#"
            SELECT o.id::text, o.user_id, o.status, o.total_amount, o.delivery_method,
                   o.delivery_address, o.created_at, o.updated_at,
                   COALESCE(u.nom_complet, CONCAT(u.prenom, ' ', u.nom), u.email) as user_name, u.phone as user_phone,
                   (
                       SELECT json_agg(json_build_object(
                           'id', i.id, 'medication_name', i.medication_name,
                           'quantity', i.quantity, 'unit_price', i.unit_price
                       ))
                       FROM pharmacy_order_items i WHERE i.order_id = o.id
                   ) as items
            FROM pharmacy_orders o
            LEFT JOIN users u ON u.id = o.user_id
            WHERE o.pharmacy_id = $1 AND o.status = $2
            ORDER BY o.created_at DESC
            LIMIT $3 OFFSET $4
            "#,
        )
        .bind(pharmacy_id)
        .bind(s)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur liste commandes: {}", e)))?
    } else {
        sqlx::query(
            r#"
            SELECT o.id::text, o.user_id, o.status, o.total_amount, o.delivery_method,
                   o.delivery_address, o.created_at, o.updated_at,
                   COALESCE(u.nom_complet, CONCAT(u.prenom, ' ', u.nom), u.email) as user_name, u.phone as user_phone,
                   (
                       SELECT json_agg(json_build_object(
                           'id', i.id, 'medication_name', i.medication_name,
                           'quantity', i.quantity, 'unit_price', i.unit_price
                       ))
                       FROM pharmacy_order_items i WHERE i.order_id = o.id
                   ) as items
            FROM pharmacy_orders o
            LEFT JOIN users u ON u.id = o.user_id
            WHERE o.pharmacy_id = $1
            ORDER BY o.created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(pharmacy_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur liste commandes: {}", e)))?
    };

    let orders: Vec<serde_json::Value> = rows.iter().map(|row| {
        json!({
            "id": row.try_get::<String, _>("id").unwrap_or_default(),
            "user_id": row.try_get::<i32, _>("user_id").unwrap_or(0),
            "user_name": row.try_get::<Option<String>, _>("user_name").ok().flatten(),
            "user_phone": row.try_get::<Option<String>, _>("user_phone").ok().flatten(),
            "status": row.try_get::<String, _>("status").unwrap_or_default(),
            "total_amount": row.try_get::<rust_decimal::Decimal, _>("total_amount").ok().map(|d| d.to_string()),
            "delivery_method": row.try_get::<String, _>("delivery_method").unwrap_or_default(),
            "delivery_address": row.try_get::<Option<String>, _>("delivery_address").ok().flatten(),
            "items": row.try_get::<Option<serde_json::Value>, _>("items").ok().flatten(),
            "created_at": row.try_get::<chrono::DateTime<chrono::Utc>, _>("created_at").ok().map(|d| d.to_rfc3339()),
            "updated_at": row.try_get::<chrono::DateTime<chrono::Utc>, _>("updated_at").ok().map(|d| d.to_rfc3339()),
        })
    }).collect();

    Ok(Json(
        json!({ "success": true, "orders": orders, "page": page, "limit": limit }),
    ))
}

#[derive(Debug, Deserialize)]
pub struct UpdateOrderStatusRequest {
    pub status: String, // 'confirmed' | 'processing' | 'ready' | 'delivered' | 'cancelled'
    pub note: Option<String>,
}

/// PATCH /api/pharmacies/orders/{order_id}/status
/// Partenaire : mettre à jour le statut d'une commande
pub async fn update_pharmacy_order_status(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(order_id): Path<String>,
    Json(payload): Json<UpdateOrderStatusRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[update_pharmacy_order_status] order_id={}, user_id={}, status={}",
        order_id, user_id, payload.status
    );

    let valid_statuses = ["confirmed", "processing", "ready", "delivered", "cancelled"];
    if !valid_statuses.contains(&payload.status.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Statut invalide. Valeurs acceptées: {}",
            valid_statuses.join(", ")
        )));
    }

    // Vérifier que la commande appartient à une pharmacie que l'utilisateur possède
    let pharmacy_id: Option<i32> = sqlx::query_scalar(
        r#"
        SELECT o.pharmacy_id FROM pharmacy_orders o
        JOIN pharmacies p ON p.id = o.pharmacy_id
        WHERE o.id = $1::uuid AND p.user_id = $2
        "#,
    )
    .bind(&order_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur vérification: {}", e)))?;

    if pharmacy_id.is_none() {
        return Err(AppError::Forbidden(
            "Commande non trouvée ou accès non autorisé".to_string(),
        ));
    }

    let mut metadata_update = String::new();
    if let Some(ref note) = payload.note {
        metadata_update = format!(
            ", metadata = metadata || '{{\"partner_note\": \"{}\"}}'::jsonb",
            note.replace('"', "\\\"")
        );
    }

    let sql = format!(
        r#"
        UPDATE pharmacy_orders
        SET status = $1, updated_at = NOW(){}
        WHERE id = $2::uuid
        RETURNING id::text, status, updated_at
        "#,
        metadata_update
    );

    let row = sqlx::query(&sql)
        .bind(&payload.status)
        .bind(&order_id)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur mise à jour: {}", e)))?;

    Ok(Json(json!({
        "success": true,
        "order_id": row.try_get::<String, _>("id").unwrap_or_default(),
        "status": row.try_get::<String, _>("status").unwrap_or_default(),
        "message": "Statut de commande mis à jour"
    })))
}

// ─────────────────────────────────────────────────────────────────────────────
// Ordonnance IA : extraction + recherche pharmacies par matching
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, serde::Deserialize)]
pub struct ExtractOrdonnanceRequest {
    pub image_base64: String,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
}

#[derive(Debug, serde::Deserialize)]
pub struct MedicationSearchItem {
    pub name: String,
    pub quantity: Option<i32>,
}

#[derive(Debug, serde::Deserialize)]
pub struct SearchByMedicationsRequest {
    pub medications: Vec<MedicationSearchItem>,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub radius_km: Option<f64>,
}

/// POST /api/pharmacies/ai/extract-ordonnance (PUBLIC)
/// Envoie une image d'ordonnance à l'IA et retourne les médicaments extraits
pub async fn extract_ordonnance(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ExtractOrdonnanceRequest>,
) -> AppResult<impl IntoResponse> {
    use crate::services::pharmacy_ai_service::PharmacyAIService;

    if payload.image_base64.is_empty() {
        return Err(AppError::BadRequest("image_base64 est requis".to_string()));
    }

    let ai_service = PharmacyAIService::new(state.ia.clone());
    let medications = ai_service
        .extract_ordonnance_medications(&payload.image_base64, payload.lat, payload.lng)
        .await?;

    log::info!(
        "[extract_ordonnance] {} médicament(s) extraits",
        medications.len()
    );

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "medications": medications,
            "count": medications.len()
        })),
    ))
}

/// POST /api/pharmacies/search-by-medications (PUBLIC)
/// Recherche les pharmacies qui ont les médicaments de l'ordonnance
/// Retourne un score de complétude et trie par (matching_score DESC, distance ASC)
///
/// Stratégie SQL :
/// - $1 = total_requested (i64)
/// - $2 = user_lat (f64 nullable) — toujours bindé, même si NULL
/// - $3 = user_lng (f64 nullable) — toujours bindé, même si NULL
/// - $4 … $N = patterns ILIKE pour chaque médicament
/// - $N+1 = radius_km (f64 nullable, optionnel)
///
/// Le haversine retourne NULL quand lat/lng sont NULL, donc le filtre radius ne s'applique pas.
pub async fn search_by_medications(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<SearchByMedicationsRequest>,
) -> AppResult<impl IntoResponse> {
    if payload.medications.is_empty() {
        return Err(AppError::BadRequest(
            "medications ne peut pas être vide".to_string(),
        ));
    }

    let total_requested = payload.medications.len() as i64;
    let med_names: Vec<String> = payload.medications.iter().map(|m| m.name.clone()).collect();
    let n = med_names.len();

    // Expressions EXISTS pour chaque médicament (params $4…$N)
    // Retourne 1/0 pour le comptage ET une colonne booléenne distincte par médicament
    // pour exposer medications_availability[] à la réponse JSON.
    let exists_cases: String = (0..n)
        .map(|i| {
            format!(
                "(CASE WHEN EXISTS (
                    SELECT 1 FROM pharmacy_products pp2
                    WHERE pp2.pharmacy_service_id = p.service_id
                      AND pp2.nom_produit ILIKE ${}
                      AND pp2.disponible = true
                      AND pp2.stock > 0
                ) THEN 1 ELSE 0 END)",
                i + 4
            )
        })
        .collect::<Vec<_>>()
        .join(" + ");

    // Colonnes booléennes individuelles — med_avail_0, med_avail_1, …
    let med_avail_cols: String = (0..n)
        .map(|i| {
            format!(
                "(CASE WHEN EXISTS (
                    SELECT 1 FROM pharmacy_products pp2
                    WHERE pp2.pharmacy_service_id = p.service_id
                      AND pp2.nom_produit ILIKE ${}
                      AND pp2.disponible = true
                      AND pp2.stock > 0
                ) THEN true ELSE false END) AS med_avail_{}",
                i + 4,
                i
            )
        })
        .collect::<Vec<_>>()
        .join(",\n                ");

    // Filtre rayon optionnel — paramètre $(n+4)
    let radius_param = n + 4;
    let radius_filter = if payload.radius_km.is_some() {
        format!(
            "AND (distance_km IS NULL OR distance_km <= ${})",
            radius_param
        )
    } else {
        String::new()
    };

    let sql = format!(
        r#"
        WITH pharmacy_scores AS (
            SELECT
                p.id,
                p.service_id,
                p.user_id,
                p.nom,
                p.ville,
                p.quartier,
                p.telephone,
                p.is_on_duty_now,
                CASE
                    WHEN $2::float8 IS NOT NULL AND $3::float8 IS NOT NULL
                         AND s.gps IS NOT NULL
                         AND s.gps::jsonb->>'lat' IS NOT NULL
                         AND s.gps::jsonb->>'lng' IS NOT NULL
                    THEN 6371.0 * acos(
                        LEAST(1.0,
                            cos(radians($2)) * cos(radians((s.gps::jsonb->>'lat')::float8))
                            * cos(radians((s.gps::jsonb->>'lng')::float8) - radians($3))
                            + sin(radians($2)) * sin(radians((s.gps::jsonb->>'lat')::float8))
                        )
                    )
                    ELSE NULL
                END AS distance_km,
                ({exists_cases}) AS available_count,
                {med_avail_cols}
            FROM pharmacies p
            JOIN services s ON s.id = p.service_id
            WHERE p.is_active = true
        )
        SELECT
            id, service_id, user_id, nom, ville, quartier, telephone,
            is_on_duty_now, distance_km, available_count,
            {med_avail_select}
            CASE
                WHEN available_count >= $1 THEN 100
                WHEN available_count = 0   THEN 0
                ELSE (available_count * 100 / $1)
            END AS matching_score
        FROM pharmacy_scores
        WHERE available_count > 0
        {radius_filter}
        ORDER BY matching_score DESC, distance_km ASC NULLS LAST
        LIMIT 30
        "#,
        exists_cases = exists_cases,
        med_avail_cols = med_avail_cols,
        med_avail_select =
            (0..n).map(|i| format!("med_avail_{},", i)).collect::<Vec<_>>().join(" "),
        radius_filter = radius_filter,
    );

    // Binding dans l'ordre strict : $1, $2, $3, $4…$N, [$N+1]
    let mut query = sqlx::query(&sql)
        .bind(total_requested) // $1
        .bind(payload.lat) // $2 (Option<f64>)
        .bind(payload.lng); // $3 (Option<f64>)

    for name in &med_names {
        query = query.bind(format!("%{}%", name)); // $4 … $N
    }

    if let Some(r) = payload.radius_km {
        query = query.bind(r); // $N+1
    }

    let rows = query.fetch_all(&state.pg).await.map_err(|e| {
        log::error!("[search_by_medications] Erreur SQL: {}", e);
        AppError::Internal(format!("Erreur recherche pharmacies: {}", e))
    })?;

    let pharmacies: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            let available_count: i64 = row.try_get("available_count").unwrap_or(0);
            let matching_score: i64 = row.try_get("matching_score").unwrap_or(0);
            let distance_km: Option<f64> = row.try_get("distance_km").ok().flatten();

            let matching_label = if matching_score >= 100 {
                "Matching 100%".to_string()
            } else {
                format!(
                    "{}/{} méd. ({}%)",
                    available_count, total_requested, matching_score
                )
            };

            // Disponibilité par médicament — colonne med_avail_i générée dynamiquement
            let medications_availability: Vec<serde_json::Value> = med_names
                .iter()
                .enumerate()
                .map(|(i, name)| {
                    let col = format!("med_avail_{}", i);
                    let avail: bool = row.try_get(col.as_str()).unwrap_or(false);
                    json!({ "name": name, "available": avail })
                })
                .collect();

            json!({
                "id": row.try_get::<i32, _>("id").unwrap_or(0),
                "service_id": row.try_get::<i32, _>("service_id").unwrap_or(0),
                "user_id": row.try_get::<i32, _>("user_id").unwrap_or(0),
                "nom": row.try_get::<String, _>("nom").unwrap_or_default(),
                "ville": row.try_get::<Option<String>, _>("ville").ok().flatten(),
                "quartier": row.try_get::<Option<String>, _>("quartier").ok().flatten(),
                "telephone": row.try_get::<Option<String>, _>("telephone").ok().flatten(),
                "is_on_duty_now": row.try_get::<bool, _>("is_on_duty_now").unwrap_or(false),
                "is_available_now": true,
                "distance_km": distance_km,
                "available_count": available_count,
                "total_requested": total_requested,
                "matching_score": matching_score,
                "matching_label": matching_label,
                // Liste précise des médicaments disponibles / manquants par pharmacie
                "medications_availability": medications_availability,
            })
        })
        .collect();

    log::info!(
        "[search_by_medications] {} pharmacie(s) pour {} médicament(s) demandé(s)",
        pharmacies.len(),
        total_requested
    );

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "pharmacies": pharmacies,
            "total_medications_requested": total_requested,
            "count": pharmacies.len()
        })),
    ))
}
