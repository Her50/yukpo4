-- Correction finale GPS - Suppression et recréation de la fonction
-- Base de données: yukpo_db

-- Étape 1: Supprimer l'ancienne fonction
DROP FUNCTION IF EXISTS extract_gps_from_json(TEXT);

-- Étape 2: Créer la nouvelle fonction GPS universelle
CREATE OR REPLACE FUNCTION extract_gps_from_json(gps_data TEXT)
RETURNS TABLE (
    lat DECIMAL,
    lng DECIMAL
) AS $$
DECLARE
    gps_text TEXT;
    point_parts TEXT[];
    point_part TEXT;
    lat_val DECIMAL;
    lng_val DECIMAL;
    i INTEGER;
BEGIN
    -- Nettoyer les données GPS
    gps_text := REPLACE(REPLACE(REPLACE(gps_data, '"', ''), 'false', ''), 'null', '');
    
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
SELECT '=== TEST: Fonction GPS universelle créée ===' as test_name;

-- Test avec zone simple
SELECT 'Zone simple' as type, COUNT(*) as points
FROM extract_gps_from_json('4.0511,9.7679');

-- Test avec zone complexe (coordonnées utilisateur)
SELECT 'Zone complexe utilisateur' as type, COUNT(*) as points
FROM extract_gps_from_json('4.318447380764929,9.39421383924782|3.900671496020994,9.513690157607195|3.7663901342151913,9.78972165174782|4.029451836036109,10.17424313612282|4.317077987367724,9.88585202284157');

-- Test de la recherche GPS complète
SELECT '=== TEST: Recherche GPS complète ===' as test_name;
SELECT COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant', 
    '4.318447380764929,9.39421383924782|3.900671496020994,9.513690157607195|3.7663901342151913,9.78972165174782|4.029451836036109,10.17424313612282|4.317077987367724,9.88585202284157', 
    50, 
    20
);

SELECT '🎯 CORRECTION GPS FINALE APPLIQUÉE !' as summary; 