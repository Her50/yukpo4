-- Migration: Optimisation Recherche Image avec Matching Vectoriel Normalisé
-- Date: 2025-12-30
-- Description: Applique les optimisations de matching vectoriel (accents, mots tronqués, fuzzy) à la recherche par image

-- =====================================================
-- 1. Colonnes Calculées Normalisées pour Media
-- =====================================================

-- Ajouter colonnes normalisées (utilise les fonctions existantes de la migration vector matching)
ALTER TABLE media 
ADD COLUMN IF NOT EXISTS normalized_ai_tags TEXT[] 
GENERATED ALWAYS AS (
    CASE 
        WHEN ai_tags IS NULL OR array_length(ai_tags, 1) IS NULL 
        THEN ARRAY[]::TEXT[]
        ELSE normalize_word_array(ai_tags)
    END
) STORED;

ALTER TABLE media 
ADD COLUMN IF NOT EXISTS normalized_ai_description TEXT
GENERATED ALWAYS AS (
    CASE 
        WHEN ai_description IS NULL OR ai_description = ''
        THEN ''
        ELSE LOWER(
            translate(
                ai_description,
                'àâäéèêëîïôöùûüÿç',
                'aaaeeeeiiioouuuyc'
            )
        )
    END
) STORED;

-- =====================================================
-- 2. Index GIN sur Colonnes Normalisées
-- =====================================================

-- Index GIN pour accélérer l'opérateur && sur tags normalisés
CREATE INDEX IF NOT EXISTS idx_media_normalized_ai_tags_gin 
ON media USING GIN (normalized_ai_tags);

-- Index full-text sur description normalisée
CREATE INDEX IF NOT EXISTS idx_media_normalized_ai_description_fulltext 
ON media USING GIN (to_tsvector('french', COALESCE(normalized_ai_description, '')));

-- Index composite pour filtres fréquents
CREATE INDEX IF NOT EXISTS idx_media_ai_image_search_filters 
ON media (type, ai_category) 
WHERE type = 'image' AND ai_description IS NOT NULL;

-- =====================================================
-- 3. Fonction de Normalisation de Texte (si pas déjà créée)
-- =====================================================

-- Fonction pour normaliser un texte (supprimer accents, minuscules)
CREATE OR REPLACE FUNCTION normalize_text(text_input TEXT)
RETURNS TEXT AS $$
BEGIN
    IF text_input IS NULL OR text_input = '' THEN
        RETURN '';
    END IF;
    RETURN LOWER(
        translate(
            text_input,
            'àâäéèêëîïôöùûüÿç',
            'aaaeeeeiiioouuuyc'
        )
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 4. Mise à Jour de la Fonction search_images_by_ai_analysis
-- =====================================================

-- Supprimer l'ancienne version si elle existe (avec l'ancienne signature)
DROP FUNCTION IF EXISTS search_images_by_ai_analysis(TEXT, TEXT[], TEXT, TEXT, TEXT, FLOAT, FLOAT, INTEGER, INTEGER);

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
    detected_lang TEXT DEFAULT 'french'  -- ✅ NOUVEAU: Langue dynamique
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
BEGIN
    -- ✅ NOUVEAU: Normaliser les paramètres de recherche
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
                -- ✅ AMÉLIORÉ: Score Full-Text avec langue dynamique
                COALESCE(
                    ts_rank(
                        to_tsvector(detected_lang, COALESCE(m.normalized_ai_description, '')),
                        plainto_tsquery(detected_lang, normalized_search_query)
                    ) * 50.0,
                    0.0
                ) +
                
                -- ✅ NOUVEAU: Matching vectoriel optimisé avec similarité (exact + partiel + fuzzy)
                COALESCE(
                    calculate_vector_match_score_optimized(
                        m.normalized_ai_tags,
                        normalized_search_tags
                    ) * 30.0,  -- Multiplicateur pour tags
                    0.0
                ) +
                
                -- ✅ AMÉLIORÉ: Matching partiel sur description normalisée (mots tronqués)
                CASE 
                    WHEN normalized_search_query != '' 
                         AND m.normalized_ai_description LIKE '%' || normalized_search_query || '%'
                    THEN 35.0
                    ELSE 0.0
                END +
                
                -- ✅ AMÉLIORÉ: Bonus tags communs avec normalisation
                (SELECT COUNT(*) * 20.0 
                 FROM unnest(COALESCE(m.normalized_ai_tags, ARRAY[]::TEXT[])) tag 
                 WHERE tag = ANY(normalized_search_tags)) +
                
                -- ✅ AMÉLIORÉ: Bonus marque exacte avec normalisation
                CASE 
                    WHEN normalized_search_marque IS NOT NULL 
                         AND normalize_text(COALESCE(m.ai_metadata->>'marque', '')) = normalized_search_marque
                    THEN 100.0 
                    ELSE 0.0 
                END +
                
                -- ✅ AMÉLIORÉ: Bonus couleur avec normalisation
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
            -- ✅ AMÉLIORÉ: Conditions de recherche avec normalisation et matching vectoriel
            to_tsvector(detected_lang, COALESCE(m.normalized_ai_description, '')) @@ plainto_tsquery(detected_lang, normalized_search_query)
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
    ORDER BY 
        ranked_results.match_score DESC,
        ranked_results.distance_km ASC NULLS LAST
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_images_by_ai_analysis IS 'Recherche intelligente d''images par analyse IA avec matching vectoriel optimisé, gestion accents, matching partiel/fuzzy, et langue dynamique';

-- =====================================================
-- 5. Analyser les Tables pour Optimiser les Statistiques
-- =====================================================

ANALYZE media;

-- =====================================================
-- 6. Vérification
-- =====================================================

DO $$
BEGIN
    -- Vérifier que les colonnes existent
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' 
        AND column_name = 'normalized_ai_tags'
    ) THEN
        RAISE EXCEPTION 'Colonne normalized_ai_tags non créée';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' 
        AND column_name = 'normalized_ai_description'
    ) THEN
        RAISE EXCEPTION 'Colonne normalized_ai_description non créée';
    END IF;
    
    -- Vérifier que les index existent
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_media_normalized_ai_tags_gin'
    ) THEN
        RAISE EXCEPTION 'Index idx_media_normalized_ai_tags_gin non créé';
    END IF;
    
    RAISE NOTICE '✅ Migration recherche image optimisée appliquée avec succès';
END $$;

