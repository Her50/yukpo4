// Service de recherche de produits par vecteur autocomplete
// Utilise autocomplete_characteristics pour trouver les VRAIS produits des prestataires
use crate::core::types::AppError;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutocompleteSearchResult {
    pub service_id: i32,
    pub product_id: String,
    pub product_vector: Vec<String>,
    pub product_labels: Vec<String>,
    pub location_vector: Vec<String>,
    pub full_vector: Vec<String>,
    pub chosen_location: Option<String>,
    pub usage_count: i32,
    pub relevance_score: f64,

    // Données complètes du service
    pub service_data: serde_json::Value,
    pub prestataire: Option<PrestataireInfo>,

    // Distance si GPS fourni
    pub distance_km: Option<f64>,

    // ✅ NOUVEAU 2025-11-06 : Extractions produit (compatibilité client_service)
    pub has_variant: bool,
    pub variant_dimension: Option<String>,
    pub prix: Option<f64>,
    pub devise: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrestataireInfo {
    pub user_id: i32,
    pub nom: String,
    pub avatar_url: Option<String>,
}

/// Recherche de produits basée sur un vecteur de caractéristiques
/// Utilise autocomplete_characteristics (VRAIS produits prestataires)
pub async fn search_by_autocomplete_vector(
    pool: &PgPool,
    combination_vector: &[String],
    user_location: Option<(f64, f64)>, // (lat, lng)
    limit: i64,
) -> Result<Vec<AutocompleteSearchResult>, AppError> {
    log::info!(
        "[AutocompleteSearchService] Recherche par vecteur: {:?} (limit: {})",
        combination_vector,
        limit
    );

    if combination_vector.is_empty() {
        return Ok(vec![]);
    }

    // Recherche dans autocomplete_characteristics avec scoring intelligent
    let rows = if let Some((lat, lng)) = user_location {
        // Recherche avec distance GPS
        sqlx::query(
            r#"
            SELECT DISTINCT ON (s.id)
                s.id as service_id,
                s.data as service_data,
                ac.product_id,
                ac.characteristic_vector as product_vector,
                ac.product_labels,
                ac.location_vector,
                ac.full_vector,
                ac.chosen_location,
                ac.usage_count,
                u.id as user_id,
                u.email as user_email,
                -- ✅ Extractions produit (compatibilité client_service)
                CASE
                    WHEN (s.data->'produits'->>'prix') ~ '^[0-9]+(\.[0-9]+)?$'
                    THEN (s.data->'produits'->>'prix')::FLOAT
                    ELSE NULL
                END as prix,
                s.data->'produits'->>'devise' as devise,
                COALESCE((s.data->'produits'->>'has_variant')::BOOLEAN, FALSE) as has_variant,
                s.data->'produits'->>'variant_dimension' as variant_dimension,
                -- Calcul distance GPS
                (
                    CASE 
                        WHEN s.gps IS NOT NULL 
                             AND s.gps != ''
                             AND s.gps ~ '^-?[0-9]+(\\.[0-9]+)?,-?[0-9]+(\\.[0-9]+)?$' THEN
                            ST_Distance(
                                ST_MakePoint($2, $3)::geography,
                                ST_MakePoint(
                                    CAST(SPLIT_PART(s.gps, ',', 1) AS DOUBLE PRECISION),
                                    CAST(SPLIT_PART(s.gps, ',', 2) AS DOUBLE PRECISION)
                                )::geography
                            ) / 1000.0
                        ELSE NULL
                    END
                ) as distance_km,
                -- Score de pertinence basé sur correspondance vecteur
                (
                    -- Score de base : combien d'éléments du vecteur recherché matchent
                    (
                        SELECT COUNT(*)::REAL * 20.0
                        FROM unnest($1::TEXT[]) AS search_val
                        WHERE EXISTS (
                            SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                            WHERE LOWER(vec_val) = LOWER(search_val)
                        )
                    ) +
                    -- Bonus correspondances partielles
                    (
                        SELECT COUNT(*)::REAL * 10.0
                        FROM unnest($1::TEXT[]) AS search_val
                        WHERE EXISTS (
                            SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                            WHERE LOWER(vec_val) LIKE '%' || LOWER(search_val) || '%'
                        )
                    ) +
                    -- BOOST popularité (usage_count)
                    (ac.usage_count::REAL * 2.0) +
                    -- BONUS lieu exact
                    CASE 
                        WHEN ac.chosen_location IS NOT NULL AND EXISTS (
                            SELECT 1 FROM unnest($1::TEXT[]) AS search_val
                            WHERE LOWER(ac.chosen_location) = LOWER(search_val)
                        )
                        THEN 50.0
                        WHEN EXISTS (
                            SELECT 1 FROM unnest($1::TEXT[]) AS search_val, unnest(ac.location_vector) AS loc_val
                            WHERE LOWER(loc_val) = LOWER(search_val)
                        )
                        THEN 35.0
                        ELSE 0.0
                    END
                ) as relevance_score
            FROM autocomplete_characteristics ac
            INNER JOIN services s ON s.id = ac.service_id
            INNER JOIN users u ON u.id = s.user_id
            WHERE 
                -- ✅ OPTIMISÉ 2025-01-14: Utiliser index composite pour filtres fréquents
                ac.is_real_product = TRUE
                AND ac.identifiant_base = 'produits'
                AND s.is_active = TRUE
                -- ✅ CORRIGÉ 2025-12-16: Utiliser LIKE pour correspondances partielles au lieu de && (correspondance exacte)
                -- Le problème: && nécessite correspondance exacte d'éléments, alors qu'on veut des correspondances partielles
                -- Solution: Utiliser LIKE pour trouver "chaussures" dans "Chaussures pour enfants"
                AND (
                    -- Au moins UN élément du vecteur recherché doit matcher dans full_vector
                    EXISTS (
                        SELECT 1 FROM unnest($1::TEXT[]) AS search_val
                        WHERE EXISTS (
                            SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                            WHERE LOWER(vec_val) LIKE '%' || LOWER(search_val) || '%'
                        )
                    )
                    -- OU dans characteristic_vector
                    OR EXISTS (
                        SELECT 1 FROM unnest($1::TEXT[]) AS search_val
                        WHERE EXISTS (
                            SELECT 1 FROM unnest(ac.characteristic_vector) AS vec_val
                            WHERE LOWER(vec_val) LIKE '%' || LOWER(search_val) || '%'
                        )
                    )
                )
            ORDER BY s.id, relevance_score DESC, distance_km ASC NULLS LAST
            LIMIT $4
            "#
        )
        .bind(combination_vector)
        .bind(lng)
        .bind(lat)
        .bind(limit)
        .fetch_all(pool)
        .await
        
        // ✅ CORRIGÉ 2025-12-18: Retry avec backoff pour erreurs TLS
        .or_else(|e| async {
            let error_msg = e.to_string();
            if error_msg.contains("TLS")
                || error_msg.contains("close_notify")
                || error_msg.contains("Connection reset")
                || error_msg.contains("peer closed")
                || error_msg.contains("communicating with database")
            {
                log::warn!("[AutocompleteSearchService] ⚠️ Erreur DB détectée, retry...");
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                sqlx::query(
                    r#"
                    SELECT DISTINCT ON (s.id)
                        s.id as service_id,
                        s.data as service_data,
                        ac.product_id,
                        ac.characteristic_vector as product_vector,
                        ac.product_labels,
                        ac.location_vector,
                        ac.full_vector,
                        ac.chosen_location,
                        ac.usage_count,
                        u.id as user_id,
                        u.email as user_email,
                        CASE
                            WHEN (s.data->'produits'->>'prix') ~ '^[0-9]+(\.[0-9]+)?$'
                            THEN (s.data->'produits'->>'prix')::FLOAT
                            ELSE NULL
                        END as prix,
                        s.data->'produits'->>'devise' as devise,
                        COALESCE((s.data->'produits'->>'has_variant')::BOOLEAN, FALSE) as has_variant,
                        s.data->'produits'->>'variant_dimension' as variant_dimension,
                        (
                            CASE 
                                WHEN s.gps IS NOT NULL 
                                     AND s.gps != ''
                                     AND s.gps ~ '^-?[0-9]+(\\.[0-9]+)?,-?[0-9]+(\\.[0-9]+)?$' THEN
                                    ST_Distance(
                                        ST_MakePoint($2, $3)::geography,
                                        ST_MakePoint(
                                            CAST(SPLIT_PART(s.gps, ',', 1) AS DOUBLE PRECISION),
                                            CAST(SPLIT_PART(s.gps, ',', 2) AS DOUBLE PRECISION)
                                        )::geography
                                    ) / 1000.0
                                ELSE NULL
                            END
                        ) as distance_km,
                        (
                            (
                                SELECT COUNT(*)::REAL * 20.0
                                FROM unnest($1::TEXT[]) AS search_val
                                WHERE EXISTS (
                                    SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                                    WHERE LOWER(vec_val) = LOWER(search_val)
                                )
                            ) +
                            (
                                SELECT COUNT(*)::REAL * 10.0
                                FROM unnest($1::TEXT[]) AS search_val
                                WHERE EXISTS (
                                    SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                                    WHERE LOWER(vec_val) LIKE '%' || LOWER(search_val) || '%'
                                )
                            ) +
                            (ac.usage_count::REAL * 2.0) +
                            CASE 
                                WHEN ac.chosen_location IS NOT NULL AND EXISTS (
                                    SELECT 1 FROM unnest($1::TEXT[]) AS search_val
                                    WHERE LOWER(ac.chosen_location) = LOWER(search_val)
                                )
                                THEN 50.0
                                WHEN EXISTS (
                                    SELECT 1 FROM unnest($1::TEXT[]) AS search_val, unnest(ac.location_vector) AS loc_val
                                    WHERE LOWER(loc_val) = LOWER(search_val)
                                )
                                THEN 35.0
                                ELSE 0.0
                            END
                        ) as relevance_score
                    FROM autocomplete_characteristics ac
                    INNER JOIN services s ON s.id = ac.service_id
                    INNER JOIN users u ON u.id = s.user_id
                    WHERE 
                        ac.is_real_product = TRUE
                        AND ac.identifiant_base = 'produits'
                        AND s.is_active = TRUE
                        AND (
                            EXISTS (
                                SELECT 1 FROM unnest($1::TEXT[]) AS search_val
                                WHERE EXISTS (
                                    SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                                    WHERE LOWER(vec_val) LIKE '%' || LOWER(search_val) || '%'
                                )
                            )
                            OR EXISTS (
                                SELECT 1 FROM unnest($1::TEXT[]) AS search_val
                                WHERE EXISTS (
                                    SELECT 1 FROM unnest(ac.characteristic_vector) AS vec_val
                                    WHERE LOWER(vec_val) LIKE '%' || LOWER(search_val) || '%'
                                )
                            )
                        )
                    ORDER BY s.id, relevance_score DESC
                    LIMIT $4
                    "#
                )
                .bind(combination_vector)
                .bind(lng)
                .bind(lat)
                .bind(limit)
                .fetch_all(pool)
                .await
            } else {
                Err(e)
            }
        })?
    } else {
        // Recherche SANS GPS
        sqlx::query(
            r#"
            SELECT DISTINCT ON (s.id)
                s.id as service_id,
                s.data as service_data,
                ac.product_id,
                ac.characteristic_vector as product_vector,
                ac.product_labels,
                ac.location_vector,
                ac.full_vector,
                ac.chosen_location,
                ac.usage_count,
                u.id as user_id,
                u.email as user_email,
                -- ✅ Extractions produit (compatibilité client_service)
                CASE
                    WHEN (s.data->'produits'->>'prix') ~ '^[0-9]+(\.[0-9]+)?$'
                    THEN (s.data->'produits'->>'prix')::FLOAT
                    ELSE NULL
                END as prix,
                s.data->'produits'->>'devise' as devise,
                COALESCE((s.data->'produits'->>'has_variant')::BOOLEAN, FALSE) as has_variant,
                s.data->'produits'->>'variant_dimension' as variant_dimension,
                NULL::DOUBLE PRECISION as distance_km,
                -- Score de pertinence
                (
                    (
                        SELECT COUNT(*)::REAL * 20.0
                        FROM unnest($1::TEXT[]) AS search_val
                        WHERE EXISTS (
                            SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                            WHERE LOWER(vec_val) = LOWER(search_val)
                        )
                    ) +
                    (
                        SELECT COUNT(*)::REAL * 10.0
                        FROM unnest($1::TEXT[]) AS search_val
                        WHERE EXISTS (
                            SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                            WHERE LOWER(vec_val) LIKE '%' || LOWER(search_val) || '%'
                        )
                    ) +
                    (ac.usage_count::REAL * 2.0) +
                    CASE 
                        WHEN ac.chosen_location IS NOT NULL AND EXISTS (
                            SELECT 1 FROM unnest($1::TEXT[]) AS search_val
                            WHERE LOWER(ac.chosen_location) = LOWER(search_val)
                        )
                        THEN 50.0
                        WHEN EXISTS (
                            SELECT 1 FROM unnest($1::TEXT[]) AS search_val, unnest(ac.location_vector) AS loc_val
                            WHERE LOWER(loc_val) = LOWER(search_val)
                        )
                        THEN 35.0
                        ELSE 0.0
                    END
                ) as relevance_score
            FROM autocomplete_characteristics ac
            INNER JOIN services s ON s.id = ac.service_id
            INNER JOIN users u ON u.id = s.user_id
            WHERE 
                -- ✅ OPTIMISÉ 2025-01-14: Utiliser index composite pour filtres fréquents
                ac.is_real_product = TRUE
                AND ac.identifiant_base = 'produits'
                AND s.is_active = TRUE
                -- ✅ CORRIGÉ 2025-12-16: Utiliser LIKE pour correspondances partielles au lieu de && (correspondance exacte)
                -- Le problème: && nécessite correspondance exacte d'éléments, alors qu'on veut des correspondances partielles
                -- Solution: Utiliser LIKE pour trouver "chaussures" dans "Chaussures pour enfants"
                AND (
                    -- Au moins UN élément du vecteur recherché doit matcher dans full_vector
                    EXISTS (
                        SELECT 1 FROM unnest($1::TEXT[]) AS search_val
                        WHERE EXISTS (
                            SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                            WHERE LOWER(vec_val) LIKE '%' || LOWER(search_val) || '%'
                        )
                    )
                    -- OU dans characteristic_vector
                    OR EXISTS (
                        SELECT 1 FROM unnest($1::TEXT[]) AS search_val
                        WHERE EXISTS (
                            SELECT 1 FROM unnest(ac.characteristic_vector) AS vec_val
                            WHERE LOWER(vec_val) LIKE '%' || LOWER(search_val) || '%'
                        )
                    )
                )
            ORDER BY s.id, relevance_score DESC
            LIMIT $2
            "#
        )
        .bind(combination_vector)
        .bind(limit)
        .fetch_all(pool)
        .await
        
        // ✅ CORRIGÉ 2025-12-18: Retry avec backoff pour erreurs TLS
        .or_else(|e| async {
            let error_msg = e.to_string();
            if error_msg.contains("TLS")
                || error_msg.contains("close_notify")
                || error_msg.contains("Connection reset")
                || error_msg.contains("peer closed")
                || error_msg.contains("communicating with database")
            {
                log::warn!("[AutocompleteSearchService] ⚠️ Erreur DB détectée, retry...");
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                // Retry avec la même query (sans GPS)
                sqlx::query(
                    r#"
                    SELECT DISTINCT ON (s.id)
                        s.id as service_id,
                        s.data as service_data,
                        ac.product_id,
                        ac.characteristic_vector as product_vector,
                        ac.product_labels,
                        ac.location_vector,
                        ac.full_vector,
                        ac.chosen_location,
                        ac.usage_count,
                        u.id as user_id,
                        u.email as user_email,
                        CASE
                            WHEN (s.data->'produits'->>'prix') ~ '^[0-9]+(\.[0-9]+)?$'
                            THEN (s.data->'produits'->>'prix')::FLOAT
                            ELSE NULL
                        END as prix,
                        s.data->'produits'->>'devise' as devise,
                        COALESCE((s.data->'produits'->>'has_variant')::BOOLEAN, FALSE) as has_variant,
                        s.data->'produits'->>'variant_dimension' as variant_dimension,
                        NULL::DOUBLE PRECISION as distance_km,
                        (
                            (
                                SELECT COUNT(*)::REAL * 20.0
                                FROM unnest($1::TEXT[]) AS search_val
                                WHERE EXISTS (
                                    SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                                    WHERE LOWER(vec_val) = LOWER(search_val)
                                )
                            ) +
                            (
                                SELECT COUNT(*)::REAL * 10.0
                                FROM unnest($1::TEXT[]) AS search_val
                                WHERE EXISTS (
                                    SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                                    WHERE LOWER(vec_val) LIKE '%' || LOWER(search_val) || '%'
                                )
                            ) +
                            (ac.usage_count::REAL * 2.0) +
                            CASE 
                                WHEN ac.chosen_location IS NOT NULL AND EXISTS (
                                    SELECT 1 FROM unnest($1::TEXT[]) AS search_val
                                    WHERE LOWER(ac.chosen_location) = LOWER(search_val)
                                )
                                THEN 50.0
                                WHEN EXISTS (
                                    SELECT 1 FROM unnest($1::TEXT[]) AS search_val, unnest(ac.location_vector) AS loc_val
                                    WHERE LOWER(loc_val) = LOWER(search_val)
                                )
                                THEN 35.0
                                ELSE 0.0
                            END
                        ) as relevance_score
                    FROM autocomplete_characteristics ac
                    INNER JOIN services s ON s.id = ac.service_id
                    INNER JOIN users u ON u.id = s.user_id
                    WHERE 
                        ac.is_real_product = TRUE
                        AND ac.identifiant_base = 'produits'
                        AND s.is_active = TRUE
                        AND (
                            EXISTS (
                                SELECT 1 FROM unnest($1::TEXT[]) AS search_val
                                WHERE EXISTS (
                                    SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                                    WHERE LOWER(vec_val) LIKE '%' || LOWER(search_val) || '%'
                                )
                            )
                            OR EXISTS (
                                SELECT 1 FROM unnest($1::TEXT[]) AS search_val
                                WHERE EXISTS (
                                    SELECT 1 FROM unnest(ac.characteristic_vector) AS vec_val
                                    WHERE LOWER(vec_val) LIKE '%' || LOWER(search_val) || '%'
                                )
                            )
                        )
                    ORDER BY s.id, relevance_score DESC
                    LIMIT $2
                    "#
                )
                .bind(combination_vector)
                .bind(limit)
                .fetch_all(pool)
                .await
            } else {
                Err(e)
            }
        })?
    };

    let mut results = Vec::new();
    for row in rows {
        let service_id: i32 = row.get::<i32, _>("service_id");
        let service_data: serde_json::Value = row.get::<serde_json::Value, _>("service_data");
        let user_id: i32 = row.get::<i32, _>("user_id");
        let user_email: String = row.get::<String, _>("user_email");

        // Extraire nom prestataire du JSON ou de l'email
        let nom_prestataire = service_data
            .get("nom_prestataire")
            .and_then(|v| v.as_str())
            .or_else(|| service_data.get("prestataire").and_then(|v| v.as_str()))
            .unwrap_or(&user_email)
            .to_string();

        results.push(AutocompleteSearchResult {
            service_id,
            product_id: row.get::<String, _>("product_id"),
            product_vector: row.get::<Vec<String>, _>("product_vector"),
            product_labels: row.get::<Vec<String>, _>("product_labels"),
            location_vector: row.get::<Vec<String>, _>("location_vector"),
            full_vector: row.get::<Vec<String>, _>("full_vector"),
            chosen_location: row.get::<Option<String>, _>("chosen_location"),
            usage_count: row.get::<i32, _>("usage_count"),
            relevance_score: row.get::<f64, _>("relevance_score"),
            service_data,
            prestataire: Some(PrestataireInfo {
                user_id,
                nom: nom_prestataire,
                avatar_url: None,
            }),
            distance_km: row.get::<Option<f64>, _>("distance_km"),
            // ✅ Extractions produit
            has_variant: row.get::<bool, _>("has_variant"),
            variant_dimension: row.get::<Option<String>, _>("variant_dimension"),
            prix: row.get::<Option<f64>, _>("prix"),
            devise: row.get::<Option<String>, _>("devise"),
        });
    }

    log::info!(
        "[AutocompleteSearchService] ✅ {} résultats trouvés",
        results.len()
    );

    Ok(results)
}
