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
use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use log::{error, info};
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;
use std::collections::HashMap;
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
        SELECT sp.id, sp.product_data, sp.product_price, sp.product_name,
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
        let data: serde_json::Value = row.try_get("product_data").unwrap_or(json!({}));
        let nom: Option<String> = row.try_get("product_name").ok();
        let prix: Option<f64> = row
            .try_get::<Option<rust_decimal::Decimal>, _>("product_price")
            .ok()
            .flatten()
            .and_then(|d| d.to_string().parse::<f64>().ok());
        let images: Option<serde_json::Value> = data.get("images").cloned();

        let name = nom.unwrap_or_else(|| {
            data.get("nom").and_then(|v| v.as_str()).unwrap_or("Produit").to_string()
        });
        let desc = data.get("description").and_then(|v| v.as_str()).map(|s| s.to_string());
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
        SELECT sp.id, sp.product_data, sp.product_price, sp.product_name,
               sp.service_id, s.data as service_data
        FROM service_products sp
        INNER JOIN services s ON s.id = sp.service_id
        WHERE sp.is_active = true AND s.is_active = true
          AND (
              s.category ILIKE '%supermarche%' OR s.category ILIKE '%supermarket%'
              OR s.category ILIKE '%epicerie%' OR s.category ILIKE '%alimentation%'
              OR s.data->>'category' ILIKE '%supermarche%' OR s.data->>'category' ILIKE '%supermarket%'
              OR s.data->>'category' ILIKE '%epicerie%' OR s.data->>'category' ILIKE '%alimentation%'
              OR s.data->'category'->>'valeur' ILIKE '%supermarche%' OR s.data->'category'->>'valeur' ILIKE '%supermarket%'
              OR s.data->'category'->>'valeur' ILIKE '%epicerie%' OR s.data->'category'->>'valeur' ILIKE '%alimentation%'
          )
          AND (sp.product_name ILIKE $1 OR sp.product_data::text ILIKE $1)
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
        let data: serde_json::Value = row.try_get("product_data").unwrap_or(json!({}));
        let nom: Option<String> = row.try_get("product_name").ok();
        let prix: Option<f64> = row
            .try_get::<Option<rust_decimal::Decimal>, _>("product_price")
            .ok()
            .flatten()
            .and_then(|d| d.to_string().parse::<f64>().ok());
        let images: Option<serde_json::Value> = data.get("images").cloned();
        let service_data: serde_json::Value = row.try_get("service_data").unwrap_or(json!({}));

        let name = nom.unwrap_or_else(|| {
            data.get("nom").and_then(|v| v.as_str()).unwrap_or("Produit").to_string()
        });
        let price =
            prix.unwrap_or_else(|| data.get("prix").and_then(|v| v.as_f64()).unwrap_or(0.0));
        let category =
            data.get("categorie").and_then(|v| v.as_str()).unwrap_or("autres").to_string();
        let is_promotion = data.get("en_promotion").and_then(|v| v.as_bool()).unwrap_or(false);
        let description = data
            .get("description")
            .or_else(|| data.get("description_produit"))
            .and_then(|v| v.as_str().or_else(|| v.get("valeur").and_then(|val| val.as_str())))
            .unwrap_or("")
            .to_string();
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
/// ✅ AMÉLIORÉ 2026-03-14: Comparaison IA avec similarity(), code_barre, GPS, et détection catégorie JSONB
pub async fn compare_prices(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ComparePricesRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[compare_prices] Comparaison IA prix: product={}, lat={:?}, lng={:?}, radius={:?}",
        request.product_name, request.lat, request.lng, request.radius_km
    );

    let search_term = request.product_name.trim().to_string();
    if search_term.is_empty() {
        return Err(AppError::BadRequest(
            "Le nom du produit est requis".to_string(),
        ));
    }

    // ✅ Phase 1: Matching exact par code-barre (identité 100%)
    let mut barcode_rows = Vec::new();
    if let Some(ref product_id) = request.product_id {
        let bc_rows = sqlx::query(
            r#"
            SELECT sp.id, sp.product_data, sp.product_price, sp.product_name,
                   sp.service_id, s.data as service_data, s.gps as service_gps,
                   1.0::REAL as match_score, 'code_barre' as match_type
            FROM service_products sp
            INNER JOIN services s ON s.id = sp.service_id
            WHERE sp.is_active = true AND s.is_active = true
              AND (
                  s.category ILIKE '%supermarche%' OR s.category ILIKE '%supermarket%'
                  OR s.category ILIKE '%epicerie%' OR s.category ILIKE '%alimentation%'
                  OR s.data->>'category' ILIKE '%supermarche%' OR s.data->>'category' ILIKE '%supermarket%'
                  OR s.data->>'category' ILIKE '%epicerie%' OR s.data->>'category' ILIKE '%alimentation%'
                  OR s.data->'category'->>'valeur' ILIKE '%supermarche%' OR s.data->'category'->>'valeur' ILIKE '%supermarket%'
                  OR s.data->'category'->>'valeur' ILIKE '%epicerie%' OR s.data->'category'->>'valeur' ILIKE '%alimentation%'
              )
              AND (sp.product_data->>'code_barre' = $1
                   OR sp.product_data->>'ean' = $1
                   OR sp.product_data->>'barcode' = $1)
            ORDER BY sp.product_price ASC NULLS LAST
            LIMIT 20
            "#,
        )
        .bind(product_id)
        .fetch_all(&state.pg)
        .await
        .unwrap_or_default();
        barcode_rows = bc_rows;
        info!(
            "[compare_prices] Phase 1 code_barre: {} résultats",
            barcode_rows.len()
        );
    }

    // ✅ Phase 2: Matching IA avec similarity() trigram + ILIKE + unaccent
    let ia_rows = sqlx::query(
        r#"
        SELECT sp.id, sp.product_data, sp.product_price, sp.product_name,
               sp.service_id, s.data as service_data, s.gps as service_gps,
               GREATEST(
                   -- Score similarity trigram sur le nom (gère erreurs de saisie, variantes)
                   CASE WHEN similarity(unaccent(LOWER(COALESCE(sp.product_name, ''))), unaccent(LOWER($1))) > 0.2
                        THEN similarity(unaccent(LOWER(COALESCE(sp.product_name, ''))), unaccent(LOWER($1)))
                        ELSE 0.0 END,
                   -- Score ILIKE classique (matching partiel)
                   CASE WHEN sp.product_name ILIKE $2 THEN 0.7
                        WHEN sp.product_data::text ILIKE $2 THEN 0.5
                        ELSE 0.0 END,
                   -- Score similarity sur description produit
                   CASE WHEN similarity(unaccent(LOWER(COALESCE(
                            sp.product_data->>'description_produit',
                            sp.product_data->>'description',
                            sp.product_data->'description'->>'valeur', ''))),
                            unaccent(LOWER($1))) > 0.3
                        THEN similarity(unaccent(LOWER(COALESCE(
                            sp.product_data->>'description_produit',
                            sp.product_data->>'description',
                            sp.product_data->'description'->>'valeur', ''))),
                            unaccent(LOWER($1))) * 0.6
                        ELSE 0.0 END
               )::REAL as match_score,
               'ia_similarity' as match_type
        FROM service_products sp
        INNER JOIN services s ON s.id = sp.service_id
        WHERE sp.is_active = true AND s.is_active = true
          AND (
              s.category ILIKE '%supermarche%' OR s.category ILIKE '%supermarket%'
              OR s.category ILIKE '%epicerie%' OR s.category ILIKE '%alimentation%'
              OR s.data->>'category' ILIKE '%supermarche%' OR s.data->>'category' ILIKE '%supermarket%'
              OR s.data->>'category' ILIKE '%epicerie%' OR s.data->>'category' ILIKE '%alimentation%'
              OR s.data->'category'->>'valeur' ILIKE '%supermarche%' OR s.data->'category'->>'valeur' ILIKE '%supermarket%'
              OR s.data->'category'->>'valeur' ILIKE '%epicerie%' OR s.data->'category'->>'valeur' ILIKE '%alimentation%'
          )
          AND (
              -- ILIKE classique
              sp.product_name ILIKE $2
              OR sp.product_data::text ILIKE $2
              -- Similarity trigram (gère variantes: "Lait Cowbell" vs "Cowbell demi-litre")
              OR similarity(unaccent(LOWER(COALESCE(sp.product_name, ''))), unaccent(LOWER($1))) > 0.3
              -- Full-text search
              OR to_tsvector('french', COALESCE(sp.product_name, '')) @@ plainto_tsquery('french', $1)
          )
        ORDER BY match_score DESC, sp.product_price ASC NULLS LAST
        LIMIT 30
        "#,
    )
    .bind(&search_term)
    .bind(format!("%{}%", search_term))
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[compare_prices] Erreur SQL IA: {}", e);
        AppError::Internal(format!("Erreur comparaison prix IA: {}", e))
    })?;

    info!(
        "[compare_prices] Phase 2 IA similarity: {} résultats",
        ia_rows.len()
    );

    // ✅ Fusionner résultats: code_barre prioritaire, puis IA (dédupliqués)
    let mut seen_ids = std::collections::HashSet::new();
    let mut all_rows = Vec::new();
    for row in barcode_rows.iter().chain(ia_rows.iter()) {
        let id: i32 = row.get("id");
        if seen_ids.insert(id) {
            all_rows.push(row);
        }
    }

    if all_rows.is_empty() {
        return Ok((
            StatusCode::OK,
            Json(
                json!({ "success": false, "message": "Aucun produit trouvé", "search_mode": "ia_similarity" }),
            ),
        ));
    }

    let mut supermarkets = Vec::new();
    let mut prices: Vec<f64> = Vec::new();
    let user_lat = request.lat;
    let user_lng = request.lng;
    let radius_km = request.radius_km.unwrap_or(50.0);

    for row in &all_rows {
        let id: i32 = row.get("id");
        let service_id: i32 = row.get("service_id");
        let nom: Option<String> = row.try_get("product_name").ok();
        let prix: Option<f64> = row
            .try_get::<Option<rust_decimal::Decimal>, _>("product_price")
            .ok()
            .flatten()
            .and_then(|d| d.to_string().parse::<f64>().ok());
        let data: serde_json::Value = row.try_get("product_data").unwrap_or(json!({}));
        let images: Option<serde_json::Value> = data.get("images").cloned();
        let service_data: serde_json::Value = row.try_get("service_data").unwrap_or(json!({}));
        let service_gps: Option<String> = row.try_get("service_gps").ok().flatten();
        let match_score: f32 = row.try_get("match_score").unwrap_or(0.0);
        let match_type: String =
            row.try_get("match_type").unwrap_or_else(|_| "unknown".to_string());

        // ✅ Filtre GPS si coordonnées fournies
        let mut distance_km: Option<f64> = None;
        if let (Some(u_lat), Some(u_lng)) = (user_lat, user_lng) {
            let gps_str = service_gps
                .as_deref()
                .or_else(|| {
                    service_data
                        .get("gps_fixe")
                        .and_then(|v| v.get("valeur"))
                        .and_then(|v| v.as_str())
                })
                .or_else(|| service_data.get("gps_fixe").and_then(|v| v.as_str()))
                .or_else(|| service_data.get("gps").and_then(|v| v.as_str()));
            if let Some(gps) = gps_str {
                if let Some(dist) = parse_gps_distance(gps, u_lat, u_lng) {
                    if dist > radius_km {
                        continue; // Hors du rayon demandé
                    }
                    distance_km = Some(dist);
                }
            }
        }

        let name = nom.unwrap_or_else(|| {
            data.get("nom").and_then(|v| v.as_str()).unwrap_or("Produit").to_string()
        });
        let price =
            prix.unwrap_or_else(|| data.get("prix").and_then(|v| v.as_f64()).unwrap_or(0.0));

        // ✅ Extraire le nom du supermarché depuis data JSONB (format {valeur: "..."} ou string)
        let supermarket_name = extract_service_field_str(&service_data, "titre_service")
            .or_else(|| extract_service_field_str(&service_data, "nom"))
            .unwrap_or_else(|| "Supermarché".to_string());

        let category =
            data.get("categorie").and_then(|v| v.as_str()).unwrap_or("autres").to_string();
        let is_promotion = data.get("en_promotion").and_then(|v| v.as_bool()).unwrap_or(false);
        let code_barre = data.get("code_barre").and_then(|v| v.as_str()).map(|s| s.to_string());
        let image_url = extract_first_image(&images, &data);

        prices.push(price);

        supermarkets.push(json!({
            "supermarket_id": service_id,
            "supermarket_name": supermarket_name,
            "distance_km": distance_km,
            "match_score": match_score,
            "match_type": match_type,
            "product": {
                "id": id.to_string(),
                "name": name,
                "price": price,
                "currency": "XAF",
                "image_url": image_url,
                "category": category,
                "is_promotion": is_promotion,
                "code_barre": code_barre,
                "supermarket_id": service_id,
                "supermarket_name": supermarket_name,
                "distance_km": distance_km
            }
        }));
    }

    if supermarkets.is_empty() {
        return Ok((
            StatusCode::OK,
            Json(
                json!({ "success": false, "message": "Aucun supermarché dans le rayon demandé", "search_mode": "ia_similarity" }),
            ),
        ));
    }

    let min_price = prices.iter().cloned().fold(f64::INFINITY, f64::min);
    let max_price = prices.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let avg_price = if !prices.is_empty() {
        prices.iter().sum::<f64>() / prices.len() as f64
    } else {
        0.0
    };

    let cheapest = supermarkets.first().cloned().unwrap_or(json!({}));

    // ✅ Phase 3: Classification d'équivalence LLM (optionnelle, non-bloquante)
    // Regroupe les produits par équivalence réelle (même contenance, même type)
    // pour éviter de comparer "Lait 400g" avec "Lait 900ml"
    let equivalence_groups = if supermarkets.len() >= 2 {
        // Construire l'input JSON pour le prompt LLM
        let candidates: Vec<serde_json::Value> = supermarkets
            .iter()
            .filter_map(|s| {
                let product = s.get("product")?;
                Some(json!({
                    "id": product.get("id")?,
                    "name": product.get("name")?,
                    "price": product.get("price")?
                }))
            })
            .collect();

        let llm_input = json!({
            "reference_product": search_term,
            "candidates": candidates
        })
        .to_string();

        // Appel LLM avec timeout de 5s (non-bloquant)
        match tokio::time::timeout(
            std::time::Duration::from_secs(5),
            state.ia.predict(&format!(
                "Analyse ces produits et regroupe-les par équivalence pour comparaison de prix.\n\nDonnées:\n{}",
                llm_input
            )),
        )
        .await
        {
            Ok(Ok((_model, response, _tokens))) => {
                info!("[compare_prices] Phase 3 LLM équivalence: réponse reçue");
                // Tenter de parser la réponse JSON du LLM
                match serde_json::from_str::<serde_json::Value>(&response) {
                    Ok(parsed) => Some(parsed),
                    Err(e) => {
                        info!(
                            "[compare_prices] Phase 3: réponse LLM non-JSON, fallback: {}",
                            e
                        );
                        None
                    }
                }
            }
            Ok(Err(e)) => {
                info!("[compare_prices] Phase 3 LLM erreur (fallback): {}", e);
                None
            }
            Err(_) => {
                info!("[compare_prices] Phase 3 LLM timeout 5s (fallback)");
                None
            }
        }
    } else {
        None
    };

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "search_mode": "ia_similarity",
            "comparison": {
                "product_name": request.product_name,
                "category": "general",
                "supermarkets": supermarkets,
                "total_results": supermarkets.len(),
                "cheapest": {
                    "supermarket_id": cheapest.get("supermarket_id"),
                    "supermarket_name": cheapest.get("supermarket_name"),
                    "price": min_price,
                    "distance_km": cheapest.get("distance_km")
                },
                "average_price": avg_price,
                "price_range": {
                    "min": min_price,
                    "max": max_price
                },
                "equivalence_groups": equivalence_groups
            }
        })),
    ))
}

