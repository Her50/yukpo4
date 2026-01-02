-- Migration: Optimiser hybrid_image_search avec unaccent() et similarity()
-- Date: 2025-01-01
-- Description: 
--  1. Ajouter unaccent() pour gérer les accents (comme keyword_search_with_gps)
--  2. Ajouter similarity() pour gérer les erreurs de saisie (comme keyword_search_with_gps)
--  3. Aligner la logique avec la nouvelle approche optimisée

DROP FUNCTION IF EXISTS hybrid_image_search CASCADE;

CREATE FUNCTION hybrid_image_search(
    search_tags TEXT[],
    search_category TEXT DEFAULT NULL,
    search_marque TEXT DEFAULT NULL,
    search_couleur TEXT DEFAULT NULL,
    search_query_semantic TEXT DEFAULT NULL,
    gps_lat FLOAT DEFAULT NULL,
    gps_lng FLOAT DEFAULT NULL,
    search_radius_km INTEGER DEFAULT 50,
    max_results INTEGER DEFAULT 20,
    pg_lang TEXT DEFAULT 'french'
)
RETURNS TABLE (
    service_id INTEGER,
    analysis_id INTEGER,
    media_id INTEGER,
    product_description TEXT,
    product_tags TEXT[],
    product_marque TEXT,
    product_couleurs TEXT[],
    match_score FLOAT,
    distance_km FLOAT,
    service_data JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH combined_results AS (
        -- ✅ SOURCE 1 (PRIORITÉ HAUTE): Recherche dans autocomplete_characteristics
        -- ✅ OPTIMISÉ 2025-01-01: Ajout unaccent() et similarity() comme keyword_search_with_gps
        SELECT DISTINCT ON (ac.service_id)
            ac.service_id,
            NULL::INTEGER as analysis_id,
            NULL::INTEGER as media_id,
            ac.valeur as product_description,
            ARRAY(
                SELECT DISTINCT unnest(string_to_array(ac.valeur, ','))
            )::TEXT[] as product_tags,
            COALESCE(
                (ac.product_labels->>'marque')::TEXT,
                (SELECT unnest(string_to_array(ac.valeur, ',')) LIMIT 1)
            ) as product_marque,
            ARRAY(
                SELECT jsonb_array_elements_text(ac.product_labels->'couleurs')
                WHERE jsonb_typeof(ac.product_labels->'couleurs') = 'array'
            )::TEXT[] as product_couleurs,
            (
                -- ✅ OPTIMISÉ 2025-01-01: Utiliser unaccent() et similarity() comme keyword_search_with_gps
                -- Score exact avec unaccent (priorité maximale)
                CASE 
                    WHEN search_query_semantic IS NOT NULL AND LOWER(unaccent(ac.valeur)) = LOWER(unaccent(search_query_semantic)) THEN 600.0
                    WHEN search_query_semantic IS NOT NULL AND unaccent(ac.valeur) ILIKE unaccent(search_query_semantic) || '%' THEN 400.0
                    WHEN search_query_semantic IS NOT NULL AND unaccent(ac.valeur) ILIKE '%' || unaccent(search_query_semantic) || '%' THEN 200.0
                    ELSE 0.0
                END +
                -- ✅ NOUVEAU: Score similarity pour erreurs de saisie
                CASE 
                    WHEN search_query_semantic IS NOT NULL AND similarity(unaccent(LOWER(ac.valeur)), unaccent(LOWER(search_query_semantic))) > 0.3 THEN 
                        similarity(unaccent(LOWER(ac.valeur)), unaccent(LOWER(search_query_semantic))) * 150.0
                    ELSE 0.0
                END +
                -- ✅ Score full-text sur valeur (index GIN tsvector) - avec langue dynamique et unaccent
                COALESCE(
                    ts_rank(to_tsvector(pg_lang, unaccent(ac.valeur)), plainto_tsquery(pg_lang, unaccent(COALESCE(search_query_semantic, '')))) * 400.0,
                    0.0
                ) +
                -- ✅ Score full-text sur characteristic_vector avec unaccent
                COALESCE(
                    ts_rank(characteristic_vector_to_tsvector(ac.characteristic_vector), plainto_tsquery(pg_lang, unaccent(COALESCE(search_query_semantic, '')))) * 300.0,
                    0.0
                ) +
                -- ✅ Score full-text sur full_vector avec unaccent
                COALESCE(
                    ts_rank(full_vector_to_tsvector(ac.full_vector), plainto_tsquery(pg_lang, unaccent(COALESCE(search_query_semantic, '')))) * 250.0,
                    0.0
                ) +
                -- ✅ AMÉLIORÉ 2025-01-01: Score tags communs avec unaccent et similarity
                CASE 
                    WHEN search_tags IS NOT NULL AND array_length(search_tags, 1) > 0 THEN
                        (SELECT 
                            CASE 
                                WHEN COUNT(*) >= 2 THEN COUNT(*) * 120.0
                                WHEN COUNT(*) = 1 THEN 60.0
                                ELSE 0.0
                            END
                         FROM unnest(search_tags) tag 
                         WHERE unaccent(ac.valeur) ILIKE '%' || unaccent(tag) || '%'
                         OR similarity(unaccent(LOWER(ac.valeur)), unaccent(LOWER(tag))) > 0.3
                         OR characteristic_vector_to_tsvector(ac.characteristic_vector) @@ plainto_tsquery(pg_lang, unaccent(tag))
                         OR full_vector_to_tsvector(ac.full_vector) @@ plainto_tsquery(pg_lang, unaccent(tag)))
                    ELSE 0.0
                END +
                -- ✅ Score marque exacte avec unaccent
                CASE 
                    WHEN search_marque IS NOT NULL 
                         AND (
                             unaccent(ac.valeur) ILIKE unaccent(search_marque) || '%'
                             OR unaccent(ac.product_labels->>'marque') ILIKE unaccent(search_marque) || '%'
                             OR similarity(unaccent(LOWER(ac.valeur)), unaccent(LOWER(search_marque))) > 0.3
                         )
                    THEN 300.0
                    ELSE 0.0
                END +
                -- ✅ Score couleur avec unaccent
                CASE 
                    WHEN search_couleur IS NOT NULL 
                         AND (
                             unaccent(ac.valeur) ILIKE '%' || unaccent(search_couleur) || '%'
                             OR (jsonb_typeof(ac.product_labels->'couleurs') = 'array' 
                                 AND unaccent(ac.product_labels->'couleurs'::text) ILIKE '%' || unaccent(search_couleur) || '%')
                         )
                    THEN 100.0
                    ELSE 0.0
                END +
                -- ✅ Score catégorie - bonus seulement
                CASE 
                    WHEN search_category IS NOT NULL 
                         AND (
                             s.category = search_category
                             OR s.data->'category'->>'valeur' = search_category
                         )
                    THEN 50.0
                    ELSE 0.0
                END +
                -- ✅ Bonus usage_count
                (COALESCE(ac.usage_count, 0)::REAL * 0.5)
            )::FLOAT as match_score,
            NULL::FLOAT as distance_km,
            s.data as service_data
        FROM autocomplete_characteristics ac
        INNER JOIN services s ON s.id = ac.service_id
        WHERE s.is_active = true
        AND ac.identifiant_base = 'produits'
        AND ac.is_real_product = TRUE
        AND (
            -- ✅ OPTIMISÉ 2025-01-01: Utiliser unaccent() et similarity() comme keyword_search_with_gps
            (
                -- Option 1: Correspondance sur query semantic avec unaccent
                (search_query_semantic IS NOT NULL AND search_query_semantic != '' AND (
                    unaccent(ac.valeur) ILIKE unaccent(search_query_semantic) || '%'
                    OR to_tsvector(pg_lang, unaccent(ac.valeur)) @@ plainto_tsquery(pg_lang, unaccent(search_query_semantic))
                    OR characteristic_vector_to_tsvector(ac.characteristic_vector) @@ plainto_tsquery(pg_lang, unaccent(search_query_semantic))
                    OR full_vector_to_tsvector(ac.full_vector) @@ plainto_tsquery(pg_lang, unaccent(search_query_semantic))
                    OR similarity(unaccent(LOWER(ac.valeur)), unaccent(LOWER(search_query_semantic))) > 0.3
                ))
                -- Option 2: Correspondance sur au moins 1 tag avec unaccent et similarity
                OR (search_tags IS NOT NULL AND array_length(search_tags, 1) > 0 AND (
                    (SELECT COUNT(*) FROM unnest(search_tags) tag 
                     WHERE unaccent(ac.valeur) ILIKE '%' || unaccent(tag) || '%'
                     OR similarity(unaccent(LOWER(ac.valeur)), unaccent(LOWER(tag))) > 0.3
                     OR characteristic_vector_to_tsvector(ac.characteristic_vector) @@ plainto_tsquery(pg_lang, unaccent(tag))
                     OR full_vector_to_tsvector(ac.full_vector) @@ plainto_tsquery(pg_lang, unaccent(tag))) >= 1
                ))
                -- Option 3: Correspondance marque avec unaccent et similarity
                OR (search_marque IS NOT NULL AND search_marque != '' AND (
                    unaccent(ac.valeur) ILIKE unaccent(search_marque) || '%'
                    OR unaccent(ac.product_labels->>'marque') ILIKE unaccent(search_marque) || '%'
                    OR similarity(unaccent(LOWER(ac.valeur)), unaccent(LOWER(search_marque))) > 0.3
                ))
            )
            AND (search_couleur IS NULL OR search_couleur = '' OR (
                unaccent(ac.valeur) ILIKE '%' || unaccent(search_couleur) || '%'
                OR (jsonb_typeof(ac.product_labels->'couleurs') = 'array' 
                    AND unaccent(ac.product_labels->'couleurs'::text) ILIKE '%' || unaccent(search_couleur) || '%')
            ))
            AND (search_category IS NULL OR search_category = '' OR (
                s.category = search_category
                OR s.data->'category'->>'valeur' = search_category
            ))
        )
        
        UNION ALL
        
        -- ✅ SOURCE 2: Recherche dans image_analyses (produits catalogués - fallback)
        -- ✅ OPTIMISÉ 2025-01-01: Ajout unaccent() et similarity()
        SELECT 
            ia.service_id,
            ia.id as analysis_id,
            ia.media_id,
            ia.description as product_description,
            ia.tags as product_tags,
            ia.marque as product_marque,
            ia.couleurs as product_couleurs,
            (
                -- ✅ OPTIMISÉ: Scoring avec unaccent() et similarity()
                CASE 
                    WHEN search_query_semantic IS NOT NULL AND LOWER(unaccent(ia.description)) = LOWER(unaccent(search_query_semantic)) THEN 550.0
                    WHEN search_query_semantic IS NOT NULL AND unaccent(ia.description) ILIKE unaccent(search_query_semantic) || '%' THEN 400.0
                    WHEN search_query_semantic IS NOT NULL AND unaccent(ia.description) ILIKE '%' || unaccent(search_query_semantic) || '%' THEN 200.0
                    ELSE 0.0
                END +
                -- ✅ NOUVEAU: Score similarity pour erreurs de saisie
                CASE 
                    WHEN search_query_semantic IS NOT NULL AND similarity(unaccent(LOWER(ia.description)), unaccent(LOWER(search_query_semantic))) > 0.3 THEN 
                        similarity(unaccent(LOWER(ia.description)), unaccent(LOWER(search_query_semantic))) * 150.0
                    ELSE 0.0
                END +
                -- ✅ Score tags communs avec unaccent
                (SELECT 
                    CASE 
                        WHEN COUNT(*) >= 2 THEN COUNT(*) * 100.0
                        WHEN COUNT(*) = 1 THEN 30.0
                        ELSE 0.0
                    END
                 FROM unnest(ia.tags) tag 
                 WHERE tag = ANY(search_tags)
                 OR (search_query_semantic IS NOT NULL AND unaccent(tag) ILIKE '%' || unaccent(search_query_semantic) || '%')
                 OR (search_query_semantic IS NOT NULL AND similarity(unaccent(LOWER(tag)), unaccent(LOWER(search_query_semantic))) > 0.3)) +
                -- ✅ Score marque avec unaccent et similarity
                CASE 
                    WHEN search_marque IS NOT NULL AND (
                        unaccent(ia.marque) ILIKE unaccent(search_marque) || '%'
                        OR similarity(unaccent(LOWER(ia.marque)), unaccent(LOWER(search_marque))) > 0.3
                    ) THEN 300.0 
                    ELSE 0.0 
                END +
                -- ✅ Score couleur avec unaccent
                CASE 
                    WHEN search_couleur IS NOT NULL AND search_couleur = ANY(ia.couleurs) THEN 100.0 
                    ELSE 0.0 
                END +
                -- ✅ Score catégorie - bonus seulement
                CASE 
                    WHEN search_category IS NOT NULL AND ia.category_detected = search_category THEN 50.0 
                    ELSE 0.0 
                END +
                -- ✅ Score full-text sur description avec unaccent (langue dynamique)
                COALESCE(
                    ts_rank(to_tsvector(pg_lang, unaccent(COALESCE(ia.description, ''))), plainto_tsquery(pg_lang, unaccent(COALESCE(search_query_semantic, '')))) * 500.0,
                    0.0
                ) +
                -- Bonus confiance
                (ia.confiance * 20.0)
            )::FLOAT as match_score,
            NULL::FLOAT as distance_km,
            s.data as service_data
        FROM image_analyses ia
        INNER JOIN services s ON s.id = ia.service_id
        WHERE s.is_active = true
        AND NOT EXISTS (
            SELECT 1 FROM autocomplete_characteristics ac2 
            WHERE ac2.service_id = ia.service_id 
            AND ac2.identifiant_base = 'produits' 
            AND ac2.is_real_product = TRUE
        )
        AND (
            -- ✅ OPTIMISÉ 2025-01-01: Utiliser unaccent() et similarity()
            (
                (search_query_semantic IS NOT NULL AND search_query_semantic != '' AND (
                    unaccent(ia.description) ILIKE unaccent(search_query_semantic) || '%'
                    OR to_tsvector(pg_lang, unaccent(COALESCE(ia.description, ''))) @@ plainto_tsquery(pg_lang, unaccent(search_query_semantic))
                    OR similarity(unaccent(LOWER(ia.description)), unaccent(LOWER(search_query_semantic))) > 0.3
                ))
                OR (search_tags IS NOT NULL AND array_length(search_tags, 1) > 0 AND (
                    (SELECT COUNT(*) FROM unnest(ia.tags) tag 
                     WHERE tag = ANY(search_tags)
                     OR (search_query_semantic IS NOT NULL AND unaccent(tag) ILIKE '%' || unaccent(search_query_semantic) || '%')
                     OR (search_query_semantic IS NOT NULL AND similarity(unaccent(LOWER(tag)), unaccent(LOWER(search_query_semantic))) > 0.3)) >= 1
                ))
                OR (search_marque IS NOT NULL AND search_marque != '' AND (
                    unaccent(ia.marque) ILIKE unaccent(search_marque) || '%'
                    OR similarity(unaccent(LOWER(ia.marque)), unaccent(LOWER(search_marque))) > 0.3
                ))
            )
            AND (search_couleur IS NULL OR search_couleur = '' OR search_couleur = ANY(ia.couleurs))
            AND (search_category IS NULL OR search_category = '' OR ia.category_detected = search_category)
        )
        
        UNION ALL
        
        -- ✅ SOURCE 3: Recherche dans media.ai_* (images avec IA - fallback)
        -- ✅ OPTIMISÉ 2025-01-01: Ajout unaccent() et similarity()
        SELECT 
            m.service_id,
            NULL::INTEGER as analysis_id,
            m.id as media_id,
            COALESCE(m.ai_description, '') as product_description,
            COALESCE(m.ai_tags, ARRAY[]::TEXT[]) as product_tags,
            m.ai_metadata->>'marque' as product_marque,
            ARRAY(SELECT jsonb_array_elements_text(m.ai_metadata->'couleurs'))::TEXT[] as product_couleurs,
            (
                -- ✅ OPTIMISÉ: Scoring avec unaccent() et similarity()
                CASE 
                    WHEN search_query_semantic IS NOT NULL AND LOWER(unaccent(COALESCE(m.ai_description, ''))) = LOWER(unaccent(search_query_semantic)) THEN 550.0
                    WHEN search_query_semantic IS NOT NULL AND unaccent(m.ai_description) ILIKE unaccent(search_query_semantic) || '%' THEN 400.0
                    WHEN search_query_semantic IS NOT NULL AND unaccent(m.ai_description) ILIKE '%' || unaccent(search_query_semantic) || '%' THEN 200.0
                    ELSE 0.0
                END +
                -- ✅ NOUVEAU: Score similarity pour erreurs de saisie
                CASE 
                    WHEN search_query_semantic IS NOT NULL AND similarity(unaccent(LOWER(COALESCE(m.ai_description, ''))), unaccent(LOWER(search_query_semantic))) > 0.3 THEN 
                        similarity(unaccent(LOWER(COALESCE(m.ai_description, ''))), unaccent(LOWER(search_query_semantic))) * 150.0
                    ELSE 0.0
                END +
                -- ✅ Score tags communs avec unaccent
                (SELECT 
                    CASE 
                        WHEN COUNT(*) >= 2 THEN COUNT(*) * 100.0
                        WHEN COUNT(*) = 1 THEN 50.0
                        ELSE 0.0
                    END
                 FROM unnest(COALESCE(m.ai_tags, ARRAY[]::TEXT[])) tag 
                 WHERE tag = ANY(search_tags)
                 OR (search_query_semantic IS NOT NULL AND unaccent(tag) ILIKE '%' || unaccent(search_query_semantic) || '%')
                 OR (search_query_semantic IS NOT NULL AND similarity(unaccent(LOWER(tag)), unaccent(LOWER(search_query_semantic))) > 0.3)) +
                -- ✅ Score marque avec unaccent et similarity
                CASE 
                    WHEN search_marque IS NOT NULL AND (
                        unaccent(m.ai_metadata->>'marque') ILIKE unaccent(search_marque) || '%'
                        OR similarity(unaccent(LOWER(COALESCE(m.ai_metadata->>'marque', ''))), unaccent(LOWER(search_marque))) > 0.3
                    ) THEN 300.0 
                    ELSE 0.0 
                END +
                -- ✅ Score couleur avec unaccent
                CASE 
                    WHEN search_couleur IS NOT NULL AND m.ai_metadata->'couleurs' ? search_couleur THEN 100.0 
                    ELSE 0.0 
                END +
                -- ✅ Score catégorie - bonus seulement
                CASE 
                    WHEN search_category IS NOT NULL AND m.ai_category = search_category THEN 50.0 
                    ELSE 0.0 
                END +
                -- ✅ Score full-text sur description avec unaccent (langue dynamique)
                COALESCE(
                    ts_rank(to_tsvector(pg_lang, unaccent(COALESCE(m.ai_description, ''))), plainto_tsquery(pg_lang, unaccent(COALESCE(search_query_semantic, '')))) * 500.0,
                    0.0
                ) +
                -- Bonus confiance
                (COALESCE(m.ai_confidence, 0.5) * 20.0)
            )::FLOAT as match_score,
            NULL::FLOAT as distance_km,
            s.data as service_data
        FROM media m
        INNER JOIN services s ON s.id = m.service_id
        WHERE s.is_active = true
        AND m.type = 'image'
        AND m.ai_description IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM autocomplete_characteristics ac3 
            WHERE ac3.service_id = m.service_id 
            AND ac3.identifiant_base = 'produits' 
            AND ac3.is_real_product = TRUE
        )
        AND NOT EXISTS (
            SELECT 1 FROM image_analyses ia2 
            WHERE ia2.media_id = m.id AND ia2.service_id = m.service_id
        )
        AND (
            -- ✅ OPTIMISÉ 2025-01-01: Utiliser unaccent() et similarity()
            (
                (search_query_semantic IS NOT NULL AND search_query_semantic != '' AND (
                    unaccent(m.ai_description) ILIKE unaccent(search_query_semantic) || '%'
                    OR to_tsvector(pg_lang, unaccent(COALESCE(m.ai_description, ''))) @@ plainto_tsquery(pg_lang, unaccent(search_query_semantic))
                    OR similarity(unaccent(LOWER(COALESCE(m.ai_description, ''))), unaccent(LOWER(search_query_semantic))) > 0.3
                ))
                OR (search_tags IS NOT NULL AND array_length(search_tags, 1) > 0 AND (
                    (SELECT COUNT(*) FROM unnest(COALESCE(m.ai_tags, ARRAY[]::TEXT[])) tag 
                     WHERE tag = ANY(search_tags)
                     OR (search_query_semantic IS NOT NULL AND unaccent(tag) ILIKE '%' || unaccent(search_query_semantic) || '%')
                     OR (search_query_semantic IS NOT NULL AND similarity(unaccent(LOWER(tag)), unaccent(LOWER(search_query_semantic))) > 0.3)) >= 1
                ))
                OR (search_marque IS NOT NULL AND search_marque != '' AND (
                    unaccent(m.ai_metadata->>'marque') ILIKE unaccent(search_marque) || '%'
                    OR similarity(unaccent(LOWER(COALESCE(m.ai_metadata->>'marque', ''))), unaccent(LOWER(search_marque))) > 0.3
                ))
            )
            AND (search_couleur IS NULL OR search_couleur = '' OR m.ai_metadata->'couleurs' ? search_couleur)
            AND (search_category IS NULL OR search_category = '' OR m.ai_category = search_category)
        )
    )
    SELECT 
        cr.service_id,
        cr.analysis_id,
        cr.media_id,
        cr.product_description,
        cr.product_tags,
        cr.product_marque,
        cr.product_couleurs,
        cr.match_score,
        cr.service_data,
        -- Calculer distance GPS si coordonnées fournies
        CASE 
            WHEN gps_lat IS NOT NULL AND gps_lng IS NOT NULL THEN
                (SELECT 
                    CASE 
                        WHEN s.gps IS NOT NULL AND s.gps != '' AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN
                            calculate_gps_distance_km_simple(
                                gps_lat,
                                gps_lng,
                                split_part(s.gps, ',', 1)::double precision,
                                split_part(s.gps, ',', 2)::double precision
                            )
                        ELSE NULL
                    END
                FROM services s WHERE s.id = cr.service_id)
            ELSE NULL
        END::FLOAT as distance_km
    FROM combined_results cr
    WHERE cr.match_score >= 200.0  -- Seuil strict maintenu
    ORDER BY 
        cr.match_score DESC,
        distance_km ASC NULLS LAST
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION hybrid_image_search IS 
'✅ OPTIMISÉ 2025-01-01: Utilise unaccent() et similarity() comme keyword_search_with_gps.
Gère accents, erreurs de saisie, troncature. Aligné avec la nouvelle approche optimisée.';


