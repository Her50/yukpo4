-- CORRECTION GPS SEARCH MANQUANTE
-- Base de données: yukpo_db
-- Problème: La fonction search_services_gps_final n'existe pas ou ne fonctionne pas

-- =====================================================
-- ÉTAPE 1: VÉRIFIER L'EXISTENCE DES FONCTIONS GPS
-- =====================================================

-- Vérifier si les fonctions GPS existent
SELECT '=== VÉRIFICATION FONCTIONS GPS ===' as test_name;

SELECT 
    routine_name,
    routine_type,
    routine_definition IS NOT NULL as definition_presente
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%gps%'
ORDER BY routine_name;

-- =====================================================
-- ÉTAPE 2: CRÉER LES FONCTIONS GPS MANQUANTES
-- =====================================================

-- Fonction pour calculer la distance GPS en km
CREATE OR REPLACE FUNCTION calculate_gps_distance_km(
    lat1 DECIMAL, lng1 DECIMAL, 
    lat2 DECIMAL, lng2 DECIMAL
) RETURNS DECIMAL AS $$
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

-- Fonction pour extraire les coordonnées GPS d'une chaîne
CREATE OR REPLACE FUNCTION extract_gps_coordinates(gps_string TEXT) 
RETURNS TABLE(lat DECIMAL, lng DECIMAL) AS $$
DECLARE
    coord_pair TEXT;
    coord_array TEXT[];
BEGIN
    -- Si c'est un point simple (lat,lng)
    IF gps_string LIKE '%,%' AND gps_string NOT LIKE '%|%' THEN
        coord_array := string_to_array(gps_string, ',');
        IF array_length(coord_array, 1) = 2 THEN
            lat := coord_array[1]::DECIMAL;
            lng := coord_array[2]::DECIMAL;
            RETURN NEXT;
        END IF;
    -- Si c'est une zone polygonale (lat1,lng1|lat2,lng2|...)
    ELSIF gps_string LIKE '%|%' THEN
        FOR coord_pair IN SELECT unnest(string_to_array(gps_string, '|'))
        LOOP
            coord_array := string_to_array(coord_pair, ',');
            IF array_length(coord_array, 1) = 2 THEN
                lat := coord_array[1]::DECIMAL;
                lng := coord_array[2]::DECIMAL;
                RETURN NEXT;
            END IF;
        END LOOP;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction pour extraire le GPS depuis les données JSON des services
CREATE OR REPLACE FUNCTION extract_gps_from_json(data JSONB) 
RETURNS TABLE(lat DECIMAL, lng DECIMAL) AS $$
DECLARE
    gps_value TEXT;
    gps_fixe TEXT;
    user_gps TEXT;
BEGIN
    -- Essayer gps_fixe en premier
    gps_fixe := data->>'gps_fixe';
    IF gps_fixe IS NOT NULL AND gps_fixe != '' AND gps_fixe != 'false' THEN
        RETURN QUERY SELECT * FROM extract_gps_coordinates(gps_fixe);
        RETURN;
    END IF;
    
    -- Essayer le champ gps standard
    gps_value := data->>'gps';
    IF gps_value IS NOT NULL AND gps_value != '' AND gps_value != 'false' THEN
        RETURN QUERY SELECT * FROM extract_gps_coordinates(gps_value);
        RETURN;
    END IF;
    
    -- Essayer d'autres champs GPS possibles
    gps_value := data->>'location';
    IF gps_value IS NOT NULL AND gps_value != '' AND gps_value != 'false' THEN
        RETURN QUERY SELECT * FROM extract_gps_coordinates(gps_value);
        RETURN;
    END IF;
    
    gps_value := data->>'coordinates';
    IF gps_value IS NOT NULL AND gps_value != '' AND gps_value != 'false' THEN
        RETURN QUERY SELECT * FROM extract_gps_coordinates(gps_value);
        RETURN;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction pour récupérer le GPS d'un utilisateur