/// Helper: Parse GPS et calcule distance Haversine
fn parse_gps_distance(gps: &str, user_lat: f64, user_lng: f64) -> Option<f64> {
    let parts: Vec<&str> = gps.split(',').collect();
    if parts.len() < 2 {
        return None;
    }
    let lat: f64 = parts[0].trim().parse().ok()?;
    let lng: f64 = parts[1].trim().parse().ok()?;
    if lat < -90.0 || lat > 90.0 || lng < -180.0 || lng > 180.0 {
        return None;
    }
    Some(haversine_km(user_lat, user_lng, lat, lng))
}

/// Formule Haversine pour distance en km
fn haversine_km(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    let r = 6371.0;
    let d_lat = (lat2 - lat1).to_radians();
    let d_lon = (lon2 - lon1).to_radians();
    let a = (d_lat / 2.0).sin().powi(2)
        + lat1.to_radians().cos() * lat2.to_radians().cos() * (d_lon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().asin();
    r * c
}

/// Helper: Extraire un champ string depuis data JSONB (gère format {valeur: "..."} et string directe)
fn extract_service_field_str(data: &serde_json::Value, field: &str) -> Option<String> {
    if let Some(v) = data.get(field) {
        // Format string directe
        if let Some(s) = v.as_str() {
            if !s.is_empty() {
                return Some(s.to_string());
            }
        }
        // Format {valeur: "..."}
        if let Some(s) = v.get("valeur").and_then(|v| v.as_str()) {
            if !s.is_empty() {
                return Some(s.to_string());
            }
        }
    }
    None
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
        SELECT sp.id, sp.product_data, sp.product_price, sp.product_name
        FROM service_products sp
        WHERE sp.service_id = $1 AND sp.is_active = true
          AND (sp.product_data->>'en_promotion' = 'true' OR sp.product_data->>'is_promotion' = 'true')
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
        let nom: Option<String> = row.try_get("product_name").ok();
        let data: serde_json::Value = row.try_get("product_data").unwrap_or(json!({}));
        let prix: Option<f64> = row
            .try_get::<Option<rust_decimal::Decimal>, _>("product_price")
            .ok()
            .flatten()
            .and_then(|d| d.to_string().parse::<f64>().ok());
        let images: Option<serde_json::Value> = data.get("images").cloned();

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
        SELECT sp.id, sp.product_data, sp.product_price, sp.product_name,
               sp.service_id, s.data as service_data
        FROM service_products sp
        INNER JOIN services s ON s.id = sp.service_id
        WHERE sp.is_active = true
          AND (s.category ILIKE '%supermarche%' OR s.category ILIKE '%supermarket%'
               OR s.category ILIKE '%epicerie%' OR s.category ILIKE '%alimentation%')
          AND (sp.product_data->>'en_promotion' = 'true' OR sp.product_data->>'is_promotion' = 'true')
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
        let nom: Option<String> = row.try_get("product_name").ok();
        let data: serde_json::Value = row.try_get("product_data").unwrap_or(json!({}));
        let prix: Option<f64> = row
            .try_get::<Option<rust_decimal::Decimal>, _>("product_price")
            .ok()
            .flatten()
            .and_then(|d| d.to_string().parse::<f64>().ok());
        let images: Option<serde_json::Value> = data.get("images").cloned();
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
            COALESCE(sp.product_data->>'categorie', sp.product_data->>'category', 'autres') as category
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
        SELECT sp.id, sp.product_data, sp.product_price, sp.product_name,
               sp.service_id, s.data as service_data
        FROM service_products sp
        INNER JOIN services s ON s.id = sp.service_id
        WHERE sp.is_active = true AND s.is_active = true
          AND (
              s.category ILIKE '%supermarche%' OR s.category ILIKE '%supermarket%'
              OR s.category ILIKE '%epicerie%' OR s.category ILIKE '%alimentation%'
              OR s.data->>'category' ILIKE '%supermarche%' OR s.data->>'category' ILIKE '%supermarket%'
              OR s.data->>'category' ILIKE '%epicerie%' OR s.data->>'category' ILIKE '%alimentation%'
              OR s.data->'category'->>'valeur' ILIKE '%supermarche%' OR s.data->'category'->>'valeur' ILIKE '%supermarket%'
              OR s.data->'category'->>'valeur' ILIKE '%epicerie%' OR s.data->'category'->>'valeur' ILIKE '%alimentation%'
          )
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
        let nom: Option<String> = row.try_get("product_name").ok();
        let prix: Option<f64> = row
            .try_get::<Option<rust_decimal::Decimal>, _>("product_price")
            .ok()
            .flatten()
            .and_then(|d| d.to_string().parse::<f64>().ok());
        let data: serde_json::Value = row.try_get("product_data").unwrap_or(json!({}));
        let images: Option<serde_json::Value> = data.get("images").cloned();
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

// ═══════════════════════════════════════════════════════════════
// 8. IMPORT EN MASSE DE PRODUITS SUPERMARCHÉ
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct BulkImportSupermarketRequest {
    pub service_id: i32,
    pub products: Option<Vec<BulkSupermarketProduct>>,
    pub csv_data: Option<String>,
    pub overwrite_existing: Option<bool>,
    pub store_category: Option<String>, // ✅ 2026-04-01: catégorie boutique (supermarche, mode, electronique, etc.)
    pub platform_integration_id: Option<i32>, // ✅ 2026-04-01: ID intégration source (traçabilité)
}

#[derive(Debug, Deserialize)]
pub struct BulkSupermarketProduct {
    pub nom: String,
    pub description: Option<String>,
    pub prix: Option<f64>,
    pub categorie: Option<String>,
    pub marque: Option<String>,
    pub unite: Option<String>,
    pub stock: Option<i32>,
    pub code_barre: Option<String>,
    pub en_promotion: Option<bool>,
    pub prix_promo: Option<f64>,
    pub image_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ExternalSupermarketSyncRequest {
    pub service_id: i32,
    pub api_url: String,
    pub overwrite_existing: Option<bool>,
    pub items_path: Option<String>,
    pub headers: Option<HashMap<String, String>>,
    pub auth_bearer_token: Option<String>,
    pub field_mapping: Option<HashMap<String, String>>,
}

/// POST /api/supermarkets/products/bulk-import
/// Import en masse de produits pour un supermarché partenaire
/// Accepte soit un tableau JSON de produits, soit du texte CSV
pub async fn bulk_import_products(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<BulkImportSupermarketRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[supermarket/bulk-import] user_id={}, service_id={}",
        user.id, payload.service_id
    );

    // 1. Vérifier que l'utilisateur est propriétaire du service
    let is_owner: bool =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM services WHERE id = $1 AND user_id = $2)")
            .bind(payload.service_id)
            .bind(user.id)
            .fetch_one(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur vérification propriétaire: {}", e)))?;

    if !is_owner {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas propriétaire de ce service supermarché".to_string(),
        ));
    }

    // ✅ AMÉLIORÉ 2026-03-14: S'assurer que le service a category='supermarche'
    // Cet endpoint est exclusivement pour les supermarchés, donc on backfill si NULL
    let _ = sqlx::query(
        "UPDATE services SET category = 'supermarche' WHERE id = $1 AND (category IS NULL OR category = '')",
    )
    .bind(payload.service_id)
    .execute(&state.pg)
    .await;

    // 2. Parser les produits (JSON ou CSV)
    let products = if let Some(json_products) = payload.products {
        json_products
    } else if let Some(csv_data) = &payload.csv_data {
        parse_csv_products(csv_data)?
    } else {
        return Err(AppError::BadRequest(
            "Fournissez 'products' (JSON) ou 'csv_data' (CSV)".to_string(),
        ));
    };

    if products.is_empty() {
        return Err(AppError::BadRequest("Aucun produit à importer".to_string()));
    }

    if products.len() > 2000 {
        return Err(AppError::BadRequest(
            "Maximum 2000 produits par import. Divisez en plusieurs imports.".to_string(),
        ));
    }

    let overwrite = payload.overwrite_existing.unwrap_or(false);
    let mut created = 0i32;
    let mut updated = 0i32;
    let mut errors: Vec<String> = Vec::new();

    // 3. Obtenir le prochain product_index
    let max_index: Option<i32> = sqlx::query_scalar(
        "SELECT COALESCE(MAX(product_index), 0) FROM service_products WHERE service_id = $1",
    )
    .bind(payload.service_id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(Some(0));
    let mut next_index = max_index.unwrap_or(0) + 1;

    for (i, product) in products.iter().enumerate() {
        if product.nom.trim().is_empty() {
            errors.push(format!("Ligne {}: nom vide, ignoré", i + 1));
            continue;
        }

        let prix = product.prix.unwrap_or(0.0);
        let stock = product.stock.unwrap_or(1);
        let categorie = product.categorie.clone().unwrap_or_else(|| "autres".to_string());

        // Construire le product_data JSONB complet
        // Le prix doit être à la racine pour que la colonne générée product_price le détecte
        // Le nom doit être à la racine pour que la colonne générée product_name le détecte
        let mut product_data = json!({
            "nom": product.nom,
            "nom_produit": product.nom,
            "prix": prix,
            "prix_produit": prix,
            "description": product.description,
            "description_produit": product.description,
            "categorie": categorie,
            "categorie_produit": categorie,
            "marque": product.marque,
            "unite": product.unite.clone().unwrap_or_else(|| "unité".to_string()),
            "stock": stock,
            "quantite_disponible": stock,
            "code_barre": product.code_barre,
            "en_promotion": product.en_promotion.unwrap_or(false),
            "origine_champs": "bulk_import",
            "type": "produit"
        });

        // Ajouter les champs optionnels
        if product.en_promotion.unwrap_or(false) {
            if let Some(px) = product.prix {
                product_data["prix_original"] = json!(px);
            }
            if let Some(pp) = product.prix_promo {
                product_data["prix_promo"] = json!(pp);
            }
        }
        if let Some(ref url) = product.image_url {
            product_data["images"] = json!([url]);
        }

        // Vérifier si le produit existe déjà (par product_name généré)
        if overwrite {
            let existing: Option<i32> = sqlx::query_scalar(
                "SELECT id FROM service_products WHERE service_id = $1 AND product_name = $2 LIMIT 1",
            )
            .bind(payload.service_id)
            .bind(&product.nom)
            .fetch_optional(&state.pg)
            .await
            .ok()
            .flatten();

            if let Some(existing_id) = existing {
                // Mettre à jour le product_data
                match sqlx::query(
                    "UPDATE service_products SET product_data = $1, is_active = true WHERE id = $2",
                )
                .bind(&product_data)
                .bind(existing_id)
                .execute(&state.pg)
                .await
                {
                    Ok(_) => updated += 1,
                    Err(e) => errors.push(format!(
                        "Ligne {} ({}): erreur MAJ: {}",
                        i + 1,
                        product.nom,
                        e
                    )),
                }
                continue;
            }
        }

        // Insérer nouveau produit
        match sqlx::query(
            r#"INSERT INTO service_products
               (service_id, product_index, product_data, is_active, platform_integration_id, store_category)
               VALUES ($1, $2, $3, true, $4, $5)"#,
        )
        .bind(payload.service_id)
        .bind(next_index)
        .bind(&product_data)
        .bind(payload.platform_integration_id)
        .bind(payload.store_category.as_deref().unwrap_or("supermarche"))
        .execute(&state.pg)
        .await
        {
            Ok(_) => {
                created += 1;
                next_index += 1;
            }
            Err(e) => errors.push(format!("Ligne {} ({}): erreur insertion: {}", i + 1, product.nom, e)),
        }
    }

    info!(
        "[supermarket/bulk-import] Terminé: {} créés, {} mis à jour, {} erreurs",
        created,
        updated,
        errors.len()
    );

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": errors.is_empty(),
            "created": created,
            "updated": updated,
            "total_processed": created + updated,
            "errors": errors,
            "message": format!("{} produits créés, {} mis à jour", created, updated)
        })),
    ))
}

