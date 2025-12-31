-- 🔍 Script de diagnostic : Pourquoi seulement 3 résultats avec keyword_search_with_gps ?

-- ============================================
-- 1. Vérifier les produits dans services.data->'produits'
-- ============================================

-- Compter les services actifs avec produits
SELECT 
    'Services actifs avec produits' as diagnostic,
    COUNT(*) as count
FROM services s
WHERE s.is_active = true
AND s.data->'produits' IS NOT NULL;

-- Lister tous les produits avec leur nom
SELECT 
    s.id as service_id,
    s.data->'titre_service'->>'valeur' as titre_service,
    jsonb_typeof(s.data->'produits') as type_produits,
    jsonb_typeof(s.data->'produits'->'valeur') as type_produits_valeur,
    jsonb_array_length(
        CASE 
            WHEN jsonb_typeof(s.data->'produits') = 'array' 
            THEN s.data->'produits'
            WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
            THEN s.data->'produits'->'valeur'
            ELSE '[]'::jsonb
        END
    ) as nb_produits,
    -- Extraire tous les noms de produits
    (
        SELECT string_agg(
            COALESCE(product->>'nom_produit', product->>'nom', 'SANS NOM'),
            ', '
        )
        FROM jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                THEN s.data->'produits'
                WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                THEN s.data->'produits'->'valeur'
                ELSE '[]'::jsonb
            END
        ) AS product
    ) as noms_produits
FROM services s
WHERE s.is_active = true
AND s.data->'produits' IS NOT NULL
ORDER BY s.id;

-- ============================================
-- 2. Rechercher "chaussures" dans produits
-- ============================================

-- Services avec "chaussures" dans nom_produit (exactement comme keyword_search_with_gps)
SELECT 
    'Services avec "chaussures" dans nom_produit' as diagnostic,
    COUNT(DISTINCT s.id) as count
FROM services s
WHERE s.is_active = true
AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
        CASE 
            WHEN jsonb_typeof(s.data->'produits') = 'array' 
            THEN s.data->'produits'
            WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
            THEN s.data->'produits'->'valeur'
            ELSE '[]'::jsonb
        END
    ) AS product
    WHERE (
        LOWER(COALESCE(product->>'nom_produit', product->>'nom', '')) = LOWER('chaussures')
        OR COALESCE(product->>'nom_produit', product->>'nom', '') ILIKE 'chaussures' || '%'
        OR COALESCE(product->>'nom_produit', product->>'nom', '') ILIKE '%' || 'chaussures' || '%'
        OR to_tsvector('french', COALESCE(product->>'nom_produit', product->>'nom', '')) @@ plainto_tsquery('french', 'chaussures')
    )
);

-- Détails des services trouvés
SELECT 
    s.id as service_id,
    s.data->'titre_service'->>'valeur' as titre_service,
    product->>'nom_produit' as nom_produit,
    product->>'nom' as nom,
    product->>'description_produit' as description_produit,
    -- Score calculé (comme dans keyword_search_with_gps)
    CASE 
        WHEN LOWER(COALESCE(product->>'nom_produit', product->>'nom', '')) = LOWER('chaussures') THEN 100.0
        WHEN COALESCE(product->>'nom_produit', product->>'nom', '') ILIKE 'chaussures' || '%' THEN 80.0
        WHEN COALESCE(product->>'nom_produit', product->>'nom', '') ILIKE '%' || 'chaussures' || '%' THEN 40.0
        ELSE 0.0
    END as score
FROM services s
CROSS JOIN LATERAL jsonb_array_elements(
    CASE 
        WHEN jsonb_typeof(s.data->'produits') = 'array' 
        THEN s.data->'produits'
        WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
        THEN s.data->'produits'->'valeur'
        ELSE '[]'::jsonb
    END
) AS product
WHERE s.is_active = true
AND (
    LOWER(COALESCE(product->>'nom_produit', product->>'nom', '')) = LOWER('chaussures')
    OR COALESCE(product->>'nom_produit', product->>'nom', '') ILIKE 'chaussures' || '%'
    OR COALESCE(product->>'nom_produit', product->>'nom', '') ILIKE '%' || 'chaussures' || '%'
    OR to_tsvector('french', COALESCE(product->>'nom_produit', product->>'nom', '')) @@ plainto_tsquery('french', 'chaussures')
)
ORDER BY score DESC, s.id;

