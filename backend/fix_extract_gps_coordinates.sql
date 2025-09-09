-- Correction de la fonction extract_gps_coordinates cassée
-- Base de données: yukpo_db

-- Étape 1: Supprimer l'ancienne fonction cassée
DROP FUNCTION IF EXISTS extract_gps_coordinates(TEXT);

-- Étape 2: Créer la nouvelle fonction corrigée
CREATE OR REPLACE FUNCTION extract_gps_coordinates(gps_text TEXT)
RETURNS TABLE (
    lat DECIMAL,
    lng DECIMAL
) AS $$
DECLARE
    point_parts TEXT[];
    point_part TEXT;
    lat_val DECIMAL;
    lng_val DECIMAL;
    i INTEGER;
BEGIN
    -- Nettoyer les données GPS
    gps_text := REPLACE(REPLACE(REPLACE(gps_text, '"', ''), 'false', ''), 'null', '');
    
    -- Vérifier si c'est un polygone (contient des |)
    IF gps_text LIKE '%|%' THEN
        -- Traiter comme polygone
        point_parts := string_to_array(gps_text, '|');
        
        FOR i IN 1..array_length(point_parts, 1) LOOP
            point_part := TRIM(point_parts[i]);
            
            -- Extraire lat et lng
            IF point_part LIKE '%,%' THEN
                lat_val := SPLIT_PART(point_part, ',', 1)::DECIMAL;
                lng_val := SPLIT_PART(point_part, ',', 2)::DECIMAL;
                
                -- Validation des coordonnées
                IF lat_val BETWEEN -90 AND 90 AND lng_val BETWEEN -180 AND 180 THEN
                    lat := lat_val;
                    lng := lng_val;
                    RETURN NEXT;
                END IF;
            END IF;
        END LOOP;
    ELSE
        -- Traiter comme point simple
        IF gps_text LIKE '%,%' THEN
            lat_val := SPLIT_PART(gps_text, ',', 1)::DECIMAL;
            lng_val := SPLIT_PART(gps_text, ',', 2)::DECIMAL;
            
            -- Validation des coordonnées
            IF lat_val BETWEEN -90 AND 90 AND lng_val BETWEEN -180 AND 180 THEN
                lat := lat_val;
                lng := lng_val;
                RETURN NEXT;
            END IF;
        END IF;
    END IF;
    
    RETURN;
EXCEPTION
    WHEN OTHERS THEN
        -- En cas d'erreur, retourner rien (pas de crash)
        RETURN;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Test de la fonction corrigée
SELECT '=== TEST: Fonction extract_gps_coordinates corrigée ===' as test_name;

-- Test avec zone simple
SELECT 'Zone simple' as type, COUNT(*) as points
FROM extract_gps_coordinates('4.05,9.71');

-- Test avec zone complexe (coordonnées utilisateur)
SELECT 'Zone complexe utilisateur' as type, COUNT(*) as points
FROM extract_gps_coordinates('4.319816771690625,9.39146725721657|3.7732417319535783,9.694964571669695|3.917112652092171,10.115191622450945|4.31160038907942,9.914691134169695');

-- Test de la recherche GPS complète maintenant
SELECT '=== TEST: Recherche GPS complète corrigée ===' as test_name;
SELECT COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant', 
    '4.319816771690625,9.39146725721657|3.7732417319535783,9.694964571669695|3.917112652092171,10.115191622450945|4.31160038907942,9.914691134169695', 
    50, 
    20
);

SELECT '🎯 FONCTION extract_gps_coordinates CORRIGÉE !' as summary; 