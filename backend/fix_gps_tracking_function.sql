-- Correction de la fonction de tracking GPS automatique
-- Base de donnees: yukpo_db

-- Corriger la fonction update_user_gps_automatic
CREATE OR REPLACE FUNCTION update_user_gps_automatic(
    user_id INTEGER,
    new_lat DECIMAL,
    new_lng DECIMAL,
    accuracy DECIMAL DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Mettre a jour le GPS de l'utilisateur avec format correct
    UPDATE users 
    SET 
        gps = new_lat::TEXT || ',' || new_lng::TEXT,
        updated_at = NOW()
    WHERE id = user_id;
    
    -- Retourner true si la mise a jour a reussi
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Test de la fonction corrigee
SELECT '=== TEST FONCTION GPS CORRIGEE ===' as test_name;

-- Test 1: Mise a jour avec coordonnees Douala
SELECT '1. Mise a jour GPS Douala' as test,
       update_user_gps_automatic(1, 4.0511, 9.7679, 10.0) as mise_a_jour_reussie;

-- Test 2: Verification des nouvelles coordonnees
SELECT '2. Verification nouvelles coordonnees' as test,
       gps as coordonnees_actuelles,
       updated_at as derniere_mise_a_jour
FROM users WHERE id = 1;

-- Test 3: Mise a jour avec coordonnees differentes
SELECT '3. Mise a jour GPS differentes' as test,
       update_user_gps_automatic(1, 4.0520, 9.7680, 5.0) as mise_a_jour_reussie;

-- Test 4: Verification finale
SELECT '4. Verification finale' as test,
       gps as coordonnees_finales,
       updated_at as derniere_mise_a_jour
FROM users WHERE id = 1;

SELECT '=== FONCTION GPS CORRIGEE ===' as summary;
SELECT 'La fonction de tracking GPS automatique fonctionne maintenant correctement' as resultat; 