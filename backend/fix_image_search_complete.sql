-- CORRECTION COMPLÈTE DE LA RECHERCHE D'IMAGES
-- Base de données: yukpo_db
-- Problème: Colonnes manquantes + données JSON mal parsées

-- 1. AJOUTER LES COLONNES MANQUANTES À LA TABLE MEDIA
DO $$
BEGIN
    -- Ajouter image_signature si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'image_signature'
    ) THEN
        ALTER TABLE media ADD COLUMN image_signature JSONB;
        RAISE NOTICE '✅ Colonne image_signature ajoutée';
    END IF;
    
    -- Ajouter image_hash si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'image_hash'
    ) THEN
        ALTER TABLE media ADD COLUMN image_hash VARCHAR(64);
        RAISE NOTICE '✅ Colonne image_hash ajoutée';
    END IF;
    
    -- Ajouter image_metadata si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'image_metadata'
    ) THEN
        ALTER TABLE media ADD COLUMN image_metadata JSONB;
        RAISE NOTICE '✅ Colonne image_metadata ajoutée';
    END IF;
END $$;

-- 2. CRÉER LES INDEX POUR LES PERFORMANCES
CREATE INDEX IF NOT EXISTS idx_media_image_signature ON media USING GIN (image_signature);
CREATE INDEX IF NOT EXISTS idx_media_image_hash ON media(image_hash);
CREATE INDEX IF NOT EXISTS idx_media_image_metadata ON media USING GIN (image_metadata);
CREATE INDEX IF NOT EXISTS idx_media_type_image ON media(type) WHERE type = 'image';

-- 3. FONCTION POUR CALCULER LA SIMILARITÉ ENTRE IMAGES
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
EXCEPTION
    WHEN OTHERS THEN
        RETURN 0.0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. FONCTION POUR RECHERCHER DES IMAGES SIMILAIRES
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
$$ LANGUAGE plpgsql STABLE;

-- 5. FONCTION POUR RECHERCHER PAR MÉTADONNÉES (CORRIGÉE)
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
        -- Score de similarité basé sur les métadonnées
        CASE 
            WHEN m.image_metadata IS NOT NULL THEN
                -- Comparer format, dimensions, ratio
                (CASE WHEN (m.image_metadata->>'format') = query_format THEN 0.3 ELSE 0.0 END) +
                (CASE WHEN ABS((m.image_metadata->>'width')::INTEGER - query_width) <= 100 THEN 0.2 ELSE 0.0 END) +
                (CASE WHEN ABS((m.image_metadata->>'height')::INTEGER - query_height) <= 100 THEN 0.2 ELSE 0.0 END) +
                (CASE WHEN ABS((m.image_metadata->>'width')::FLOAT / (m.image_metadata->>'height')::FLOAT - query_ratio) <= 0.1 THEN 0.3 ELSE 0.0 END)
            ELSE 0.0
        END as similarity_score,
        m.image_metadata
    FROM media m
    WHERE m.type = 'image'
    AND m.image_metadata IS NOT NULL
    ORDER BY similarity_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. FONCTION POUR RECHERCHER PAR MÉTADONNÉES AVEC FILTRAGE GPS
CREATE OR REPLACE FUNCTION search_images_by_metadata_with_gps(
    query_metadata TEXT,
    user_gps_zone TEXT DEFAULT NULL,
    search_radius_km INTEGER DEFAULT 50,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    media_id INTEGER,
    service_id INTEGER,
    path TEXT,
    similarity_score FLOAT,
    image_metadata JSONB,
    gps_distance_km DECIMAL,
    gps_coords TEXT
) AS $$
DECLARE
    query_metadata_json JSONB;
    user_lat DECIMAL;
    user_lng DECIMAL;
