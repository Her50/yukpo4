//! ✅ Contrôleur pour service Supermarché dédié
//!
//! Endpoints pour :
//! - Récupérer les produits d'un supermarché
//! - Rechercher des produits dans tous les supermarchés
//! - Comparer les prix d'un produit entre supermarchés
//! - Récupérer les promotions
//! - Récupérer les catégories
//! - Récupérer les produits tendances

use crate::core::types::{AppError, AppResult};
use crate::state::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::{error, info};
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;

// ═══════════════════════════════════════════════════════════════
// 1. PRODUITS D'UN SUPERMARCHÉ
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ProductsQuery {
    pub query: Option<String>,
    pub category: Option<String>,
    pub min_price: Option<f64>,
    pub max_price: Option<f64>,
    pub on_promotion: Option<bool>,
    pub in_stock: Option<bool>,
    pub page: Option<i32>,
    pub limit: Option<i32>,
}

/// GET /api/supermarkets/{id}/products
pub async fn get_supermarket_products(
    State(state): State<Arc<AppState>>,
    Path(supermarket_id): Path<i32>,
    Query(query): Query<ProductsQuery>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_supermarket_products] Produits supermarché id={}",
        supermarket_id
    );

    let limit = query.limit.unwrap_or(50).min(100);
    let page = query.page.unwrap_or(1).max(1);
    let offset = (page - 1) * limit;

    let rows = sqlx::query(
        r#"
        SELECT sp.id, sp.data, sp.prix, sp.nom, sp.description, sp.images,
               sp.is_active, sp.created_at,
               s.data as service_data
        FROM service_products sp
        INNER JOIN services s ON s.id = sp.service_id
        WHERE sp.service_id = $1 AND sp.is_active = true
        ORDER BY sp.id DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(supermarket_id)
    .bind(limit as i64)
    .bind(offset as i64)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_supermarket_products] Erreur SQL: {}", e);
        AppError::Internal(format!("Erreur chargement produits: {}", e))
    })?;

    let mut products = Vec::new();
    for row in &rows {
        let id: i32 = row.get("id");
        let nom: Option<String> = row.try_get("nom").ok();
        let description: Option<String> = row.try_get("description").ok();
        let prix: Option<f64> = row
            .try_get::<Option<rust_decimal::Decimal>, _>("prix")
            .ok()
            .flatten()
            .and_then(|d| d.to_string().parse::<f64>().ok());
        let data: serde_json::Value = row.try_get("data").unwrap_or(json!({}));
        let images: Option<serde_json::Value> = row.try_get("images").ok();

        let name = nom.unwrap_or_else(|| {
            data.get("nom").and_then(|v| v.as_str()).unwrap_or("Produit").to_string()
        });
        let desc = description
            .or_else(|| data.get("description").and_then(|v| v.as_str()).map(|s| s.to_string()));
        let category = data
            .get("categorie")
            .or_else(|| data.get("category"))
            .and_then(|v| v.as_str())
            .unwrap_or("autres")
            .to_string();
        let price =
            prix.unwrap_or_else(|| data.get("prix").and_then(|v| v.as_f64()).unwrap_or(0.0));
        let is_promotion = data.get("en_promotion").and_then(|v| v.as_bool()).unwrap_or(false);
        let original_price = if is_promotion {
            data.get("prix_original").and_then(|v| v.as_f64())
        } else {
            None
        };
        let brand = data.get("marque").and_then(|v| v.as_str()).map(|s| s.to_string());
        let unit = data.get("unite").and_then(|v| v.as_str()).map(|s| s.to_string());
        let stock = data.get("stock").and_then(|v| v.as_i64());

        // Apply filters
        if let Some(ref q) = query.query {
            let q_lower = q.to_lowercase();
            if !name.to_lowercase().contains(&q_lower)
                && !desc.as_deref().unwrap_or("").to_lowercase().contains(&q_lower)
                && !category.to_lowercase().contains(&q_lower)
            {
                continue;
            }
        }
        if let Some(ref cat) = query.category {
            if !category.to_lowercase().contains(&cat.to_lowercase()) {
                continue;
            }
        }
        if let Some(min) = query.min_price {
            if price < min {
                continue;
            }
        }
        if let Some(max) = query.max_price {
            if price > max {
                continue;
            }
        }
        if query.on_promotion == Some(true) && !is_promotion {
            continue;
        }

        let image_url = extract_first_image(&images, &data);

        products.push(json!({
            "id": id.to_string(),
            "name": name,
            "description": desc,
            "price": price,
            "original_price": original_price,
            "currency": "XAF",
            "image_url": image_url,
            "category": category,
            "brand": brand,
            "unit": unit,
            "is_promotion": is_promotion,
            "stock_status": if stock.unwrap_or(1) > 0 { "in_stock" } else { "out_of_stock" },
            "supermarket_id": supermarket_id,
            "supermarket_name": ""
        }));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "products": products,
            "total": products.len()
        })),
    ))
}