fn extract_json_path<'a>(
    value: &'a serde_json::Value,
    path: &str,
) -> Option<&'a serde_json::Value> {
    let mut current = value;
    for segment in path.split('.').filter(|s| !s.trim().is_empty()) {
        current = current.get(segment)?;
    }
    Some(current)
}

/// POST /api/supermarkets/products/sync-external
/// Synchronisation catalogue depuis API JSON externe (service propriétaire uniquement).
pub async fn sync_products_from_external_api(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<ExternalSupermarketSyncRequest>,
) -> AppResult<impl IntoResponse> {
    let is_owner: bool =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM services WHERE id = $1 AND user_id = $2)")
            .bind(payload.service_id)
            .bind(user.id)
            .fetch_one(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur vérification propriétaire: {}", e)))?;
    if !is_owner {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas propriétaire de ce service supermarché".to_string(),
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
    let items_value = extract_json_path(&upstream_json, items_path).unwrap_or(&upstream_json);
    let items = items_value.as_array().ok_or_else(|| {
        AppError::BadRequest("Impossible de trouver la liste de produits".to_string())
    })?;

    let mapping = payload.field_mapping.unwrap_or_default();
    let name_key = mapping.get("nom").cloned().unwrap_or_else(|| "nom".to_string());
    let price_key = mapping.get("prix").cloned().unwrap_or_else(|| "prix".to_string());
    let stock_key = mapping.get("stock").cloned().unwrap_or_else(|| "stock".to_string());
    let category_key = mapping.get("categorie").cloned().unwrap_or_else(|| "categorie".to_string());
    let brand_key = mapping.get("marque").cloned().unwrap_or_else(|| "marque".to_string());
    let unit_key = mapping.get("unite").cloned().unwrap_or_else(|| "unite".to_string());
    let desc_key = mapping.get("description").cloned().unwrap_or_else(|| "description".to_string());
    let barcode_key =
        mapping.get("code_barre").cloned().unwrap_or_else(|| "code_barre".to_string());
    let promo_key = mapping
        .get("en_promotion")
        .cloned()
        .unwrap_or_else(|| "en_promotion".to_string());
    let promo_price_key =
        mapping.get("prix_promo").cloned().unwrap_or_else(|| "prix_promo".to_string());
    let image_key = mapping.get("image_url").cloned().unwrap_or_else(|| "image_url".to_string());

    let products: Vec<BulkSupermarketProduct> = items
        .iter()
        .filter_map(|it| it.as_object())
        .map(|obj| {
            let nom = obj
                .get(&name_key)
                .and_then(|v| v.as_str())
                .map(|v| v.trim().to_string())
                .unwrap_or_default();
            let prix = obj.get(&price_key).and_then(|v| {
                v.as_f64()
                    .or_else(|| v.as_str().and_then(|s| s.replace(',', ".").parse::<f64>().ok()))
            });
            let stock = obj
                .get(&stock_key)
                .and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse::<i64>().ok())))
                .map(|v| v.max(0) as i32);
            let en_promotion = obj.get(&promo_key).and_then(|v| {
                v.as_bool().or_else(|| {
                    v.as_str()
                        .map(|s| matches!(s.to_lowercase().as_str(), "1" | "true" | "oui" | "yes"))
                })
            });
            let prix_promo = obj.get(&promo_price_key).and_then(|v| {
                v.as_f64()
                    .or_else(|| v.as_str().and_then(|s| s.replace(',', ".").parse::<f64>().ok()))
            });

            BulkSupermarketProduct {
                nom,
                description: obj
                    .get(&desc_key)
                    .and_then(|v| v.as_str())
                    .map(|s| s.trim().to_string()),
                prix,
                categorie: obj
                    .get(&category_key)
                    .and_then(|v| v.as_str())
                    .map(|s| s.trim().to_string()),
                marque: obj.get(&brand_key).and_then(|v| v.as_str()).map(|s| s.trim().to_string()),
                unite: obj.get(&unit_key).and_then(|v| v.as_str()).map(|s| s.trim().to_string()),
                stock,
                code_barre: obj
                    .get(&barcode_key)
                    .and_then(|v| v.as_str())
                    .map(|s| s.trim().to_string()),
                en_promotion,
                prix_promo,
                image_url: obj
                    .get(&image_key)
                    .and_then(|v| v.as_str())
                    .map(|s| s.trim().to_string()),
            }
        })
        .filter(|p| !p.nom.trim().is_empty())
        .collect();

    let response = bulk_import_products(
        State(state),
        Extension(user),
        Json(BulkImportSupermarketRequest {
            service_id: payload.service_id,
            products: Some(products),
            csv_data: None,
            overwrite_existing: payload.overwrite_existing,
            store_category: Some("supermarche".to_string()),
            platform_integration_id: None,
        }),
    )
    .await?;

    Ok(response)
}