-- ============================================
-- 3. Vérifier autocomplete_characteristics
-- ============================================

-- Compter les entrées dans autocomplete_characteristics pour produits
SELECT 
    'Entrées autocomplete_characteristics pour produits' as diagnostic,
    COUNT(*) as count
FROM autocomplete_characteristics ac
WHERE ac.identifiant_base = 'produits'
AND ac.is_real_product = TRUE;

-- Vérifier si "chaussures" est dans autocomplete_characteristics
SELECT 
    'Match "chaussures" dans autocomplete_characteristics' as diagnostic,
    COUNT(*) as count
FROM autocomplete_characteristics ac
INNER JOIN services s ON s.id = ac.service_id
WHERE s.is_active = true
AND ac.identifiant_base = 'produits'
AND ac.is_real_product = TRUE
AND (
    LOWER(ac.valeur) = LOWER('chaussures')
    OR ac.valeur ILIKE 'chaussures' || '%'
    OR ac.valeur ILIKE '%' || 'chaussures' || '%'
    OR to_tsvector('french', ac.valeur) @@ plainto_tsquery('french', 'chaussures')
);

-- Détails des matches dans autocomplete_characteristics
SELECT 
    ac.service_id,
    ac.valeur,
    ac.usage_count,
    s.data->'titre_service'->>'valeur' as titre_service,
    -- Score calculé (comme dans keyword_search_with_gps)
    (
        CASE WHEN LOWER(ac.valeur) = LOWER('chaussures') THEN 100.0 ELSE 0.0 END +
        CASE WHEN ac.valeur ILIKE 'chaussures' || '%' THEN 80.0 ELSE 0.0 END +
        CASE WHEN ac.valeur ILIKE '%' || 'chaussures' || '%' THEN 60.0 ELSE 0.0 END +
        ts_rank(to_tsvector('french', ac.valeur), plainto_tsquery('french', 'chaussures')) * 20.0 +
        (ac.usage_count::REAL * 0.5)
    )::REAL as ac_score
FROM autocomplete_characteristics ac
INNER JOIN services s ON s.id = ac.service_id
WHERE s.is_active = true
AND ac.identifiant_base = 'produits'
AND ac.is_real_product = TRUE
AND (
    LOWER(ac.valeur) = LOWER('chaussures')
    OR ac.valeur ILIKE 'chaussures' || '%'
    OR ac.valeur ILIKE '%' || 'chaussures' || '%'
    OR to_tsvector('french', ac.valeur) @@ plainto_tsquery('french', 'chaussures')
)
ORDER BY ac_score DESC;

-- ============================================
-- 4. Simuler exactement keyword_search_with_gps
-- ============================================

-- Simuler la requête complète keyword_search_with_gps pour "chaussures"
WITH autocomplete_matches AS (
    SELECT 
        ac.service_id,
        ac.valeur,
        ac.usage_count,
        (
            CASE WHEN LOWER(ac.valeur) = LOWER('chaussures') THEN 100.0 ELSE 0.0 END +
            CASE WHEN ac.valeur ILIKE 'chaussures' || '%' THEN 80.0 ELSE 0.0 END +
            CASE WHEN ac.valeur ILIKE '%' || 'chaussures' || '%' THEN 60.0 ELSE 0.0 END +
            ts_rank(to_tsvector('french', ac.valeur), plainto_tsquery('french', 'chaussures')) * 20.0 +
            (ac.usage_count::REAL * 0.5)
        )::REAL as ac_score
    FROM autocomplete_characteristics ac
    INNER JOIN services s ON s.id = ac.service_id
    WHERE s.is_active = true
    AND ac.identifiant_base = 'produits'
    AND ac.is_real_product = TRUE
    AND (
        LOWER(ac.valeur) = LOWER('chaussures')
        OR ac.valeur ILIKE 'chaussures' || '%'
        OR ac.valeur ILIKE '%' || 'chaussures' || '%'
        OR to_tsvector('french', ac.valeur) @@ plainto_tsquery('french', 'chaussures')
    )
),
best_autocomplete_per_service AS (
    SELECT DISTINCT ON (service_id)
        service_id,
        ac_score
    FROM autocomplete_matches
    ORDER BY service_id, ac_score DESC, usage_count DESC NULLS LAST
)
SELECT 
    'Résultats keyword_search_with_gps simulés' as diagnostic,
    COUNT(*) as count
