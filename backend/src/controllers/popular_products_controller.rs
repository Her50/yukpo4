// Contrôleur pour les produits populaires
// Permet au prestataire de voir les produits les plus commercialisés par ses concurrents
use crate::services::popular_products_service;
use crate::state::AppState;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct PopularProductsQuery {
    pub search: Option<String>,
    pub category: Option<String>,
    pub limit: Option<i64>,
}

/// GET /api/products/popular
/// Récupère les produits les plus populaires (usage_count élevé)
pub async fn get_popular_products(
    Query(query): Query<PopularProductsQuery>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    use crate::utils::log::log_info;
    
    log_info(&format!(
        "[PopularProductsController] 🔍 GET /api/products/popular - search: {:?}, category: {:?}, limit: {:?}",
        query.search, query.category, query.limit
    ));
    
    let pool = &state.pg;
    let limit = query.limit.unwrap_or(20);

    let products = if let Some(search) = query.search {
        log_info(&format!(
            "[PopularProductsController] 🔎 Recherche produits similaires à: '{}' (limit: {})",
            search, limit
        ));
        // Recherche avec filtre
        popular_products_service::get_popular_products_similar_to(pool, &search, limit).await
    } else {
        log_info(&format!(
            "[PopularProductsController] 📊 Récupération TOP produits globaux (category: {:?}, limit: {})",
            query.category, limit
        ));
        // TOP produits globaux
        popular_products_service::get_top_popular_products(pool, query.category.as_deref(), limit)
            .await
    };

    match products {
        Ok(products) => {
            log_info(&format!(
                "[PopularProductsController] ✅ {} produits populaires récupérés",
                products.len()
            ));
            
            // ✅ NOUVEAU: Log détaillé des produits retournés pour déboguer sous_caracteristiques
            for (idx, product) in products.iter().take(3).enumerate() {
                log_info(&format!(
                    "[PopularProductsController] 📦 Produit #{}: vector={:?}, labels={:?}, usage_count={}, prix={:?}",
                    idx + 1,
                    product.product_vector,
                    product.product_labels,
                    product.usage_count,
                    product.prix_moyen
                ));
            }
            
            Ok(Json(serde_json::json!({
                "success": true,
                "data": products,
                "count": products.len(),
                "message": "Produits populaires récupérés"
            })))
        }
        Err(e) => {
            log_info(&format!(
                "[PopularProductsController] ❌ Erreur récupération produits populaires: {:?}",
                e
            ));
            eprintln!("❌ Erreur récupération produits populaires: {:?}", e);
            Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Erreur: {}", e)))
        }
    }
}
