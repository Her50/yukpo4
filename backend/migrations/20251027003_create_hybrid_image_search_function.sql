-- Migration pour créer la fonction hybrid_image_search
-- Combine recherche dans image_analyses ET media.ai_* pour matching amélioré
-- Date: 2025-10-27 (renommée depuis 2025-01-22 pour être appliquée APRÈS 20251026)
-- Compatible avec sqlx offline mode
-- IMPORTANT: Cette migration doit être appliquée APRÈS 20251026_create_image_analyses_table.sql

-- Fonction helper pour calculer la distance GPS (formule Haversine)
-- Compatible sqlx offline - utilise uniquement des fonctions PostgreSQL standard
CREATE OR REPLACE FUNCTION calculate_gps_distance_km_simple(
    lat1 DOUBLE PRECISION,
    lng1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION,
    lng2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION AS $$
BEGIN
    -- Formule de Haversine pour calculer la distance entre deux points GPS
    RETURN (
        6371.0 * acos(
            LEAST(1.0, GREATEST(-1.0,
                cos(radians(lat1)) * 
                cos(radians(lat2)) * 
                cos(radians(lng2) - radians(lng1)) + 
                sin(radians(lat1)) * 
                sin(radians(lat2))
            ))
        )
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_gps_distance_km_simple IS 'Calcule la distance GPS en km avec formule Haversine (compatible sqlx offline)';

-- ✅ CORRECTION: Fonction de recherche hybride améliorée qui cherche dans DEUX sources
CREATE OR REPLACE FUNCTION hybrid_image_search(
    search_tags TEXT[],
    search_category TEXT DEFAULT NULL,
    search_marque TEXT DEFAULT NULL,
    search_couleur TEXT DEFAULT NULL,
    search_query_semantic TEXT DEFAULT NULL,
    gps_lat FLOAT DEFAULT NULL,
    gps_lng FLOAT DEFAULT NULL,
    search_radius_km INTEGER DEFAULT 50,
    max_results INTEGER DEFAULT 20
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
    distance_km FLOAT
) AS $$
BEGIN
    RETURN QUERY
    WITH combined_results AS (
        -- ✅ SOURCE 1: Recherche dans image_analyses (produits catalogués)
        SELECT 
            ia.service_id,
            ia.id as analysis_id,
            ia.media_id,
            ia.description as product_description,
            ia.tags as product_tags,
            ia.marque as product_marque,
            ia.couleurs as product_couleurs,
            (
                -- Score tags communs
                (SELECT COUNT(*) * 20.0 FROM unnest(ia.tags) tag WHERE tag = ANY(search_tags)) +
                -- Score marque exacte
                CASE WHEN search_marque IS NOT NULL AND ia.marque ILIKE '%' || search_marque || '%' THEN 100.0 ELSE 0.0 END +
                -- Score couleur
                CASE WHEN search_couleur IS NOT NULL AND search_couleur = ANY(ia.couleurs) THEN 30.0 ELSE 0.0 END +
                -- Score catégorie
                CASE WHEN search_category IS NOT NULL AND ia.category_detected = search_category THEN 40.0 ELSE 0.0 END +
                -- Score full-text sur description
                COALESCE(
                    ts_rank(to_tsvector('french', COALESCE(ia.description, '')), plainto_tsquery('french', COALESCE(search_query_semantic, ''))) * 50.0,
                    0.0
                ) +
                -- Score full-text sur search_query_semantic dans description
                CASE 
                    WHEN search_query_semantic IS NOT NULL AND ia.description ILIKE '%' || search_query_semantic || '%' THEN 30.0
                    ELSE 0.0
                END +
                -- Bonus confiance
                (ia.confiance * 20.0)
            )::FLOAT as match_score,
            NULL::FLOAT as distance_km
        FROM image_analyses ia
        INNER JOIN services s ON s.id = ia.service_id
        WHERE s.is_active = true
        AND (
            -- Matching flexible : au moins un tag en commun OU description match
            (search_tags IS NOT NULL AND array_length(search_tags, 1) > 0 AND ia.tags && search_tags)
            OR (search_query_semantic IS NOT NULL AND ia.description ILIKE '%' || search_query_semantic || '%')
            OR (search_category IS NOT NULL AND ia.category_detected = search_category)
            OR (search_marque IS NOT NULL AND ia.marque ILIKE '%' || search_marque || '%')
        )
        
        UNION ALL
        
        -- ✅ SOURCE 2: Recherche dans media.ai_* (images créées mais non cataloguées dans image_analyses)
        SELECT 
            m.service_id,
            NULL::INTEGER as analysis_id,
            m.id as media_id,
            COALESCE(m.ai_description, '') as product_description,
            COALESCE(m.ai_tags, ARRAY[]::TEXT[]) as product_tags,
            m.ai_metadata->>'marque' as product_marque,
            ARRAY(SELECT jsonb_array_elements_text(m.ai_metadata->'couleurs'))::TEXT[] as product_couleurs,
            (
                -- Score tags communs
                (SELECT COUNT(*) * 20.0 FROM unnest(COALESCE(m.ai_tags, ARRAY[]::TEXT[])) tag WHERE tag = ANY(search_tags)) +
                -- Score marque exacte
                CASE WHEN search_marque IS NOT NULL AND m.ai_metadata->>'marque' ILIKE '%' || search_marque || '%' THEN 100.0 ELSE 0.0 END +
                -- Score couleur
                CASE WHEN search_couleur IS NOT NULL AND m.ai_metadata->'couleurs' ? search_couleur THEN 30.0 ELSE 0.0 END +
                -- Score catégorie
                CASE WHEN search_category IS NOT NULL AND m.ai_category = search_category THEN 40.0 ELSE 0.0 END +
                -- Score full-text sur description
                COALESCE(
                    ts_rank(to_tsvector('french', COALESCE(m.ai_description, '')), plainto_tsquery('french', COALESCE(search_query_semantic, ''))) * 50.0,
                    0.0
                ) +
                -- Score full-text sur search_query_semantic dans description
                CASE 
                    WHEN search_query_semantic IS NOT NULL AND m.ai_description ILIKE '%' || search_query_semantic || '%' THEN 30.0
                    ELSE 0.0
                END +
                -- Bonus confiance
                (COALESCE(m.ai_confidence, 0.5) * 20.0)
            )::FLOAT as match_score,
            NULL::FLOAT as distance_km
        FROM media m
        INNER JOIN services s ON s.id = m.service_id
        WHERE s.is_active = true
        AND m.type = 'image'
        AND m.ai_description IS NOT NULL
        -- ✅ CORRECTION: Exclure les images déjà dans image_analyses pour éviter doublons
        AND NOT EXISTS (
            SELECT 1 FROM image_analyses ia2 
            WHERE ia2.media_id = m.id AND ia2.service_id = m.service_id
        )
        AND (
            -- Matching flexible : au moins un tag en commun OU description match
            (search_tags IS NOT NULL AND array_length(search_tags, 1) > 0 AND m.ai_tags && search_tags)
            OR (search_query_semantic IS NOT NULL AND m.ai_description ILIKE '%' || search_query_semantic || '%')
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
        -- Calculer distance GPS si coordonnées fournies (utilise fonction helper pour compatibilité sqlx offline)
        CASE 
            WHEN gps_lat IS NOT NULL AND gps_lng IS NOT NULL THEN
                (SELECT 
                    CASE 
                        WHEN s.gps IS NOT NULL AND s.gps != '' AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN
                            -- Extraire lat/lng du GPS string (format: lat,lng) et utiliser fonction helper
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
    WHERE cr.match_score >= 10.0  -- ✅ CORRECTION: Seuil abaissé de 0 à 10.0 pour inclure plus de résultats
    ORDER BY 
        cr.match_score DESC,
        distance_km ASC NULLS LAST
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION hybrid_image_search IS 'Recherche hybride améliorée : combine image_analyses ET media.ai_* pour matching complet de toutes les images créées';

