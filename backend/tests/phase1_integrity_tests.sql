-- ============================================
-- SCRIPTS DE TEST PHASE 1 : INTÉGRITÉ TABLE PRODUCTS
-- ============================================
-- Ces scripts vérifient que la migration Phase 1 fonctionne correctement
-- Date: 2026-01-03
-- ============================================

-- ============================================
-- TEST 1 : Vérifier que tous les produits sont dans JSONB ET table products
-- ============================================
-- Cette requête doit retourner 0 lignes après Phase 1
-- Si des lignes sont retournées, il y a des produits manquants dans la table products

SELECT 
    s.id as service_id,
    s.data->'titre_service'->>'valeur' as service_titre,
    jsonb_array_length(s.data->'produits'->'valeur') as produits_jsonb,
    COUNT(p.id) as produits_table,
    CASE 
        WHEN jsonb_array_length(s.data->'produits'->'valeur') = COUNT(p.id) THEN '✅ OK'
        WHEN jsonb_array_length(s.data->'produits'->'valeur') > COUNT(p.id) THEN '❌ PRODUITS MANQUANTS dans table'
        ELSE '❌ TROP DE PRODUITS dans table'
    END as status,
    jsonb_array_length(s.data->'produits'->'valeur') - COUNT(p.id) as difference
FROM services s
LEFT JOIN service_products p ON p.service_id = s.id
WHERE s.is_active = true
AND s.data->'produits'->'valeur' IS NOT NULL
AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
AND jsonb_array_length(s.data->'produits'->'valeur') > 0
GROUP BY s.id, s.data
HAVING jsonb_array_length(s.data->'produits'->'valeur') != COUNT(p.id)
ORDER BY s.id;

-- ============================================
-- TEST 2 : Vérifier que les product_index correspondent
-- ============================================
-- Vérifie que chaque produit dans JSONB a le bon product_index dans la table products

SELECT 
    s.id as service_id,
    p.product_index,
    p.id as product_table_id,
    p.product_name,
    CASE 
        WHEN s.data->'produits'->'valeur'->p.product_index IS NOT NULL THEN '✅ OK'
        ELSE '❌ PRODUIT JSONB MANQUANT'
    END as status_jsonb,
    CASE 
        WHEN p.id IS NOT NULL THEN '✅ OK'
        ELSE '❌ PRODUIT TABLE MANQUANT'
    END as status_table
FROM services s
CROSS JOIN LATERAL jsonb_array_elements(s.data->'produits'->'valeur') WITH ORDINALITY AS prod(value, index)
LEFT JOIN service_products p ON p.service_id = s.id AND p.product_index = (prod.index - 1)::INTEGER
WHERE s.is_active = true
AND s.data->'produits'->'valeur' IS NOT NULL
AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
AND (
    s.data->'produits'->'valeur'->p.product_index IS NULL
    OR p.id IS NULL
)
ORDER BY s.id, p.product_index;

-- ============================================
-- TEST 3 : Vérifier que autocomplete_characteristics.product_id référence bien products.id
-- ============================================
-- Cette requête doit retourner 0 lignes après migration complète
-- Si des lignes sont retournées, il y a des product_id invalides

SELECT 
    ac.id as autocomplete_id,
    ac.service_id,
    ac.product_id,
    p.id as product_table_id,
    p.product_index,
    p.product_name,
    CASE 
        WHEN ac.product_id::INTEGER = p.id THEN '✅ OK'
        WHEN p.id IS NULL THEN '❌ PRODUCT_ID INVALIDE (produit n''existe pas)'
        ELSE '❌ PRODUCT_ID INCORRECT'
    END as status
FROM autocomplete_characteristics ac
LEFT JOIN service_products p ON p.id = ac.product_id::INTEGER
WHERE ac.is_real_product = TRUE
AND ac.identifiant_base = 'produits'
AND ac.product_id IS NOT NULL
AND (
    ac.product_id::INTEGER != p.id
    OR p.id IS NULL
)
ORDER BY ac.service_id, ac.id;

-- ============================================
-- TEST 4 : Vérifier que tous les produits ont un product_id dans autocomplete_characteristics
-- ============================================
-- Vérifie que chaque produit dans la table products a au moins une entrée dans autocomplete_characteristics

