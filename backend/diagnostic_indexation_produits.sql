-- Script de diagnostic : Vérifier l'indexation des produits
-- Pour comprendre pourquoi seulement 3 résultats sont trouvés

-- =====================================================
-- 1. COMPTER LES PRODUITS INDEXÉS
-- =====================================================

SELECT 
    'Produits indexés dans autocomplete_characteristics' as metric,
    COUNT(*) as count
FROM autocomplete_characteristics 
WHERE is_real_product = TRUE 
AND identifiant_base = 'produits';

-- =====================================================
-- 2. COMPTER LES SERVICES ACTIFS AVEC PRODUITS
-- =====================================================

SELECT 
    'Services actifs avec produits' as metric,
    COUNT(*) as count
FROM services s
WHERE s.is_active = true
AND (
    s.data->'produits' IS NOT NULL 
    OR s.data->'produits'->'valeur' IS NOT NULL
    OR jsonb_typeof(s.data->'produits') = 'array'
);

-- =====================================================
-- 3. PRODUITS NON INDEXÉS (dans services mais pas dans autocomplete_characteristics)
-- =====================================================

SELECT 
    s.id as service_id,
    s.data->'produits' as produits_data,
    s.data->'titre_service'->>'valeur' as titre_service,
    s.created_at
FROM services s
WHERE s.is_active = true
AND (
    s.data->'produits' IS NOT NULL 
    OR s.data->'produits'->'valeur' IS NOT NULL
    OR jsonb_typeof(s.data->'produits') = 'array'
)
AND NOT EXISTS (
    SELECT 1 
    FROM autocomplete_characteristics ac
    WHERE ac.service_id = s.id
    AND ac.is_real_product = TRUE
    AND ac.identifiant_base = 'produits'
)
ORDER BY s.created_at DESC;

-- =====================================================
-- 4. VÉRIFIER LES 3 RÉSULTATS TROUVÉS POUR "chaussures"
-- =====================================================

SELECT 
    ac.id,
    ac.service_id,
    ac.valeur,
    ac.characteristic_vector,
    ac.normalized_characteristic_vector,
    ac.full_vector,
    ac.normalized_full_vector,
    ac.is_real_product,
    ac.identifiant_base,
    s.data->'titre_service'->>'valeur' as titre_service,
    s.data->'produits'->'valeur' as produits
FROM autocomplete_characteristics ac
INNER JOIN services s ON s.id = ac.service_id
WHERE ac.valeur ILIKE '%chaussures%'
OR ac.valeur ILIKE '%chaussure%'
AND ac.is_real_product = TRUE
AND ac.identifiant_base = 'produits'
ORDER BY ac.usage_count DESC;

-- =====================================================
-- 5. TESTER LA RECHERCHE VECTORIELLE (pourquoi 0 résultats)
-- =====================================================

-- Test avec le mot "chaussures" normalisé
SELECT 
    ac.service_id,
    ac.valeur,
    ac.normalized_characteristic_vector,
    ac.normalized_full_vector,
    -- Test overlap
    (ac.normalized_characteristic_vector && ARRAY['chaussures']::TEXT[]) as match_characteristic,
    (ac.normalized_full_vector && ARRAY['chaussures']::TEXT[]) as match_full,
    -- Test avec calculate_best_vector_match_score
    calculate_best_vector_match_score(
        ac.normalized_characteristic_vector,
        ac.normalized_full_vector,
        ARRAY['chaussures']::TEXT[]
    ) as vector_score
FROM autocomplete_characteristics ac
WHERE ac.is_real_product = TRUE
AND ac.identifiant_base = 'produits'
AND ac.valeur ILIKE '%chaussure%'
LIMIT 10;

-- =====================================================
-- 6. VÉRIFIER LES COLONNES NORMALISÉES
-- =====================================================

SELECT 
    ac.id,
    ac.valeur,
    ac.characteristic_vector,
    ac.normalized_characteristic_vector,
    ac.full_vector,
    ac.normalized_full_vector,
    -- Vérifier si les colonnes normalisées sont vides
    CASE 
        WHEN ac.normalized_characteristic_vector IS NULL OR array_length(ac.normalized_characteristic_vector, 1) IS NULL 
        THEN 'VIDE' 
        ELSE 'OK' 
    END as status_characteristic,
    CASE 
        WHEN ac.normalized_full_vector IS NULL OR array_length(ac.normalized_full_vector, 1) IS NULL 
        THEN 'VIDE' 
        ELSE 'OK' 
    END as status_full
FROM autocomplete_characteristics ac
WHERE ac.is_real_product = TRUE
AND ac.identifiant_base = 'produits'
LIMIT 20;

-- =====================================================
-- 7. STATISTIQUES GÉNÉRALES
-- =====================================================

SELECT 
    'Total services actifs' as metric,
    COUNT(*) as count
FROM services
WHERE is_active = true

UNION ALL

SELECT 
    'Services avec produits' as metric,
    COUNT(*) as count
FROM services
WHERE is_active = true
AND (
    data->'produits' IS NOT NULL 
    OR data->'produits'->'valeur' IS NOT NULL
)

UNION ALL

SELECT 
    'Produits indexés (autocomplete_characteristics)' as metric,
    COUNT(*) as count
FROM autocomplete_characteristics
WHERE is_real_product = TRUE
AND identifiant_base = 'produits'

UNION ALL

SELECT 
    'Produits avec normalized_characteristic_vector vide' as metric,
    COUNT(*) as count
FROM autocomplete_characteristics
WHERE is_real_product = TRUE
AND identifiant_base = 'produits'
AND (
    normalized_characteristic_vector IS NULL 
    OR array_length(normalized_characteristic_vector, 1) IS NULL
)

UNION ALL

SELECT 
    'Produits avec normalized_full_vector vide' as metric,
    COUNT(*) as count
FROM autocomplete_characteristics
WHERE is_real_product = TRUE
AND identifiant_base = 'produits'
AND (
    normalized_full_vector IS NULL 
    OR array_length(normalized_full_vector, 1) IS NULL
);

-- =====================================================
-- 8. TESTER LA RECHERCHE KEYWORD (pourquoi 3 résultats)
-- =====================================================

-- Simuler la recherche keyword_search_with_gps pour "chaussures"
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
)
SELECT 
    ac.service_id,
    ac.valeur,
    ac.ac_score,
    s.data->'titre_service'->>'valeur' as titre_service
FROM autocomplete_matches ac
INNER JOIN services s ON s.id = ac.service_id
ORDER BY ac.ac_score DESC
LIMIT 10;


