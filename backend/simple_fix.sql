-- Script simplifié pour corriger la recherche d'images
-- Base de données: yukpo_db

-- 1. Ajouter les colonnes manquantes
ALTER TABLE media ADD COLUMN IF NOT EXISTS image_signature JSONB;
ALTER TABLE media ADD COLUMN IF NOT EXISTS image_hash VARCHAR(64);
ALTER TABLE media ADD COLUMN IF NOT EXISTS image_metadata JSONB;

-- 2. Créer les index
CREATE INDEX IF NOT EXISTS idx_media_image_signature ON media USING GIN (image_signature);
CREATE INDEX IF NOT EXISTS idx_media_image_hash ON media(image_hash);
CREATE INDEX IF NOT EXISTS idx_media_image_metadata ON media USING GIN (image_metadata);
CREATE INDEX IF NOT EXISTS idx_media_type_image ON media(type) WHERE type = 'image';

-- 3. Créer la fonction de similarité
CREATE OR REPLACE FUNCTION calculate_image_similarity(sig1 JSONB, sig2 JSONB)
RETURNS FLOAT AS $$
DECLARE
    similarity FLOAT := 0.0;
    diff_squared FLOAT := 0.0;
    val1 FLOAT;
    val2 FLOAT;
    i INTEGER;
BEGIN
    IF jsonb_array_length(sig1) != jsonb_array_length(sig2) THEN
        RETURN 0.0;
    END IF;

    FOR i IN 0..jsonb_array_length(sig1) - 1 LOOP
        val1 := (sig1->i)::FLOAT;
        val2 := (sig2->i)::FLOAT;
        diff_squared := diff_squared + (val1 - val2) * (val1 - val2);
    END LOOP;

    similarity := GREATEST(0.0, 1.0 - SQRT(diff_squared) / SQRT(jsonb_array_length(sig1)::FLOAT));
    RETURN similarity;
END;
$$ LANGUAGE plpgsql;

-- 4. Créer la fonction de recherche par métadonnées
CREATE OR REPLACE FUNCTION search_images_by_metadata(
    query_metadata TEXT,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    media_id INTEGER,
    service_id INTEGER,
    path TEXT,
    similarity_score FLOAT,
    image_metadata JSONB
) AS $$
DECLARE
    query_metadata_json JSONB;
    query_format VARCHAR(50);
    query_width INTEGER;
    query_height INTEGER;
    query_ratio FLOAT;
BEGIN
    query_metadata_json := query_metadata::JSONB;
    query_format := (query_metadata_json->>'format')::VARCHAR(50);
    query_width := (query_metadata_json->>'width')::INTEGER;
    query_height := (query_metadata_json->>'height')::INTEGER;
    
    IF query_width IS NOT NULL AND query_height IS NOT NULL AND query_height > 0 THEN
        query_ratio := query_width::FLOAT / query_height::FLOAT;
    ELSE
        query_ratio := 1.0;
    END IF;

    RETURN QUERY
    SELECT
        m.id,
        m.service_id,
        m.path,
        (
            CASE WHEN (m.image_metadata->>'format')::VARCHAR(50) = query_format THEN 0.3 ELSE 0.0 END +
            CASE
                WHEN m.image_metadata->>'width' IS NOT NULL AND m.image_metadata->>'height' IS NOT NULL THEN
                    CASE
                        WHEN ABS((m.image_metadata->>'width')::INTEGER::FLOAT / (m.image_metadata->>'height')::INTEGER::FLOAT - query_ratio) < 0.1 THEN 0.3
                        WHEN ABS((m.image_metadata->>'width')::INTEGER::FLOAT / (m.image_metadata->>'height')::INTEGER::FLOAT - query_ratio) < 0.3 THEN 0.1
                        ELSE 0.0
                    END
                ELSE 0.0
            END +
            CASE
                WHEN m.image_metadata->>'file_size' IS NOT NULL AND query_metadata_json->>'file_size' IS NOT NULL THEN
                    CASE
                        WHEN ABS((m.image_metadata->>'file_size')::INTEGER - (query_metadata_json->>'file_size')::INTEGER)::FLOAT / (query_metadata_json->>'file_size')::INTEGER::FLOAT < 0.2 THEN 0.2
                        ELSE 0.0
                    END
                ELSE 0.0
            END
        ) as similarity_score,
        m.image_metadata
    FROM media m
    WHERE m.type = 'image'
    AND m.image_metadata IS NOT NULL
    GROUP BY m.id, m.service_id, m.path, m.image_metadata
    HAVING (
        CASE WHEN (m.image_metadata->>'format')::VARCHAR(50) = query_format THEN 0.3 ELSE 0.0 END +
        CASE
            WHEN m.image_metadata->>'width' IS NOT NULL AND m.image_metadata->>'height' IS NOT NULL THEN
                CASE
                    WHEN ABS((m.image_metadata->>'width')::INTEGER::FLOAT / (m.image_metadata->>'height')::INTEGER::FLOAT - query_ratio) < 0.1 THEN 0.3
                    WHEN ABS((m.image_metadata->>'width')::INTEGER::FLOAT / (m.image_metadata->>'height')::INTEGER::FLOAT - query_ratio) < 0.3 THEN 0.1
                    ELSE 0.0
                END
            ELSE 0.0
        END +
        CASE
            WHEN m.image_metadata->>'file_size' IS NOT NULL AND query_metadata_json->>'file_size' IS NOT NULL THEN
                CASE
                    WHEN ABS((m.image_metadata->>'file_size')::INTEGER - (query_metadata_json->>'file_size')::INTEGER)::FLOAT / (query_metadata_json->>'file_size')::INTEGER::FLOAT < 0.2 THEN 0.2
                    ELSE 0.0
                END
            ELSE 0.0
        END
    ) > 0.3
    ORDER BY similarity_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- 5. Vérifier que tout a été créé
SELECT 'Corrections appliquées avec succès!' as status; 