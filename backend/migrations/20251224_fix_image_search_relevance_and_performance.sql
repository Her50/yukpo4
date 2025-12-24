-- Migration pour corriger la pertinence et performance de la recherche par image
-- Problèmes identifiés:
-- 1. Seuil match_score trop bas (30.0) → récupère presque tous les produits
-- 2. Recherches ILIKE trop larges → matchent presque tout
-- 3. Pas de filtrage strict sur le nombre minimum de correspondances
-- 4. Scores trop élevés pour correspondances partielles
-- Date: 2025-12-24

-- Supprimer l'ancienne fonction
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
                -- ✅ AMÉLIORÉ: Scoring plus strict - correspondances exactes uniquement
                -- Score ILIKE exact (priorité maximale) - SEULEMENT si correspondance exacte ou début
                CASE 
                    WHEN search_query_semantic IS NOT NULL AND LOWER(ac.valeur) = LOWER(search_query_semantic) THEN 600.0
                    WHEN search_query_semantic IS NOT NULL AND ac.valeur ILIKE search_query_semantic || '%' THEN 400.0
                    -- ✅ SUPPRIMÉ: Correspondance partielle (trop permissive)
                    -- WHEN search_query_semantic IS NOT NULL AND ac.valeur ILIKE '%' || search_query_semantic || '%' THEN 300.0
                    ELSE 0.0
                END +
                -- ✅ Score full-text sur valeur (index GIN tsvector) - avec langue dynamique
                COALESCE(
                    ts_rank(to_tsvector(pg_lang, ac.valeur), plainto_tsquery(pg_lang, COALESCE(search_query_semantic, ''))) * 400.0,
                    0.0
                ) +
                -- ✅ Score full-text sur characteristic_vector
                COALESCE(
                    ts_rank(characteristic_vector_to_tsvector(ac.characteristic_vector), plainto_tsquery(pg_lang, COALESCE(search_query_semantic, ''))) * 300.0,
                    0.0
                ) +
                -- ✅ Score full-text sur full_vector
                COALESCE(
                    ts_rank(full_vector_to_tsvector(ac.full_vector), plainto_tsquery(pg_lang, COALESCE(search_query_semantic, ''))) * 250.0,
                    0.0
                ) +
                -- ✅ AMÉLIORÉ: Score tags communs - SEULEMENT si au moins 2 tags correspondent
                CASE 
                    WHEN search_tags IS NOT NULL AND array_length(search_tags, 1) > 0 THEN
                        (SELECT 
                            CASE 
                                WHEN COUNT(*) >= 2 THEN COUNT(*) * 100.0  -- Bonus si 2+ tags
                                WHEN COUNT(*) = 1 THEN 50.0  -- Score réduit si 1 seul tag
                                ELSE 0.0
                            END
                         FROM unnest(search_tags) tag 
                         WHERE ac.valeur ILIKE '%' || tag || '%'
                         OR characteristic_vector_to_tsvector(ac.characteristic_vector) @@ plainto_tsquery(pg_lang, tag)
                         OR full_vector_to_tsvector(ac.full_vector) @@ plainto_tsquery(pg_lang, tag))
                    ELSE 0.0
                END +
                -- ✅ Score marque exacte (priorité haute)
                CASE 
                    WHEN search_marque IS NOT NULL 
                         AND (
                             ac.valeur ILIKE search_marque || '%'  -- ✅ Commence par la marque (plus strict)
                             OR (ac.product_labels->>'marque') ILIKE search_marque || '%'
                         )
                    THEN 350.0
                    ELSE 0.0
                END +
                -- ✅ Score couleur (priorité moyenne)
                CASE 
                    WHEN search_couleur IS NOT NULL 
                         AND (
                             ac.valeur ILIKE '%' || search_couleur || '%'
                             OR (jsonb_typeof(ac.product_labels->'couleurs') = 'array' 
                                 AND ac.product_labels->'couleurs'::text ILIKE '%' || search_couleur || '%')
                         )
                    THEN 150.0
                    ELSE 0.0
                END +
                -- ✅ Score catégorie (priorité moyenne)
                CASE 
                    WHEN search_category IS NOT NULL 
                         AND (
                             s.category = search_category
                             OR s.data->'category'->>'valeur' = search_category
                         )
                    THEN 200.0
                    ELSE 0.0
                END +
                -- ✅ Bonus usage_count (produits populaires) - réduit
                (COALESCE(ac.usage_count, 0)::REAL * 1.0)  -- Réduit de 2.0 à 1.0
            )::FLOAT as match_score,
            NULL::FLOAT as distance_km,
            s.data as service_data
        FROM autocomplete_characteristics ac
        INNER JOIN services s ON s.id = ac.service_id
        WHERE s.is_active = true
        AND ac.identifiant_base = 'produits'
        AND ac.is_real_product = TRUE
        AND (
            -- ✅ AMÉLIORÉ: Conditions plus strictes - correspondances exactes ou début uniquement
            (search_query_semantic IS NOT NULL AND (
                ac.valeur ILIKE search_query_semantic || '%'  -- ✅ Commence par (plus strict)
                OR to_tsvector(pg_lang, ac.valeur) @@ plainto_tsquery(pg_lang, search_query_semantic)
                OR characteristic_vector_to_tsvector(ac.characteristic_vector) @@ plainto_tsquery(pg_lang, search_query_semantic)
                OR full_vector_to_tsvector(ac.full_vector) @@ plainto_tsquery(pg_lang, search_query_semantic)
            ))
            OR (search_tags IS NOT NULL AND array_length(search_tags, 1) > 0 AND (
                -- ✅ AMÉLIORÉ: Exiger au moins 2 tags correspondants (plus strict)
                (SELECT COUNT(*) FROM unnest(search_tags) tag 
                 WHERE ac.valeur ILIKE '%' || tag || '%'
                 OR characteristic_vector_to_tsvector(ac.characteristic_vector) @@ plainto_tsquery(pg_lang, tag)) >= 2
            ))
            OR (search_marque IS NOT NULL AND (
                ac.valeur ILIKE search_marque || '%'  -- ✅ Commence par la marque
                OR (ac.product_labels->>'marque') ILIKE search_marque || '%'
            ))
            OR (search_couleur IS NOT NULL AND (
                ac.valeur ILIKE '%' || search_couleur || '%'
                OR (jsonb_typeof(ac.product_labels->'couleurs') = 'array' 
                    AND ac.product_labels->'couleurs'::text ILIKE '%' || search_couleur || '%')
            ))
            OR (search_category IS NOT NULL AND (
                s.category = search_category
                OR s.data->'category'->>'valeur' = search_category
            ))
        )
        
        UNION ALL
        
        -- ✅ SOURCE 2: Recherche dans image_analyses (produits catalogués - fallback)
        SELECT 
            ia.service_id,
            ia.id as analysis_id,
            ia.media_id,
            ia.description as product_description,
            ia.tags as product_tags,
            ia.marque as product_marque,
            ia.couleurs as product_couleurs,
            (
                -- ✅ AMÉLIORÉ: Scoring plus strict
                CASE 
                    WHEN search_query_semantic IS NOT NULL AND LOWER(ia.description) = LOWER(search_query_semantic) THEN 550.0
                    WHEN search_query_semantic IS NOT NULL AND ia.description ILIKE search_query_semantic || '%' THEN 400.0
                    -- ✅ SUPPRIMÉ: Correspondance partielle
                    ELSE 0.0
                END +
                -- ✅ Score tags communs - SEULEMENT si au moins 2 tags
                (SELECT 
                    CASE 
                        WHEN COUNT(*) >= 2 THEN COUNT(*) * 80.0
                        WHEN COUNT(*) = 1 THEN 30.0
                        ELSE 0.0
                    END
                 FROM unnest(ia.tags) tag WHERE tag = ANY(search_tags)) +
                -- Score marque exacte
                CASE WHEN search_marque IS NOT NULL AND ia.marque ILIKE search_marque || '%' THEN 300.0 ELSE 0.0 END +
                -- Score couleur
                CASE WHEN search_couleur IS NOT NULL AND search_couleur = ANY(ia.couleurs) THEN 120.0 ELSE 0.0 END +
                -- Score catégorie
                CASE WHEN search_category IS NOT NULL AND ia.category_detected = search_category THEN 180.0 ELSE 0.0 END +
                -- ✅ Score full-text sur description (langue dynamique)
                COALESCE(
                    ts_rank(to_tsvector(pg_lang, COALESCE(ia.description, '')), plainto_tsquery(pg_lang, COALESCE(search_query_semantic, ''))) * 500.0,
                    0.0
                ) +
                -- Bonus confiance (réduit)
                (ia.confiance * 30.0)  -- Réduit de 50.0 à 30.0
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
            (search_query_semantic IS NOT NULL AND (
                ia.description ILIKE search_query_semantic || '%'  -- ✅ Commence par
                OR to_tsvector(pg_lang, COALESCE(ia.description, '')) @@ plainto_tsquery(pg_lang, search_query_semantic)
            ))
            OR (search_tags IS NOT NULL AND array_length(search_tags, 1) > 0 AND (
                -- ✅ AMÉLIORÉ: Exiger au moins 2 tags correspondants
                (SELECT COUNT(*) FROM unnest(ia.tags) tag WHERE tag = ANY(search_tags)) >= 2
            ))
            OR (search_category IS NOT NULL AND ia.category_detected = search_category)
            OR (search_marque IS NOT NULL AND ia.marque ILIKE search_marque || '%')
        )
        
        UNION ALL
        
        -- ✅ SOURCE 3: Recherche dans media.ai_* (images avec IA - fallback)
        SELECT 
            m.service_id,
            NULL::INTEGER as analysis_id,
            m.id as media_id,
            COALESCE(m.ai_description, '') as product_description,
            COALESCE(m.ai_tags, ARRAY[]::TEXT[]) as product_tags,
            m.ai_metadata->>'marque' as product_marque,
            ARRAY(SELECT jsonb_array_elements_text(m.ai_metadata->'couleurs'))::TEXT[] as product_couleurs,
            (
                -- ✅ AMÉLIORÉ: Scoring plus strict
                CASE 
                    WHEN search_query_semantic IS NOT NULL AND LOWER(COALESCE(m.ai_description, '')) = LOWER(search_query_semantic) THEN 550.0
                    WHEN search_query_semantic IS NOT NULL AND m.ai_description ILIKE search_query_semantic || '%' THEN 400.0
                    -- ✅ SUPPRIMÉ: Correspondance partielle
                    ELSE 0.0
                END +
                -- ✅ Score tags communs - SEULEMENT si au moins 2 tags
                (SELECT 
                    CASE 
                        WHEN COUNT(*) >= 2 THEN COUNT(*) * 80.0
                        WHEN COUNT(*) = 1 THEN 30.0
                        ELSE 0.0
                    END
                 FROM unnest(COALESCE(m.ai_tags, ARRAY[]::TEXT[])) tag WHERE tag = ANY(search_tags)) +
                -- Score marque exacte
                CASE WHEN search_marque IS NOT NULL AND m.ai_metadata->>'marque' ILIKE search_marque || '%' THEN 300.0 ELSE 0.0 END +
                -- Score couleur
                CASE WHEN search_couleur IS NOT NULL AND m.ai_metadata->'couleurs' ? search_couleur THEN 120.0 ELSE 0.0 END +
                -- Score catégorie
                CASE WHEN search_category IS NOT NULL AND m.ai_category = search_category THEN 180.0 ELSE 0.0 END +
                -- ✅ Score full-text sur description (langue dynamique)
                COALESCE(
                    ts_rank(to_tsvector(pg_lang, COALESCE(m.ai_description, '')), plainto_tsquery(pg_lang, COALESCE(search_query_semantic, ''))) * 500.0,
                    0.0
                ) +
                -- Bonus confiance (réduit)
                (COALESCE(m.ai_confidence, 0.5) * 30.0)  -- Réduit de 50.0 à 30.0
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
            (search_query_semantic IS NOT NULL AND (
                m.ai_description ILIKE search_query_semantic || '%'  -- ✅ Commence par
                OR to_tsvector(pg_lang, COALESCE(m.ai_description, '')) @@ plainto_tsquery(pg_lang, search_query_semantic)
            ))
            OR (search_tags IS NOT NULL AND array_length(search_tags, 1) > 0 AND (
                -- ✅ AMÉLIORÉ: Exiger au moins 2 tags correspondants
                (SELECT COUNT(*) FROM unnest(COALESCE(m.ai_tags, ARRAY[]::TEXT[])) tag WHERE tag = ANY(search_tags)) >= 2
            ))
            OR (search_category IS NOT NULL AND m.ai_category = search_category)
            OR (search_marque IS NOT NULL AND m.ai_metadata->>'marque' ILIKE search_marque || '%')
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
    WHERE cr.match_score >= 150.0  -- ✅ SEUIL AUGMENTÉ: 150.0 au lieu de 30.0 (5x plus strict)
    ORDER BY 
        cr.match_score DESC,
        distance_km ASC NULLS LAST
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION hybrid_image_search IS 'Recherche hybride améliorée avec seuil strict (150.0) et scoring priorisant correspondances exactes - 2025-12-24';


