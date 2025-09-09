-- CORRECTION DE L'ORDRE DES COORDONNÉES GPS
-- =========================================
-- Base de données: yukpo_db

-- 1. Créer une fonction pour détecter et corriger l'ordre des coordonnées GPS
CREATE OR REPLACE FUNCTION fix_gps_coordinate_order(gps_string text)
RETURNS text AS $$
DECLARE
    coords text[];
    lat double precision;
    lng double precision;
    corrected_gps text;
BEGIN
    -- Vérifier si c'est une chaîne GPS valide
    IF gps_string IS NULL OR gps_string = '' OR gps_string !~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN
        RETURN gps_string;
    END IF;
    
    -- Diviser les coordonnées
    coords := string_to_array(gps_string, ',');
    
    IF array_length(coords, 1) != 2 THEN
        RETURN gps_string;
    END IF;
    
    -- Extraire les coordonnées
    lat := coords[1]::double precision;
    lng := coords[2]::double precision;
    
    -- Détecter si l'ordre est incorrect
    -- Latitude doit être entre -90 et 90
    -- Longitude doit être entre -180 et 180
    IF lat >= -90 AND lat <= 90 AND lng >= -180 AND lng <= 180 THEN
        -- Ordre correct: lat,lng
        corrected_gps := gps_string;
    ELSIF lng >= -90 AND lng <= 90 AND lat >= -180 AND lat <= 180 THEN
        -- Ordre inversé: lng,lat -> corriger en lat,lng
        corrected_gps := lng || ',' || lat;
    ELSE
        -- Format inconnu, retourner tel quel
        corrected_gps := gps_string;
    END IF;
    
    RETURN corrected_gps;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Créer une fonction pour extraire et corriger les coordonnées GPS du JSON
CREATE OR REPLACE FUNCTION extract_and_fix_gps_from_json(gps_json jsonb)
RETURNS text AS $$
DECLARE
    gps_value text;
    corrected_gps text;
