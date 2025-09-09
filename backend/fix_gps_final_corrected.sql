-- CORRECTION GPS FINALE - GÈRE TOUS LES FORMATS DE COORDONNÉES
-- ===========================================================
-- Base de données: yukpo_db

-- 1. Supprimer la fonction existante problématique
DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer, integer);

-- 2. Créer la fonction corrigée qui gère TOUS les formats GPS
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
                    -- Priorité 1: GPS fixe du service (format JSON ou texte)
                    CASE 
                        WHEN s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' AND s.data->>'gps_fixe' != 'false' THEN
                            CASE 
                                -- Format JSON: {"lat": 4.0487, "lon": 9.9736}
                                WHEN s.data->>'gps_fixe' ~ '^\{.*"lat".*"lon".*\}.*$' THEN
                                    (s.data->>'gps_fixe'::jsonb->>'lat') || ',' || (s.data->>'gps_fixe'::jsonb->>'lon')
                                -- Format simple: "4.05,9.71"
                                WHEN s.data->>'gps_fixe' ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN
                                    s.data->>'gps_fixe'
                                -- Format texte: "Garoua, Cameroun" - on ne peut pas extraire de coordonnées
                                ELSE NULL
                            END
                        ELSE NULL
                    END,
                    -- Priorité 2: GPS du prestataire (si c'est de vraies coordonnées)
                    CASE 
                        WHEN s.gps IS NOT NULL AND s.gps != '' AND s.gps != 'false' AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN
                            s.gps
                        ELSE NULL
                    END,
                    -- Priorité 3: GPS de l'utilisateur créateur
                    CASE 
                        WHEN EXISTS(SELECT 1 FROM users WHERE id = s.user_id AND gps IS NOT NULL AND gps != '' AND gps != 'false' AND gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$') THEN
                            (SELECT gps FROM users WHERE id = s.user_id)
                        ELSE NULL
                    END
                ) as gps_coords,
                COALESCE(
                    -- Priorité 1: GPS fixe du service
                    CASE 
                        WHEN s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' AND s.data->>'gps_fixe' != 'false' THEN
                            CASE 
                                -- Format JSON: {"lat": 4.0487, "lon": 9.9736}
                                WHEN s.data->>'gps_fixe' ~ '^\{.*"lat".*"lon".*\}.*$' THEN
                                    calculate_gps_distance_km(lat, lng,
                                        (s.data->>'gps_fixe'::jsonb->>'lat')::double precision,
                                        (s.data->>'gps_fixe'::jsonb->>'lon')::double precision
                                    )
                                -- Format simple: "4.05,9.71"
                                WHEN s.data->>'gps_fixe' ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN
                                    calculate_gps_distance_km(lat, lng,
                                        split_part(s.data->>'gps_fixe', ',', 1)::double precision,
                                        split_part(s.data->>'gps_fixe', ',', 2)::double precision
                                    )
                                -- Format texte: pas de coordonnées calculables
                                ELSE NULL
                            END
                        ELSE NULL
                    END,
                    -- Priorité 2: GPS du prestataire
                    CASE 
                        WHEN s.gps IS NOT NULL AND s.gps != '' AND s.gps != 'false' AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN
                            calculate_gps_distance_km(lat, lng,
                                split_part(s.gps, ',', 1)::double precision,
                                split_part(s.gps, ',', 2)::double precision
                            )
                        ELSE NULL
                    END,
                    -- Priorité 3: GPS de l'utilisateur créateur
                    CASE 
                        WHEN EXISTS(SELECT 1 FROM users WHERE id = s.user_id AND gps IS NOT NULL AND gps != '' AND gps != 'false' AND gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$') THEN
                            calculate_gps_distance_km(lat, lng,
                                split_part((SELECT gps FROM users WHERE id = s.user_id), ',', 1)::double precision,
                                split_part((SELECT gps FROM users WHERE id = s.user_id), ',', 2)::double precision
                            )
                        ELSE NULL
                    END,
                    999.0::double precision  -- Valeur par défaut très élevée si aucun GPS calculable
                ) as distance_km,
                (CASE
                    WHEN s.data->>'titre_service' ILIKE '%' || search_query || '%' THEN 100.0::double precision
                    WHEN s.data->>'description' ILIKE '%' || search_query || '%' THEN 50.0::double precision
                    WHEN s.data->>'category' ILIKE '%' || search_query || '%' THEN 30.0::double precision
                    ELSE 10.0::double precision
                END) as relevance_score,
                CASE
                    WHEN s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' AND s.data->>'gps_fixe' != 'false' THEN 'service_gps_fixe'
                    WHEN s.gps IS NOT NULL AND s.gps != '' AND s.gps != 'false' AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN 'service_gps_prestataire'
                    WHEN EXISTS(SELECT 1 FROM users WHERE id = s.user_id AND gps IS NOT NULL AND gps != '' AND gps != 'false' AND gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$') THEN 'user_creator_gps'
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
                -- IMPORTANT: Inclure TOUS les services avec GPS calculable
                AND (
                    -- Service avec GPS fixe calculable
                    (s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' AND s.data->>'gps_fixe' != 'false' 
                     AND (s.data->>'gps_fixe' ~ '^\{.*"lat".*"lon".*\}.*$' OR s.data->>'gps_fixe' ~ '^-?\d+\.?\d*,-?\d+\.?\d*$'))
                    OR
                    -- Service avec GPS prestataire calculable
                    (s.gps IS NOT NULL AND s.gps != '' AND s.gps != 'false' AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$')
                    OR
                    -- Service avec utilisateur créateur ayant GPS calculable
                    EXISTS(SELECT 1 FROM users WHERE id = s.user_id AND gps IS NOT NULL AND gps != '' AND gps != 'false' AND gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$')
                )
                -- Filtrer par distance UNIQUEMENT si on a une distance calculable
                AND (
                    COALESCE(
                        -- GPS fixe
                        CASE 
                            WHEN s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' AND s.data->>'gps_fixe' != 'false' THEN
                                CASE 
                                    WHEN s.data->>'gps_fixe' ~ '^\{.*"lat".*"lon".*\}.*$' THEN
                                        calculate_gps_distance_km(lat, lng,
                                            (s.data->>'gps_fixe'::jsonb->>'lat')::double precision,
                                            (s.data->>'gps_fixe'::jsonb->>'lon')::double precision
                                        )
                                    WHEN s.data->>'gps_fixe' ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN
                                        calculate_gps_distance_km(lat, lng,
                                            split_part(s.data->>'gps_fixe', ',', 1)::double precision,
                                            split_part(s.data->>'gps_fixe', ',', 2)::double precision
                                        )
                                    ELSE NULL
                                END
                            ELSE NULL
                        END,
                        -- GPS prestataire
                        CASE 
                            WHEN s.gps IS NOT NULL AND s.gps != '' AND s.gps != 'false' AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN
                                calculate_gps_distance_km(lat, lng,
                                    split_part(s.gps, ',', 1)::double precision,
                                    split_part(s.gps, ',', 2)::double precision
                                )
                            ELSE NULL
                        END,
                        -- GPS utilisateur créateur
                        CASE 
                            WHEN EXISTS(SELECT 1 FROM users WHERE id = s.user_id AND gps IS NOT NULL AND gps != '' AND gps != 'false' AND gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$') THEN
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
                -- Priorité 1: GPS fixe du service
                CASE 
                    WHEN s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' AND s.data->>'gps_fixe' != 'false' THEN
                        CASE 
                            WHEN s.data->>'gps_fixe' ~ '^\{.*"lat".*"lon".*\}.*$' THEN
                                (s.data->>'gps_fixe'::jsonb->>'lat') || ',' || (s.data->>'gps_fixe'::jsonb->>'lon')
                            WHEN s.data->>'gps_fixe' ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN
                                s.data->>'gps_fixe'
                            ELSE NULL
                        END
                    ELSE NULL
                END,
                -- Priorité 2: GPS du prestataire
                CASE 
                    WHEN s.gps IS NOT NULL AND s.gps != '' AND s.gps != 'false' AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN
                        s.gps
                    ELSE NULL
                END,
                -- Priorité 3: GPS de l'utilisateur créateur
                CASE 
                    WHEN EXISTS(SELECT 1 FROM users WHERE id = s.user_id AND gps IS NOT NULL AND gps != '' AND gps != 'false' AND gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$') THEN
                        (SELECT gps FROM users WHERE id = s.user_id)
                    ELSE NULL
                END
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