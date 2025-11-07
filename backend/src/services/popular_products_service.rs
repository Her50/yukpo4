// Service pour récupérer les produits populaires depuis autocomplete_combinations
// Permet au prestataire de voir les produits les plus commercialisés par ses concurrents
use sqlx::{PgPool, Row};
use serde::{Deserialize, Serialize};
use crate::core::types::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PopularProduct {
    pub product_vector: Vec<String>,      // ["Nike", "Air Max", "42", "Noir"]
    pub product_labels: Vec<String>,      // ["marque", "modele", "pointure", "couleur"]
    pub usage_count: i32,                 // Popularité (nombre de prestataires qui le vendent)
    pub prix_moyen: Option<f64>,          // Prix moyen
    pub has_variant: bool,
    pub variant_dimension: Option<String>,
    pub variant_value: Option<String>,
    pub is_trending: bool,                // ✅ NOUVEAU : Tendance (actif dans les 7 derniers jours)
}

/// Récupère les produits populaires similaires à une recherche partielle
/// Trie par usage_count DESC pour montrer les plus populaires en premier
/// ✅ NOUVEAU : Inclut calcul de tendance (variation usage_count sur 7 derniers jours)
pub async fn get_popular_products_similar_to(
    pool: &PgPool,
    search_query: &str,
    limit: i64,
) -> Result<Vec<PopularProduct>, AppError> {
    log::info!(
        "[PopularProductsService] Recherche produits populaires similaires à: '{}' (limit: {})",
        search_query,
        limit
    );
    
    // Recherche dans autocomplete_combinations avec usage_count élevé
    let rows = sqlx::query(
        r#"
        WITH recent_trend AS (
            SELECT 
                ac.id,
                ac.product_vector,
                ac.usage_count as current_usage,
                -- Calcul tendance : usage_count actuel vs il y a 7 jours (via updated_at)
                CASE 
                    WHEN ac.updated_at >= NOW() - INTERVAL '7 days' 
                    THEN 1 -- Tendance hausse (produit actif récemment)
                    ELSE 0 -- Stable/baisse
                END as is_trending
            FROM autocomplete_combinations ac
            WHERE ac.usage_count >= 2
        )
        SELECT 
            ac.product_vector,
            ac.product_labels,
            ac.usage_count,
            ac.prix::FLOAT8 AS prix_float,
            ac.has_variant,
            ac.variant_dimension,
            ac.variant_value,
            rt.is_trending
        FROM autocomplete_combinations ac
        INNER JOIN recent_trend rt ON rt.id = ac.id
        WHERE 
            -- Recherche dans le vecteur produit (ANY permet de chercher dans l'array)
            EXISTS (
                SELECT 1 FROM unnest(ac.product_vector) AS val
                WHERE val ILIKE '%' || $1 || '%'
            )
            -- Seulement les produits avec usage_count >= 2 (vraiment populaires)
            AND ac.usage_count >= 2
        ORDER BY 
            rt.is_trending DESC,  -- Tendances EN PREMIER
            ac.usage_count DESC,  -- Puis popularité
            ac.prix::FLOAT8 ASC           -- Puis prix
        LIMIT $2
        "#
    )
    .bind(search_query)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération produits populaires: {}", e)))?;
    
    let products: Vec<PopularProduct> = rows.iter().map(|row| PopularProduct {
        product_vector: row.get("product_vector"),
        product_labels: row.get("product_labels"),
        usage_count: row.get("usage_count"),
        prix_moyen: row.get("prix_float"),
        has_variant: row.get("has_variant"),
        variant_dimension: row.get("variant_dimension"),
        variant_value: row.get("variant_value"),
        is_trending: row.try_get("is_trending").unwrap_or(false),
    }).collect();
    
    log::info!("[PopularProductsService] ✅ {} produits populaires trouvés", products.len());
    
    Ok(products)
}

/// Récupère les TOP produits les plus populaires par catégorie
pub async fn get_top_popular_products(
    pool: &PgPool,
    category_filter: Option<&str>,
    limit: i64,
) -> Result<Vec<PopularProduct>, AppError> {
    log::info!(
        "[PopularProductsService] Récupération TOP produits populaires (catégorie: {:?}, limit: {})",
        category_filter,
        limit
    );
    
    let rows = if let Some(category) = category_filter {
        sqlx::query(
            r#"
            WITH recent_trend AS (
                SELECT 
                    id,
                    CASE 
                        WHEN updated_at >= NOW() - INTERVAL '7 days' THEN 1
                        ELSE 0
                    END as is_trending
                FROM autocomplete_combinations
                WHERE usage_count >= 2
            )
            SELECT 
                ac.product_vector,
                ac.product_labels,
                ac.usage_count,
                ac.prix::FLOAT8 AS prix_float,
                ac.has_variant,
                ac.variant_dimension,
                ac.variant_value,
                rt.is_trending
            FROM autocomplete_combinations ac
            INNER JOIN recent_trend rt ON rt.id = ac.id
            WHERE ac.usage_count >= 2
            AND EXISTS (
                SELECT 1 FROM unnest(ac.product_vector) AS val
                WHERE val ILIKE '%' || $1 || '%'
            )
            ORDER BY rt.is_trending DESC, ac.usage_count DESC, ac.prix::FLOAT8 ASC
            LIMIT $2
            "#
        )
        .bind(category)
        .bind(limit)
        .fetch_all(pool)
        .await
    } else {
        sqlx::query(
            r#"
            WITH recent_trend AS (
                SELECT 
                    id,
                    CASE 
                        WHEN updated_at >= NOW() - INTERVAL '7 days' THEN 1
                        ELSE 0
                    END as is_trending
                FROM autocomplete_combinations
                WHERE usage_count >= 2
            )
            SELECT 
                ac.product_vector,
                ac.product_labels,
                ac.usage_count,
                ac.prix::FLOAT8 AS prix_float,
                ac.has_variant,
                ac.variant_dimension,
                ac.variant_value,
                rt.is_trending
            FROM autocomplete_combinations ac
            INNER JOIN recent_trend rt ON rt.id = ac.id
            WHERE ac.usage_count >= 2
            ORDER BY rt.is_trending DESC, ac.usage_count DESC, ac.prix::FLOAT8 ASC
            LIMIT $1
            "#
        )
        .bind(limit)
        .fetch_all(pool)
        .await
    }
    .map_err(|e| AppError::Internal(format!("Erreur récupération TOP produits: {}", e)))?;
    
    let products: Vec<PopularProduct> = rows.iter().map(|row| PopularProduct {
        product_vector: row.get("product_vector"),
        product_labels: row.get("product_labels"),
        usage_count: row.get("usage_count"),
        prix_moyen: row.get("prix_float"),
        has_variant: row.get("has_variant"),
        variant_dimension: row.get("variant_dimension"),
        variant_value: row.get("variant_value"),
        is_trending: row.try_get("is_trending").unwrap_or(false),
    }).collect();
    
    log::info!("[PopularProductsService] ✅ {} TOP produits trouvés", products.len());
    
    Ok(products)
}