CREATE OR REPLACE FUNCTION get_user_gps(user_id INTEGER) 
RETURNS TABLE(lat DECIMAL, lng DECIMAL) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        split_part(u.gps, ',', 1)::DECIMAL as lat,
        split_part(u.gps, ',', 2)::DECIMAL as lng
    FROM users u 
    WHERE u.id = user_id 
    AND u.gps IS NOT NULL 
    AND u.gps != '' 
    AND u.gps != 'false'
    AND u.gps LIKE '%,%';
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- ÉTAPE 3: CRÉER LA FONCTION DE RECHERCHE GPS FINALE
-- =====================================================

-- Fonction de recherche GPS avec fallback automatique
CREATE OR REPLACE FUNCTION fast_gps_search_with_user_fallback(
    user_gps_zone TEXT DEFAULT NULL,
    search_radius_km INTEGER DEFAULT 50,
    max_results INTEGER DEFAULT 20
) RETURNS TABLE (
    service_id INTEGER,
    titre_service TEXT,
    category TEXT,
    gps_coords TEXT,
    distance_km DECIMAL,
    gps_source TEXT
) AS $$
BEGIN
    -- Si pas de zone GPS utilisateur, retourner tous les services
    IF user_gps_zone IS NULL OR user_gps_zone = '' THEN
        RETURN QUERY
        SELECT 
            s.id::INTEGER,
            COALESCE(s.data->>'titre_service', 'Sans titre')::TEXT,
            COALESCE(s.data->>'category', 'Général')::TEXT,
            COALESCE(s.data->>'gps_fixe', s.gps, '')::TEXT,
            0::DECIMAL as distance_km,
            CASE 
                WHEN s.data->>'gps_fixe' IS NOT NULL THEN 'service_gps_fixe'
                WHEN s.gps IS NOT NULL AND s.gps != 'false' THEN 'service_gps_prestataire'
                ELSE 'user_creator_gps'
            END::TEXT as gps_source
        FROM services s
        WHERE s.is_active = true
        ORDER BY s.created_at DESC
        LIMIT max_results;
        RETURN;
    END IF;
    
    -- Recherche avec filtrage GPS
    RETURN QUERY
    SELECT 
        s.id::INTEGER,
        COALESCE(s.data->>'titre_service', 'Sans titre')::TEXT,
        COALESCE(s.data->>'category', 'Général')::TEXT,
        COALESCE(s.data->>'gps_fixe', s.gps, '')::TEXT,
        g.distance_km,
        g.gps_source
    FROM services s
    CROSS JOIN LATERAL (
        SELECT 
            -- Priorité 1: GPS fixe du service
            CASE 
                WHEN s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' AND s.data->>'gps_fixe' != 'false' THEN
                    (SELECT calculate_gps_distance_km(p.lat, p.lng, u.lat, u.lng)
                     FROM extract_gps_coordinates(s.data->>'gps_fixe') p,
                          extract_gps_coordinates(user_gps_zone) u
                     LIMIT 1)
                -- Priorité 2: GPS du prestataire
                WHEN s.gps IS NOT NULL AND s.gps != '' AND s.gps != 'false' THEN
                    (SELECT calculate_gps_distance_km(p.lat, p.lng, u.lat, u.lng)
                     FROM extract_gps_coordinates(s.gps) p,
                          extract_gps_coordinates(user_gps_zone) u
                     LIMIT 1)
                -- Priorité 3: GPS de l'utilisateur créateur (fallback)
                ELSE
                    (SELECT calculate_gps_distance_km(p.lat, p.lng, u.lat, u.lng)
                     FROM get_user_gps(s.user_id) p,
                          extract_gps_coordinates(user_gps_zone) u
                     LIMIT 1)
            END as distance_km,
            CASE 
                WHEN s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' AND s.data->>'gps_fixe' != 'false' THEN 'service_gps_fixe'
                WHEN s.gps IS NOT NULL AND s.gps != '' AND s.gps != 'false' THEN 'service_gps_prestataire'
                ELSE 'user_creator_gps'
            END as gps_source
    ) g
    WHERE s.is_active = true
    AND g.distance_km IS NOT NULL
    AND g.distance_km <= search_radius_km
    ORDER BY g.distance_km ASC, s.created_at DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- Fonction de recherche texte + GPS avec fallback
