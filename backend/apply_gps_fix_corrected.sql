-- CORRECTION GPS FINALE - LOGIQUE INVERSE CORRIGÉE
-- ================================================
-- Base de données: yukpo_db

-- 1. Supprimer la fonction existante problématique
DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer, integer);

-- 2. Créer la fonction corrigée avec la logique GPS appropriée
CREATE OR REPLACE FUNCTION search_services_gps_final(
    search_query text,
    user_gps_zone text DEFAULT NULL,
    search_radius_km integer DEFAULT 50,
    max_results integer DEFAULT 20
)
RETURNS TABLE(
    service_id integer,
    titre_service text,
    category text,
    gps_coords text,
    distance_km double precision,
    relevance_score double precision,
    gps_source text
) AS $$
DECLARE
    gps_parts text[];
    lat double precision;
    lng double precision;
    radius_adjusted double precision;
BEGIN
    -- Ajuster le rayon
    radius_adjusted := calculate_intelligent_radius(search_radius_km::double precision);

    -- CAS 1: Recherche AVEC zone GPS (zone non NULL et non vide)
    IF user_gps_zone IS NOT NULL AND user_gps_zone != '' AND user_gps_zone != 'null' THEN
        -- Diviser par le séparateur "|" pour gérer les zones polygonales
        gps_parts := string_to_array(user_gps_zone, '|');

        -- Pour l'instant, utiliser le premier point comme centre de recherche
        IF array_length(gps_parts, 1) > 0 THEN
            -- Extraire lat,lng du premier point
            lat := split_part(gps_parts[1], ',', 1)::double precision;
            lng := split_part(gps_parts[1], ',', 2)::double precision;

            -- Recherche avec filtrage GPS COMPLET (toutes les sources GPS)
            RETURN QUERY
            SELECT
                s.id as service_id,
                s.data->>'titre_service' as titre_service,
                s.data->>'category' as category,
                COALESCE(
                    extract_gps_from_json(s.data->'gps_fixe'),
                    s.gps,
                    (SELECT gps FROM users WHERE id = s.user_id)
                ) as gps_coords,
                COALESCE(
                    -- Priorité 1: GPS fixe du service
                    CASE 
                        WHEN s.data->'gps_fixe' IS NOT NULL AND extract_gps_from_json(s.data->'gps_fixe') IS NOT NULL THEN
                            calculate_gps_distance_km(lat, lng,
                                split_part(extract_gps_from_json(s.data->'gps_fixe'), ',', 1)::double precision,
                                split_part(extract_gps_from_json(s.data->'gps_fixe'), ',', 2)::double precision
                            )
                        ELSE NULL
                    END,
                    -- Priorité 2: GPS du prestataire
                    CASE 
                        WHEN s.gps IS NOT NULL AND s.gps != '' AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN
                            calculate_gps_distance_km(lat, lng,
                                split_part(s.gps, ',', 1)::double precision,
                                split_part(s.gps, ',', 2)::double precision
                            )
                        ELSE NULL
                    END,
                    -- Priorité 3: GPS de l'utilisateur créateur
                    CASE 
                        WHEN EXISTS(SELECT 1 FROM users WHERE id = s.user_id AND gps IS NOT NULL AND gps != '') THEN
                            calculate_gps_distance_km(lat, lng,
                                split_part((SELECT gps FROM users WHERE id = s.user_id), ',', 1)::double precision,
                                split_part((SELECT gps FROM users WHERE id = s.user_id), ',', 2)::double precision
                            )
                        ELSE NULL
                    END,
                    999.0::double precision  -- Valeur par défaut très élevée si aucun GPS
                ) as distance_km,
                (CASE
                    WHEN s.data->>'titre_service' ILIKE '%' || search_query || '%' THEN 100.0::double precision
                    WHEN s.data->>'description' ILIKE '%' || search_query || '%' THEN 50.0::double precision
                    WHEN s.data->>'category' ILIKE '%' || search_query || '%' THEN 30.0::double precision
                    ELSE 10.0::double precision
                END) as relevance_score,
                CASE
                    WHEN s.data->'gps_fixe' IS NOT NULL AND extract_gps_from_json(s.data->'gps_fixe') IS NOT NULL THEN 'service_gps_fixe'
                    WHEN s.gps IS NOT NULL AND s.gps != '' AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN 'service_gps_prestataire'
                    WHEN EXISTS(SELECT 1 FROM users WHERE id = s.user_id AND gps IS NOT NULL AND gps != '') THEN 'user_creator_gps'
                    ELSE 'no_gps'
                END as gps_source
            FROM services s
            WHERE
                s.is_active = true
                AND (
                    s.data->>'titre_service' ILIKE '%' || search_query || '%'
                    OR s.data->>'description' ILIKE '%' || search_query || '%'
                    OR s.data->>'category' ILIKE '%' || search_query || '%'
                )
                -- IMPORTANT: Inclure TOUS les services, pas seulement ceux avec gps_fixe
                AND (
                    -- Service avec GPS fixe
                    (s.data->'gps_fixe' IS NOT NULL AND extract_gps_from_json(s.data->'gps_fixe') IS NOT NULL)
                    OR
                    -- Service avec GPS prestataire
                    (s.gps IS NOT NULL AND s.gps != '' AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$')
                    OR
                    -- Service avec utilisateur créateur ayant GPS
                    EXISTS(SELECT 1 FROM users WHERE id = s.user_id AND gps IS NOT NULL AND gps != '')
                )
                -- Filtrer par distance UNIQUEMENT si on a une distance calculable
                AND (
                    COALESCE(
                        CASE 
                            WHEN s.data->'gps_fixe' IS NOT NULL AND extract_gps_from_json(s.data->'gps_fixe') IS NOT NULL THEN
                                calculate_gps_distance_km(lat, lng,
                                    split_part(extract_gps_from_json(s.data->'gps_fixe'), ',', 1)::double precision,
                                    split_part(extract_gps_from_json(s.data->'gps_fixe'), ',', 2)::double precision
                                )
                            ELSE NULL
                        END,
                        CASE 
                            WHEN s.gps IS NOT NULL AND s.gps != '' AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN
                                calculate_gps_distance_km(lat, lng,
                                    split_part(s.gps, ',', 1)::double precision,
                                    split_part(s.gps, ',', 2)::double precision
                                )
                            ELSE NULL
                        END,
                        CASE 
                            WHEN EXISTS(SELECT 1 FROM users WHERE id = s.user_id AND gps IS NOT NULL AND gps != '') THEN
                                calculate_gps_distance_km(lat, lng,
                                    split_part((SELECT gps FROM users WHERE id = s.user_id), ',', 1)::double precision,
                                    split_part((SELECT gps FROM users WHERE id = s.user_id), ',', 2)::double precision
                                )
                            ELSE NULL
                        END,
                        999.0::double precision
                    ) <= radius_adjusted
                )
            ORDER BY 
                relevance_score DESC, 
                distance_km ASC
            LIMIT max_results;
        END IF;
    END IF;

    -- CAS 2: Recherche SANS zone GPS (fallback textuel pur)
    IF user_gps_zone IS NULL OR user_gps_zone = '' OR user_gps_zone = 'null' THEN
        RETURN QUERY
        SELECT
            s.id as service_id,
            s.data->>'titre_service' as titre_service,
            s.data->>'category' as category,
            COALESCE(
                extract_gps_from_json(s.data->'gps_fixe'),
                s.gps,
                (SELECT gps FROM users WHERE id = s.user_id)
            ) as gps_coords,
            0.0::double precision as distance_km,
            (CASE
                WHEN s.data->>'titre_service' ILIKE '%' || search_query || '%' THEN 100.0::double precision
                WHEN s.data->>'description' ILIKE '%' || search_query || '%' THEN 50.0::double precision
                WHEN s.data->>'category' ILIKE '%' || search_query || '%' THEN 30.0::double precision
                ELSE 10.0::double precision
            END) as relevance_score,
            'text_only' as gps_source
        FROM services s
        WHERE
            s.is_active = true
            AND (
                s.data->>'titre_service' ILIKE '%' || search_query || '%'
                OR s.data->>'description' ILIKE '%' || search_query || '%'
                OR s.data->>'category' ILIKE '%' || search_query || '%'
            )
        ORDER BY relevance_score DESC
        LIMIT max_results;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Tester la fonction corrigée
SELECT '=== TEST FONCTION GPS CORRIGÉE ===' as test_name;

-- Test 1: Recherche avec GPS (devrait retourner des services DANS la zone)
SELECT '--- Test 1: Recherche "restaurant" AVEC GPS ---' as test_name;
SELECT 
    service_id,
    titre_service,
    category,
    ROUND(distance_km::NUMERIC, 2) as distance_km_rounded,
    gps_source
FROM search_services_gps_final(
    'restaurant',
    '4.0511,9.7679',  -- Douala centre
    50,                -- 50km de rayon
    10                 -- 10 résultats max
);

-- Test 2: Recherche sans GPS (devrait retourner tous les services)
SELECT '--- Test 2: Recherche "restaurant" SANS GPS ---' as test_name;
SELECT 
    service_id,
    titre_service,
    category,
    distance_km,
    gps_source
FROM search_services_gps_final(
    'restaurant',
    NULL,              -- Pas de GPS
    50,                -- 50km de rayon
    10                 -- 10 résultats max
);

-- Test 3: Vérifier que la fonction existe et fonctionne
SELECT '--- Test 3: Vérification fonction ---' as test_name;
SELECT 
    routine_name,
    routine_type,
    routine_definition IS NOT NULL as definition_presente
FROM information_schema.routines 
WHERE routine_name = 'search_services_gps_final'; 