FROM services s
LEFT JOIN best_autocomplete_per_service ac ON ac.service_id = s.id
WHERE s.is_active = true
AND (
    ac.service_id IS NOT NULL
    OR
    EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                THEN s.data->'produits'
                WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                THEN s.data->'produits'->'valeur'
                ELSE '[]'::jsonb
            END
        ) AS product
        WHERE (
            LOWER(COALESCE(product->>'nom_produit', product->>'nom', '')) = LOWER('chaussures')
            OR COALESCE(product->>'nom_produit', product->>'nom', '') ILIKE 'chaussures' || '%'
            OR COALESCE(product->>'nom_produit', product->>'nom', '') ILIKE '%' || 'chaussures' || '%'
            OR to_tsvector('french', COALESCE(product->>'nom_produit', product->>'nom', '')) @@ plainto_tsquery('french', 'chaussures')
            OR LOWER(COALESCE(product->>'description_produit', product->>'description', '')) = LOWER('chaussures')
            OR COALESCE(product->>'description_produit', product->>'description', '') ILIKE 'chaussures' || '%'
            OR COALESCE(product->>'description_produit', product->>'description', '') ILIKE '%' || 'chaussures' || '%'
            OR to_tsvector('french', COALESCE(product->>'description_produit', product->>'description', '')) @@ plainto_tsquery('french', 'chaussures')
        )
    )
    OR LOWER(COALESCE(s.data->'titre_service'->>'valeur', '')) = LOWER('chaussures')
    OR COALESCE(s.data->'titre_service'->>'valeur', '') ILIKE 'chaussures' || '%'
    OR COALESCE(s.data->'titre_service'->>'valeur', '') ILIKE '%' || 'chaussures' || '%'
    OR to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', 'chaussures')
    OR COALESCE(s.data->'category'->>'valeur', s.category, '') ILIKE '%' || 'chaussures' || '%'
    OR to_tsvector('french', COALESCE(s.data->'category'->>'valeur', s.category, '')) @@ plainto_tsquery('french', 'chaussures')
    OR COALESCE(s.data->'description'->>'valeur', '') ILIKE '%' || 'chaussures' || '%'
    OR to_tsvector('french', COALESCE(s.data->'description'->>'valeur', '')) @@ plainto_tsquery('french', 'chaussures')
);