BEGIN
    -- Extraire la valeur GPS du JSON
    IF gps_json IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Essayer différents formats de JSON
    IF gps_json ? 'valeur' THEN
        gps_value := gps_json->>'valeur';
    ELSIF gps_json ? 'value' THEN
        gps_value := gps_json->>'value';
    ELSIF gps_json ? 'gps' THEN
        gps_value := gps_json->>'gps';
    ELSIF gps_json ? 'coordinates' THEN
        gps_value := gps_json->>'coordinates';
    ELSE
        -- Essayer de traiter comme une chaîne directe
        gps_value := gps_json::text;
        -- Enlever les guillemets si présents
        IF gps_value ~ '^".*"$' THEN
            gps_value := substring(gps_value from 2 for length(gps_value) - 2);
        END IF;
    END IF;
    
    -- Vérifier si c'est une valeur GPS valide
    IF gps_value IS NULL OR gps_value = '' OR gps_value = 'null' OR gps_value = 'undefined' THEN
        RETURN NULL;
    END IF;
    
    -- Corriger l'ordre des coordonnées si nécessaire
    corrected_gps := fix_gps_coordinate_order(gps_value);
    
    RETURN corrected_gps;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Mettre à jour la fonction search_services_gps_final pour utiliser la nouvelle fonction
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
            -- Extraire lat,lng du premier point et corriger l'ordre si nécessaire
            gps_parts[1] := fix_gps_coordinate_order(gps_parts[1]);
            lat := split_part(gps_parts[1], ',', 1)::double precision;
            lng := split_part(gps_parts[1], ',', 2)::double precision;

            -- Recherche avec filtrage GPS COMPLET (toutes les sources GPS)
            RETURN QUERY
            SELECT
                s.id as service_id,
                s.data->>'titre_service' as titre_service,
                s.data->>'category' as category,
                COALESCE(
                    extract_and_fix_gps_from_json(s.data->'gps_fixe'),
                    fix_gps_coordinate_order(s.gps),
                    fix_gps_coordinate_order((SELECT gps FROM users WHERE id = s.user_id))
                ) as gps_coords,
                COALESCE(
                    -- Priorité 1: GPS fixe du service
                    CASE 
                        WHEN s.data->'gps_fixe' IS NOT NULL AND extract_and_fix_gps_from_json(s.data->'gps_fixe') IS NOT NULL THEN
                            calculate_gps_distance_km(lat, lng,
                                split_part(extract_and_fix_gps_from_json(s.data->'gps_fixe'), ',', 1)::double precision,
                                split_part(extract_and_fix_gps_from_json(s.data->'gps_fixe'), ',', 2)::double precision
                            )
                        ELSE NULL
                    END,
                    -- Priorité 2: GPS du prestataire
                    CASE 
                        WHEN s.gps IS NOT NULL AND s.gps != '' AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN
                            calculate_gps_distance_km(lat, lng,
                                split_part(fix_gps_coordinate_order(s.gps), ',', 1)::double precision,
                                split_part(fix_gps_coordinate_order(s.gps), ',', 2)::double precision
                            )
                        ELSE NULL
                    END,
                    -- Priorité 3: GPS de l'utilisateur créateur
                    CASE 
                        WHEN EXISTS(SELECT 1 FROM users WHERE id = s.user_id AND gps IS NOT NULL AND gps != '') THEN
                            calculate_gps_distance_km(lat, lng,
                                split_part(fix_gps_coordinate_order((SELECT gps FROM users WHERE id = s.user_id)), ',', 1)::double precision,
                                split_part(fix_gps_coordinate_order((SELECT gps FROM users WHERE id = s.user_id)), ',', 2)::double precision
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
                    WHEN s.data->'gps_fixe' IS NOT NULL AND extract_and_fix_gps_from_json(s.data->'gps_fixe') IS NOT NULL THEN 'service_gps_fixe'
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
                    (s.data->'gps_fixe' IS NOT NULL AND extract_and_fix_gps_from_json(s.data->'gps_fixe') IS NOT NULL)
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
                            WHEN s.data->'gps_fixe' IS NOT NULL AND extract_and_fix_gps_from_json(s.data->'gps_fixe') IS NOT NULL THEN
                                calculate_gps_distance_km(lat, lng,
                                    split_part(extract_and_fix_gps_from_json(s.data->'gps_fixe'), ',', 1)::double precision,
                                    split_part(extract_and_fix_gps_from_json(s.data->'gps_fixe'), ',', 2)::double precision
                                )
                            ELSE NULL
                        END,
                        CASE 
                            WHEN s.gps IS NOT NULL AND s.gps != '' AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN
                                calculate_gps_distance_km(lat, lng,
                                    split_part(fix_gps_coordinate_order(s.gps), ',', 1)::double precision,
                                    split_part(fix_gps_coordinate_order(s.gps), ',', 2)::double precision
                                )
                            ELSE NULL
                        END,
                        CASE 
                            WHEN EXISTS(SELECT 1 FROM users WHERE id = s.user_id AND gps IS NOT NULL AND gps != '') THEN
                                calculate_gps_distance_km(lat, lng,
                                    split_part(fix_gps_coordinate_order((SELECT gps FROM users WHERE id = s.user_id)), ',', 1)::double precision,
                                    split_part(fix_gps_coordinate_order((SELECT gps WHERE id = s.user_id)), ',', 2)::double precision
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
                extract_and_fix_gps_from_json(s.data->'gps_fixe'),
                fix_gps_coordinate_order(s.gps),
                fix_gps_coordinate_order((SELECT gps FROM users WHERE id = s.user_id))
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

-- 4. Tester la correction
SELECT '=== TEST CORRECTION COORDONNÉES GPS ===' as test_type;

-- Test 1: Coordonnées correctes (Douala)
SELECT 
    'Douala (correct)' as test,
    '4.051056,9.767869' as original,
    fix_gps_coordinate_order('4.051056,9.767869') as corrige;

-- Test 2: Coordonnées inversées (Douala)
SELECT 
    'Douala (inversé)' as test,
    '9.767869,4.051056' as original,
    fix_gps_coordinate_order('9.767869,4.051056') as corrige;

-- Test 3: Coordonnées correctes (Yaoundé)
SELECT 
    'Yaoundé (correct)' as test,
    '3.848033,11.502075' as original,
    fix_gps_coordinate_order('3.848033,11.502075') as corrige;

-- Test 4: Coordonnées inversées (Yaoundé)
SELECT 
    'Yaoundé (inversé)' as test,
    '11.502075,3.848033' as original,
    fix_gps_coordinate_order('11.502075,3.848033') as corrige;

-- Test 5: Extraction et correction depuis JSON
SELECT 
    'JSON extraction' as test,
    extract_and_fix_gps_from_json('{"valeur": "9.767869,4.051056"}') as resultat,
    '4.051056,9.767869' as attendu; 
 