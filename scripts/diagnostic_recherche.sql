-- 🔍 Script de diagnostic pour la recherche lente et produits manquants
-- Base de données: yukpo_db
-- Date: 2025-12-20

-- =====================================================
-- 1. VÉRIFIER LE PRODUIT "toyota avensis 200" créé le 19/12/2025
-- =====================================================

-- Chercher dans services.data->'produits'
SELECT 
    s.id as service_id,
    s.user_id,
    s.created_at,
    s.is_active,
    s.data->'produits'->'valeur' as produits_array,
    jsonb_array_elements(s.data->'produits'->'valeur') as produit
FROM services s
WHERE s.created_at >= '2025-12-19'::date
AND s.created_at < '2025-12-21'::date
AND s.data->'produits' IS NOT NULL
AND (
    s.data->'produits'->'valeur'::text ILIKE '%toyota%' OR
    s.data->'produits'->'valeur'::text ILIKE '%avensis%' OR
    s.data->'produits'->'valeur'::text ILIKE '%200%'
);

-- Chercher dans autocomplete_characteristics (table utilisée pour la recherche)
SELECT 
    ac.id,
    ac.service_id,
    ac.product_id,
    ac.valeur,
    ac.characteristic_vector,
    ac.product_labels,
    ac.is_real_product,
    ac.created_at,
    s.is_active as service_is_active
FROM autocomplete_characteristics ac
INNER JOIN services s ON s.id = ac.service_id
WHERE ac.identifiant_base = 'produits'
AND ac.is_real_product = TRUE
AND (
    ac.valeur ILIKE '%toyota%' OR
    ac.valeur ILIKE '%avensis%' OR
    ac.valeur ILIKE '%200%' OR
    ac.characteristic_vector::text ILIKE '%toyota%' OR
    ac.characteristic_vector::text ILIKE '%avensis%'
)
ORDER BY ac.created_at DESC;

-- =====================================================
-- 2. DIAGNOSTIC PERFORMANCE RECHERCHE
-- =====================================================

-- Vérifier les index sur autocomplete_characteristics
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'autocomplete_characteristics'
ORDER BY indexname;

-- Vérifier les index sur services
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'services'
AND indexdef LIKE '%tsvector%' OR indexdef LIKE '%GIN%'
ORDER BY indexname;

-- Vérifier si l'index tsvector existe sur autocomplete_characteristics.valeur
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'autocomplete_characteristics'
AND (
    indexdef LIKE '%to_tsvector%' OR
    indexdef LIKE '%valeur%' OR
    indexdef LIKE '%GIN%'
);

-- Compter les produits dans autocomplete_characteristics
SELECT 
    COUNT(*) as total_produits,
    COUNT(DISTINCT service_id) as services_avec_produits,
    COUNT(*) FILTER (WHERE is_real_product = TRUE) as produits_reels
FROM autocomplete_characteristics
WHERE identifiant_base = 'produits';

-- =====================================================
-- 3. TEST DE RECHERCHE DIRECTE (simuler la requête SQL)
-- =====================================================

-- Test recherche "toyota avensis"
EXPLAIN ANALYZE
SELECT DISTINCT s.id as service_id
FROM autocomplete_characteristics ac
INNER JOIN services s ON s.id = ac.service_id
WHERE s.is_active = true
AND ac.identifiant_base = 'produits'
AND ac.is_real_product = TRUE
AND to_tsvector('french', ac.valeur) @@ plainto_tsquery('french', 'toyota avensis');

-- Test recherche dans services.data directement (fallback)
EXPLAIN ANALYZE
SELECT DISTINCT s.id as service_id
FROM services s
WHERE s.is_active = true
AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(
        CASE 
            WHEN jsonb_typeof(s.data->'produits') = 'array' 
            THEN s.data->'produits'
            WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
            THEN s.data->'produits'->'valeur'
            ELSE '[]'::jsonb
        END
    ) AS produit
    WHERE to_tsvector('french', 
        COALESCE(produit->>'nom_produit', '') || ' ' || 
        COALESCE(produit->>'marque', '') || ' ' ||
        COALESCE(produit->>'modele', '')
    ) @@ plainto_tsquery('french', 'toyota avensis')
);

-- =====================================================
-- 4. VÉRIFIER LES SERVICES RÉCENTS (créés le 19/12/2025)
-- =====================================================

SELECT 
    s.id,
    s.user_id,
    s.created_at,
    s.is_active,
    s.data->'titre_service'->>'valeur' as titre,
    s.data->'category'->>'valeur' as category,
    jsonb_array_length(COALESCE(s.data->'produits'->'valeur', '[]'::jsonb)) as nb_produits,
    (SELECT COUNT(*) FROM autocomplete_characteristics ac2 
     WHERE ac2.service_id = s.id 
     AND ac2.identifiant_base = 'produits'
     AND ac2.is_real_product = TRUE) as nb_produits_indexes
FROM services s
WHERE s.created_at >= '2025-12-19'::date
AND s.created_at < '2025-12-21'::date
ORDER BY s.created_at DESC;

-- =====================================================
-- 5. CRÉER LES INDEX MANQUANTS SI NÉCESSAIRES
-- =====================================================

-- Index GIN sur tsvector de autocomplete_characteristics.valeur (si n'existe pas)
CREATE INDEX IF NOT EXISTS idx_autocomplete_characteristics_valeur_tsvector 
ON autocomplete_characteristics 
USING GIN (to_tsvector('french', valeur))
WHERE identifiant_base = 'produits' AND is_real_product = TRUE;

-- Index sur service_id pour JOIN rapide
CREATE INDEX IF NOT EXISTS idx_autocomplete_characteristics_service_id 
ON autocomplete_characteristics(service_id)
WHERE identifiant_base = 'produits' AND is_real_product = TRUE;

-- Index composite pour la recherche optimale
CREATE INDEX IF NOT EXISTS idx_autocomplete_characteristics_search 
ON autocomplete_characteristics(identifiant_base, is_real_product, service_id)
WHERE identifiant_base = 'produits' AND is_real_product = TRUE;

