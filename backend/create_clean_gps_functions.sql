-- Création des fonctions GPS propres et bien définies
-- ===================================================

-- 1. Fonction extract_gps_from_json
CREATE OR REPLACE FUNCTION extract_gps_from_json(gps_data jsonb)
RETURNS text AS $$
DECLARE
    gps_value text;
BEGIN
    -- Vérifier si gps_data est null
    IF gps_data IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Extraire la valeur GPS selon le format attendu
    IF jsonb_typeof(gps_data) = 'object' THEN
        -- Format: {"valeur": "lat,lng", "type_donnee": "gps"}
        gps_value := gps_data->>'valeur';
        
        IF gps_value IS NOT NULL AND gps_value != '' THEN
            -- Vérifier que c'est bien au format "lat,lng"
            IF gps_value ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN
                RETURN gps_value;
            END IF;
        END IF;
    ELSIF jsonb_typeof(gps_data) = 'string' THEN
        -- Format direct: "lat,lng"
        gps_value := gps_data::text;
        -- Enlever les guillemets
        gps_value := trim(both '"' from gps_value);
        
        IF gps_value ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN
            RETURN gps_value;
        END IF;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Fonction calculate_gps_distance_km
CREATE OR REPLACE FUNCTION calculate_gps_distance_km(
    lat1 double precision,
    lng1 double precision,
    lat2 double precision,
    lng2 double precision
)
RETURNS double precision AS $$
BEGIN
    -- Formule de Haversine pour calculer la distance entre deux points GPS
    RETURN (
        6371 * acos(
            cos(radians(lat1)) * cos(radians(lat2)) * 
            cos(radians(lng2) - radians(lng1)) + 
            sin(radians(lat1)) * sin(radians(lat2))
        )
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Fonction calculate_intelligent_radius
CREATE OR REPLACE FUNCTION calculate_intelligent_radius(base_radius double precision)
RETURNS double precision AS $$
BEGIN
    -- Ajuster le rayon en fonction de la densité de population
    -- Pour l'instant, retourner le rayon de base
    RETURN base_radius;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Fonction get_user_gps
CREATE OR REPLACE FUNCTION get_user_gps(user_id integer)
RETURNS text AS $$
DECLARE
    user_gps text;
BEGIN
    -- Récupérer la position GPS de l'utilisateur
    SELECT gps_location INTO user_gps
    FROM users
    WHERE id = user_id;
    
    RETURN user_gps;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Fonction search_services_gps_final principale
CREATE OR REPLACE FUNCTION search_services_gps_final(
    search_query text,
    gps_zone text,
    radius_km integer DEFAULT 50
)
RETURNS TABLE(
    id integer,
    titre text,
    description text,
    category text,
    score double precision,
    distance_km double precision
) AS $$
DECLARE
    gps_parts text[];
    lat double precision;
    lng double precision;
    radius_adjusted double precision;
BEGIN
    -- Ajuster le rayon
    radius_adjusted := calculate_intelligent_radius(radius_km::double precision);
    
    -- Extraire les coordonnées GPS si fournies
    IF gps_zone IS NOT NULL AND gps_zone != '' THEN
        -- Diviser par le séparateur "|" pour gérer les zones polygonales
        gps_parts := string_to_array(gps_zone, '|');
        
        -- Pour l'instant, utiliser le premier point comme centre de recherche
        IF array_length(gps_parts, 1) > 0 THEN
            -- Extraire lat,lng du premier point
            lat := split_part(gps_parts[1], ',', 1)::double precision;
            lng := split_part(gps_parts[1], ',', 2)::double precision;
            
            -- Recherche avec filtrage GPS
            RETURN QUERY
            SELECT 
                s.id,
                s.data->>'titre_service' as titre,
                s.data->>'description' as description,
                s.data->>'category' as category,
                GREATEST(
                    CASE 
                        WHEN s.data->>'titre_service' ILIKE '%' || search_text || '%' THEN 100
                        WHEN s.data->>'description' ILIKE '%' || search_text || '%' THEN 50
                        ELSE 10
                    END,
                    CASE 
                        WHEN s.data->>'category' ILIKE '%' || search_text || '%' THEN 30
                        ELSE 0
                    END
                ) as score,
                calculate_gps_distance_km(lat, lng, 
                    split_part(extract_gps_from_json(s.data->'gps_fixe'), ',', 1)::double precision,
                    split_part(extract_gps_from_json(s.data->'gps_fixe'), ',', 2)::double precision
                ) as distance_km
            FROM services s
            WHERE 
                (s.data->>'titre_service' ILIKE '%' || search_text || '%'
                OR s.data->>'description' ILIKE '%' || search_text || '%'
                OR s.data->>'category' ILIKE '%' || search_text || '%')
                AND s.data->'gps_fixe' IS NOT NULL
                AND extract_gps_from_json(s.data->'gps_fixe') IS NOT NULL
                AND calculate_gps_distance_km(lat, lng,
                    split_part(extract_gps_from_json(s.data->'gps_fixe'), ',', 1)::double precision,
                    split_part(extract_gps_from_json(s.data->'gps_fixe'), ',', 2)::double precision
                ) <= radius_adjusted
            ORDER BY score DESC, distance_km ASC
            LIMIT 100;
        END IF;
    END IF;
    
    -- Si pas de GPS ou pas de résultats, faire une recherche textuelle simple
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            s.id,
            s.data->>'titre_service' as titre,
            s.data->>'description' as description,
            s.data->>'category' as category,
            GREATEST(
                CASE 
                    WHEN s.data->>'titre_service' ILIKE '%' || search_text || '%' THEN 100
                    WHEN s.data->>'description' ILIKE '%' || search_text || '%' THEN 50
                    ELSE 10
                END,
                CASE 
                    WHEN s.data->>'category' ILIKE '%' || search_text || '%' THEN 30
                    ELSE 0
                END
            ) as score,
            0.0 as distance_km
        FROM services s
        WHERE 
            s.data->>'titre_service' ILIKE '%' || search_text || '%'
            OR s.data->>'description' ILIKE '%' || search_text || '%'
            OR s.data->>'category' ILIKE '%' || search_text || '%'
        ORDER BY score DESC
        LIMIT 100;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. Fonctions de fallback
CREATE OR REPLACE FUNCTION fast_gps_search_with_user_fallback(
    search_text text,
    gps_zone text,
    radius_km integer DEFAULT 50
)
RETURNS TABLE(
    id integer,
    titre text,
    description text,
    category text,
    score double precision,
    distance_km double precision
) AS $$
BEGIN
    RETURN QUERY SELECT * FROM search_services_gps_final(search_text, gps_zone, radius_km);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION fast_text_gps_search_with_user_fallback(
    search_text text,
    gps_zone text,
    radius_km integer DEFAULT 50
)
RETURNS TABLE(
    id integer,
    titre text,
    description text,
    category text,
    score double precision,
    distance_km double precision
) AS $$
BEGIN
    RETURN QUERY SELECT * FROM search_services_gps_final(search_text, gps_zone, radius_km);
END;
$$ LANGUAGE plpgsql STABLE;

-- 7. Vérifier que les fonctions sont créées
SELECT 
    routine_name,
    routine_type,
    'OK' as status
FROM information_schema.routines 
WHERE routine_name IN (
    'search_services_gps_final',
    'extract_gps_from_json',
    'fast_gps_search_with_user_fallback',
    'fast_text_gps_search_with_user_fallback',
    'get_user_gps',
    'calculate_gps_distance_km',
    'calculate_intelligent_radius'
)
ORDER BY routine_name; 