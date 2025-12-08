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
use log::info;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::json;
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
    pub query: String,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub radius_km: Option<f64>,
    pub min_price: Option<Decimal>,
    pub max_price: Option<Decimal>,
    pub only_available: Option<bool>,
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

    // Vérifier que l'utilisateur est propriétaire de la pharmacie
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
    .map_err(|e| AppError::Internal(format!("Erreur vérification propriétaire: {}", e)))?;

    if !is_owner {
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
/// Rechercher des produits
pub async fn search_products(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SearchProductsQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[search_products] Query: {}", params.query);

    let service = Service::new(Arc::new(state.pg.clone()));
    let products = service
        .search_products(
            &params.query,
            params.lat,
            params.lng,
            params.radius_km,
            params.min_price,
            params.max_price,
            params.only_available.unwrap_or(true),
            params.limit,
        )
        .await?;

    Ok(Json(json!({ "success": true, "products": products })))
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
    let items: Vec<(i32, i32)> = payload
        .items
        .into_iter()
        .map(|item| (item.product_id, item.quantity))
        .collect();

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
    let products = service
        .get_products_by_pharmacy(pharmacy_service_id)
        .await?;

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
    service
        .delete_product(product_id, pharmacy_service_id)
        .await?;

    Ok(Json(
        json!({ "success": true, "message": "Produit supprimé" }),
    ))
}
