-- Migration pour ajouter les signatures d'images à la table media existante
-- Cette migration étend la table media existante pour supporter la recherche d'images similaires

-- Ajouter les colonnes pour les signatures d'images
ALTER TABLE media
ADD COLUMN IF NOT EXISTS image_signature JSONB, -- Signature vectorielle de l'image (192 valeurs float)
ADD COLUMN IF NOT EXISTS image_hash VARCHAR(64), -- Hash MD5 de l'image pour détection de doublons
ADD COLUMN IF NOT EXISTS image_metadata JSONB; -- Métadonnées (dimensions, format, couleurs dominantes)

-- Ajouter des commentaires
COMMENT ON COLUMN media.image_signature IS 'Signature vectorielle de l''image pour recherche de similarité (192 valeurs float)';
COMMENT ON COLUMN media.image_hash IS 'Hash MD5 de l''image pour détection de doublons';
COMMENT ON COLUMN media.image_metadata IS 'Métadonnées de l''image (dimensions, format, couleurs dominantes)';

-- Créer des index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_media_image_signature ON media USING GIN (image_signature);
CREATE INDEX IF NOT EXISTS idx_media_image_hash ON media(image_hash);
CREATE INDEX IF NOT EXISTS idx_media_image_metadata ON media USING GIN (image_metadata);
CREATE INDEX IF NOT EXISTS idx_media_type_image ON media(type) WHERE type = 'image';

-- Fonction pour calculer la similarité entre deux signatures d'images
CREATE OR REPLACE FUNCTION calculate_image_similarity(sig1 JSONB, sig2 JSONB)
RETURNS FLOAT AS $$
DECLARE
    similarity FLOAT := 0.0;
    diff_squared FLOAT := 0.0;
    val1 FLOAT;
    val2 FLOAT;
    i INTEGER;
BEGIN
    -- Vérifier que les signatures ont la même longueur
    IF jsonb_array_length(sig1) != jsonb_array_length(sig2) THEN
        RETURN 0.0;
    END IF;

    -- Calculer la distance euclidienne
    FOR i IN 0..jsonb_array_length(sig1) - 1 LOOP
        val1 := (sig1->i)::FLOAT;
        val2 := (sig2->i)::FLOAT;
        diff_squared := diff_squared + (val1 - val2) * (val1 - val2);
    END LOOP;

    -- Convertir en score de similarité (0 = identique, 1 = très différent)
    similarity := GREATEST(0.0, 1.0 - SQRT(diff_squared) / SQRT(jsonb_array_length(sig1)::FLOAT));

    RETURN similarity;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour rechercher des images similaires dans la table media
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

-- Fonction pour rechercher par métadonnées d'image
CREATE OR REPLACE FUNCTION search_images_by_metadata(
    query_metadata JSONB,
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
    query_format VARCHAR(50);
    query_width INTEGER;
    query_height INTEGER;
    query_ratio FLOAT;
BEGIN
    -- Extraire les métadonnées de la requête
    query_format := (query_metadata->>'format')::VARCHAR(50);
    query_width := (query_metadata->>'width')::INTEGER;
    query_height := (query_metadata->>'height')::INTEGER;
    query_ratio := query_width::FLOAT / query_height::FLOAT;

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
                WHEN ABS((m.image_metadata->>'width')::INTEGER::FLOAT / (m.image_metadata->>'height')::INTEGER::FLOAT - query_ratio) < 0.1 THEN 0.3
                WHEN ABS((m.image_metadata->>'width')::INTEGER::FLOAT / (m.image_metadata->>'height')::INTEGER::FLOAT - query_ratio) < 0.3 THEN 0.1
                ELSE 0.0
            END +
            -- Score basé sur la similarité de taille
            CASE
                WHEN ABS((m.image_metadata->>'file_size')::INTEGER - (query_metadata->>'file_size')::INTEGER)::FLOAT / (query_metadata->>'file_size')::INTEGER::FLOAT < 0.2 THEN 0.2
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
            WHEN ABS((m.image_metadata->>'width')::INTEGER::FLOAT / (m.image_metadata->>'height')::INTEGER::FLOAT - query_ratio) < 0.1 THEN 0.3
            WHEN ABS((m.image_metadata->>'width')::INTEGER::FLOAT / (m.image_metadata->>'height')::INTEGER::FLOAT - query_ratio) < 0.3 THEN 0.1
            ELSE 0.0
        END +
        CASE
            WHEN ABS((m.image_metadata->>'file_size')::INTEGER - (query_metadata->>'file_size')::INTEGER)::FLOAT / (query_metadata->>'file_size')::INTEGER::FLOAT < 0.2 THEN 0.2
            ELSE 0.0
        END
    ) > 0.3
    ORDER BY similarity_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour les signatures d'images existantes
CREATE OR REPLACE FUNCTION update_existing_image_signatures()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
    media_record RECORD;
BEGIN
    -- Parcourir tous les médias de type 'image' qui n'ont pas encore de signature
    FOR media_record IN
        SELECT id, path
        FROM media
        WHERE type = 'image'
        AND image_signature IS NULL
        AND path IS NOT NULL
    LOOP
        -- Ici on pourrait appeler une fonction Rust pour générer la signature
        -- Pour l'instant, on marque comme à traiter
        UPDATE media
        SET image_signature = '[]'::jsonb,
            image_hash = 'pending',
            image_metadata = '{"status": "pending_processing"}'::jsonb
        WHERE id = media_record.id;

        updated_count := updated_count + 1;
    END LOOP;

    RETURN updated_count;
END;
$$ LANGUAGE plpgsql; 