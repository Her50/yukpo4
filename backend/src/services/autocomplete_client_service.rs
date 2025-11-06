// Service pour suggestions autocomplete CÔTÉ CLIENT
// Utilise autocomplete_characteristics (VRAIS produits) pour aider le client à préciser sa recherche
use sqlx::{PgPool, Row};
use serde::{Deserialize, Serialize};
use crate::core::types::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductSuggestion {
    pub service_id: i32,
    pub product_vector: Vec<String>,
    pub product_labels: Vec<String>,
    pub location_vector: Vec<String>,
    pub full_vector: Vec<String>,
    pub chosen_location: Option<String>,
    pub usage_count: i32,
    pub has_variant: bool,
    pub variant_dimension: Option<String>,
    pub prix: Option<f64>,
    pub devise: Option<String>,
    pub final_score: f64,
}

/// Recherche de suggestions produits pour aider le client à préciser sa recherche
/// Utilise autocomplete_characteristics (VRAIS produits validés par clients)
pub async fn search_product_suggestions(
    pool: &PgPool,
    search_query: &str,
    limit: i64,
) -> Result<Vec<ProductSuggestion>, AppError> {
    log::info!(
        "[AutocompleteClientService] Recherche suggestions CLIENT: '{}' (limit: {})",
        search_query,
        limit
    );
    
    if search_query.trim().is_empty() {
        return Ok(vec![]);
    }
    
    // Recherche dans autocomplete_characteristics avec usage_count élevé
    let rows = sqlx::query(
        r#"
        SELECT 
            ac.service_id,
            ac.characteristic_vector as product_vector,
            ac.product_labels,
            ac.location_vector,
            ac.full_vector,
            ac.usage_count,
            -- Extraire données produit depuis service.data
            (s.data->'produits'->>'prix')::FLOAT as prix,
            s.data->'produits'->>'devise' as devise,
            COALESCE((s.data->'produits'->>'has_variant')::BOOLEAN, FALSE) as has_variant,
            s.data->'produits'->>'variant_dimension' as variant_dimension,
            -- Score de pertinence
            (
                -- Correspondance dans full_vector
                (
                    SELECT COUNT(*)::REAL * 15.0
                    FROM unnest(ac.full_vector) AS vec_val
                    WHERE LOWER(vec_val) LIKE '%' || LOWER($1) || '%'
                ) +
                -- BOOST popularité CLIENT (usage_count)
                (ac.usage_count::REAL * 3.0)
            ) as relevance_score
        FROM autocomplete_characteristics ac
        INNER JOIN services s ON s.id = ac.service_id
        WHERE 
            ac.is_real_product = TRUE
            AND s.is_active = TRUE
            AND ac.identifiant_base = 'produits'
            AND (
                -- Au moins UN élément du vecteur matche
                EXISTS (
                    SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                    WHERE LOWER(vec_val) LIKE '%' || LOWER($1) || '%'
                )
            )
        ORDER BY relevance_score DESC, ac.usage_count DESC
        LIMIT $2
        "#
    )
    .bind(search_query)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur recherche suggestions: {}", e)))?;
    
    let suggestions: Vec<ProductSuggestion> = rows.iter().map(|row| ProductSuggestion {
        service_id: row.get("service_id"),
        product_vector: row.get("product_vector"),
        product_labels: row.get("product_labels"),
        location_vector: row.get("location_vector"),
        full_vector: row.get("full_vector"),
        chosen_location: None, // ✅ FIX: chosen_location n'est plus dans la requête SQL
        usage_count: row.get("usage_count"),
        has_variant: row.get("has_variant"),
        variant_dimension: row.get("variant_dimension"),
        prix: row.get("prix"),
        devise: row.get("devise"),
        final_score: row.get("relevance_score"),
    }).collect();
    
    log::info!("[AutocompleteClientService] ✅ {} suggestions CLIENT trouvées", suggestions.len());
    
    Ok(suggestions)
}


