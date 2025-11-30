-- Test détaillé du service 157 pour comprendre le problème

-- 1. Structure complète du service
SELECT 
    s.id,
    s.is_active,
    s.category,
    s.data->'titre_service'->>'valeur' as titre_service,
    jsonb_typeof(s.data->'produits') as produits_type,
    s.data->'produits' as produits_raw
FROM services s
WHERE s.id = 157;

-- 2. Test extract_all_product_text sur le produit
SELECT 
    extract_all_product_text(s.data->'produits'::jsonb) as texte_extraite
FROM services s
WHERE s.id = 157;

-- 3. Vérifier autocomplete_characteristics
SELECT 
    ac.service_id,
    ac.product_id,
    ac.full_vector,
    ac.characteristic_vector
FROM autocomplete_characteristics ac
WHERE ac.service_id = 157
AND ac.is_real_product = TRUE;

-- 4. Comparer ce qui est dans full_vector vs ce qui est extrait
WITH service_data AS (
    SELECT s.data->'produits' as produits
    FROM services s
    WHERE s.id = 157
),
autocomplete_data AS (
    SELECT ac.full_vector
    FROM autocomplete_characteristics ac
    WHERE ac.service_id = 157
    AND ac.is_real_product = TRUE
    LIMIT 1
)
SELECT 
    'Dans autocomplete.full_vector' as source,
    string_agg(val::text, ' | ') as contenu
FROM autocomplete_data ad,
unnest(ad.full_vector) as val
UNION ALL
SELECT 
    'Dans extract_all_product_text' as source,
    extract_all_product_text(sd.produits::jsonb) as contenu
FROM service_data sd;

