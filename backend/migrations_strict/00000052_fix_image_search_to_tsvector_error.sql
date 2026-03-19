-- Migration: Correction erreur to_tsvector avec langue dynamique
-- Date: 2026-01-14
-- Description: Corrige l'erreur "function to_tsvector(text, text) does not exist" 
--              en convertissant correctement le paramètre TEXT en regconfig

-- =====================================================
-- 1. Fonction Helper pour Convertir Langue TEXT -> regconfig
-- =====================================================

CREATE OR REPLACE FUNCTION get_text_search_config(lang_text TEXT)
RETURNS regconfig AS $$
BEGIN
    -- Convertir le texte de langue en regconfig valide
    -- Valeurs supportées: french, english, spanish, portuguese, arabic
    CASE 
        WHEN lang_text ILIKE 'french' OR lang_text ILIKE 'français' OR lang_text ILIKE 'fr' THEN
            RETURN 'french'::regconfig;
        WHEN lang_text ILIKE 'english' OR lang_text ILIKE 'anglais' OR lang_text ILIKE 'en' THEN
            RETURN 'english'::regconfig;
        WHEN lang_text ILIKE 'spanish' OR lang_text ILIKE 'espagnol' OR lang_text ILIKE 'es' THEN
            RETURN 'spanish'::regconfig;
        WHEN lang_text ILIKE 'portuguese' OR lang_text ILIKE 'portugais' OR lang_text ILIKE 'pt' THEN
            RETURN 'portuguese'::regconfig;
        WHEN lang_text ILIKE 'arabic' OR lang_text ILIKE 'arabe' OR lang_text ILIKE 'ar' THEN
            RETURN 'arabic'::regconfig;
        ELSE
            -- Français par défaut si langue non reconnue
            RETURN 'french'::regconfig;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_text_search_config IS 'Convertit un texte de langue en regconfig PostgreSQL valide pour to_tsvector';

-- =====================================================
-- 2. Correction de la Fonction search_images_by_ai_analysis
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
    detected_lang TEXT DEFAULT 'french'  -- Langue dynamique
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
    lang_config regconfig;  -- ✅ CORRIGÉ: Variable regconfig au lieu de TEXT
BEGIN
    -- ✅ CORRIGÉ: Convertir la langue TEXT en regconfig
    lang_config := get_text_search_config(detected_lang);
    
    -- Normaliser les paramètres de recherche
    normalized_search_query := normalize_text(search_query);
    normalized_search_tags := normalize_word_array(search_tags);
    normalized_search_marque := CASE WHEN search_marque IS NOT NULL THEN normalize_text(search_marque) ELSE NULL END;
    normalized_search_couleur := CASE WHEN search_couleur IS NOT NULL THEN normalize_text(search_couleur) ELSE NULL END;

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
                -- ✅ CORRIGÉ: Utiliser lang_config (regconfig) au lieu de detected_lang (TEXT)
                COALESCE(
                    ts_rank(
                        to_tsvector(lang_config, COALESCE(m.normalized_ai_description, '')),
                        plainto_tsquery(lang_config, normalized_search_query)
                    ) * 50.0,
                    0.0
                ) +
                
                -- Matching vectoriel optimisé avec similarité (exact + partiel + fuzzy)
                COALESCE(
                    calculate_vector_match_score_optimized(
                        m.normalized_ai_tags,
                        normalized_search_tags
                    ) * 30.0,  -- Multiplicateur pour tags
                    0.0
                ) +
                
                -- Matching partiel sur description normalisée (mots tronqués)
                CASE 
                    WHEN normalized_search_query != '' 
                         AND m.normalized_ai_description LIKE '%' || normalized_search_query || '%'
                    THEN 35.0
                    ELSE 0.0
                END +
                
                -- Bonus tags communs avec normalisation
                (SELECT COUNT(*) * 20.0 
                 FROM unnest(COALESCE(m.normalized_ai_tags, ARRAY[]::TEXT[])) tag 
                 WHERE tag = ANY(normalized_search_tags)) +
                
                -- Bonus marque exacte avec normalisation
                CASE 
                    WHEN normalized_search_marque IS NOT NULL 
                         AND normalize_text(COALESCE(m.ai_metadata->>'marque', '')) = normalized_search_marque
                    THEN 100.0 
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
                
                -- Bonus catégorie identique
                CASE 
                    WHEN search_category IS NOT NULL 
                         AND m.ai_category = search_category 
                    THEN 40.0 
                    ELSE 0.0 
                END +
                
                -- Bonus confidence élevée
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
        AND m.ai_description IS NOT NULL
        AND (
            -- ✅ CORRIGÉ: Utiliser lang_config (regconfig) au lieu de detected_lang (TEXT)
            to_tsvector(lang_config, COALESCE(m.normalized_ai_description, '')) @@ plainto_tsquery(lang_config, normalized_search_query)
            OR m.normalized_ai_tags && normalized_search_tags  -- Overlap sur tags normalisés
            OR calculate_vector_match_score_optimized(m.normalized_ai_tags, normalized_search_tags) > 0.0  -- Matching vectoriel optimisé
            OR (normalized_search_query != '' AND m.normalized_ai_description LIKE '%' || normalized_search_query || '%')  -- Matching partiel
            OR (search_category IS NOT NULL AND m.ai_category = search_category)
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
    WHERE ranked_results.match_score > 0.0  -- ✅ AMÉLIORÉ: Filtrer les résultats avec score > 0
    ORDER BY 
        ranked_results.match_score DESC,
        ranked_results.distance_km ASC NULLS LAST
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_images_by_ai_analysis IS 'Recherche intelligente d''images par analyse IA avec matching vectoriel optimisé, gestion accents, matching partiel/fuzzy, et langue dynamique (CORRIGÉ: conversion TEXT->regconfig)';

-- =====================================================
-- 3. Vérification
-- =====================================================

DO $$
BEGIN
    -- Vérifier que la fonction helper existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'get_text_search_config'
    ) THEN
        RAISE EXCEPTION 'Fonction get_text_search_config non créée';
    END IF;
    
    -- Vérifier que la fonction principale existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'search_images_by_ai_analysis'
    ) THEN
        RAISE EXCEPTION 'Fonction search_images_by_ai_analysis non créée';
    END IF;
    
    RAISE NOTICE '✅ Migration correction to_tsvector appliquée avec succès';
END $$;






