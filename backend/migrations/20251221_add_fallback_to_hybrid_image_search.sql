-- Migration pour ajouter un fallback dans hybrid_image_search
-- Problème: Les images dans media n'ont pas toujours ai_description remplie
-- Solution: Ajouter un fallback pour chercher directement dans services.data->'produits'
-- Date: 2025-12-21

-- ✅ AMÉLIORATION: Ajouter une SOURCE 3 (fallback) pour chercher dans services.data->'produits'
-- Cette source permet de trouver des produits même si leurs images n'ont pas été analysées par IA
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
    distance_km FLOAT,
    service_data JSONB
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
            NULL::FLOAT as distance_km,
            s.data as service_data
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
            NULL::FLOAT as distance_km,
            s.data as service_data
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
        
        UNION ALL
        
        -- ✅ NOUVEAU SOURCE 3: Fallback - Recherche directe dans services.data->'produits'
        -- Cette source permet de trouver des produits même si leurs images n'ont pas été analysées
        -- ✅ OPTIMISÉ: Limiter à 5 produits par service pour éviter les scans complets
        SELECT DISTINCT ON (s.id, produit->>'nom_produit')
            s.id as service_id,
            NULL::INTEGER as analysis_id,
            NULL::INTEGER as media_id,
            COALESCE(
                produit->>'nom_produit',
                produit->>'nom',
                produit->>'name',
                produit->>'titre',
                'Produit'
            ) as product_description,
            -- Extraire les tags depuis les champs du produit
            ARRAY(
                SELECT DISTINCT unnest(ARRAY[
                    produit->>'nom_produit',
                    produit->>'marque',
                    produit->>'modele',
                    produit->>'couleur',
                    produit->>'categorie'
                ])
                WHERE unnest IS NOT NULL AND unnest != ''
            )::TEXT[] as product_tags,
            produit->>'marque' as product_marque,
            ARRAY(
                SELECT jsonb_array_elements_text(produit->'couleurs')
                WHERE jsonb_typeof(produit->'couleurs') = 'array'
            )::TEXT[] as product_couleurs,
            (
                -- Score full-text sur nom_produit, marque, modele
                COALESCE(
                    ts_rank(
                        to_tsvector('french', 
                            COALESCE(produit->>'nom_produit', '') || ' ' ||
                            COALESCE(produit->>'nom', '') || ' ' ||
                            COALESCE(produit->>'marque', '') || ' ' ||
                            COALESCE(produit->>'modele', '') || ' ' ||
                            COALESCE(produit->>'description', '')
                        ),
                        plainto_tsquery('french', COALESCE(search_query_semantic, ''))
                    ) * 40.0,
                    0.0
                ) +
                -- Score ILIKE sur nom_produit
                CASE 
                    WHEN search_query_semantic IS NOT NULL 
                         AND (
                             produit->>'nom_produit' ILIKE '%' || search_query_semantic || '%'
                             OR produit->>'nom' ILIKE '%' || search_query_semantic || '%'
                             OR produit->>'description' ILIKE '%' || search_query_semantic || '%'
                         )
                    THEN 25.0
                    ELSE 0.0
                END +
                -- Score marque exacte
                CASE 
                    WHEN search_marque IS NOT NULL 
                         AND produit->>'marque' ILIKE '%' || search_marque || '%'
                    THEN 80.0
                    ELSE 0.0
                END +
                -- Score couleur
                CASE 
                    WHEN search_couleur IS NOT NULL 
                         AND (
                             produit->>'couleur' ILIKE '%' || search_couleur || '%'
                             OR (jsonb_typeof(produit->'couleurs') = 'array' 
                                 AND produit->'couleurs'::text ILIKE '%' || search_couleur || '%')
                         )
                    THEN 20.0
                    ELSE 0.0
                END +
                -- Score catégorie
                CASE 
                    WHEN search_category IS NOT NULL 
                         AND (
                             s.category = search_category
                             OR s.data->'category'->>'valeur' = search_category
                             OR produit->>'categorie' = search_category
                         )
                    THEN 30.0
                    ELSE 0.0
                END +
                -- Bonus basique (score minimum pour inclure dans les résultats)
                5.0
            )::FLOAT as match_score,
            NULL::FLOAT as distance_km,
            s.data as service_data
        FROM services s
        CROSS JOIN LATERAL jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                THEN s.data->'produits'
                WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                THEN s.data->'produits'->'valeur'
                ELSE '[]'::jsonb
            END
        ) AS produit
        WHERE s.is_active = true
        -- ✅ OPTIMISÉ: Limiter à 5 produits par service pour éviter les scans complets
        AND (
            -- Exclure les services déjà trouvés dans SOURCE 1 ou SOURCE 2
            NOT EXISTS (
                SELECT 1 FROM image_analyses ia3 
                WHERE ia3.service_id = s.id
            )
            AND NOT EXISTS (
                SELECT 1 FROM media m3 
                WHERE m3.service_id = s.id 
                AND m3.type = 'image' 
                AND m3.ai_description IS NOT NULL
            )
        )
        AND (
            -- Matching flexible : recherche full-text ou ILIKE
            (search_query_semantic IS NOT NULL AND (
                to_tsvector('french', 
                    COALESCE(produit->>'nom_produit', '') || ' ' ||
                    COALESCE(produit->>'nom', '') || ' ' ||
                    COALESCE(produit->>'marque', '') || ' ' ||
                    COALESCE(produit->>'modele', '') || ' ' ||
                    COALESCE(produit->>'description', '')
                ) @@ plainto_tsquery('french', search_query_semantic)
                OR produit->>'nom_produit' ILIKE '%' || search_query_semantic || '%'
                OR produit->>'nom' ILIKE '%' || search_query_semantic || '%'
                OR produit->>'description' ILIKE '%' || search_query_semantic || '%'
            ))
            OR (search_marque IS NOT NULL AND produit->>'marque' ILIKE '%' || search_marque || '%')
            OR (search_couleur IS NOT NULL AND (
                produit->>'couleur' ILIKE '%' || search_couleur || '%'
                OR (jsonb_typeof(produit->'couleurs') = 'array' 
                    AND produit->'couleurs'::text ILIKE '%' || search_couleur || '%')
            ))
            OR (search_category IS NOT NULL AND (
                s.category = search_category
                OR s.data->'category'->>'valeur' = search_category
                OR produit->>'categorie' = search_category
            ))
        )
        -- ✅ OPTIMISÉ: Limiter à 5 produits par service pour éviter les scans complets
        LIMIT 5
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
    WHERE cr.match_score >= 5.0  -- ✅ CORRECTION: Seuil abaissé à 5.0 pour inclure le fallback
    ORDER BY 
        cr.match_score DESC,
        distance_km ASC NULLS LAST
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION hybrid_image_search IS 'Recherche hybride améliorée : combine image_analyses, media.ai_* ET services.data->produits (fallback) pour matching complet';