-- Détails des résultats avec scores
WITH autocomplete_matches AS (
    SELECT 
        ac.service_id,
        ac.valeur,
        ac.usage_count,
        (
            CASE WHEN LOWER(ac.valeur) = LOWER('chaussures') THEN 100.0 ELSE 0.0 END +
            CASE WHEN ac.valeur ILIKE 'chaussures' || '%' THEN 80.0 ELSE 0.0 END +
            CASE WHEN ac.valeur ILIKE '%' || 'chaussures' || '%' THEN 60.0 ELSE 0.0 END +
            ts_rank(to_tsvector('french', ac.valeur), plainto_tsquery('french', 'chaussures')) * 20.0 +
            (ac.usage_count::REAL * 0.5)
        )::REAL as ac_score
    FROM autocomplete_characteristics ac
    INNER JOIN services s ON s.id = ac.service_id
    WHERE s.is_active = true
    AND ac.identifiant_base = 'produits'
    AND ac.is_real_product = TRUE
    AND (
        LOWER(ac.valeur) = LOWER('chaussures')
        OR ac.valeur ILIKE 'chaussures' || '%'
        OR ac.valeur ILIKE '%' || 'chaussures' || '%'
        OR to_tsvector('french', ac.valeur) @@ plainto_tsquery('french', 'chaussures')
    )
),
best_autocomplete_per_service AS (
    SELECT DISTINCT ON (service_id)
        service_id,
        ac_score
    FROM autocomplete_matches
    ORDER BY service_id, ac_score DESC, usage_count DESC NULLS LAST
)
SELECT 
    s.id,
    s.data->'titre_service'->>'valeur' as titre_service,
    COALESCE(ac.ac_score, 0.0) as ac_score,
    GREATEST(
        COALESCE(ac.ac_score, 0.0),
        CASE 
            WHEN EXISTS (
                SELECT 1
                FROM jsonb_array_elements(
                    CASE 
                        WHEN jsonb_typeof(s.data->'produits') = 'array' 
                        THEN s.data->'produits'
                        WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                        THEN s.data->'produits'->'valeur'
                        ELSE '[]'::jsonb
                    END
                ) AS product
                WHERE LOWER(COALESCE(product->>'nom_produit', product->>'nom', '')) = LOWER('chaussures')
            ) THEN 100.0
            WHEN EXISTS (
                SELECT 1
                FROM jsonb_array_elements(
                    CASE 
                        WHEN jsonb_typeof(s.data->'produits') = 'array' 
                        THEN s.data->'produits'
                        WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                        THEN s.data->'produits'->'valeur'
                        ELSE '[]'::jsonb
                    END
                ) AS product
                WHERE COALESCE(product->>'nom_produit', product->>'nom', '') ILIKE 'chaussures' || '%'
            ) THEN 80.0
            WHEN EXISTS (
                SELECT 1
                FROM jsonb_array_elements(
                    CASE 
                        WHEN jsonb_typeof(s.data->'produits') = 'array' 
                        THEN s.data->'produits'
                        WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                        THEN s.data->'produits'->'valeur'
                        ELSE '[]'::jsonb
                    END
                ) AS product
                WHERE COALESCE(product->>'nom_produit', product->>'nom', '') ILIKE '%' || 'chaussures' || '%'
            ) THEN 40.0
            ELSE 0.0
        END
    )::REAL as keyword_score,
    CASE 
        WHEN ac.service_id IS NOT NULL THEN 'autocomplete_characteristics'
        ELSE 'jsonb_array_elements_fallback'
    END as source
FROM services s
LEFT JOIN best_autocomplete_per_service ac ON ac.service_id = s.id
WHERE s.is_active = true
AND (
    ac.service_id IS NOT NULL
    OR
    EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                THEN s.data->'produits'
                WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                THEN s.data->'produits'->'valeur'
                ELSE '[]'::jsonb
            END
        ) AS product
        WHERE (
            LOWER(COALESCE(product->>'nom_produit', product->>'nom', '')) = LOWER('chaussures')
            OR COALESCE(product->>'nom_produit', product->>'nom', '') ILIKE 'chaussures' || '%'
            OR COALESCE(product->>'nom_produit', product->>'nom', '') ILIKE '%' || 'chaussures' || '%'
            OR to_tsvector('french', COALESCE(product->>'nom_produit', product->>'nom', '')) @@ plainto_tsquery('french', 'chaussures')
        )
    )
)
ORDER BY keyword_score DESC
LIMIT 50;

-- ============================================
-- 5. Comparer avec les autres termes
-- ============================================

-- Tester avec d'autres termes pour voir combien de résultats
SELECT 
    search_term,
    COUNT(DISTINCT s.id) as count_results
FROM (
    SELECT 'chaussures' as search_term
    UNION ALL SELECT 'sneakers'
    UNION ALL SELECT 'baskets'
    UNION ALL SELECT 'chaussure'
    UNION ALL SELECT 'chauss'
) terms
CROSS JOIN services s
WHERE s.is_active = true
AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
        CASE 
            WHEN jsonb_typeof(s.data->'produits') = 'array' 
            THEN s.data->'produits'
            WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
            THEN s.data->'produits'->'valeur'
            ELSE '[]'::jsonb
        END
    ) AS product
    WHERE COALESCE(product->>'nom_produit', product->>'nom', '') ILIKE '%' || terms.search_term || '%'
)
GROUP BY search_term
ORDER BY count_results DESC;

