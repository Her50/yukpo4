-- Script de test pour comparer autocomplete vs recherche directe
-- Utilise les identifiants fournis par l'utilisateur

-- Test 1: Vérifier ce que trouve l'autocomplete pour un terme de recherche
-- Exemple: "confortables" (d'après les logs)

\echo '=== TEST 1: Ce que trouve AUTOCOMPLETE ==='
SELECT 
    ac.service_id,
    ac.product_id,
    ac.full_vector,
    ac.characteristic_vector as product_vector,
    ac.location_vector,
    ac.chosen_location,
    ac.usage_count,
    s.is_active,
    s.data->'titre_service'->>'valeur' as titre_service,
    s.category
FROM autocomplete_characteristics ac
INNER JOIN services s ON s.id = ac.service_id
WHERE 
    ac.is_real_product = TRUE
    AND s.is_active = TRUE
    AND ac.identifiant_base = 'produits'
    AND (
        EXISTS (
            SELECT 1 FROM unnest(ac.full_vector) AS vec_val
            WHERE LOWER(vec_val) LIKE '%confortables%'
        )
    )
ORDER BY ac.usage_count DESC NULLS LAST
LIMIT 10;

\echo ''
\echo '=== TEST 2: Ce que trouve RECHERCHE DIRECTE (fulltext_search_with_gps) ==='
-- Simuler la requête de fulltext_search_with_gps
WITH all_products_extracted AS (
    SELECT 
        s.id as service_id,
        s.data,
        s.created_at,
        s.user_id,
        s.gps,
        s.category,
        CASE 
            WHEN jsonb_typeof(s.data->'produits') = 'array' 
            THEN s.data->'produits'
            WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
            THEN s.data->'produits'->'valeur'
            ELSE '[]'::jsonb
        END as products_array
    FROM services s
    WHERE s.is_active = true
),
products_extracted AS (
    SELECT DISTINCT
        ape.service_id,
        ape.data,
        ape.created_at,
        ape.user_id,
        ape.gps,
        ape.category,
        ape.products_array
    FROM all_products_extracted ape
    WHERE (
        EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(ape.products_array) AS product
            WHERE (
                extract_all_product_text(product) ILIKE '%confortables%'
                OR product->>'nom' ILIKE '%confortables%'
                OR product->>'categorie' ILIKE '%confortables%'
                OR product->>'description' ILIKE '%confortables%'
            )
        )
        OR COALESCE(ape.data->>'titre_service', ape.data->'titre_service'->>'valeur', '') ILIKE '%confortables%'
        OR COALESCE(ape.data->>'description', ape.data->'description'->>'valeur', '') ILIKE '%confortables%'
        OR COALESCE(ape.data->>'category', ape.data->'category'->>'valeur', ape.category, '') ILIKE '%confortables%'
    )
)
SELECT 
    pe.service_id,
    pe.data->'titre_service'->>'valeur' as titre_service,
    pe.category,
    jsonb_array_length(pe.products_array) as produits_count,
    -- Extraire un exemple de produit pour voir sa structure
    (SELECT product FROM jsonb_array_elements(pe.products_array) AS product LIMIT 1) as exemple_produit
FROM products_extracted pe
LIMIT 10;

\echo ''
\echo '=== TEST 3: Comparer les service_id trouvés ==='
-- Service IDs trouvés par autocomplete
WITH autocomplete_ids AS (
    SELECT DISTINCT ac.service_id
    FROM autocomplete_characteristics ac
    INNER JOIN services s ON s.id = ac.service_id
    WHERE 
        ac.is_real_product = TRUE
        AND s.is_active = TRUE
        AND ac.identifiant_base = 'produits'
        AND (
            EXISTS (
                SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                WHERE LOWER(vec_val) LIKE '%confortables%'
            )
        )
),
direct_search_ids AS (
    SELECT DISTINCT ape.service_id
    FROM services s,
    LATERAL (
        CASE 
            WHEN jsonb_typeof(s.data->'produits') = 'array' 
            THEN s.data->'produits'
            WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
            THEN s.data->'produits'->'valeur'
            ELSE '[]'::jsonb
        END
    ) AS products_array
    WHERE s.is_active = true
    AND (
        EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(products_array) AS product
            WHERE (
                extract_all_product_text(product) ILIKE '%confortables%'
                OR product->>'nom' ILIKE '%confortables%'
                OR product->>'categorie' ILIKE '%confortables%'
                OR product->>'description' ILIKE '%confortables%'
            )
        )
        OR COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '') ILIKE '%confortables%'
        OR COALESCE(s.data->>'description', s.data->'description'->>'valeur', '') ILIKE '%confortables%'
        OR COALESCE(s.data->>'category', s.data->'category'->>'valeur', s.category, '') ILIKE '%confortables%'
    )
)
SELECT 
    'Dans autocomplete mais PAS dans recherche directe' as type,
    array_agg(ac.service_id ORDER BY ac.service_id) as service_ids