// ═══════════════════════════════════════════════════════════════
// 2. RECHERCHE DE PRODUITS GLOBALE
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct SearchProductsQuery {
    pub query: Option<String>,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub radius_km: Option<f64>,
}

/// GET /api/supermarkets/products/search
pub async fn search_products(
    State(state): State<Arc<AppState>>,
    Query(query): Query<SearchProductsQuery>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[search_products] Recherche produits: query={:?}",
        query.query
    );

    let search_term = query.query.unwrap_or_default();
    if search_term.is_empty() {
        return Ok((
            StatusCode::OK,
            Json(json!({ "success": true, "products": [], "total": 0 })),
        ));
    }

    let rows = sqlx::query(
        r#"
        SELECT sp.id, sp.data, sp.prix, sp.nom, sp.description, sp.images,
               sp.service_id, s.data as service_data
        FROM service_products sp
        INNER JOIN services s ON s.id = sp.service_id
        WHERE sp.is_active = true
          AND (s.category ILIKE '%supermarche%' OR s.category ILIKE '%supermarket%'
               OR s.category ILIKE '%epicerie%' OR s.category ILIKE '%alimentation%')
          AND (sp.nom ILIKE $1 OR sp.description ILIKE $1
               OR sp.data::text ILIKE $1)
        ORDER BY sp.id DESC
        LIMIT 50
        "#,
    )
    .bind(format!("%{}%", search_term))
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[search_products] Erreur SQL: {}", e);
        AppError::Internal(format!("Erreur recherche produits: {}", e))
    })?;

    let mut products = Vec::new();
    for row in &rows {
        let id: i32 = row.get("id");
        let service_id: i32 = row.get("service_id");
        let nom: Option<String> = row.try_get("nom").ok();
        let description: Option<String> = row.try_get("description").ok();
        let prix: Option<f64> = row
            .try_get::<Option<rust_decimal::Decimal>, _>("prix")
            .ok()
            .flatten()
            .and_then(|d| d.to_string().parse::<f64>().ok());
        let data: serde_json::Value = row.try_get("data").unwrap_or(json!({}));
        let images: Option<serde_json::Value> = row.try_get("images").ok();
        let service_data: serde_json::Value = row.try_get("service_data").unwrap_or(json!({}));

        let name = nom.unwrap_or_else(|| {
            data.get("nom").and_then(|v| v.as_str()).unwrap_or("Produit").to_string()
        });
        let price =
            prix.unwrap_or_else(|| data.get("prix").and_then(|v| v.as_f64()).unwrap_or(0.0));
        let category =
            data.get("categorie").and_then(|v| v.as_str()).unwrap_or("autres").to_string();
        let is_promotion = data.get("en_promotion").and_then(|v| v.as_bool()).unwrap_or(false);
        let supermarket_name = service_data
            .get("titre_service")
            .or_else(|| service_data.get("nom"))
            .and_then(|v| v.as_str())
            .unwrap_or("Supermarché")
            .to_string();
        let image_url = extract_first_image(&images, &data);

        products.push(json!({
            "id": id.to_string(),
            "name": name,
            "description": description,
            "price": price,
            "currency": "XAF",
            "image_url": image_url,
            "category": category,
            "is_promotion": is_promotion,
            "supermarket_id": service_id,
            "supermarket_name": supermarket_name
        }));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "products": products,
            "total": products.len()
        })),
    ))
}

// ═══════════════════════════════════════════════════════════════
// 3. COMPARAISON DE PRIX
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ComparePricesRequest {
    pub product_name: String,
    pub product_id: Option<String>,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub radius_km: Option<f64>,
}

