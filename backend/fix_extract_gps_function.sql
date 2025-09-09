-- Correction de la fonction extract_gps_from_json
-- Base de donnees: yukpo_db
-- Problème: La fonction ne gère pas le format JSON complexe des services

SELECT '=== CORRECTION FONCTION EXTRACT_GPS_FROM_JSON ===' as test_name;

-- =====================================================
-- ÉTAPE 1: ANALYSER LE PROBLÈME
-- =====================================================

SELECT '--- ÉTAPE 1: Analyse du problème ---' as etape;

-- Vérifier comment les données GPS sont stockées
SELECT '1.1. Exemples de données GPS dans data' as test;
SELECT 
    id,
    data->>'titre_service' as titre,
    data->'gps_fixe' as gps_fixe_json,
    data->>'gps_fixe' as gps_fixe_text,
    gps as gps_prestataire
FROM services 
WHERE (data->>'gps_fixe' IS NOT NULL AND data->>'gps_fixe' != '' AND data->>'gps_fixe' != 'false')
   OR (gps IS NOT NULL AND gps != '' AND gps != 'false')
LIMIT 5;

-- =====================================================
-- ÉTAPE 2: CRÉER UNE FONCTION EXTRACT_GPS CORRIGÉE
-- =====================================================

SELECT '--- ÉTAPE 2: Création fonction extract_gps corrigée ---' as etape;

-- Supprimer l'ancienne fonction si elle existe
DROP FUNCTION IF EXISTS extract_gps_from_json(JSONB);

-- Créer une nouvelle fonction qui gère le format JSON complexe
CREATE OR REPLACE FUNCTION extract_gps_from_json(data JSONB) 
RETURNS TABLE(lat DECIMAL, lng DECIMAL) AS $$
DECLARE
    gps_value TEXT;
    gps_fixe_value TEXT;
    gps_mobile_value TEXT;
    gps_coords TEXT;
BEGIN
    -- Essayer gps_fixe en premier (format JSON complexe)
    gps_fixe_value := data->>'gps_fixe';
    IF gps_fixe_value IS NOT NULL AND gps_fixe_value != '' AND gps_fixe_value != 'false' THEN
        -- Si c'est un objet JSON avec "valeur"
        IF gps_fixe_value LIKE '{"valeur":%' THEN
            gps_coords := data->'gps_fixe'->>'valeur';
        ELSE
            gps_coords := gps_fixe_value;
        END IF;
        
        IF gps_coords IS NOT NULL AND gps_coords != '' AND gps_coords != 'false' THEN
            RETURN QUERY SELECT * FROM extract_gps_coordinates(gps_coords);
            RETURN;
        END IF;
    END IF;
    
    -- Essayer gps_mobile
    gps_mobile_value := data->>'gps_mobile';
    IF gps_mobile_value IS NOT NULL AND gps_mobile_value != '' AND gps_mobile_value != 'false' THEN
        -- Si c'est un objet JSON avec "valeur"
        IF gps_mobile_value LIKE '{"valeur":%' THEN
            gps_coords := data->'gps_mobile'->>'valeur';
        ELSE
            gps_coords := gps_mobile_value;
        END IF;
        
        IF gps_coords IS NOT NULL AND gps_coords != '' AND gps_coords != 'false' THEN
            RETURN QUERY SELECT * FROM extract_gps_coordinates(gps_coords);
            RETURN;
        END IF;
    END IF;
    
    -- Essayer d'autres champs GPS possibles
    gps_value := data->>'gps';
    IF gps_value IS NOT NULL AND gps_value != '' AND gps_value != 'false' THEN
        RETURN QUERY SELECT * FROM extract_gps_coordinates(gps_value);
        RETURN;
    END IF;
    
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
    
    gps_value := data->>'localisation';
    IF gps_value IS NOT NULL AND gps_value != '' AND gps_value != 'false' THEN
        RETURN QUERY SELECT * FROM extract_gps_coordinates(gps_value);
        RETURN;
    END IF;
    
    gps_value := data->>'zone_intervention';
    IF gps_value IS NOT NULL AND gps_value != '' AND gps_value != 'false' THEN
        RETURN QUERY SELECT * FROM extract_gps_coordinates(gps_value);
        RETURN;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- ÉTAPE 3: TESTER LA FONCTION CORRIGÉE
-- =====================================================

SELECT '--- ÉTAPE 3: Test de la fonction corrigée ---' as etape;

