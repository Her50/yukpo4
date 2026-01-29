-- Migration pour améliorer la pertinence de la recherche par image
-- Problème: La fonction utilise 'french' en dur au lieu de détection automatique
-- Problème: Le scoring ne priorise pas assez les correspondances exactes (ILIKE)
-- Solution: Ajouter paramètre langue + améliorer scoring pour prioriser ILIKE
-- Date: 2025-12-24

-- Supprimer l'ancienne fonction si elle existe (toutes les signatures)
-- ✅ Corrigé: Spécifier la signature complète
DROP FUNCTION IF EXISTS hybrid_image_search(TEXT[], TEXT, TEXT, TEXT, TEXT, FLOAT, FLOAT, INTEGER, INTEGER, TEXT) CASCADE;

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
    pg_lang TEXT DEFAULT 'french'  -- ✅ NOUVEAU: Paramètre langue PostgreSQL (ex: 'french', 'english', 'simple')
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
        -- C'est la source principale utilisée par la recherche textuelle et audio
        SELECT DISTINCT ON (ac.service_id)
            ac.service_id,
            NULL::INTEGER as analysis_id,
            NULL::INTEGER as media_id,
            ac.valeur as product_description,
            -- Extraire les tags depuis characteristic_vector et full_vector
            ARRAY(
                SELECT DISTINCT unnest(string_to_array(ac.valeur, ','))
            )::TEXT[] as product_tags,
            -- Extraire marque depuis product_labels ou characteristic_vector
            COALESCE(
                (ac.product_labels->>'marque')::TEXT,
                (SELECT unnest(string_to_array(ac.valeur, ',')) LIMIT 1)
            ) as product_marque,
            -- Extraire couleurs depuis product_labels ou characteristic_vector
            ARRAY(
                SELECT jsonb_array_elements_text(ac.product_labels->'couleurs')
                WHERE jsonb_typeof(ac.product_labels->'couleurs') = 'array'
            )::TEXT[] as product_couleurs,
            (
                -- ✅ AMÉLIORÉ: Prioriser ILIKE pour correspondances exactes (gestion accents)
                -- Score ILIKE exact (priorité maximale)
                CASE 
                    WHEN search_query_semantic IS NOT NULL AND LOWER(ac.valeur) = LOWER(search_query_semantic) THEN 600.0
                    WHEN search_query_semantic IS NOT NULL AND ac.valeur ILIKE search_query_semantic || '%' THEN 450.0
                    WHEN search_query_semantic IS NOT NULL AND ac.valeur ILIKE '%' || search_query_semantic || '%' THEN 300.0
                    ELSE 0.0
                END +
                -- ✅ Score full-text sur valeur (index GIN tsvector) - avec langue dynamique
                COALESCE(
                    ts_rank(to_tsvector(pg_lang, ac.valeur), plainto_tsquery(pg_lang, COALESCE(search_query_semantic, ''))) * 400.0,
                    0.0
                ) +
                -- ✅ Score full-text sur characteristic_vector (index GIN tsvector) - avec langue dynamique
                COALESCE(
                    ts_rank(characteristic_vector_to_tsvector(ac.characteristic_vector), plainto_tsquery(pg_lang, COALESCE(search_query_semantic, ''))) * 300.0,
                    0.0
                ) +
                -- ✅ Score full-text sur full_vector (index GIN tsvector) - avec langue dynamique
                COALESCE(
                    ts_rank(full_vector_to_tsvector(ac.full_vector), plainto_tsquery(pg_lang, COALESCE(search_query_semantic, ''))) * 250.0,
                    0.0
                ) +
                -- ✅ Score tags communs (si search_tags fourni) - avec ILIKE prioritaire
                CASE 
                    WHEN search_tags IS NOT NULL AND array_length(search_tags, 1) > 0 THEN
                        (SELECT COUNT(*) * 80.0 FROM unnest(search_tags) tag 
                         WHERE ac.valeur ILIKE '%' || tag || '%'
                         OR characteristic_vector_to_tsvector(ac.characteristic_vector) @@ plainto_tsquery(pg_lang, tag)
                         OR full_vector_to_tsvector(ac.full_vector) @@ plainto_tsquery(pg_lang, tag))
                    ELSE 0.0
                END +
                -- ✅ Score marque exacte (avec ILIKE prioritaire)
                CASE 
                    WHEN search_marque IS NOT NULL 
                         AND (
                             ac.valeur ILIKE '%' || search_marque || '%'
                             OR (ac.product_labels->>'marque') ILIKE '%' || search_marque || '%'
                         )
                    THEN 300.0
                    ELSE 0.0
                END +
                -- ✅ Score couleur
                CASE 
                    WHEN search_couleur IS NOT NULL 
                         AND (
                             ac.valeur ILIKE '%' || search_couleur || '%'
                             OR (jsonb_typeof(ac.product_labels->'couleurs') = 'array' 
                                 AND ac.product_labels->'couleurs'::text ILIKE '%' || search_couleur || '%')
                         )
                    THEN 120.0
                    ELSE 0.0
                END +
                -- ✅ Score catégorie
                CASE 
                    WHEN search_category IS NOT NULL 
                         AND (
                             s.category = search_category
                             OR s.data->'category'->>'valeur' = search_category
                         )
                    THEN 180.0
                    ELSE 0.0
                END +
                -- ✅ Bonus usage_count (produits populaires)
                (COALESCE(ac.usage_count, 0)::REAL * 2.0)
            )::FLOAT as match_score,
            NULL::FLOAT as distance_km,
            s.data as service_data
        FROM autocomplete_characteristics ac
        INNER JOIN services s ON s.id = ac.service_id
        WHERE s.is_active = true
        AND ac.identifiant_base = 'produits'
        AND ac.is_real_product = TRUE
        AND (
            -- ✅ AMÉLIORÉ: Matching flexible avec priorité ILIKE + full-text (langue dynamique)
            (search_query_semantic IS NOT NULL AND (
                ac.valeur ILIKE '%' || search_query_semantic || '%'  -- ✅ ILIKE en premier (gestion accents)
                OR to_tsvector(pg_lang, ac.valeur) @@ plainto_tsquery(pg_lang, search_query_semantic)
                OR characteristic_vector_to_tsvector(ac.characteristic_vector) @@ plainto_tsquery(pg_lang, search_query_semantic)
                OR full_vector_to_tsvector(ac.full_vector) @@ plainto_tsquery(pg_lang, search_query_semantic)
            ))
            OR (search_tags IS NOT NULL AND array_length(search_tags, 1) > 0 AND (
                EXISTS (SELECT 1 FROM unnest(search_tags) tag WHERE ac.valeur ILIKE '%' || tag || '%')
                OR EXISTS (SELECT 1 FROM unnest(search_tags) tag 
                           WHERE characteristic_vector_to_tsvector(ac.characteristic_vector) @@ plainto_tsquery(pg_lang, tag))
            ))
            OR (search_marque IS NOT NULL AND (
                ac.valeur ILIKE '%' || search_marque || '%'
                OR (ac.product_labels->>'marque') ILIKE '%' || search_marque || '%'
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
                -- ✅ AMÉLIORÉ: Prioriser ILIKE pour correspondances exactes
                CASE 
                    WHEN search_query_semantic IS NOT NULL AND LOWER(ia.description) = LOWER(search_query_semantic) THEN 550.0
                    WHEN search_query_semantic IS NOT NULL AND ia.description ILIKE search_query_semantic || '%' THEN 400.0
                    WHEN search_query_semantic IS NOT NULL AND ia.description ILIKE '%' || search_query_semantic || '%' THEN 250.0
                    ELSE 0.0
                END +
                -- Score tags communs
                (SELECT COUNT(*) * 60.0 FROM unnest(ia.tags) tag WHERE tag = ANY(search_tags)) +
                -- Score marque exacte
                CASE WHEN search_marque IS NOT NULL AND ia.marque ILIKE '%' || search_marque || '%' THEN 250.0 ELSE 0.0 END +
                -- Score couleur
                CASE WHEN search_couleur IS NOT NULL AND search_couleur = ANY(ia.couleurs) THEN 100.0 ELSE 0.0 END +
                -- Score catégorie
                CASE WHEN search_category IS NOT NULL AND ia.category_detected = search_category THEN 150.0 ELSE 0.0 END +
                -- ✅ Score full-text sur description (langue dynamique)
                COALESCE(
                    ts_rank(to_tsvector(pg_lang, COALESCE(ia.description, '')), plainto_tsquery(pg_lang, COALESCE(search_query_semantic, ''))) * 500.0,
                    0.0
                ) +
                -- Bonus confiance
                (ia.confiance * 50.0)
            )::FLOAT as match_score,
            NULL::FLOAT as distance_km,
            s.data as service_data
        FROM image_analyses ia
        INNER JOIN services s ON s.id = ia.service_id
        WHERE s.is_active = true
        -- ✅ Exclure les services déjà trouvés dans SOURCE 1 (autocomplete_characteristics)
        AND NOT EXISTS (
            SELECT 1 FROM autocomplete_characteristics ac2 
            WHERE ac2.service_id = ia.service_id 
            AND ac2.identifiant_base = 'produits' 
            AND ac2.is_real_product = TRUE
        )
        AND (
            (search_query_semantic IS NOT NULL AND ia.description ILIKE '%' || search_query_semantic || '%')
            OR (search_query_semantic IS NOT NULL AND to_tsvector(pg_lang, COALESCE(ia.description, '')) @@ plainto_tsquery(pg_lang, search_query_semantic))
            OR (search_tags IS NOT NULL AND array_length(search_tags, 1) > 0 AND ia.tags && search_tags)
            OR (search_category IS NOT NULL AND ia.category_detected = search_category)
            OR (search_marque IS NOT NULL AND ia.marque ILIKE '%' || search_marque || '%')
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
                -- ✅ AMÉLIORÉ: Prioriser ILIKE pour correspondances exactes
                CASE 
                    WHEN search_query_semantic IS NOT NULL AND LOWER(COALESCE(m.ai_description, '')) = LOWER(search_query_semantic) THEN 550.0
                    WHEN search_query_semantic IS NOT NULL AND m.ai_description ILIKE search_query_semantic || '%' THEN 400.0
                    WHEN search_query_semantic IS NOT NULL AND m.ai_description ILIKE '%' || search_query_semantic || '%' THEN 250.0
                    ELSE 0.0
                END +
                -- Score tags communs
                (SELECT COUNT(*) * 60.0 FROM unnest(COALESCE(m.ai_tags, ARRAY[]::TEXT[])) tag WHERE tag = ANY(search_tags)) +
                -- Score marque exacte
                CASE WHEN search_marque IS NOT NULL AND m.ai_metadata->>'marque' ILIKE '%' || search_marque || '%' THEN 250.0 ELSE 0.0 END +
                -- Score couleur
                CASE WHEN search_couleur IS NOT NULL AND m.ai_metadata->'couleurs' ? search_couleur THEN 100.0 ELSE 0.0 END +
                -- Score catégorie
                CASE WHEN search_category IS NOT NULL AND m.ai_category = search_category THEN 150.0 ELSE 0.0 END +
                -- ✅ Score full-text sur description (langue dynamique)
                COALESCE(
                    ts_rank(to_tsvector(pg_lang, COALESCE(m.ai_description, '')), plainto_tsquery(pg_lang, COALESCE(search_query_semantic, ''))) * 500.0,
                    0.0
                ) +
                -- Bonus confiance
                (COALESCE(m.ai_confidence, 0.5) * 50.0)
            )::FLOAT as match_score,
            NULL::FLOAT as distance_km,
            s.data as service_data
        FROM media m
        INNER JOIN services s ON s.id = m.service_id
        WHERE s.is_active = true
        AND m.type = 'image'
        AND m.ai_description IS NOT NULL
        -- ✅ Exclure les services déjà trouvés dans SOURCE 1 ou SOURCE 2
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
            (search_query_semantic IS NOT NULL AND m.ai_description ILIKE '%' || search_query_semantic || '%')
            OR (search_query_semantic IS NOT NULL AND to_tsvector(pg_lang, COALESCE(m.ai_description, '')) @@ plainto_tsquery(pg_lang, search_query_semantic))
            OR (search_tags IS NOT NULL AND array_length(search_tags, 1) > 0 AND m.ai_tags && search_tags)
            OR (search_category IS NOT NULL AND m.ai_category = search_category)
            OR (search_marque IS NOT NULL AND m.ai_metadata->>'marque' ILIKE '%' || search_marque || '%')
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
    WHERE cr.match_score >= 30.0  -- ✅ Seuil strict pour filtrer les résultats non pertinents
    ORDER BY 
        cr.match_score DESC,
        distance_km ASC NULLS LAST
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION hybrid_image_search IS 'Recherche hybride améliorée avec langue dynamique et scoring priorisant ILIKE (gestion accents) - 2025-12-24';