/// POST /api/supermarkets/compare-prices
pub async fn compare_prices(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ComparePricesRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[compare_prices] Comparaison prix: product={}",
        request.product_name
    );

    let rows = sqlx::query(
        r#"
        SELECT sp.id, sp.data, sp.prix, sp.nom, sp.description, sp.images,
               sp.service_id, s.data as service_data
        FROM service_products sp
        INNER JOIN services s ON s.id = sp.service_id
        WHERE sp.is_active = true
          AND (s.category ILIKE '%supermarche%' OR s.category ILIKE '%supermarket%'
               OR s.category ILIKE '%epicerie%' OR s.category ILIKE '%alimentation%')
          AND (sp.nom ILIKE $1 OR sp.data::text ILIKE $1)
        ORDER BY sp.prix ASC NULLS LAST
        LIMIT 20
        "#,
    )
    .bind(format!("%{}%", request.product_name))
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[compare_prices] Erreur SQL: {}", e);
        AppError::Internal(format!("Erreur comparaison prix: {}", e))
    })?;

    if rows.is_empty() {
        return Ok((
            StatusCode::OK,
            Json(json!({ "success": false, "message": "Aucun produit trouvé" })),
        ));
    }

    let mut supermarkets = Vec::new();
    let mut prices: Vec<f64> = Vec::new();

    for row in &rows {
        let id: i32 = row.get("id");
        let service_id: i32 = row.get("service_id");
        let nom: Option<String> = row.try_get("nom").ok();
        let prix: Option<f64> = row
            .try_get::<Option<rust_decimal::Decimal>, _>("prix")
            .ok()
            .flatten()
            .and_then(|d| d.to_string().parse::<f64>().ok());
        let data: serde_json::Value = row.try_get("data").unwrap_or(json!({}));
        let images: Option<serde_json::Value> = row.try_get("images").ok();
        let service_data: serde_json::Value = row.try_get("service_data").unwrap_or(json!({}));

        let name = nom.unwrap_or_else(|| {
            data.get("nom").and_then(|v| v.as_str()).unwrap_or("Produit").to_string()
        });
        let price =
            prix.unwrap_or_else(|| data.get("prix").and_then(|v| v.as_f64()).unwrap_or(0.0));
        let supermarket_name = service_data
            .get("titre_service")
            .or_else(|| service_data.get("nom"))
            .and_then(|v| v.as_str())
            .unwrap_or("Supermarché")
            .to_string();
        let category =
            data.get("categorie").and_then(|v| v.as_str()).unwrap_or("autres").to_string();
        let is_promotion = data.get("en_promotion").and_then(|v| v.as_bool()).unwrap_or(false);
        let image_url = extract_first_image(&images, &data);

        prices.push(price);

        supermarkets.push(json!({
            "supermarket_id": service_id,
            "supermarket_name": supermarket_name,
            "product": {
                "id": id.to_string(),
                "name": name,
                "price": price,
                "currency": "XAF",
                "image_url": image_url,
                "category": category,
                "is_promotion": is_promotion,
                "supermarket_id": service_id,
                "supermarket_name": supermarket_name
            }
        }));
    }

    let min_price = prices.iter().cloned().fold(f64::INFINITY, f64::min);
    let max_price = prices.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let avg_price = if !prices.is_empty() {
        prices.iter().sum::<f64>() / prices.len() as f64
    } else {
        0.0
    };

    let cheapest = supermarkets.first().cloned().unwrap_or(json!({}));

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "comparison": {
                "product_name": request.product_name,
                "category": "general",
                "supermarkets": supermarkets,
                "cheapest": {
                    "supermarket_id": cheapest.get("supermarket_id"),
                    "supermarket_name": cheapest.get("supermarket_name"),
                    "price": min_price
                },
                "average_price": avg_price,
                "price_range": {
                    "min": min_price,
                    "max": max_price
                }
            }
        })),
    ))
}

// ═══════════════════════════════════════════════════════════════
// 4. PROMOTIONS
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct PromotionsQuery {
    pub active_only: Option<bool>,
}

/// GET /api/supermarkets/{id}/promotions
pub async fn get_supermarket_promotions(
    State(state): State<Arc<AppState>>,
    Path(supermarket_id): Path<i32>,
    Query(_query): Query<PromotionsQuery>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_supermarket_promotions] Promotions supermarché id={}",
        supermarket_id
    );

    let rows = sqlx::query(
        r#"
        SELECT sp.id, sp.data, sp.prix, sp.nom, sp.description, sp.images
        FROM service_products sp
        WHERE sp.service_id = $1 AND sp.is_active = true
          AND (sp.data->>'en_promotion' = 'true' OR sp.data->>'is_promotion' = 'true')
        ORDER BY sp.id DESC
        LIMIT 50
        "#,
    )
    .bind(supermarket_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_supermarket_promotions] Erreur SQL: {}", e);
        AppError::Internal(format!("Erreur chargement promotions: {}", e))
    })?;

    let mut promotions = Vec::new();
    for row in &rows {
        let id: i32 = row.get("id");
        let nom: Option<String> = row.try_get("nom").ok();
        let data: serde_json::Value = row.try_get("data").unwrap_or(json!({}));
        let prix: Option<f64> = row
            .try_get::<Option<rust_decimal::Decimal>, _>("prix")
            .ok()
            .flatten()
            .and_then(|d| d.to_string().parse::<f64>().ok());
        let images: Option<serde_json::Value> = row.try_get("images").ok();

        let name = nom.unwrap_or_else(|| {
            data.get("nom").and_then(|v| v.as_str()).unwrap_or("Promo").to_string()
        });
        let price =
            prix.unwrap_or_else(|| data.get("prix").and_then(|v| v.as_f64()).unwrap_or(0.0));
        let discount = data.get("reduction_pourcent").and_then(|v| v.as_f64());
        let image_url = extract_first_image(&images, &data);

        promotions.push(json!({
            "id": id.to_string(),
            "title": name,
            "discount_percentage": discount,
            "products": [{
                "id": id.to_string(),
                "name": name,
                "price": price,
                "currency": "XAF",
                "image_url": image_url,
                "is_promotion": true,
                "supermarket_id": supermarket_id
            }],
            "supermarket_id": supermarket_id,
            "image_url": image_url
        }));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "promotions": promotions,
            "total": promotions.len()
        })),
    ))
}