CREATE OR REPLACE FUNCTION fast_text_gps_search_with_user_fallback(
    search_query TEXT,
    user_gps_zone TEXT DEFAULT NULL,
    search_radius_km INTEGER DEFAULT 50,
    max_results INTEGER DEFAULT 20
) RETURNS TABLE (
    service_id INTEGER,
    titre_service TEXT,
    category TEXT,
    gps_coords TEXT,
    distance_km DECIMAL,
    relevance_score FLOAT,
    gps_source TEXT
) AS $$
BEGIN
    -- Si pas de zone GPS utilisateur, faire une recherche texte pure
    IF user_gps_zone IS NULL OR user_gps_zone = '' THEN
        RETURN QUERY
        SELECT 
            s.id::INTEGER,
            COALESCE(s.data->>'titre_service', 'Sans titre')::TEXT,
            COALESCE(s.data->>'category', 'Général')::TEXT,
            COALESCE(s.data->>'gps_fixe', s.gps, '')::TEXT,
            0::DECIMAL as distance_km,
            CASE 
                WHEN s.data->>'titre_service' ILIKE '%' || search_query || '%' THEN 10.0
                WHEN s.data->>'description' ILIKE '%' || search_query || '%' THEN 8.0
                WHEN s.data->>'category' ILIKE '%' || search_query || '%' THEN 6.0
                ELSE 1.0
            END::FLOAT as relevance_score,
            CASE 
                WHEN s.data->>'gps_fixe' IS NOT NULL THEN 'service_gps_fixe'
                WHEN s.gps IS NOT NULL AND s.gps != 'false' THEN 'service_gps_prestataire'
                ELSE 'user_creator_gps'
            END::TEXT as gps_source
        FROM services s
        WHERE s.is_active = true
        AND (
            s.data->>'titre_service' ILIKE '%' || search_query || '%' OR
            s.data->>'description' ILIKE '%' || search_query || '%' OR
            s.data->>'category' ILIKE '%' || search_query || '%'
        )
        ORDER BY 
            CASE 
                WHEN s.data->>'titre_service' ILIKE '%' || search_query || '%' THEN 10.0
                WHEN s.data->>'description' ILIKE '%' || search_query || '%' THEN 8.0
                WHEN s.data->>'category' ILIKE '%' || search_query || '%' THEN 6.0
                ELSE 1.0
            END DESC,
            s.created_at DESC
        LIMIT max_results;
        RETURN;
    END IF;
    
    -- Recherche texte + GPS avec fallback
    RETURN QUERY
    SELECT 
        s.id::INTEGER,
        COALESCE(s.data->>'titre_service', 'Sans titre')::TEXT,
        COALESCE(s.data->>'category', 'Général')::TEXT,
        COALESCE(s.data->>'gps_fixe', s.gps, '')::TEXT,
        g.distance_km,
        g.relevance_score,
        g.gps_source
    FROM services s
    CROSS JOIN LATERAL (
        SELECT 
            -- Distance GPS
            CASE 
                WHEN s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' AND s.data->>'gps_fixe' != 'false' THEN
                    (SELECT calculate_gps_distance_km(p.lat, p.lng, u.lat, u.lng)
                     FROM extract_gps_coordinates(s.data->>'gps_fixe') p,
                          extract_gps_coordinates(user_gps_zone) u
                     LIMIT 1)
                WHEN s.gps IS NOT NULL AND s.gps != '' AND s.gps != 'false' THEN
                    (SELECT calculate_gps_distance_km(p.lat, p.lng, u.lat, u.lng)
                     FROM extract_gps_coordinates(s.gps) p,
                          extract_gps_coordinates(user_gps_zone) u
                     LIMIT 1)
                ELSE
                    (SELECT calculate_gps_distance_km(p.lat, p.lng, u.lat, u.lng)
                     FROM get_user_gps(s.user_id) p,
                          extract_gps_coordinates(user_gps_zone) u
                     LIMIT 1)
            END as distance_km,
            -- Score de pertinence
            CASE 
                WHEN s.data->>'titre_service' ILIKE '%' || search_query || '%' THEN 10.0
                WHEN s.data->>'description' ILIKE '%' || search_query || '%' THEN 8.0
                WHEN s.data->>'category' ILIKE '%' || search_query || '%' THEN 6.0
                ELSE 1.0
            END::FLOAT as relevance_score,
            -- Source GPS
            CASE 
                WHEN s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' AND s.data->>'gps_fixe' != 'false' THEN 'service_gps_fixe'
                WHEN s.gps IS NOT NULL AND s.gps != '' AND s.gps != 'false' THEN 'service_gps_prestataire'
                ELSE 'user_creator_gps'
            END as gps_source
    ) g
    WHERE s.is_active = true
    AND g.distance_km IS NOT NULL
    AND g.distance_km <= search_radius_km
    AND (
        s.data->>'titre_service' ILIKE '%' || search_query || '%' OR
        s.data->>'description' ILIKE '%' || search_query || '%' OR
        s.data->>'category' ILIKE '%' || search_query || '%'
    )
    ORDER BY 
        (100 - g.distance_km) / 100 * 0.6 + (g.relevance_score / 10) * 0.4 DESC,
        s.created_at DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- Fonction finale unifiée
