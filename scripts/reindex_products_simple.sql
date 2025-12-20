-- 🔧 Script SQL simple pour identifier les produits non indexés
-- Note: La réindexation complète doit être faite via Rust (save_autocomplete_combination)
-- car elle nécessite la construction complexe des vecteurs

-- =====================================================
-- IDENTIFIER LES SERVICES AVEC PRODUITS NON INDEXÉS
-- =====================================================

SELECT 
    s.id as service_id,
    s.user_id,
    s.created_at,
    s.data->'titre_service'->>'valeur' as titre,
    jsonb_array_length(COALESCE(s.data->'produits'->'valeur', '[]'::jsonb)) as nb_produits,
    (SELECT COUNT(*) FROM autocomplete_characteristics ac2 
     WHERE ac2.service_id = s.id 
     AND ac2.identifiant_base = 'produits'
     AND ac2.is_real_product = TRUE) as nb_produits_indexes
FROM services s
WHERE s.is_active = true
AND s.data->'produits' IS NOT NULL
AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
AND jsonb_array_length(s.data->'produits'->'valeur') > 0
AND NOT EXISTS (
    SELECT 1 FROM autocomplete_characteristics ac
    WHERE ac.service_id = s.id
    AND ac.identifiant_base = 'produits'
    AND ac.is_real_product = TRUE
)
ORDER BY s.created_at DESC;

-- =====================================================
-- STATISTIQUES
-- =====================================================

-- Total services avec produits
SELECT COUNT(DISTINCT s.id) as total_services_avec_produits
FROM services s
WHERE s.is_active = true
AND s.data->'produits' IS NOT NULL
AND jsonb_typeof(s.data->'produits'->'valeur') = 'array';

-- Total produits indexés
SELECT COUNT(*) as total_produits_indexes
FROM autocomplete_characteristics
WHERE identifiant_base = 'produits'
AND is_real_product = TRUE;

-- Services non indexés
SELECT COUNT(DISTINCT s.id) as services_non_indexes
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

