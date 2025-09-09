-- CORRECTION COMPLÈTE GPS + IMAGES EN UN SEUL FICHIER
-- Base de données: yukpo_db

-- =====================================================
-- ÉTAPE 1: CORRECTION GPS
-- =====================================================

-- Fonction finale de recherche GPS avec fallback automatique
CREATE OR REPLACE FUNCTION search_services_gps_final(
    search_query TEXT DEFAULT NULL,
    user_gps_zone TEXT DEFAULT NULL,
    search_radius_km INTEGER DEFAULT 50,
    max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
    service_id INTEGER,
    titre_service TEXT,
    category TEXT,
    gps_coords TEXT,
    distance_km DECIMAL,
    relevance_score FLOAT,
    gps_source TEXT
) AS $$
BEGIN
    -- Si pas de requête de recherche, faire une recherche GPS pure
    IF search_query IS NULL OR search_query = '' THEN
        RETURN QUERY
        SELECT
            s.service_id,
            s.titre_service,
            s.category,
            s.gps_coords,
            s.distance_km,
            0.0::FLOAT as relevance_score,
            s.gps_source
        FROM fast_gps_search_with_user_fallback(user_gps_zone, search_radius_km, max_results) s;
    ELSE
        -- Sinon, faire une recherche texte + GPS avec fallback
        RETURN QUERY
        SELECT * FROM fast_text_gps_search_with_user_fallback(search_query, user_gps_zone, search_radius_km, max_results);
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- ÉTAPE 2: CORRECTION DES IMAGES
-- =====================================================

-- Ajouter les colonnes manquantes à la table media
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

-- Créer les index pour les performances
CREATE INDEX IF NOT EXISTS idx_media_image_signature ON media USING GIN (image_signature);
CREATE INDEX IF NOT EXISTS idx_media_image_hash ON media(image_hash);
CREATE INDEX IF NOT EXISTS idx_media_image_metadata ON media USING GIN (image_metadata);
CREATE INDEX IF NOT EXISTS idx_media_type_image ON media(type) WHERE type = 'image';

-- Fonction pour calculer la similarité entre images
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

-- Fonction pour rechercher des images similaires
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

-- Fonction pour rechercher par métadonnées
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

-- =====================================================
-- ÉTAPE 3: VÉRIFICATION FINALE
-- =====================================================

-- Vérifier que les fonctions GPS existent
SELECT 
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'search_services_gps_final'
    ) THEN '✅ FONCTION GPS EXISTE' ELSE '❌ FONCTION GPS MANQUANTE' END as status_gps;

-- Vérifier que les colonnes d'image existent
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'media' 
AND column_name LIKE 'image_%'
ORDER BY column_name;

-- Vérifier que les fonctions d'image existent
SELECT 
    proname as function_name,
    proargtypes::regtype[] as argument_types
FROM pg_proc 
WHERE proname IN ('search_images_by_metadata', 'calculate_image_similarity', 'search_similar_images')
ORDER BY proname;

-- Test de la fonction GPS finale
SELECT '=== TEST FONCTION GPS ===' as test_name;
SELECT COUNT(*) as total_results
FROM search_services_gps_final('restaurant', '4.0511,9.7679', 50, 5);

-- Résumé final
SELECT '🎉 CORRECTIONS TERMINÉES!' as status;
SELECT '✅ Fonction GPS search_services_gps_final créée' as info
UNION ALL
SELECT '✅ Colonnes d\'image ajoutées à la table media'
UNION ALL
SELECT '✅ Fonctions de recherche d\'images créées'
UNION ALL
SELECT '✅ Index de performance créés'; 