CREATE OR REPLACE FUNCTION search_services_gps_final(
    search_query TEXT DEFAULT NULL,
    user_gps_zone TEXT DEFAULT NULL,
    search_radius_km INTEGER DEFAULT 50,
    max_results INTEGER DEFAULT 20
) RETURNS TABLE (
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
-- ÉTAPE 4: TESTS DE VALIDATION
-- =====================================================

-- Test 1: Vérifier que la fonction existe
SELECT '=== TEST 1: Vérification existence fonction ===' as test_name;
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'search_services_gps_final';

-- Test 2: Test de recherche GPS pure
SELECT '=== TEST 2: Recherche GPS pure ===' as test_name;
SELECT COUNT(*) as resultats_gps_pure
FROM search_services_gps_final(NULL, '4.05,9.71', 100, 10);

-- Test 3: Test de recherche texte + GPS
SELECT '=== TEST 3: Recherche "restaurant" + GPS ===' as test_name;
SELECT COUNT(*) as resultats_restaurant_gps
FROM search_services_gps_final('restaurant', '4.05,9.71', 100, 10);

-- Test 4: Test avec la zone complexe de l'utilisateur
SELECT '=== TEST 4: Zone complexe utilisateur ===' as test_name;
SELECT COUNT(*) as resultats_zone_complexe
FROM search_services_gps_final(
    'restaurant', 
    '4.3047533357035155,9.412066622450945|3.7759823559244974,9.72655026502907|3.918482733868402,10.139910860732195|4.30338391763405,10.128924532607195|4.328033065299631,9.758135958388445', 
    100, 
    10
);

-- Test 5: Détail des résultats
SELECT '=== TEST 5: Détail des résultats ===' as test_name;
SELECT 
    service_id,
    titre_service,
    category,
    ROUND(distance_km::NUMERIC, 2) as distance_km_rounded,
    gps_source
FROM search_services_gps_final(
    'restaurant', 
    '4.3047533357035155,9.412066622450945|3.7759823559244974,9.72655026502907|3.918482733868402,10.139910860732195|4.30338391763405,10.128924532607195|4.328033065299631,9.758135958388445', 
    100, 
    5
)
ORDER BY distance_km ASC;

-- =====================================================
-- RÉSUMÉ DES CORRECTIONS
-- =====================================================

SELECT '=== RÉSUMÉ DES CORRECTIONS ===' as info;
SELECT 
    'Fonction GPS créée' as fonction,
    'search_services_gps_final' as nom,
    'Recherche unifiée avec fallback automatique' as description
UNION ALL
SELECT 
    'Fallback GPS utilisateur' as fonction,
    'get_user_gps' as nom,
    'Récupération automatique du GPS du créateur' as description
UNION ALL
SELECT 
    'Extraction GPS JSON' as fonction,
    'extract_gps_from_json' as nom,
    'Support des formats GPS complexes' as description
UNION ALL
SELECT 
    'Calcul distance' as fonction,
    'calculate_gps_distance_km' as nom,
    'Formule Haversine optimisée' as description; 