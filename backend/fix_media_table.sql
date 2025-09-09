-- Script pour étendre la table media avec les colonnes d'image
-- Base de données: yukpo_db

-- 1. Ajouter les colonnes pour les signatures d'images si elles n'existent pas
DO $$
BEGIN
    -- Ajouter image_signature si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'image_signature'
    ) THEN
        ALTER TABLE media ADD COLUMN image_signature JSONB;
        RAISE NOTICE 'Colonne image_signature ajoutée';
    END IF;
    
    -- Ajouter image_hash si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'image_hash'
    ) THEN
        ALTER TABLE media ADD COLUMN image_hash VARCHAR(64);
        RAISE NOTICE 'Colonne image_hash ajoutée';
    END IF;
    
    -- Ajouter image_metadata si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'image_metadata'
    ) THEN
        ALTER TABLE media ADD COLUMN image_metadata JSONB;
        RAISE NOTICE 'Colonne image_metadata ajoutée';
    END IF;
END $$;

-- 2. Créer des index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_media_image_signature ON media USING GIN (image_signature);
CREATE INDEX IF NOT EXISTS idx_media_image_hash ON media(image_hash);
CREATE INDEX IF NOT EXISTS idx_media_image_metadata ON media USING GIN (image_metadata);
CREATE INDEX IF NOT EXISTS idx_media_type_image ON media(type) WHERE type = 'image';

-- 3. Créer la fonction pour calculer la similarité entre deux signatures d'images
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

-- 4. Créer la fonction pour rechercher des images similaires
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

-- 5. Créer la fonction pour rechercher par métadonnées d'image
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

-- 6. Vérifier que tout a été créé
SELECT 'Structure de la table media étendue avec succès' as status;

-- 7. Afficher la structure finale
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'media' 
ORDER BY ordinal_position;

-- 8. Vérifier les fonctions créées
SELECT 
    proname as function_name,
    prosrc as function_source
FROM pg_proc 
WHERE proname IN ('calculate_image_similarity', 'search_similar_images', 'search_images_by_metadata')
ORDER BY proname; 