/// Parser du CSV en produits supermarché
/// Format attendu: nom,prix,stock,categorie,marque,unite,description,code_barre,en_promotion,prix_promo,image_url
/// La première ligne peut être un en-tête (détecté automatiquement)
fn parse_csv_products(csv_data: &str) -> AppResult<Vec<BulkSupermarketProduct>> {
    let lines: Vec<&str> = csv_data.lines().filter(|l| !l.trim().is_empty()).collect();
    if lines.is_empty() {
        return Ok(Vec::new());
    }

    // Détecter si la première ligne est un en-tête
    let first_line_lower = lines[0].to_lowercase();
    let has_header = first_line_lower.contains("nom")
        || first_line_lower.contains("prix")
        || first_line_lower.contains("product")
        || first_line_lower.contains("name");

    let data_lines = if has_header { &lines[1..] } else { &lines[..] };
    let mut products = Vec::new();

    for line in data_lines {
        let parts: Vec<&str> = line.split(|c| c == ',' || c == ';' || c == '\t').collect();
        if parts.is_empty() || parts[0].trim().is_empty() {
            continue;
        }

        let get = |idx: usize| -> Option<String> {
            parts.get(idx).and_then(|s| {
                let trimmed = s.trim().trim_matches('"');
                if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed.to_string())
                }
            })
        };

        let nom = get(0).unwrap_or_default();
        if nom.is_empty() {
            continue;
        }

        products.push(BulkSupermarketProduct {
            nom,
            prix: get(1).and_then(|s| s.replace(',', ".").parse::<f64>().ok()),
            stock: get(2).and_then(|s| s.parse::<i32>().ok()),
            categorie: get(3),
            marque: get(4),
            unite: get(5),
            description: get(6),
            code_barre: get(7),
            en_promotion: get(8)
                .map(|s| s == "1" || s.to_lowercase() == "oui" || s.to_lowercase() == "true"),
            prix_promo: get(9).and_then(|s| s.replace(',', ".").parse::<f64>().ok()),
            image_url: get(10),
        });
    }

    Ok(products)
}