// ═══════════════════════════════════════════════════════════════
// 5. PROMOTIONS À PROXIMITÉ
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct NearbyPromotionsQuery {
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub radius_km: Option<f64>,
}

/// GET /api/supermarkets/promotions/nearby
pub async fn get_nearby_promotions(
    State(state): State<Arc<AppState>>,
    Query(_query): Query<NearbyPromotionsQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[get_nearby_promotions] Promotions à proximité");

    let rows = sqlx::query(
        r#"
        SELECT sp.id, sp.data, sp.prix, sp.nom, sp.description, sp.images,
               sp.service_id, s.data as service_data
        FROM service_products sp
        INNER JOIN services s ON s.id = sp.service_id
        WHERE sp.is_active = true
          AND (s.category ILIKE '%supermarche%' OR s.category ILIKE '%supermarket%'
               OR s.category ILIKE '%epicerie%' OR s.category ILIKE '%alimentation%')
          AND (sp.data->>'en_promotion' = 'true' OR sp.data->>'is_promotion' = 'true')
        ORDER BY sp.id DESC
        LIMIT 30
        "#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_nearby_promotions] Erreur SQL: {}", e);
        AppError::Internal(format!("Erreur chargement promotions: {}", e))
    })?;

    let mut promotions = Vec::new();
    for row in &rows {
        let id: i32 = row.get("id");
        let service_id: i32 = row.get("service_id");
        let nom: Option<String> = row.try_get("nom").ok();
        let data: serde_json::Value = row.try_get("data").unwrap_or(json!({}));
        let prix: Option<f64> = row
            .try_get::<Option<rust_decimal::Decimal>, _>("prix")
            .ok()
            .flatten()
            .and_then(|d| d.to_string().parse::<f64>().ok());
        let images: Option<serde_json::Value> = row.try_get("images").ok();
        let service_data: serde_json::Value = row.try_get("service_data").unwrap_or(json!({}));

        let name = nom.unwrap_or_else(|| {
            data.get("nom").and_then(|v| v.as_str()).unwrap_or("Promo").to_string()
        });
        let price =
            prix.unwrap_or_else(|| data.get("prix").and_then(|v| v.as_f64()).unwrap_or(0.0));
        let supermarket_name = service_data
            .get("titre_service")
            .or_else(|| service_data.get("nom"))
            .and_then(|v| v.as_str())
            .unwrap_or("Supermarché")
            .to_string();
        let image_url = extract_first_image(&images, &data);

        promotions.push(json!({
            "id": id.to_string(),
            "title": name,
            "products": [{
                "id": id.to_string(),
                "name": name,
                "price": price,
                "currency": "XAF",
                "image_url": image_url,
                "is_promotion": true,
                "supermarket_id": service_id,
                "supermarket_name": supermarket_name
            }],
            "supermarket_id": service_id,
            "supermarket_name": supermarket_name,
            "image_url": image_url
        }));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "promotions": promotions,
            "total": promotions.len()
        })),
    ))
}

// ═══════════════════════════════════════════════════════════════
// 6. CATÉGORIES
// ═══════════════════════════════════════════════════════════════

/// GET /api/supermarkets/{id}/categories
pub async fn get_supermarket_categories(
    State(state): State<Arc<AppState>>,
    Path(supermarket_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_supermarket_categories] Catégories supermarché id={}",
        supermarket_id
    );

    let rows = sqlx::query(
        r#"
        SELECT DISTINCT
            COALESCE(sp.data->>'categorie', sp.data->>'category', 'autres') as category
        FROM service_products sp
        WHERE sp.service_id = $1 AND sp.is_active = true
        ORDER BY category
        "#,
    )
    .bind(supermarket_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_supermarket_categories] Erreur SQL: {}", e);
        AppError::Internal(format!("Erreur chargement catégories: {}", e))
    })?;

    let categories: Vec<String> = rows
        .iter()
        .filter_map(|row| row.try_get::<String, _>("category").ok())
        .collect();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "categories": categories
        })),
    ))
}

