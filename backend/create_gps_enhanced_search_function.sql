-- Fonction de recherche par métadonnées avec filtrage GPS avancé
-- Base de données: yukpo_db
-- Intègre le filtrage GPS depuis ChatInputPanel

\c yukpo_db;

-- 1. Fonction pour calculer la distance entre deux points GPS
CREATE OR REPLACE FUNCTION calculate_gps_distance_km(
    lat1 DECIMAL, lng1 DECIMAL, 
    lat2 DECIMAL, lng2 DECIMAL
)
RETURNS DECIMAL AS $$
BEGIN
    -- Utiliser la formule de Haversine pour calculer la distance
    RETURN (
        6371 * acos(
            cos(radians(lat1)) * cos(radians(lat2)) * 
            cos(radians(lng2) - radians(lng1)) + 
            sin(radians(lat1)) * sin(radians(lat2))
        )
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Fonction pour extraire les coordonnées GPS d'une chaîne
CREATE OR REPLACE FUNCTION extract_gps_coordinates(gps_text TEXT)
RETURNS TABLE(lat DECIMAL, lng DECIMAL) AS $$
DECLARE
    parts TEXT[];
BEGIN
    -- Vérifier le format "lat,lng" ou "lat|lng"
    IF gps_text ~ '^-?\d+\.?\d*[,|-]-?\d+\.?\d*$' THEN
        parts := string_to_array(gps_text, CASE WHEN gps_text LIKE '%,%' THEN ',' ELSE '|' END);
        
        IF array_length(parts, 1) = 2 THEN
            lat := CAST(parts[1] AS DECIMAL);
            lng := CAST(parts[2] AS DECIMAL);
            
            -- Vérifier les limites géographiques
            IF lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180 THEN
                RETURN NEXT;
            END IF;
        END IF;
    END IF;
    
    RETURN;
EXCEPTION
    WHEN OTHERS THEN
        RETURN;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Fonction principale de recherche par métadonnées avec filtrage GPS
CREATE OR REPLACE FUNCTION search_images_by_metadata_with_gps(
    query_metadata TEXT,
    user_gps_zone TEXT DEFAULT NULL,  -- Format: "lat1,lng1|lat2,lng2|..." pour polygone ou "lat,lng" pour point
    search_radius_km INTEGER DEFAULT 50,  -- Rayon de recherche en km
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
    query_format VARCHAR(50);
    query_width INTEGER;
    query_height INTEGER;
    query_ratio FLOAT;
    user_lat DECIMAL;
    user_lng DECIMAL;
    gps_filter_condition TEXT;
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

    -- Extraire les coordonnées GPS de l'utilisateur
    IF user_gps_zone IS NOT NULL AND user_gps_zone != '' THEN
        -- Si c'est un polygone (format: "lat1,lng1|lat2,lng2|...")
        IF user_gps_zone LIKE '%|%' THEN
            -- Prendre le centre du polygone comme point de référence
            SELECT 
                AVG(lat)::DECIMAL, 
                AVG(lng)::DECIMAL 
            INTO user_lat, user_lng
            FROM extract_gps_coordinates(user_gps_zone);
        ELSE
            -- Si c'est un point simple (format: "lat,lng")
            SELECT lat, lng INTO user_lat, user_lng
            FROM extract_gps_coordinates(user_gps_zone);
        END IF;
    END IF;

    -- Construire la condition GPS si des coordonnées sont disponibles
    IF user_lat IS NOT NULL AND user_lng IS NOT NULL THEN
        gps_filter_condition := format(
            'AND (
                -- Vérifier gps_fixe dans les données du service
                (s.data->>''gps_fixe'' IS NOT NULL AND s.data->>''gps_fixe'' != '''') AND
                EXISTS (
                    SELECT 1 FROM extract_gps_coordinates(s.data->>''gps_fixe'') g
                    WHERE calculate_gps_distance_km(%s, %s, g.lat, g.lng) <= %s
                )
                OR
                -- Vérifier gps du prestataire
                (s.gps IS NOT NULL AND s.gps != '''') AND
                EXISTS (
                    SELECT 1 FROM extract_gps_coordinates(s.gps) g
                    WHERE calculate_gps_distance_km(%s, %s, g.lat, g.lng) <= %s
                )
            )',
            user_lat, user_lng, search_radius_km,
            user_lat, user_lng, search_radius_km
        );
    ELSE
        gps_filter_condition := '';
    END IF;

    -- Exécuter la requête avec ou sans filtrage GPS
    RETURN QUERY EXECUTE format(
        'SELECT
            m.id as media_id,
            m.service_id,
            m.path,
            (
                CASE WHEN (m.image_metadata->>''format'')::VARCHAR(50) = %L THEN 0.3 ELSE 0.0 END +
                CASE
                    WHEN m.image_metadata->>''width'' IS NOT NULL AND m.image_metadata->>''height'' IS NOT NULL THEN
                        CASE
                            WHEN ABS((m.image_metadata->>''width'')::INTEGER::FLOAT / (m.image_metadata->>''height'')::INTEGER::FLOAT - %s) < 0.1 THEN 0.3
                            WHEN ABS((m.image_metadata->>''width'')::INTEGER::FLOAT / (m.image_metadata->>''height'')::INTEGER::FLOAT - %s) < 0.3 THEN 0.1
                            ELSE 0.0
                        END
                    ELSE 0.0
                END +
                CASE
                    WHEN m.image_metadata->>''file_size'' IS NOT NULL AND %L::JSONB->>''file_size'' IS NOT NULL THEN
                        CASE
                            WHEN ABS((m.image_metadata->>''file_size'')::INTEGER - (%L::JSONB->>''file_size'')::INTEGER)::FLOAT / (%L::JSONB->>''file_size'')::INTEGER::FLOAT < 0.2 THEN 0.2
                            ELSE 0.0
                        END
                    ELSE 0.0
                END
            )::FLOAT as similarity_score,
            m.image_metadata,
            CASE 
                WHEN %s IS NOT NULL AND %s IS NOT NULL THEN
                    GREATEST(
                        -- Distance depuis gps_fixe
                        CASE 
                            WHEN s.data->>''gps_fixe'' IS NOT NULL THEN
                                (SELECT calculate_gps_distance_km(%s, %s, g.lat, g.lng)
                                 FROM extract_gps_coordinates(s.data->>''gps_fixe'') g LIMIT 1)
                            ELSE NULL
                        END,
                        -- Distance depuis gps prestataire
                        CASE 
                            WHEN s.gps IS NOT NULL THEN
                                (SELECT calculate_gps_distance_km(%s, %s, g.lat, g.lng)
                                 FROM extract_gps_coordinates(s.gps) g LIMIT 1)
                            ELSE NULL
                        END
                    )
                ELSE NULL
            END as gps_distance_km,
            COALESCE(s.data->>''gps_fixe'', s.gps) as gps_coords
        FROM media m
        JOIN services s ON m.service_id = s.id
        WHERE m.type = ''image''
        AND m.image_metadata IS NOT NULL
        AND s.is_active = true
        %s
        HAVING (
            CASE WHEN (m.image_metadata->>''format'')::VARCHAR(50) = %L THEN 0.3 ELSE 0.0 END +
            CASE
                WHEN m.image_metadata->>''width'' IS NOT NULL AND m.image_metadata->>''height'' IS NOT NULL THEN
                    CASE
                        WHEN ABS((m.image_metadata->>''width'')::INTEGER::FLOAT / (m.image_metadata->>''height'')::INTEGER::FLOAT - %s) < 0.1 THEN 0.3
                        WHEN ABS((m.image_metadata->>''width'')::INTEGER::FLOAT / (m.image_metadata->>''height'')::INTEGER::FLOAT - %s) < 0.3 THEN 0.1
                        ELSE 0.0
                    END
                ELSE 0.0
            END +
            CASE
                WHEN m.image_metadata->>''file_size'' IS NOT NULL AND %L::JSONB->>''file_size'' IS NOT NULL THEN
                    CASE
                        WHEN ABS((m.image_metadata->>''file_size'')::INTEGER - (%L::JSONB->>''file_size'')::INTEGER)::FLOAT / (%L::JSONB->>''file_size'')::INTEGER::FLOAT < 0.2 THEN 0.2
                        ELSE 0.0
                    END
                ELSE 0.0
            END
        ) > 0.3
        ORDER BY 
            CASE 
                WHEN %s IS NOT NULL AND %s IS NOT NULL THEN
                    -- Priorité 1: Distance GPS (plus proche = meilleur score)
                    CASE 
                        WHEN gps_distance_km IS NOT NULL THEN (100 - gps_distance_km) / 100
                        ELSE 0
                    END
                ELSE 0
            END DESC,
            similarity_score DESC
        LIMIT %s',
        query_format, query_ratio, query_ratio,
        query_metadata, query_metadata, query_metadata,
        user_lat, user_lng, user_lat, user_lng, user_lng, user_lat,
        gps_filter_condition,
        query_format, query_ratio, query_ratio,
        query_metadata, query_metadata, query_metadata,
        user_lat, user_lng,
        max_results
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Fonction pour rechercher les services dans une zone GPS spécifique
CREATE OR REPLACE FUNCTION search_services_in_gps_zone(
    user_gps_zone TEXT,  -- Format: "lat1,lng1|lat2,lng2|..." pour polygone ou "lat,lng" pour point
    search_radius_km INTEGER DEFAULT 50,
    category_filter TEXT DEFAULT NULL,
    max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
    service_id INTEGER,
    titre_service TEXT,
    category TEXT,
    gps_distance_km DECIMAL,
    gps_coords TEXT,
    location_type TEXT
) AS $$
DECLARE
    user_lat DECIMAL;
    user_lng DECIMAL;
    gps_filter_condition TEXT;
BEGIN
    -- Extraire les coordonnées GPS de l'utilisateur
    IF user_gps_zone IS NOT NULL AND user_gps_zone != '' THEN
        -- Si c'est un polygone (format: "lat1,lng1|lat2,lng2|...")
        IF user_gps_zone LIKE '%|%' THEN
            -- Prendre le centre du polygone comme point de référence
            SELECT 
                AVG(lat)::DECIMAL, 
                AVG(lng)::DECIMAL 
            INTO user_lat, user_lng
            FROM extract_gps_coordinates(user_gps_zone);
        ELSE
            -- Si c'est un point simple (format: "lat,lng")
            SELECT lat, lng INTO user_lat, user_lng
            FROM extract_gps_coordinates(user_gps_zone);
        END IF;
    END IF;

    -- Construire la condition GPS
    IF user_lat IS NOT NULL AND user_lng IS NOT NULL THEN
        gps_filter_condition := format(
            'AND (
                -- Vérifier gps_fixe dans les données du service
                (s.data->>''gps_fixe'' IS NOT NULL AND s.data->>''gps_fixe'' != '''') AND
                EXISTS (
                    SELECT 1 FROM extract_gps_coordinates(s.data->>''gps_fixe'') g
                    WHERE calculate_gps_distance_km(%s, %s, g.lat, g.lng) <= %s
                )
                OR
                -- Vérifier gps du prestataire
                (s.gps IS NOT NULL AND s.gps != '''') AND
                EXISTS (
                    SELECT 1 FROM extract_gps_coordinates(s.gps) g
                    WHERE calculate_gps_distance_km(%s, %s, g.lat, g.lng) <= %s
                )
            )',
            user_lat, user_lng, search_radius_km,
            user_lat, user_lng, search_radius_km
        );
    ELSE
        gps_filter_condition := '';
    END IF;

    -- Exécuter la requête
    RETURN QUERY EXECUTE format(
        'SELECT
            s.id as service_id,
            s.data->>''titre_service'' as titre_service,
            COALESCE(s.category, s.data->''category''->>''valeur'') as category,
            CASE 
                WHEN %s IS NOT NULL AND %s IS NOT NULL THEN
                    GREATEST(
                        -- Distance depuis gps_fixe
                        CASE 
                            WHEN s.data->>''gps_fixe'' IS NOT NULL THEN
                                (SELECT calculate_gps_distance_km(%s, %s, g.lat, g.lng)
                                 FROM extract_gps_coordinates(s.data->>''gps_fixe'') g LIMIT 1)
                            ELSE NULL
                        END,
                        -- Distance depuis gps prestataire
                        CASE 
                            WHEN s.gps IS NOT NULL THEN
                                (SELECT calculate_gps_distance_km(%s, %s, g.lat, g.lng)
                                 FROM extract_gps_coordinates(s.gps) g LIMIT 1)
                            ELSE NULL
                        END
                    )
                ELSE NULL
            END as gps_distance_km,
            COALESCE(s.data->>''gps_fixe'', s.gps) as gps_coords,
            CASE 
                WHEN s.data->>''gps_fixe'' IS NOT NULL THEN ''gps_fixe''
                WHEN s.gps IS NOT NULL THEN ''gps_prestataire''
                ELSE ''adresse''
            END as location_type
        FROM services s
        WHERE s.is_active = true
        AND (
            (s.data->>''gps_fixe'' IS NOT NULL AND s.data->>''gps_fixe'' != '''') OR
            (s.gps IS NOT NULL AND s.gps != '''')
        )
        %s
        %s
        ORDER BY 
            CASE 
                WHEN %s IS NOT NULL AND %s IS NOT NULL THEN
                    -- Priorité 1: Distance GPS (plus proche = meilleur score)
                    CASE 
                        WHEN gps_distance_km IS NOT NULL THEN (100 - gps_distance_km) / 100
                        ELSE 0
                    END
                ELSE 0
            END DESC,
            s.created_at DESC
        LIMIT %s',
        user_lat, user_lng, user_lat, user_lng, user_lng, user_lat,
        gps_filter_condition,
        CASE 
            WHEN category_filter IS NOT NULL THEN format('AND (s.category = %L OR s.data->''category''->>''valeur'' = %L)', category_filter, category_filter)
            ELSE ''
        END,
        user_lat, user_lng,
        max_results
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Vérifier que les fonctions ont été créées
SELECT 'Fonction calculate_gps_distance_km créée' as status;
SELECT 'Fonction extract_gps_coordinates créée' as status;
SELECT 'Fonction search_images_by_metadata_with_gps créée' as status;
SELECT 'Fonction search_services_in_gps_zone créée' as status;

-- 6. Afficher les fonctions créées
SELECT proname, prosrc FROM pg_proc WHERE proname IN (
    'calculate_gps_distance_km',
    'extract_gps_coordinates', 
    'search_images_by_metadata_with_gps',
    'search_services_in_gps_zone'
); 