-- Migration pour ajouter l'analyse IA des images dans la table media
-- Permet la recherche intelligente par image sans pgvector
-- Date: 2025-10-21
-- Compatible avec sqlx offline

-- Ajouter les colonnes d'analyse IA
ALTER TABLE media
ADD COLUMN IF NOT EXISTS ai_description TEXT,
ADD COLUMN IF NOT EXISTS ai_tags TEXT[],
ADD COLUMN IF NOT EXISTS ai_category VARCHAR(100),
ADD COLUMN IF NOT EXISTS ai_metadata JSONB,
ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ai_model_used VARCHAR(100),
ADD COLUMN IF NOT EXISTS ai_confidence FLOAT;

-- Ajouter des commentaires
COMMENT ON COLUMN media.ai_description IS 'Description générée par IA pour recherche full-text';
COMMENT ON COLUMN media.ai_tags IS 'Tags/mots-clés extraits par IA pour matching';
COMMENT ON COLUMN media.ai_category IS 'Catégorie de produit détectée par IA';
COMMENT ON COLUMN media.ai_metadata IS 'Métadonnées extraites par IA (marque, couleurs, caractéristiques)';
COMMENT ON COLUMN media.ai_analyzed_at IS 'Date de l''analyse IA';
COMMENT ON COLUMN media.ai_model_used IS 'Modèle IA utilisé pour l''analyse';
COMMENT ON COLUMN media.ai_confidence IS 'Score de confiance de l''analyse (0.0-1.0)';

-- Créer des index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_media_ai_description_fulltext 
ON media USING GIN (to_tsvector('french', COALESCE(ai_description, '')));

CREATE INDEX IF NOT EXISTS idx_media_ai_tags_gin 
ON media USING GIN (ai_tags);

CREATE INDEX IF NOT EXISTS idx_media_ai_category 
ON media(ai_category) WHERE ai_category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_media_ai_metadata_gin 
ON media USING GIN (ai_metadata);

-- Fonction pour rechercher des images par analyse IA (compatible sqlx offline)
CREATE OR REPLACE FUNCTION search_images_by_ai_analysis(
    search_query TEXT,
    search_tags TEXT[],
    search_category TEXT DEFAULT NULL,
    search_marque TEXT DEFAULT NULL,
    search_couleur TEXT DEFAULT NULL,
    gps_lat FLOAT DEFAULT NULL,
    gps_lng FLOAT DEFAULT NULL,
    search_radius_km INTEGER DEFAULT 50,
    max_results INTEGER DEFAULT 20
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
BEGIN
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
                -- Score Full-Text sur description
                COALESCE(
                    ts_rank(
                        to_tsvector('french', COALESCE(m.ai_description, '')),
                        plainto_tsquery('french', search_query)
                    ) * 50.0,
                    0.0
                ) +
                
                -- Bonus tags communs
                (SELECT COUNT(*) * 20.0 FROM unnest(COALESCE(m.ai_tags, ARRAY[]::TEXT[])) tag 
                 WHERE tag = ANY(search_tags)) +
                
                -- Bonus marque exacte
                CASE 
                    WHEN search_marque IS NOT NULL 
                         AND m.ai_metadata->>'marque' ILIKE search_marque 
                    THEN 100.0 
                    ELSE 0.0 
                END +
                
                -- Bonus couleur exacte
                CASE 
                    WHEN search_couleur IS NOT NULL 
                         AND m.ai_metadata->'couleurs' ? search_couleur 
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
                     AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
                THEN
                    ST_Distance(
                        ST_Point(gps_lng, gps_lat)::geography,
                        ST_Point(s.longitude, s.latitude)::geography
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
            to_tsvector('french', COALESCE(m.ai_description, '')) @@ plainto_tsquery('french', search_query)
            OR m.ai_tags && search_tags
            OR (search_category IS NOT NULL AND m.ai_category = search_category)
        )
        -- Filtre GPS si coordonnées fournies
        AND (
            gps_lat IS NULL 
            OR gps_lng IS NULL
            OR search_radius_km IS NULL
            OR s.latitude IS NULL
            OR s.longitude IS NULL
            OR ST_Distance(
                ST_Point(gps_lng, gps_lat)::geography,
                ST_Point(s.longitude, s.latitude)::geography
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

COMMENT ON FUNCTION search_images_by_ai_analysis IS 'Recherche intelligente d''images par analyse IA avec support GPS et scoring multi-critères';