-- Test 1: Tester avec un service existant
SELECT '3.1. Test avec service existant' as test;
SELECT 
    id,
    data->>'titre_service' as titre,
    extract_gps_from_json(data) as gps_extrait
FROM services 
WHERE data->>'gps_fixe' IS NOT NULL 
AND data->>'gps_fixe' != '' 
AND data->>'gps_fixe' != 'false'
LIMIT 3;

-- Test 2: Tester avec différents formats GPS
SELECT '3.2. Test avec différents formats GPS' as test;
SELECT 
    'Format JSON complexe' as format,
    COUNT(*) as services_trouves
FROM services 
WHERE extract_gps_from_json(data) IS NOT NULL
UNION ALL
SELECT 
    'Format GPS simple' as format,
    COUNT(*) as services_trouves
FROM services 
WHERE gps IS NOT NULL 
AND gps != '' 
AND gps != 'false';

-- =====================================================
-- ÉTAPE 4: RECRÉER LES FONCTIONS GPS AVEC LA CORRECTION
-- =====================================================

SELECT '--- ÉTAPE 4: Recréation des fonctions GPS avec la correction ---' as etape;

-- Recréer la fonction fast_gps_search_with_user_fallback
DROP FUNCTION IF EXISTS fast_gps_search_with_user_fallback(TEXT, INTEGER, INTEGER);

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
                     FROM extract_gps_from_json(s.data) p,
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

-- Recréer la fonction search_services_gps_final
DROP FUNCTION IF EXISTS search_services_gps_final(TEXT, TEXT, INTEGER, INTEGER);

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
-- ÉTAPE 5: TEST FINAL DE LA CORRECTION
-- =====================================================

SELECT '--- ÉTAPE 5: Test final de la correction ---' as etape;

-- Test 1: Recherche GPS pure avec point simple
SELECT '5.1. Test recherche GPS pure (point simple)' as test;
SELECT COUNT(*) as resultats_gps_pure
FROM search_services_gps_final(NULL, '4.05,9.71', 100, 10);

-- Test 2: Recherche "restaurant" + GPS point simple
SELECT '5.2. Test recherche "restaurant" + GPS (point simple)' as test;
SELECT COUNT(*) as resultats_restaurant_gps
FROM search_services_gps_final('restaurant', '4.05,9.71', 100, 10);

-- Test 3: Détail des résultats avec point simple
SELECT '5.3. Détail résultats (point simple)' as test;
SELECT 
    service_id,
    titre_service,
    category,
    gps_coords,
    ROUND(distance_km::NUMERIC, 2) as distance_km_rounded,
    gps_source
FROM search_services_gps_final('restaurant', '4.05,9.71', 100, 5)
ORDER BY distance_km ASC;

-- Test 4: Recherche avec zone polygonale
SELECT '5.4. Test recherche zone polygonale' as test;
SELECT COUNT(*) as resultats_zone_polygonale
FROM search_services_gps_final(
    'restaurant', 
    '4.3047533357035155,9.412066622450945|3.7759823559244974,9.72655026502907|3.918482733868402,10.139910860732195|4.30338391763405,10.128924532607195|4.328033065299631,9.758135958388445', 
    100, 
    10
);

-- =====================================================
-- RÉSUMÉ FINAL
-- =====================================================

SELECT '--- RÉSUMÉ FINAL DE LA CORRECTION ---' as etape;

-- Validation finale
SELECT 'VALIDATION FINALE APRÈS CORRECTION' as test;
SELECT 
    'Point simple (4.05,9.71)' as test_type,
    CASE 
        WHEN (SELECT COUNT(*) FROM search_services_gps_final('restaurant', '4.05,9.71', 100, 10)) > 0 
        THEN 'SUCCÈS - Résultats trouvés' 
        ELSE 'ÉCHEC - 0 résultats' 
    END as resultat
UNION ALL
SELECT 
    'Zone polygonale (5 points)' as test_type,
    CASE 
        WHEN (SELECT COUNT(*) FROM search_services_gps_final('restaurant', '4.3047533357035155,9.412066622450945|3.7759823559244974,9.72655026502907|3.918482733868402,10.139910860732195|4.30338391763405,10.128924532607195|4.328033065299631,9.758135958388445', 100, 10)) > 0 
        THEN 'SUCCÈS - Résultats trouvés' 
        ELSE 'ÉCHEC - 0 résultats' 
    END as resultat;

SELECT '=== FIN DE LA CORRECTION ===' as fin_test; 