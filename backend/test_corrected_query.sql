-- Test de la requête SQL corrigée pour vérifier qu'elle trouve maintenant le service 157

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
        -- Recherche dans les PRODUITS
        EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(ape.products_array) AS product
            WHERE (
                extract_all_product_text(product) ILIKE '%confortables%'
                OR product->>'nom' ILIKE '%confortables%'
                OR product->>'nom_produit' ILIKE '%confortables%'
                OR product->>'categorie' ILIKE '%confortables%'
                OR product->>'description' ILIKE '%confortables%'
            )
        )
        -- ✅ NOUVEAU: Recherche dans autocomplete_characteristics.full_vector
        OR EXISTS (
            SELECT 1 
            FROM autocomplete_characteristics ac
            WHERE ac.service_id = ape.service_id
            AND ac.is_real_product = TRUE
            AND ac.identifiant_base = 'produits'
            AND EXISTS (
                SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                WHERE LOWER(vec_val) LIKE '%confortables%'
            )
        )
        -- Recherche dans les champs service
        OR COALESCE(ape.data->>'titre_service', ape.data->'titre_service'->>'valeur', '') ILIKE '%confortables%'
        OR COALESCE(ape.data->>'description', ape.data->'description'->>'valeur', '') ILIKE '%confortables%'
        OR COALESCE(ape.data->>'category', ape.data->'category'->>'valeur', ape.category, '') ILIKE '%confortables%'
    )
)
SELECT 
    pe.service_id,
    pe.data->'titre_service'->>'valeur' as titre_service,
    pe.category,
    jsonb_array_length(pe.products_array) as produits_count
FROM products_extracted pe
ORDER BY pe.service_id;

