-- Application manuelle des fonctions de recherche d'images
-- Migration: 20250110000000_extend_media_for_image_search.sql
-- Base de données: yukpo_db

-- 1. Créer la fonction calculate_image_similarity
CREATE OR REPLACE FUNCTION calculate_image_similarity(
    signature1 JSONB,
    signature2 JSONB
)
RETURNS FLOAT AS $$
DECLARE
    similarity FLOAT;
    array1 FLOAT[];
    array2 FLOAT[];
    dot_product FLOAT := 0.0;
    norm1 FLOAT := 0.0;
    norm2 FLOAT := 0.0;
    i INTEGER;
BEGIN
    -- Convertir les JSONB en arrays
    array1 := ARRAY(SELECT jsonb_array_elements_text(signature1)::FLOAT);
    array2 := ARRAY(SELECT jsonb_array_elements_text(signature2)::FLOAT);
    
    -- Calculer le produit scalaire et les normes
    FOR i IN 1..array_length(array1, 1) LOOP
        dot_product := dot_product + array1[i] * array2[i];
        norm1 := norm1 + array1[i] * array1[i];
        norm2 := norm2 + array2[i] * array2[i];
    END LOOP;
    
    -- Calculer la similarité cosinus
    IF norm1 = 0 OR norm2 = 0 THEN
        similarity := 0.0;
    ELSE
        similarity := dot_product / (SQRT(norm1) * SQRT(norm2));
    END IF;
    
    RETURN similarity;
END;
$$ LANGUAGE plpgsql;

-- 2. Créer la fonction search_similar_images
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
        m.id,
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

-- 3. Vérifier que les fonctions ont été créées
SELECT 'Fonctions créées avec succès' as status;
SELECT proname, prosrc FROM pg_proc WHERE proname IN ('search_similar_images', 'calculate_image_similarity'); 