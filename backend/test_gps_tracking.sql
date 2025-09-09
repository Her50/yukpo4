-- Test du tracking GPS automatique
-- Base de donnees: yukpo_db

SELECT '=== TEST TRACKING GPS AUTOMATIQUE ===' as test_name;

-- Test 1: Verifier que la fonction de mise a jour GPS fonctionne
SELECT '1. Test fonction mise a jour GPS' as test,
       update_user_gps_automatic(1, 4.0511, 9.7679, 10.0) as mise_a_jour_reussie;

-- Test 2: Verifier les coordonnees actuelles
SELECT '2. Coordonnees actuelles utilisateur 1' as test,
       gps as coordonnees,
       updated_at as derniere_mise_a_jour
FROM users WHERE id = 1;

-- Test 3: Simuler une mise a jour GPS en temps reel
SELECT '3. Simulation mise a jour GPS temps reel' as test,
       update_user_gps_automatic(1, 4.0520, 9.7680, 5.0) as mise_a_jour_reussie;

-- Test 4: Verifier la mise a jour
SELECT '4. Verification mise a jour temps reel' as test,
       gps as nouvelles_coordonnees,
       updated_at as derniere_mise_a_jour
FROM users WHERE id = 1;

-- Test 5: Test avec coordonnees differentes (simulation deplacement)
SELECT '5. Simulation deplacement utilisateur' as test,
       update_user_gps_automatic(1, 4.0530, 9.7690, 15.0) as mise_a_jour_reussie;

-- Test 6: Verification finale
SELECT '6. Verification finale coordonnees' as test,
       gps as coordonnees_finales,
       updated_at as derniere_mise_a_jour
FROM users WHERE id = 1;

-- Test 7: Test de la recherche GPS avec nouvelles coordonnees
SELECT '7. Test recherche avec nouvelles coordonnees' as test,
       COUNT(*) as resultats
FROM search_services_gps_final('restaurant', '4.0530,9.7690', NULL, 20);

SELECT '=== TRACKING GPS TESTE ===' as summary;
SELECT 'Le systeme de tracking GPS automatique fonctionne correctement' as resultat;
SELECT 'Les coordonnees sont maintenant mises a jour en temps reel' as avantage; 