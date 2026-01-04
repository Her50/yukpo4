-- ============================================
-- TESTS SIMPLIFIÉS PHASE 1 : INTÉGRITÉ TABLE service_products
-- ============================================
-- Version simplifiée pour éviter les timeouts
-- Date: 2026-01-03
-- ============================================

-- TEST 1 : Vérifier intégrité produits (version simplifiée)
SELECT 
    COUNT(*) as services_avec_differences,
    SUM(CASE 
        WHEN jsonb_array_length(s.data->'produits'->'valeur') > COALESCE(produits_count.count, 0) THEN 1 
        ELSE 0 
    END) as services_avec_produits_manquants
FROM services s
LEFT JOIN (
    SELECT service_id, COUNT(*) as count
    FROM service_products
    GROUP BY service_id
) produits_count ON produits_count.service_id = s.id
WHERE s.is_active = true
AND s.data->'produits'->'valeur' IS NOT NULL
AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
AND jsonb_array_length(s.data->'produits'->'valeur') > 0
AND jsonb_array_length(s.data->'produits'->'valeur') != COALESCE(produits_count.count, 0);

-- TEST 2 : Vérifier product_id dans autocomplete_characteristics
SELECT 
    COUNT(*) as product_id_invalides
FROM autocomplete_characteristics ac
LEFT JOIN service_products p ON p.id = ac.product_id::INTEGER
WHERE ac.is_real_product = TRUE
AND ac.identifiant_base = 'produits'
AND ac.product_id IS NOT NULL
AND (
    ac.product_id::INTEGER != p.id
    OR p.id IS NULL
);

-- TEST 3 : Statistiques globales
SELECT 
    'Services avec produits (JSONB)' as metric,
    COUNT(DISTINCT s.id)::BIGINT as count
FROM services s
WHERE s.is_active = true
AND s.data->'produits'->'valeur' IS NOT NULL
AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
AND jsonb_array_length(s.data->'produits'->'valeur') > 0

UNION ALL

SELECT 
    'Produits dans JSONB (total)' as metric,
    SUM(jsonb_array_length(s.data->'produits'->'valeur'))::BIGINT as count
FROM services s
WHERE s.is_active = true
AND s.data->'produits'->'valeur' IS NOT NULL
AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'

UNION ALL

SELECT 
    'Produits dans table service_products (total)' as metric,
    COUNT(*)::BIGINT as count
FROM service_products
WHERE is_active = true

UNION ALL

SELECT 
    'Produits avec autocomplete_characteristics' as metric,
    COUNT(DISTINCT ac.product_id)::BIGINT as count
FROM autocomplete_characteristics ac
WHERE ac.is_real_product = TRUE
AND ac.identifiant_base = 'produits'
AND ac.product_id IS NOT NULL;

-- TEST 4 : Vérifier services récents
SELECT 
    s.id as service_id,
    s.data->'titre_service'->>'valeur' as service_titre,
    COUNT(p.id) as produits_table,
    CASE 
        WHEN s.data->'produits' IS NULL THEN '✅ NULL (correct après suppression JSONB)'
        WHEN s.data->'produits' = 'null'::jsonb THEN '✅ NULL (correct)'
        WHEN s.data->'produits'->'valeur' IS NULL THEN '✅ VALEUR NULL (correct)'
        ELSE '⚠️ PRODUITS ENCORE DANS JSONB'
    END as status_jsonb
FROM services s
INNER JOIN service_products p ON p.service_id = s.id
WHERE s.is_active = true
AND s.created_at > NOW() - INTERVAL '7 days'
GROUP BY s.id, s.data
ORDER BY s.created_at DESC
LIMIT 10;

-- TEST 5 : Vérifier que tous les produits ont un product_id dans autocomplete_characteristics
SELECT 
    COUNT(*) as produits_sans_autocomplete
FROM service_products p
LEFT JOIN autocomplete_characteristics ac ON ac.product_id::INTEGER = p.id 
    AND ac.is_real_product = TRUE 
    AND ac.identifiant_base = 'produits'
WHERE p.is_active = true
AND ac.id IS NULL;

-- TEST 6 : Vérifier les product_index uniques
SELECT 
    service_id,
    product_index,
    COUNT(*) as occurrences
FROM service_products
GROUP BY service_id, product_index
HAVING COUNT(*) > 1;