BEGIN
    -- Convertir le texte en JSONB
    query_metadata_json := query_metadata::JSONB;
    
    -- Extraire les coordonnées GPS de l'utilisateur
    IF user_gps_zone IS NOT NULL AND user_gps_zone != '' THEN
        IF user_gps_zone LIKE '%,%' THEN
            user_lat := CAST(SPLIT_PART(user_gps_zone, ',', 1) AS DECIMAL);
            user_lng := CAST(SPLIT_PART(user_gps_zone, ',', 2) AS DECIMAL);
        END IF;
    END IF;

    RETURN QUERY
    SELECT
        m.id,
        m.service_id,
        m.path,
        -- Score de similarité basé sur les métadonnées
        CASE 
            WHEN m.image_metadata IS NOT NULL THEN
                (CASE WHEN (m.image_metadata->>'format') = (query_metadata_json->>'format') THEN 0.3 ELSE 0.0 END) +
                (CASE WHEN ABS((m.image_metadata->>'width')::INTEGER - (query_metadata_json->>'width')::INTEGER) <= 100 THEN 0.2 ELSE 0.0 END) +
                (CASE WHEN ABS((m.image_metadata->>'height')::INTEGER - (query_metadata_json->>'height')::INTEGER) <= 100 THEN 0.2 ELSE 0.0 END) +
                (CASE WHEN ABS((m.image_metadata->>'width')::FLOAT / (m.image_metadata->>'height')::FLOAT - 
                              (query_metadata_json->>'width')::FLOAT / (query_metadata_json->>'height')::FLOAT) <= 0.1 THEN 0.3 ELSE 0.0 END)
            ELSE 0.0
        END as similarity_score,
        m.image_metadata,
        -- Distance GPS avec fallback
        CASE 
            WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL THEN
                COALESCE(
                    -- Priorité 1: GPS fixe du service
                    (SELECT calculate_gps_distance_km(user_lat, user_lng, g.lat, g.lng)
                     FROM extract_gps_from_json(s.data->>'gps_fixe') g LIMIT 1),
                    -- Priorité 2: GPS du prestataire
                    (SELECT calculate_gps_distance_km(user_lat, user_lng, g.lat, g.lng)
                     FROM extract_gps_from_json(s.gps) g LIMIT 1),
                    -- Priorité 3: GPS de l'utilisateur créateur
                    (SELECT calculate_gps_distance_km(user_lat, user_lng, g.lat, g.lng)
                     FROM get_user_gps(s.user_id) g LIMIT 1)
                )
            ELSE NULL
        END as gps_distance_km,
        -- Coordonnées GPS utilisées
        CASE 
            WHEN s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' THEN s.data->>'gps_fixe'
            WHEN s.gps IS NOT NULL AND s.gps != '' AND s.gps != 'false' THEN s.gps
            ELSE (SELECT gps FROM users WHERE id = s.user_id)
        END as gps_coords
    FROM media m
    JOIN services s ON m.service_id = s.id
    WHERE m.type = 'image'
    AND m.image_metadata IS NOT NULL
    AND (
        user_gps_zone IS NULL 
        OR user_gps_zone = ''
        OR (
            -- Filtrage GPS si des coordonnées sont fournies
            CASE 
                WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL THEN
                    COALESCE(
                        (SELECT calculate_gps_distance_km(user_lat, user_lng, g.lat, g.lng)
                         FROM extract_gps_from_json(s.data->>'gps_fixe') g LIMIT 1),
                        (SELECT calculate_gps_distance_km(user_lat, user_lng, g.lat, g.lng)
                         FROM extract_gps_from_json(s.gps) g LIMIT 1),
                        (SELECT calculate_gps_distance_km(user_lat, user_lng, g.lat, g.lng)
                         FROM get_user_gps(s.user_id) g LIMIT 1)
                    ) <= search_radius_km
                ELSE TRUE
            END
        )
    )
    ORDER BY 
        CASE 
            WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL THEN
                (100 - COALESCE(
                    (SELECT calculate_gps_distance_km(user_lat, user_lng, g.lat, g.lng)
                     FROM extract_gps_from_json(s.data->>'gps_fixe') g LIMIT 1),
                    (SELECT calculate_gps_distance_km(user_lat, user_lng, g.lat, g.lng)
                     FROM extract_gps_from_json(s.gps) g LIMIT 1),
                    (SELECT calculate_gps_distance_km(user_lat, user_lng, g.lat, g.lng)
                     FROM get_user_gps(s.user_id) g LIMIT 1),
                    0
                )) / 100  -- Priorité à la proximité GPS
            ELSE 0 
        END DESC,
        similarity_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- 7. VÉRIFICATION FINALE
SELECT '✅ CORRECTION TERMINÉE' as status;

-- Vérifier que les colonnes existent
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'media' 
AND column_name LIKE 'image_%'
ORDER BY column_name;

-- Vérifier que les fonctions existent
SELECT 
    proname as function_name,
    proargtypes::regtype[] as argument_types
FROM pg_proc 
WHERE proname IN ('search_images_by_metadata', 'calculate_image_similarity', 'search_similar_images', 'search_images_by_metadata_with_gps')
ORDER BY proname; 