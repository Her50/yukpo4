-- 🔧 Script pour réindexer les produits manquants dans autocomplete_characteristics
-- Ce script trouve les produits dans services.data qui ne sont pas dans autocomplete_characteristics
-- et les ajoute pour qu'ils soient trouvables dans la recherche

-- =====================================================
-- 1. TROUVER LES PRODUITS MANQUANTS
-- =====================================================

-- Produits dans services.data mais pas dans autocomplete_characteristics
WITH produits_services AS (
    SELECT 
        s.id as service_id,
        s.data->'produits'->'valeur' as produits_array,
        jsonb_array_elements(s.data->'produits'->'valeur') as produit,
        jsonb_array_elements(s.data->'produits'->'valeur')::jsonb->>'nom_produit' as nom_produit,
        jsonb_array_elements(s.data->'produits'->'valeur')::jsonb->>'marque' as marque,
        jsonb_array_elements(s.data->'produits'->'valeur')::jsonb->>'modele' as modele
    FROM services s
    WHERE s.is_active = true
    AND s.data->'produits' IS NOT NULL
    AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
),
produits_indexes AS (
    SELECT DISTINCT service_id, product_id
    FROM autocomplete_characteristics
    WHERE identifiant_base = 'produits'
    AND is_real_product = TRUE
)
SELECT 
    ps.service_id,
    ps.nom_produit,
    ps.marque,
    ps.modele,
    ps.produit
FROM produits_services ps
LEFT JOIN produits_indexes pi ON pi.service_id = ps.service_id
WHERE pi.service_id IS NULL  -- Produit non indexé
ORDER BY ps.service_id;

-- =====================================================
-- 2. CRÉER UNE FONCTION POUR RÉINDEXER UN PRODUIT
-- =====================================================

-- Note: Cette fonction doit être appelée depuis Rust (save_autocomplete_combination)
-- car elle nécessite la logique complexe de construction des vecteurs

-- =====================================================
-- 3. VÉRIFIER LE PRODUIT SPÉCIFIQUE "toyota avensis 200"
-- =====================================================

-- Chercher le service contenant ce produit
SELECT 
    s.id as service_id,
    s.user_id,
    s.created_at,
    s.is_active,
    jsonb_array_elements(s.data->'produits'->'valeur') as produit,
    jsonb_array_elements(s.data->'produits'->'valeur')::jsonb->>'nom_produit' as nom,
    jsonb_array_elements(s.data->'produits'->'valeur')::jsonb->>'marque' as marque,
    jsonb_array_elements(s.data->'produits'->'valeur')::jsonb->>'modele' as modele
FROM services s
WHERE s.created_at >= '2025-12-19'::date
AND s.data->'produits' IS NOT NULL
AND (
    s.data->'produits'->'valeur'::text ILIKE '%toyota%' OR
    s.data->'produits'->'valeur'::text ILIKE '%avensis%'
)
ORDER BY s.created_at DESC;

-- Vérifier si ce produit est dans autocomplete_characteristics
SELECT 
    ac.*,
    s.is_active as service_is_active
FROM autocomplete_characteristics ac
INNER JOIN services s ON s.id = ac.service_id
WHERE ac.service_id IN (
    SELECT DISTINCT s2.id
    FROM services s2
    WHERE s2.created_at >= '2025-12-19'::date
    AND s2.data->'produits'->'valeur'::text ILIKE '%toyota%'
)
AND ac.identifiant_base = 'produits'
AND ac.is_real_product = TRUE;

