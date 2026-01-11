// Service de recherche de produits par vecteur autocomplete
// Utilise autocomplete_characteristics pour trouver les VRAIS produits des prestataires
use crate::core::types::AppError;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutocompleteSearchResult {
    pub service_id: i32,
    pub product_id: Option<String>, // ✅ CORRIGÉ 2025-12-22: Peut être NULL dans la base
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

    // ✅ CORRIGÉ 2025-12-18: Retry avec gestion d'erreur TLS pour requêtes autocomplete
    let mut query_result = Err(AppError::Internal("Initial attempt".to_string()));
    let max_retries = 3;
    
    for attempt in 1..=max_retries {
        query_result = if let Some((lat, lng)) = user_location {
        // ✅ OPTIMISÉ 2025-12-20: Recherche AVEC GPS utilisant index GIN tsvector (ultra-rapide)
        // Construire la requête tsquery depuis le vecteur de recherche
        let search_query = combination_vector.join(" | "); // Format tsquery: "mot1 | mot2 | mot3"
        
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
                -- ✅ Extractions produit depuis service_products (plus services.data->produits)
                CASE
                    WHEN sp.product_data->'prix'->'valeur'->>'montant' IS NOT NULL
                    THEN (sp.product_data->'prix'->'valeur'->>'montant')::FLOAT
                    WHEN sp.product_data->'prix'->>'montant' IS NOT NULL
                    THEN (sp.product_data->'prix'->>'montant')::FLOAT
                    WHEN sp.product_price IS NOT NULL
                    THEN sp.product_price::FLOAT
                    ELSE NULL
                END as prix,
                COALESCE(
                    sp.product_data->'prix'->'valeur'->>'devise',
                    sp.product_data->'prix'->>'devise',
                    sp.product_data->>'devise'
                ) as devise,
                COALESCE(
                    (sp.product_data->>'has_variant')::BOOLEAN,
                    FALSE
                ) as has_variant,
                sp.product_data->>'variant_dimension' as variant_dimension,
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
                -- ✅ OPTIMISÉ: Score basé sur ts_rank (utilise l'index GIN) + usage_count + distance
                (
                    ts_rank(to_tsvector('french', ac.valeur), plainto_tsquery('french', $4)) * 20.0 +
                    (ac.usage_count::REAL * 2.0) +
                    -- Bonus lieu exact (si présent dans le vecteur de recherche)
                    CASE 
                        WHEN ac.chosen_location IS NOT NULL 
                             AND to_tsvector('french', ac.chosen_location) @@ plainto_tsquery('french', $4)
                        THEN 50.0
                        WHEN to_tsvector('french', array_to_string(ac.location_vector, ' ')) @@ plainto_tsquery('french', $4)
                        THEN 35.0
                        ELSE 0.0
                    END
                ) as relevance_score
            FROM autocomplete_characteristics ac
            INNER JOIN services s ON s.id = ac.service_id
            INNER JOIN service_products sp ON sp.id::TEXT = ac.product_id AND sp.service_id = ac.service_id
            INNER JOIN users u ON u.id = s.user_id
            WHERE 
                -- ✅ OPTIMISÉ: Utiliser index composite pour filtres fréquents
                ac.is_real_product = TRUE
                AND ac.identifiant_base = 'produits'
                AND s.is_active = TRUE
                AND sp.is_active = TRUE
                -- ✅ OPTIMISÉ 2025-12-21: Utiliser tsvector @@ tsquery avec index GIN (ultra-rapide)
                -- Au lieu de LIKE '%...%' avec sous-requêtes corrélées (très lent)
                -- Note: Les index GIN sur to_tsvector('french', array_to_string(...)) sont créés dans la migration 20251221
                AND (
                    -- Recherche dans valeur (index GIN tsvector - idx_autocomplete_characteristics_valeur_tsvector)
                    to_tsvector('french', ac.valeur) @@ plainto_tsquery('french', $4)
                    -- OU dans full_vector (index GIN tsvector - idx_autocomplete_full_vector_tsvector_gin)
                    -- Utilise la fonction IMMUTABLE full_vector_to_tsvector() pour utiliser l'index
                    OR full_vector_to_tsvector(ac.full_vector) @@ plainto_tsquery('french', $4)
                    -- OU dans characteristic_vector (index GIN tsvector - idx_autocomplete_characteristic_vector_tsvector_gin)
                    -- Utilise la fonction IMMUTABLE characteristic_vector_to_tsvector() pour utiliser l'index
                    OR characteristic_vector_to_tsvector(ac.characteristic_vector) @@ plainto_tsquery('french', $4)
                )
            ORDER BY s.id, relevance_score DESC, distance_km ASC NULLS LAST
            LIMIT $5
            "#
        )
        .bind(combination_vector) // Garder pour compatibilité (non utilisé dans la nouvelle requête)
        .bind(lng)
        .bind(lat)
        .bind(&search_query) // Requête tsquery pour recherche full-text
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(Into::into)
    } else {
        // ✅ OPTIMISÉ 2025-12-20: Recherche SANS GPS utilisant index GIN tsvector (ultra-rapide)
        // Le problème: LIKE '%...%' avec sous-requêtes corrélées = très lent (15 secondes)
        // Solution: Utiliser tsvector @@ tsquery avec index GIN = instantané (< 100ms)
        
        // Construire la requête tsquery depuis le vecteur de recherche
        let search_query = combination_vector.join(" | "); // Format tsquery: "mot1 | mot2 | mot3"
        
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
                -- ✅ Extractions produit depuis service_products (plus services.data->produits)
                CASE
                    WHEN sp.product_data->'prix'->'valeur'->>'montant' IS NOT NULL
                    THEN (sp.product_data->'prix'->'valeur'->>'montant')::FLOAT
                    WHEN sp.product_data->'prix'->>'montant' IS NOT NULL
                    THEN (sp.product_data->'prix'->>'montant')::FLOAT
                    WHEN sp.product_price IS NOT NULL
                    THEN sp.product_price::FLOAT
                    ELSE NULL
                END as prix,
                COALESCE(
                    sp.product_data->'prix'->'valeur'->>'devise',
                    sp.product_data->'prix'->>'devise',
                    sp.product_data->>'devise'
                ) as devise,
                COALESCE(
                    (sp.product_data->>'has_variant')::BOOLEAN,
                    FALSE
                ) as has_variant,
                sp.product_data->>'variant_dimension' as variant_dimension,
                NULL::DOUBLE PRECISION as distance_km,
                -- ✅ OPTIMISÉ: Score basé sur ts_rank (utilise l'index GIN) + usage_count
                (
                    ts_rank(to_tsvector('french', ac.valeur), plainto_tsquery('french', $2)) * 20.0 +
                    (ac.usage_count::REAL * 2.0) +
                    -- Bonus lieu exact (si présent dans le vecteur de recherche)
                    CASE 
                        WHEN ac.chosen_location IS NOT NULL 
                             AND to_tsvector('french', ac.chosen_location) @@ plainto_tsquery('french', $2)
                        THEN 50.0
                        WHEN to_tsvector('french', array_to_string(ac.location_vector, ' ')) @@ plainto_tsquery('french', $2)
                        THEN 35.0
                        ELSE 0.0
                    END
                ) as relevance_score
            FROM autocomplete_characteristics ac
            INNER JOIN services s ON s.id = ac.service_id
            INNER JOIN users u ON u.id = s.user_id
            WHERE 
                -- ✅ OPTIMISÉ: Utiliser index composite pour filtres fréquents
                ac.is_real_product = TRUE
                AND ac.identifiant_base = 'produits'
                AND s.is_active = TRUE
                -- ✅ OPTIMISÉ 2025-12-21: Utiliser tsvector @@ tsquery avec index GIN (ultra-rapide)
                -- Au lieu de LIKE '%...%' avec sous-requêtes corrélées (très lent)
                -- Note: Les index GIN sur to_tsvector('french', array_to_string(...)) sont créés dans la migration 20251221
                AND (
                    -- Recherche dans valeur (index GIN tsvector - idx_autocomplete_characteristics_valeur_tsvector)
                    to_tsvector('french', ac.valeur) @@ plainto_tsquery('french', $2)
                    -- OU dans full_vector (index GIN tsvector - idx_autocomplete_full_vector_tsvector_gin)
                    -- Utilise la fonction IMMUTABLE full_vector_to_tsvector() pour utiliser l'index
                    OR full_vector_to_tsvector(ac.full_vector) @@ plainto_tsquery('french', $2)
                    -- OU dans characteristic_vector (index GIN tsvector - idx_autocomplete_characteristic_vector_tsvector_gin)
                    -- Utilise la fonction IMMUTABLE characteristic_vector_to_tsvector() pour utiliser l'index
                    OR characteristic_vector_to_tsvector(ac.characteristic_vector) @@ plainto_tsquery('french', $2)
                )
            ORDER BY s.id, relevance_score DESC
            LIMIT $3
            "#
        )
        .bind(combination_vector) // Garder pour compatibilité (non utilisé dans la nouvelle requête)
        .bind(&search_query) // Requête tsquery pour recherche full-text
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(Into::into)
        };
        
        match &query_result {
            Ok(_) => break, // Succès, sortir de la boucle
            Err(e) => {
                let error_msg = e.to_string();
                let is_tls_error = error_msg.contains("TLS")
                    || error_msg.contains("close_notify")
                    || error_msg.contains("Connection reset")
                    || error_msg.contains("peer closed")
                    || error_msg.contains("communicating with database");
                
                if is_tls_error && attempt < max_retries {
                    let delay_ms = 100 * attempt; // Backoff: 100ms, 200ms, 300ms
                    log::warn!(
                        "[AutocompleteSearchService] ⚠️ Erreur DB détectée (tentative {}/{}), retry dans {}ms: {}",
                        attempt,
                        max_retries,
                        delay_ms,
                        error_msg
                    );
                    tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
                    continue;
                } else if !is_tls_error {
                    // Erreur non-TLS, ne pas retry
                    break;
                } else {
                    log::error!(
                        "[AutocompleteSearchService] ❌ Erreur DB après {} tentatives: {}",
                        max_retries,
                        error_msg
                    );
                    break;
                }
            }
        }
    }
    
    let rows = match query_result {
        Ok(rows) => rows,
        Err(e) => {
            let error_msg = format!("Erreur recherche autocomplete: {}", e);
            log::error!("[AutocompleteSearchService] {}", error_msg);
            return Err(AppError::Internal(error_msg));
        }
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
            product_id: row.get::<Option<String>, _>("product_id"), // ✅ CORRIGÉ 2025-12-22: Gérer NULL
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
