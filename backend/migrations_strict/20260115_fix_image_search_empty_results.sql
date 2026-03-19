-- Migration: Correction recherche image - Gestion images non analysées
-- Date: 2026-01-15
-- Description: Améliore la fonction search_images_by_ai_analysis pour gérer les cas où
--              les images n'ont pas été analysées par l'IA (description générique, tags vides)

-- =====================================================
-- 1. Amélioration de la Fonction search_images_by_ai_analysis
-- =====================================================

CREATE OR REPLACE FUNCTION search_images_by_ai_analysis(
    search_query TEXT,
    search_tags TEXT[],
    search_category TEXT DEFAULT NULL,
    search_marque TEXT DEFAULT NULL,
    search_couleur TEXT DEFAULT NULL,
    gps_lat FLOAT DEFAULT NULL,
    gps_lng FLOAT DEFAULT NULL,
    search_radius_km INTEGER DEFAULT 50,
    max_results INTEGER DEFAULT 20,
    detected_lang TEXT DEFAULT 'french'
)
RETURNS TABLE (
    service_id INTEGER,
    media_id INTEGER,
    media_path TEXT,
    product_name TEXT,
    ai_description TEXT,
    ai_tags TEXT[],
    match_score FLOAT,
    distance_km FLOAT,
    service_data JSONB
) AS $$
DECLARE
    normalized_search_query TEXT;
    normalized_search_tags TEXT[];
    normalized_search_marque TEXT;
    normalized_search_couleur TEXT;
    lang_config regconfig;
    is_generic_description BOOLEAN;
