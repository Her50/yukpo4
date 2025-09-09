-- Correction de la signature de la fonction search_images_by_metadata
-- Base de données: yukpo_db

-- Supprimer l'ancienne fonction
DROP FUNCTION IF EXISTS search_images_by_metadata(JSONB, INTEGER);

-- Créer la fonction avec la signature correcte (TEXT, INTEGER)
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
    -- Convertir le texte en JSONB
    query_metadata_json := query_metadata::JSONB;
    
    -- Extraire les métadonnées de la requête
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
            -- Score basé sur la similarité de format
            CASE WHEN (m.image_metadata->>'format')::VARCHAR(50) = query_format THEN 0.3 ELSE 0.0 END +
            -- Score basé sur la similarité de ratio
            CASE
                WHEN m.image_metadata->>'width' IS NOT NULL AND m.image_metadata->>'height' IS NOT NULL THEN
                    CASE
                        WHEN ABS((m.image_metadata->>'width')::INTEGER::FLOAT / (m.image_metadata->>'height')::INTEGER::FLOAT - query_ratio) < 0.1 THEN 0.3
                        WHEN ABS((m.image_metadata->>'width')::INTEGER::FLOAT / (m.image_metadata->>'height')::INTEGER::FLOAT - query_ratio) < 0.3 THEN 0.1
                        ELSE 0.0
                    END
                ELSE 0.0
            END +
            -- Score basé sur la similarité de taille
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

-- Vérifier que la fonction a été créée
SELECT 'Fonction search_images_by_metadata corrigée' as status;
SELECT proname, prosrc FROM pg_proc WHERE proname = 'search_images_by_metadata'; 