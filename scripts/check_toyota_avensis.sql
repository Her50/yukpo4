-- 🔍 Vérification spécifique du produit "toyota avensis 200" créé le 19/12/2025
-- Base de données: yukpo_db

-- =====================================================
-- 1. CHERCHER LE PRODUIT DANS services.data
-- =====================================================

SELECT 
    s.id as service_id,
    s.user_id,
    s.created_at,
    s.is_active,
    s.data->'titre_service'->>'valeur' as titre_service,
    s.data->'category'->>'valeur' as category,
    jsonb_array_elements(s.data->'produits'->'valeur') as produit_json,
    jsonb_array_elements(s.data->'produits'->'valeur')::jsonb->>'nom_produit' as nom_produit,
    jsonb_array_elements(s.data->'produits'->'valeur')::jsonb->>'marque' as marque,
    jsonb_array_elements(s.data->'produits'->'valeur')::jsonb->>'modele' as modele,
    jsonb_array_elements(s.data->'produits'->'valeur')::jsonb->>'annee' as annee
FROM services s
WHERE s.created_at >= '2025-12-19 00:00:00'::timestamp
AND s.created_at < '2025-12-20 23:59:59'::timestamp
AND s.data->'produits' IS NOT NULL
AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
AND (
    s.data->'produits'->'valeur'::text ILIKE '%toyota%' OR
    s.data->'produits'->'valeur'::text ILIKE '%avensis%' OR
    s.data->'produits'->'valeur'::text ILIKE '%200%'
)
ORDER BY s.created_at DESC;

-- =====================================================
-- 2. VÉRIFIER SI LE PRODUIT EST DANS autocomplete_characteristics
-- =====================================================

SELECT 
    ac.id,
    ac.service_id,
    ac.product_id,
    ac.valeur,
    ac.characteristic_vector,
    ac.product_labels,
    ac.full_vector,
    ac.is_real_product,
    ac.created_at,
    s.is_active as service_is_active,
    s.created_at as service_created_at
FROM autocomplete_characteristics ac
INNER JOIN services s ON s.id = ac.service_id
WHERE s.created_at >= '2025-12-19 00:00:00'::timestamp
AND s.created_at < '2025-12-20 23:59:59'::timestamp
AND ac.identifiant_base = 'produits'
AND ac.is_real_product = TRUE
AND (
    ac.valeur ILIKE '%toyota%' OR
    ac.valeur ILIKE '%avensis%' OR
    ac.characteristic_vector::text ILIKE '%toyota%' OR
    ac.characteristic_vector::text ILIKE '%avensis%' OR
    ac.full_vector::text ILIKE '%toyota%' OR
    ac.full_vector::text ILIKE '%avensis%'
)
ORDER BY ac.created_at DESC;

-- =====================================================
-- 3. TEST DE RECHERCHE DIRECTE
-- =====================================================

-- Test avec tsvector (comme dans le code Rust)
SELECT 
    s.id as service_id,
    s.data->'titre_service'->>'valeur' as titre,
    ac.valeur,
    ts_rank(to_tsvector('french', ac.valeur), plainto_tsquery('french', 'toyota avensis')) as rank
FROM autocomplete_characteristics ac
INNER JOIN services s ON s.id = ac.service_id
WHERE s.is_active = true
AND ac.identifiant_base = 'produits'
AND ac.is_real_product = TRUE
AND to_tsvector('french', ac.valeur) @@ plainto_tsquery('french', 'toyota avensis')
ORDER BY rank DESC;

-- Test recherche dans services.data directement (fallback)
SELECT 
    s.id as service_id,
    s.data->'titre_service'->>'valeur' as titre,
    produit->>'nom_produit' as nom,
    produit->>'marque' as marque,
    produit->>'modele' as modele
FROM services s,
jsonb_array_elements(
    CASE 
        WHEN jsonb_typeof(s.data->'produits') = 'array' 
        THEN s.data->'produits'
        WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
        THEN s.data->'produits'->'valeur'
        ELSE '[]'::jsonb
    END
) AS produit
WHERE s.is_active = true
AND s.created_at >= '2025-12-19 00:00:00'::timestamp
AND to_tsvector('french', 
    COALESCE(produit->>'nom_produit', '') || ' ' || 
    COALESCE(produit->>'marque', '') || ' ' ||
    COALESCE(produit->>'modele', '')
) @@ plainto_tsquery('french', 'toyota avensis');

-- =====================================================
-- 4. STATISTIQUES GÉNÉRALES
-- =====================================================

-- Nombre total de services avec produits
SELECT COUNT(DISTINCT s.id) as services_avec_produits
FROM services s
WHERE s.is_active = true
AND s.data->'produits' IS NOT NULL
AND jsonb_typeof(s.data->'produits'->'valeur') = 'array';

-- Nombre de produits indexés dans autocomplete_characteristics
SELECT COUNT(*) as produits_indexes
FROM autocomplete_characteristics
WHERE identifiant_base = 'produits'
AND is_real_product = TRUE;

-- Services avec produits mais non indexés
SELECT 
    COUNT(DISTINCT s.id) as services_non_indexes
FROM services s
WHERE s.is_active = true
AND s.data->'produits' IS NOT NULL
AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
AND NOT EXISTS (
    SELECT 1 FROM autocomplete_characteristics ac
    WHERE ac.service_id = s.id
    AND ac.identifiant_base = 'produits'
    AND ac.is_real_product = TRUE
);

