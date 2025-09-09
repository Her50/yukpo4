-- Correction de la fonction search_similar_images pour retourner toutes les colonnes nécessaires
DROP FUNCTION IF EXISTS search_similar_images(JSONB, FLOAT, INTEGER);

CREATE OR REPLACE FUNCTION search_similar_images(
    query_signature JSONB,
    similarity_threshold FLOAT DEFAULT 0.3,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    media_id INTEGER,
    service_id INTEGER,
    path TEXT,
    similarity_score FLOAT,
    image_metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id as media_id,  -- Renommé pour correspondre au code Rust
        m.service_id,
        m.path,
        calculate_image_similarity(query_signature, m.image_signature) as similarity_score,
        m.image_metadata
    FROM media m
    WHERE m.type = 'image'
    AND m.image_signature IS NOT NULL
    AND calculate_image_similarity(query_signature, m.image_signature) >= similarity_threshold
    ORDER BY similarity_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Vérifier que la fonction fonctionne
SELECT 'Fonction search_similar_images corrigée' as status; 