FROM autocomplete_ids ac
WHERE ac.service_id NOT IN (SELECT service_id FROM direct_search_ids)
UNION ALL
SELECT 
    'Dans recherche directe mais PAS dans autocomplete' as type,
    array_agg(ds.service_id ORDER BY ds.service_id) as service_ids
FROM direct_search_ids ds
WHERE ds.service_id NOT IN (SELECT service_id FROM autocomplete_ids)
UNION ALL
SELECT 
    'Dans les DEUX' as type,
    array_agg(ac.service_id ORDER BY ac.service_id) as service_ids
FROM autocomplete_ids ac
WHERE ac.service_id IN (SELECT service_id FROM direct_search_ids);

\echo ''
\echo '=== TEST 4: Analyser un service spécifique trouvé par autocomplete ==='
-- Prendre le premier service_id trouvé par autocomplete
WITH autocomplete_service AS (
    SELECT DISTINCT ac.service_id
    FROM autocomplete_characteristics ac
    INNER JOIN services s ON s.id = ac.service_id
    WHERE 
        ac.is_real_product = TRUE
        AND s.is_active = TRUE
        AND ac.identifiant_base = 'produits'
        AND (
            EXISTS (
                SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                WHERE LOWER(vec_val) LIKE '%confortables%'
            )
        )
    LIMIT 1
)
SELECT 
    s.id as service_id,
    s.is_active,
    s.category,
    s.data->'titre_service'->>'valeur' as titre_service,
    -- Structure des produits
    jsonb_typeof(s.data->'produits') as produits_type,
    CASE 
        WHEN jsonb_typeof(s.data->'produits') = 'array' 
        THEN jsonb_array_length(s.data->'produits')
        WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
        THEN jsonb_array_length(s.data->'produits'->'valeur')
        ELSE 0
    END as produits_count,
    -- Vérifier extract_all_product_text sur les produits
    (
        SELECT string_agg(extract_all_product_text(product), ' | ')
        FROM jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                THEN s.data->'produits'
                WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                THEN s.data->'produits'->'valeur'
                ELSE '[]'::jsonb
            END
        ) AS product
    ) as extracted_text,
    -- Vérifier si "confortables" est dans extract_all_product_text
    (
        SELECT COUNT(*)
        FROM jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                THEN s.data->'produits'
                WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                THEN s.data->'produits'->'valeur'
                ELSE '[]'::jsonb
            END
        ) AS product
        WHERE extract_all_product_text(product) ILIKE '%confortables%'
    ) as produits_avec_confortables,
    -- Vérifier autocomplete_characteristics pour ce service
    (
        SELECT jsonb_agg(jsonb_build_object(
            'product_id', ac.product_id,
            'full_vector', ac.full_vector,
            'characteristic_vector', ac.characteristic_vector
        ))
        FROM autocomplete_characteristics ac
        WHERE ac.service_id = s.id
        AND ac.is_real_product = TRUE
        AND ac.identifiant_base = 'produits'
    ) as autocomplete_data
FROM services s
WHERE s.id IN (SELECT service_id FROM autocomplete_service);

\echo ''
\echo '=== TEST 5: Vérifier la fonction extract_all_product_text ==='
-- Tester extract_all_product_text sur un produit réel
WITH test_product AS (
    SELECT product
    FROM services s,
    jsonb_array_elements(
        CASE 
            WHEN jsonb_typeof(s.data->'produits') = 'array' 
            THEN s.data->'produits'
            WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
            THEN s.data->'produits'->'valeur'
            ELSE '[]'::jsonb
        END
    ) AS product
    WHERE s.is_active = true
    AND EXISTS (
        SELECT 1 FROM autocomplete_characteristics ac
        WHERE ac.service_id = s.id
        AND ac.is_real_product = TRUE
        AND EXISTS (
            SELECT 1 FROM unnest(ac.full_vector) AS vec_val
            WHERE LOWER(vec_val) LIKE '%confortables%'
        )
    )
    LIMIT 1
)
SELECT 
    product as produit_original,
    extract_all_product_text(product) as texte_extraite,
    CASE 
        WHEN extract_all_product_text(product) ILIKE '%confortables%' 
        THEN 'TROUVÉ' 
        ELSE 'NON TROUVÉ' 
    END as resultat_recherche
FROM test_product;

