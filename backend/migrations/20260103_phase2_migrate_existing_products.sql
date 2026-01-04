-- ============================================
-- PHASE 2 : Migration des produits existants
-- ============================================
-- Date: 2026-01-03
-- Objectif: Migrer les produits existants depuis JSONB vers service_products
-- et corriger les product_id dans autocomplete_characteristics
-- ============================================

\echo '🚀 Début Phase 2 : Migration des produits existants...'

-- ============================================
-- ÉTAPE 1 : Migrer les produits depuis JSONB vers service_products
-- ============================================
\echo '📦 Étape 1 : Migration des produits depuis JSONB...'

-- Utiliser une approche avec INSERT ... SELECT pour éviter les problèmes de boucle
INSERT INTO service_products (
    service_id,
    product_index,
    product_data,
    is_active,
    created_at,
    updated_at
)
SELECT 
    s.id as service_id,
    (prod.ordinality - 1)::INTEGER as product_index,
    (prod.value - 'images' - 'videos' - 'audios' - 'documents')::JSONB as product_data,
    COALESCE(
        ((prod.value - 'images' - 'videos' - 'audios' - 'documents')->>'is_active')::boolean,
        true
    ) as is_active,
    NOW() as created_at,
    NOW() as updated_at
FROM services s
CROSS JOIN LATERAL jsonb_array_elements(s.data->'produits'->'valeur') 
    WITH ORDINALITY AS prod(value, ordinality)
WHERE s.is_active = true
AND s.data->'produits'->'valeur' IS NOT NULL
AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
AND jsonb_array_length(s.data->'produits'->'valeur') > 0
AND NOT EXISTS (
    -- Ne pas migrer si des produits existent déjà pour ce service
    SELECT 1 FROM service_products sp 
    WHERE sp.service_id = s.id
)
ON CONFLICT (service_id, product_index) 
DO UPDATE SET 
    product_data = EXCLUDED.product_data,
    updated_at = NOW();

-- Afficher le nombre de produits migrés
SELECT 
    COUNT(*) as produits_migres,
    COUNT(DISTINCT service_id) as services_migres
FROM service_products
WHERE created_at > NOW() - INTERVAL '1 minute';

-- ============================================
-- ÉTAPE 2 : Corriger les product_id dans autocomplete_characteristics
-- ============================================
\echo '🔧 Étape 2 : Correction des product_id dans autocomplete_characteristics...'

-- Mettre à jour autocomplete_characteristics avec les nouveaux product_id
-- Les anciens product_id référencent probablement des index (0, 1, 2...) au lieu des vrais id
UPDATE autocomplete_characteristics ac
SET 
    product_id = sp.id::TEXT,
    updated_at = NOW()
FROM service_products sp
WHERE ac.service_id = sp.service_id
AND ac.is_real_product = TRUE
AND ac.identifiant_base = 'produits'
AND ac.product_id IS NOT NULL
AND (
    -- Cas 1: product_id est un nombre qui correspond à un product_index
    (ac.product_id ~ '^\d+$' AND ac.product_id::INTEGER = sp.product_index)
    OR
    -- Cas 2: product_id ne correspond à aucun id valide dans service_products
    NOT EXISTS (
        SELECT 1 FROM service_products sp2 
        WHERE sp2.id::TEXT = ac.product_id
    )
);

-- Afficher le nombre de product_id corrigés
SELECT 
    COUNT(*) as product_id_corriges
FROM autocomplete_characteristics ac
INNER JOIN service_products sp ON sp.id::TEXT = ac.product_id
WHERE ac.is_real_product = TRUE
AND ac.identifiant_base = 'produits'
AND ac.updated_at > NOW() - INTERVAL '1 minute';

-- ============================================
-- ÉTAPE 3 : Vérification post-migration
-- ============================================
\echo '✅ Étape 3 : Vérification post-migration...'

-- Statistiques après migration
SELECT 
    'Produits migrés dans service_products' as metric,
    COUNT(*)::BIGINT as count
FROM service_products
WHERE is_active = true

UNION ALL

SELECT 
    'Services avec produits migrés' as metric,
    COUNT(DISTINCT service_id)::BIGINT as count
FROM service_products
WHERE is_active = true

UNION ALL

SELECT 
    'product_id valides dans autocomplete_characteristics' as metric,
    COUNT(DISTINCT ac.product_id)::BIGINT as count
FROM autocomplete_characteristics ac
INNER JOIN service_products sp ON sp.id::TEXT = ac.product_id
WHERE ac.is_real_product = TRUE
AND ac.identifiant_base = 'produits';

\echo '✅ Phase 2 terminée !'