// ═══════════════════════════════════════════════════════════════
// 7. PRODUITS TENDANCES
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct TrendingQuery {
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub radius_km: Option<f64>,
}

/// GET /api/supermarkets/products/trending
pub async fn get_trending_products(
    State(state): State<Arc<AppState>>,
    Query(_query): Query<TrendingQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[get_trending_products] Produits tendances");

    let rows = sqlx::query(
        r#"
        SELECT sp.id, sp.data, sp.prix, sp.nom, sp.description, sp.images,
               sp.service_id, s.data as service_data
        FROM service_products sp
        INNER JOIN services s ON s.id = sp.service_id
        WHERE sp.is_active = true
          AND (s.category ILIKE '%supermarche%' OR s.category ILIKE '%supermarket%'
               OR s.category ILIKE '%epicerie%' OR s.category ILIKE '%alimentation%')
        ORDER BY sp.id DESC
        LIMIT 20
        "#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_trending_products] Erreur SQL: {}", e);
        AppError::Internal(format!("Erreur chargement tendances: {}", e))
    })?;

    let mut products = Vec::new();
    for row in &rows {
        let id: i32 = row.get("id");
        let service_id: i32 = row.get("service_id");
        let nom: Option<String> = row.try_get("nom").ok();
        let prix: Option<f64> = row
            .try_get::<Option<rust_decimal::Decimal>, _>("prix")
            .ok()
            .flatten()
            .and_then(|d| d.to_string().parse::<f64>().ok());
        let data: serde_json::Value = row.try_get("data").unwrap_or(json!({}));
        let images: Option<serde_json::Value> = row.try_get("images").ok();
        let service_data: serde_json::Value = row.try_get("service_data").unwrap_or(json!({}));

        let name = nom.unwrap_or_else(|| {
            data.get("nom").and_then(|v| v.as_str()).unwrap_or("Produit").to_string()
        });
        let price =
            prix.unwrap_or_else(|| data.get("prix").and_then(|v| v.as_f64()).unwrap_or(0.0));
        let category =
            data.get("categorie").and_then(|v| v.as_str()).unwrap_or("autres").to_string();
        let is_promotion = data.get("en_promotion").and_then(|v| v.as_bool()).unwrap_or(false);
        let supermarket_name = service_data
            .get("titre_service")
            .or_else(|| service_data.get("nom"))
            .and_then(|v| v.as_str())
            .unwrap_or("Supermarché")
            .to_string();
        let image_url = extract_first_image(&images, &data);

        products.push(json!({
            "id": id.to_string(),
            "name": name,
            "price": price,
            "currency": "XAF",
            "image_url": image_url,
            "category": category,
            "is_promotion": is_promotion,
            "supermarket_id": service_id,
            "supermarket_name": supermarket_name
        }));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "products": products,
            "total": products.len()
        })),
    ))
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

fn extract_first_image(
    images: &Option<serde_json::Value>,
    data: &serde_json::Value,
) -> Option<String> {
    // Try images column first
    if let Some(imgs) = images {
        if let Some(arr) = imgs.as_array() {
            if let Some(first) = arr.first() {
                if let Some(url) = first.as_str() {
                    return Some(url.to_string());
                }
                if let Some(url) = first.get("url").and_then(|v| v.as_str()) {
                    return Some(url.to_string());
                }
            }
        }
        if let Some(val) = imgs.get("valeur") {
            if let Some(arr) = val.as_array() {
                if let Some(first) = arr.first() {
                    if let Some(url) = first.as_str() {
                        return Some(url.to_string());
                    }
                }
            }
        }
    }
    // Try data.images
    if let Some(imgs) = data.get("images") {
        if let Some(arr) = imgs.as_array() {
            if let Some(first) = arr.first() {
                if let Some(url) = first.as_str() {
                    return Some(url.to_string());
                }
            }
        }
        if let Some(val) = imgs.get("valeur") {
            if let Some(arr) = val.as_array() {
                if let Some(first) = arr.first() {
                    if let Some(url) = first.as_str() {
                        return Some(url.to_string());
                    }
                }
            }
        }
    }
    // Try data.image_url
    data.get("image_url").and_then(|v| v.as_str()).map(|s| s.to_string())
}
