// Service pour suggestions autocomplete CÔTÉ CLIENT
// Utilise autocomplete_characteristics (VRAIS produits) pour aider le client à préciser sa recherche
use crate::core::types::AppError;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

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
            ac.chosen_location,
            ac.usage_count,
            -- ✅ PHASE 3: Extraire données produit depuis table service_products
            COALESCE(p.product_price::FLOAT, 
                CASE 
                    WHEN p.product_data->'prix'->'valeur'->>'montant' IS NOT NULL 
                    THEN (p.product_data->'prix'->'valeur'->>'montant')::FLOAT
                    WHEN p.product_data->'prix'->>'montant' IS NOT NULL 
                    THEN (p.product_data->'prix'->>'montant')::FLOAT
                    WHEN p.product_data->>'prix' IS NOT NULL 
                    THEN (p.product_data->>'prix')::FLOAT
                    ELSE NULL
                END
            ) as prix,
            COALESCE(
                p.product_data->'prix'->'valeur'->>'devise',
                p.product_data->'prix'->>'devise',
                p.product_data->>'devise'
            ) as devise,
            COALESCE((p.product_data->>'has_variant')::BOOLEAN, FALSE) as has_variant,
            p.product_data->>'variant_dimension' as variant_dimension,
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
        INNER JOIN service_products p ON p.id = ac.product_id::INTEGER AND p.service_id = ac.service_id
        WHERE 
            ac.is_real_product = TRUE
            AND s.is_active = TRUE
            AND p.is_active = TRUE
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
        "#,
    )
    .bind(search_query)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur recherche suggestions: {}", e)))?;

    let suggestions: Vec<ProductSuggestion> = rows
        .iter()
        .map(|row| ProductSuggestion {
            service_id: row.get::<i32, _>("service_id"),
            product_vector: row.get::<Vec<String>, _>("product_vector"),
            product_labels: row.get::<Vec<String>, _>("product_labels"),
            location_vector: row.get::<Vec<String>, _>("location_vector"),
            full_vector: row.get::<Vec<String>, _>("full_vector"),
            chosen_location: row.get::<Option<String>, _>("chosen_location"), // ✅ RESTAURÉ: chosen_location ajouté dans auto_migrate.rs
            usage_count: row.get::<i32, _>("usage_count"),
            has_variant: row.get::<bool, _>("has_variant"),
            variant_dimension: row.get::<Option<String>, _>("variant_dimension"),
            prix: row.get::<Option<f64>, _>("prix"),
            devise: row.get::<Option<String>, _>("devise"),
            final_score: row.get::<f64, _>("relevance_score"),
        })
        .collect();

    log::info!(
        "[AutocompleteClientService] ✅ {} suggestions CLIENT trouvées",
        suggestions.len()
    );

    Ok(suggestions)
}