SELECT 
    p.id as product_id,
    p.service_id,
    p.product_index,
    p.product_name,
    COUNT(ac.id) as autocomplete_entries,
    CASE 
        WHEN COUNT(ac.id) > 0 THEN '✅ OK'
        ELSE '⚠️ PAS D''ENTRÉE autocomplete_characteristics'
    END as status
FROM service_products p
LEFT JOIN autocomplete_characteristics ac ON ac.product_id::INTEGER = p.id 
    AND ac.is_real_product = TRUE 
    AND ac.identifiant_base = 'produits'
WHERE p.is_active = true
GROUP BY p.id, p.service_id, p.product_index, p.product_name
HAVING COUNT(ac.id) = 0
ORDER BY p.service_id, p.product_index;

-- ============================================
-- TEST 5 : Statistiques globales
-- ============================================

SELECT 
    'Services avec produits' as metric,
    COUNT(DISTINCT s.id) as count
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
AND ac.product_id IS NOT NULL

UNION ALL

SELECT 
    'Services avec produits non migrés' as metric,
    COUNT(DISTINCT s.id)::BIGINT as count
FROM services s
LEFT JOIN service_products p ON p.service_id = s.id
WHERE s.is_active = true
AND s.data->'produits'->'valeur' IS NOT NULL
AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
AND jsonb_array_length(s.data->'produits'->'valeur') > 0
GROUP BY s.id
HAVING jsonb_array_length(s.data->'produits'->'valeur') != COUNT(p.id);

-- ============================================
-- TEST 6 : Vérifier l'intégrité des données produit
-- ============================================
-- Compare les données JSONB avec les données de la table products

SELECT 
    s.id as service_id,
    p.product_index,
    p.id as product_table_id,
    p.product_name as table_name,
    s.data->'produits'->'valeur'->p.product_index->>'nom' as jsonb_name,
    CASE 
        WHEN p.product_name = COALESCE(
            s.data->'produits'->'valeur'->p.product_index->>'nom',
            s.data->'produits'->'valeur'->p.product_index->'nom'->>'valeur',
            'Produit sans nom'
        ) THEN '✅ OK'
        ELSE '⚠️ NOM DIFFÉRENT'
    END as name_match
FROM services s
INNER JOIN products p ON p.service_id = s.id
WHERE s.is_active = true
AND s.data->'produits'->'valeur' IS NOT NULL
AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
AND p.product_name != COALESCE(
    s.data->'produits'->'valeur'->p.product_index->>'nom',
    s.data->'produits'->'valeur'->p.product_index->'nom'->>'valeur',
    'Produit sans nom'
)
ORDER BY s.id, p.product_index
LIMIT 50; -- Limiter pour éviter trop de résultats

-- ============================================
-- TEST 7 : Vérifier les product_index uniques par service
-- ============================================
-- Vérifie qu'il n'y a pas de doublons de product_index pour un même service

SELECT 
    service_id,
    product_index,
    COUNT(*) as count,
    array_agg(id ORDER BY id) as product_ids,
    array_agg(product_name ORDER BY id) as product_names
FROM service_products
GROUP BY service_id, product_index
HAVING COUNT(*) > 1
ORDER BY service_id, product_index;

-- ============================================
-- TEST 8 : Vérifier les produits orphelins (dans table mais pas dans JSONB)
-- ============================================
-- Produits qui sont dans la table products mais pas dans le JSONB du service

SELECT 
    p.id as product_id,
    p.service_id,
    p.product_index,
    p.product_name,
    CASE 
        WHEN s.id IS NULL THEN '❌ SERVICE N''EXISTE PAS'
        WHEN s.data->'produits'->'valeur'->p.product_index IS NULL THEN '❌ PRODUIT PAS DANS JSONB'
        ELSE '✅ OK'
    END as status
FROM service_products p
LEFT JOIN services s ON s.id = p.service_id
WHERE p.is_active = true
AND (
    s.id IS NULL
    OR s.data->'produits'->'valeur'->p.product_index IS NULL
)
ORDER BY p.service_id, p.product_index;

-- ============================================
-- NOTES D'UTILISATION
-- ============================================
-- 
-- 1. Exécuter TEST 1 en premier : doit retourner 0 lignes
-- 2. Si TEST 1 retourne des lignes, exécuter TEST 2 pour voir les détails
-- 3. Exécuter TEST 3 pour vérifier autocomplete_characteristics
-- 4. TEST 5 donne un aperçu global de l'état de la migration
-- 5. Les autres tests sont optionnels mais utiles pour le debugging
--
-- ============================================

