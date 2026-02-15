-- ============================================
-- PHASE 2 : Correction des références media -> service_products
-- ============================================
-- Date: 2026-01-03
-- Objectif: Corriger les product_id dans media pour référencer service_products.id
-- ============================================

-- echo (commenté car commande psql, pas SQL) '🔧 Correction des références media -> service_products...'

-- ============================================
-- ÉTAPE 1 : Analyser l'état actuel
-- ============================================
-- echo (commenté car commande psql, pas SQL) '📊 Étape 1 : Analyse de l''état actuel...'

SELECT 
    'Total médias avec produits' as metric,
    COUNT(*)::BIGINT as count
FROM media
WHERE service_id IN (SELECT DISTINCT service_id FROM service_products)
AND (product_id IS NOT NULL OR product_index IS NOT NULL)

UNION ALL

SELECT 
    'Médias avec product_id (TEXT)' as metric,
    COUNT(*)::BIGINT as count
FROM media
WHERE service_id IN (SELECT DISTINCT service_id FROM service_products)
AND product_id IS NOT NULL

UNION ALL

SELECT 
    'Médias avec product_index (INTEGER)' as metric,
    COUNT(*)::BIGINT as count
FROM media
WHERE service_id IN (SELECT DISTINCT service_id FROM service_products)
AND product_index IS NOT NULL

UNION ALL

SELECT 
    'Médias pouvant être corrigés (via product_index)' as metric,
    COUNT(*)::BIGINT as count
FROM media m
INNER JOIN service_products sp ON sp.service_id = m.service_id AND sp.product_index = m.product_index
WHERE m.service_id IN (SELECT DISTINCT service_id FROM service_products)
AND m.product_index IS NOT NULL;

-- ============================================
-- ÉTAPE 2 : Corriger les product_id via product_index
-- ============================================
-- echo (commenté car commande psql, pas SQL) '🔧 Étape 2 : Correction des product_id via product_index...'

-- Mettre à jour les product_id en utilisant product_index pour trouver le bon service_products.id
UPDATE media m
SET product_id = sp.id::TEXT
FROM service_products sp
WHERE m.service_id = sp.service_id
AND m.product_index = sp.product_index
AND m.service_id IN (SELECT DISTINCT service_id FROM service_products)
AND (
    -- Cas 1: product_id est NULL mais product_index existe
    (m.product_id IS NULL AND m.product_index IS NOT NULL)
    OR
    -- Cas 2: product_id ne correspond à aucun id valide dans service_products
    (m.product_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM service_products sp2 
        WHERE sp2.id::TEXT = m.product_id
    ))
    OR
    -- Cas 3: product_id est un format ancien (prod_0, 120_1, etc.)
    (m.product_id IS NOT NULL AND (
        m.product_id LIKE 'prod_%' 
        OR m.product_id LIKE '%_%' 
        OR NOT (m.product_id ~ '^\d+$')
    ))
);

-- Afficher le nombre de product_id corrigés
SELECT 
    COUNT(*) as product_id_corriges
FROM media m
INNER JOIN service_products sp ON sp.id::TEXT = m.product_id
WHERE m.service_id IN (SELECT DISTINCT service_id FROM service_products)
AND m.product_id IS NOT NULL;

-- ============================================
-- ÉTAPE 3 : Vérification post-correction
-- ============================================
-- echo (commenté car commande psql, pas SQL) '✅ Étape 3 : Vérification post-correction...'

-- Statistiques après correction
SELECT 
    'Médias avec product_id valide' as metric,
    COUNT(*)::BIGINT as count
FROM media m
INNER JOIN service_products sp ON sp.id::TEXT = m.product_id
WHERE m.service_id IN (SELECT DISTINCT service_id FROM service_products)
AND m.product_id IS NOT NULL

UNION ALL

SELECT 
    'Médias avec product_id invalide' as metric,
    COUNT(*)::BIGINT as count
FROM media m
WHERE m.service_id IN (SELECT DISTINCT service_id FROM service_products)
AND m.product_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM service_products sp 
    WHERE sp.id::TEXT = m.product_id
)

UNION ALL

SELECT 
    'Médias avec product_index mais sans product_id' as metric,
    COUNT(*)::BIGINT as count
FROM media m
WHERE m.service_id IN (SELECT DISTINCT service_id FROM service_products)
AND m.product_index IS NOT NULL
AND m.product_id IS NULL;

-- Détails des médias corrigés
SELECT 
    m.id as media_id,
    m.service_id,
    m.product_id as product_id_apres,
    m.product_index,
    sp.id as service_product_id,
    sp.product_name,
    CASE 
        WHEN m.product_id = sp.id::TEXT THEN '✅ OK'
        ELSE '❌ INVALIDE'
    END as status
FROM media m
LEFT JOIN service_products sp ON sp.id::TEXT = m.product_id
WHERE m.service_id IN (SELECT DISTINCT service_id FROM service_products)
AND (m.product_id IS NOT NULL OR m.product_index IS NOT NULL)
ORDER BY m.service_id, m.product_index
LIMIT 20;

-- echo (commenté car commande psql, pas SQL) '✅ Correction des références media terminée !'

