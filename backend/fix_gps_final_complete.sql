-- CORRECTION FINALE COMPLÈTE DE LA FONCTION GPS
-- =============================================

-- 1. Supprimer TOUTES les versions existantes de la fonction
DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer, integer);
DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer);
DROP FUNCTION IF EXISTS search_services_gps_final(text, text);
DROP FUNCTION IF EXISTS search_services_gps_final(text);
DROP FUNCTION IF EXISTS search_services_gps_final();

-- 2. Créer la fonction finale unique avec la signature correcte
CREATE OR REPLACE FUNCTION search_services_gps_final(
    search_query text,
    user_gps_zone text DEFAULT NULL,
    search_radius_km integer DEFAULT 50,
    max_results integer DEFAULT 20
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
    radius_adjusted := calculate_intelligent_radius(search_radius_km::double precision);

    -- Extraire les coordonnées GPS si fournies
    IF user_gps_zone IS NOT NULL AND user_gps_zone != '' THEN
        -- Diviser par le séparateur "|" pour gérer les zones polygonales
        gps_parts := string_to_array(user_gps_zone, '|');

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
                (CASE
                    WHEN s.data->>'titre_service' ILIKE '%' || search_query || '%' THEN 100.0::double precision
                    WHEN s.data->>'description' ILIKE '%' || search_query || '%' THEN 50.0::double precision
                    WHEN s.data->>'category' ILIKE '%' || search_query || '%' THEN 30.0::double precision
                    ELSE 10.0::double precision
                END) as score,
                COALESCE(calculate_gps_distance_km(lat, lng,
                    split_part(extract_gps_from_json(s.data->'gps_fixe'), ',', 1)::double precision,
                    split_part(extract_gps_from_json(s.data->'gps_fixe'), ',', 2)::double precision
                ), 0.0::double precision) as distance_km
            FROM services s
            WHERE
                (s.data->>'titre_service' ILIKE '%' || search_query || '%'
                OR s.data->>'description' ILIKE '%' || search_query || '%'
                OR s.data->>'category' ILIKE '%' || search_query || '%')
                AND s.data->'gps_fixe' IS NOT NULL
                AND extract_gps_from_json(s.data->'gps_fixe') IS NOT NULL
                AND calculate_gps_distance_km(lat, lng,
                    split_part(extract_gps_from_json(s.data->'gps_fixe'), ',', 1)::double precision,
                    split_part(extract_gps_from_json(s.data->'gps_fixe'), ',', 2)::double precision
                ) <= radius_adjusted
            ORDER BY score DESC, distance_km ASC
            LIMIT max_results;
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
            (CASE
                WHEN s.data->>'titre_service' ILIKE '%' || search_query || '%' THEN 100.0::double precision
                WHEN s.data->>'description' ILIKE '%' || search_query || '%' THEN 50.0::double precision
                WHEN s.data->>'category' ILIKE '%' || search_query || '%' THEN 30.0::double precision
                ELSE 10.0::double precision
            END) as score,
            0.0::double precision as distance_km
        FROM services s
        WHERE
            s.data->>'titre_service' ILIKE '%' || search_query || '%'
            OR s.data->>'description' ILIKE '%' || search_query || '%'
            OR s.data->>'category' ILIKE '%' || search_query || '%'
        ORDER BY score DESC
        LIMIT max_results;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Vérifier que la fonction est créée correctement
SELECT 
    'Fonction creee' as status,
    routine_name,
    routine_type,
    pg_get_function_arguments(oid) as arguments
FROM information_schema.routines
WHERE routine_name = 'search_services_gps_final';

-- 4. Tester la fonction avec les paramètres exacts du frontend
SELECT
    'Test fonction GPS corrigee' as test_type,
    COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant',
    '4.2937979222287135,9.50682370252907|3.799277309726559,9.681231661513445|3.815720428088311,10.032794161513445|4.155472432549666,10.153643770888445|4.297906220734441,9.911944552138445',
    50,
    100
);

-- 5. Vérifier que la fonction retourne les bonnes colonnes
SELECT 
    'Verification colonnes' as test_type,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'search_services_gps_final'
ORDER BY ordinal_position; 