BEGIN
    -- Convertir la langue TEXT en regconfig
    lang_config := get_text_search_config(detected_lang);
    
    -- Normaliser les paramètres de recherche
    normalized_search_query := normalize_text(search_query);
    normalized_search_tags := normalize_word_array(search_tags);
    normalized_search_marque := CASE WHEN search_marque IS NOT NULL THEN normalize_text(search_marque) ELSE NULL END;
    normalized_search_couleur := CASE WHEN search_couleur IS NOT NULL THEN normalize_text(search_couleur) ELSE NULL END;
    
    -- Détecter si la description est générique (non analysée)
    is_generic_description := normalized_search_query ILIKE '%image générée automatiquement%' 
                            OR normalized_search_query ILIKE '%générée automatiquement%';

    RETURN QUERY
    WITH ranked_results AS (
        SELECT 
            s.id as service_id,
            m.id as media_id,
            m.path as media_path,
            COALESCE(
                product->>'nom',
                product->>'name',
                product->>'titre',
                'Produit'
            ) as product_name,
            m.ai_description,
            m.ai_tags,
            (
                -- ✅ AMÉLIORÉ: Score Full-Text avec gestion des descriptions génériques
                CASE 
                    -- Si description générique, utiliser recherche sur nom de produit
                    WHEN m.normalized_ai_description ILIKE '%image générée automatiquement%' 
                         OR m.normalized_ai_description ILIKE '%générée automatiquement%'
                    THEN 
                        -- Recherche sur nom de produit à la place
                        CASE 
                            WHEN normalized_search_query != '' 
                                 AND (
                                     COALESCE(product->>'nom', '') ILIKE '%' || normalized_search_query || '%'
                                     OR COALESCE(product->>'name', '') ILIKE '%' || normalized_search_query || '%'
                                     OR COALESCE(product->>'titre', '') ILIKE '%' || normalized_search_query || '%'
                                 )
                            THEN 40.0  -- Score pour match sur nom de produit
                            ELSE 0.0
                        END
                    ELSE
                        -- Recherche normale sur description IA
                        COALESCE(
                            ts_rank(
                                to_tsvector(lang_config, COALESCE(m.normalized_ai_description, '')),
                                plainto_tsquery(lang_config, normalized_search_query)
                            ) * 50.0,
                            0.0
                        )
                END +
                
                -- Matching vectoriel optimisé avec similarité (exact + partiel + fuzzy)
                COALESCE(
                    calculate_vector_match_score_optimized(
                        m.normalized_ai_tags,
                        normalized_search_tags
                    ) * 30.0,
                    0.0
                ) +
                
                -- ✅ AMÉLIORÉ: Matching partiel sur description normalisée OU nom de produit
                CASE 
                    WHEN normalized_search_query != '' THEN
                        CASE 
                            -- Si description générique, chercher dans nom de produit
                            WHEN m.normalized_ai_description ILIKE '%image générée automatiquement%' 
                                 OR m.normalized_ai_description ILIKE '%générée automatiquement%'
                            THEN
                                CASE 
                                    WHEN COALESCE(product->>'nom', '') ILIKE '%' || normalized_search_query || '%'
                                         OR COALESCE(product->>'name', '') ILIKE '%' || normalized_search_query || '%'
                                         OR COALESCE(product->>'titre', '') ILIKE '%' || normalized_search_query || '%'
                                    THEN 35.0
                                    ELSE 0.0
                                END
                            -- Sinon, chercher dans description normalisée
                            WHEN m.normalized_ai_description LIKE '%' || normalized_search_query || '%'
                            THEN 35.0
                            ELSE 0.0
                        END
                    ELSE 0.0
                END +
                
                -- Bonus tags communs avec normalisation
                (SELECT COUNT(*) * 20.0 
                 FROM unnest(COALESCE(m.normalized_ai_tags, ARRAY[]::TEXT[])) tag 
                 WHERE tag = ANY(normalized_search_tags)) +
                
                -- ✅ AMÉLIORÉ: Bonus marque exacte avec normalisation (chercher aussi dans nom produit)
                CASE 
                    WHEN normalized_search_marque IS NOT NULL THEN
                        CASE 
                            WHEN normalize_text(COALESCE(m.ai_metadata->>'marque', '')) = normalized_search_marque
                                 OR COALESCE(product->>'marque', '') ILIKE '%' || normalized_search_marque || '%'
                                 OR COALESCE(product->>'brand', '') ILIKE '%' || normalized_search_marque || '%'
                            THEN 100.0 
                            ELSE 0.0 
                        END
                    ELSE 0.0
                END +
                
                -- Bonus couleur avec normalisation
                CASE 
                    WHEN normalized_search_couleur IS NOT NULL 
                         AND EXISTS (
                             SELECT 1 
                             FROM jsonb_array_elements_text(COALESCE(m.ai_metadata->'couleurs', '[]'::jsonb)) AS couleur
                             WHERE normalize_text(couleur) = normalized_search_couleur
                         )
                    THEN 30.0 
                    ELSE 0.0
                END +
                
                -- ✅ AMÉLIORÉ: Bonus catégorie identique (chercher aussi dans données service)
                CASE 
                    WHEN search_category IS NOT NULL THEN
                        CASE 
                            WHEN m.ai_category = search_category 
                                 OR COALESCE(product->>'categorie', '') ILIKE '%' || search_category || '%'
                                 OR COALESCE(product->>'category', '') ILIKE '%' || search_category || '%'
                                 OR COALESCE(s.data->>'categorie', '') ILIKE '%' || search_category || '%'
                            THEN 40.0 
                            ELSE 0.0
                        END
                    ELSE 0.0
                END +
                
                -- Bonus confidence élevée (minimum 10 points même si NULL)
                (COALESCE(m.ai_confidence, 0.5) * 20.0)
                
            )::FLOAT as match_score,
            
            -- Calcul distance GPS si coordonnées fournies
            CASE 
                WHEN gps_lat IS NOT NULL AND gps_lng IS NOT NULL 
                     AND s.gps IS NOT NULL AND s.gps != '' 
                     AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$'
                THEN
                    ST_Distance(
                        ST_Point(gps_lng, gps_lat)::geography,
                        ST_Point(
                            COALESCE(CAST(SPLIT_PART(s.gps, ',', 2) AS FLOAT), 0.0),
                            COALESCE(CAST(SPLIT_PART(s.gps, ',', 1) AS FLOAT), 0.0)
                        )::geography
                    ) / 1000.0  -- Convertir en km
                ELSE NULL
            END as distance_km,
            
            s.data as service_data,
            product
        FROM services s
        INNER JOIN media m ON m.service_id = s.id
        CROSS JOIN LATERAL jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                THEN s.data->'produits'
                ELSE '[]'::jsonb
            END
        ) AS product
        WHERE s.is_active = true
        AND m.type = 'image'
        AND (
            -- ✅ AMÉLIORÉ: Conditions de recherche étendues pour gérer images non analysées
            -- 1. Recherche normale sur description IA (si analysée)
            (
                m.ai_description IS NOT NULL 
                AND m.normalized_ai_description NOT ILIKE '%image générée automatiquement%'
                AND m.normalized_ai_description NOT ILIKE '%générée automatiquement%'
                AND (
                    to_tsvector(lang_config, COALESCE(m.normalized_ai_description, '')) @@ plainto_tsquery(lang_config, normalized_search_query)
                    OR m.normalized_ai_tags && normalized_search_tags
                    OR calculate_vector_match_score_optimized(m.normalized_ai_tags, normalized_search_tags) > 0.0
                    OR (normalized_search_query != '' AND m.normalized_ai_description LIKE '%' || normalized_search_query || '%')
                )
            )
            -- 2. Recherche sur nom de produit (si description générique)
            OR (
                (
                    m.ai_description IS NULL
                    OR m.normalized_ai_description ILIKE '%image générée automatiquement%'
                    OR m.normalized_ai_description ILIKE '%générée automatiquement%'
                )
                AND normalized_search_query != ''
                AND (
                    COALESCE(product->>'nom', '') ILIKE '%' || normalized_search_query || '%'
                    OR COALESCE(product->>'name', '') ILIKE '%' || normalized_search_query || '%'
                    OR COALESCE(product->>'titre', '') ILIKE '%' || normalized_search_query || '%'
                )
            )
            -- 3. Recherche par catégorie (même si description générique)
            OR (
                search_category IS NOT NULL 
                AND (
                    m.ai_category = search_category
                    OR COALESCE(product->>'categorie', '') ILIKE '%' || search_category || '%'
                    OR COALESCE(product->>'category', '') ILIKE '%' || search_category || '%'
                    OR COALESCE(s.data->>'categorie', '') ILIKE '%' || search_category || '%'
                )
            )
            -- 4. Recherche par marque (même si description générique)
            OR (
                normalized_search_marque IS NOT NULL
                AND (
                    normalize_text(COALESCE(m.ai_metadata->>'marque', '')) = normalized_search_marque
                    OR COALESCE(product->>'marque', '') ILIKE '%' || normalized_search_marque || '%'
                    OR COALESCE(product->>'brand', '') ILIKE '%' || normalized_search_marque || '%'
                )
            )
        )
        -- Filtre GPS si coordonnées fournies
        AND (
            gps_lat IS NULL 
            OR gps_lng IS NULL
            OR search_radius_km IS NULL
            OR s.gps IS NULL
            OR s.gps = ''
            OR s.gps !~ '^-?\d+\.?\d*,-?\d+\.?\d*$'
            OR ST_Distance(
                ST_Point(gps_lng, gps_lat)::geography,
                ST_Point(
                    COALESCE(CAST(SPLIT_PART(s.gps, ',', 2) AS FLOAT), 0.0),
                    COALESCE(CAST(SPLIT_PART(s.gps, ',', 1) AS FLOAT), 0.0)
                )::geography
            ) / 1000.0 <= search_radius_km
        )
    )
    SELECT 
        ranked_results.service_id,
        ranked_results.media_id,
        ranked_results.media_path,
        ranked_results.product_name,
        ranked_results.ai_description,
        ranked_results.ai_tags,
        ranked_results.match_score,
        ranked_results.distance_km,
        ranked_results.service_data
    FROM ranked_results
    WHERE ranked_results.match_score > 0.0  -- Filtrer les résultats avec score > 0
    ORDER BY 
        ranked_results.match_score DESC,
        ranked_results.distance_km ASC NULLS LAST
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_images_by_ai_analysis IS 'Recherche intelligente d''images par analyse IA avec gestion des images non analysées (recherche sur nom de produit si description générique)';

-- =====================================================
-- 2. Vérification
-- =====================================================

DO $$
BEGIN
    -- Vérifier que la fonction existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'search_images_by_ai_analysis'
    ) THEN
        RAISE EXCEPTION 'Fonction search_images_by_ai_analysis non créée';
    END IF;
    
    RAISE NOTICE '✅ Migration correction recherche image (gestion images non analysées) appliquée avec succès';
END $$;






