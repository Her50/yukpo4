-- Test de débogage des paramètres GPS
-- Test 1: Avec les guillemets exacts du backend
SELECT 'Test 1: GPS avec guillemets échappés' as test_type;
SELECT search_services_gps_final(
    'restaurant', 
    '"4.318447380764929,9.39421383924782|3.900671496020994,9.513690157607195|3.7663901342151913,9.78972165174782|4.029451836036109,10.17424313612282|4.317077987367724,9.88585202284157"', 
    50, 
    20
);

-- Test 2: Sans guillemets (comme dans les logs)
SELECT 'Test 2: GPS sans guillemets' as test_type;
SELECT search_services_gps_final(
    'restaurant', 
    '4.318447380764929,9.39421383924782|3.900671496020994,9.513690157607195|3.7663901342151913,9.78972165174782|4.029451836036109,10.17424313612282|4.317077987367724,9.88585202284157', 
    50, 
    20
);

-- Test 3: Vérification de la fonction extract_gps_from_json
SELECT 'Test 3: Test extract_gps_from_json' as test_type;
SELECT * FROM extract_gps_from_json('4.318447380764929,9.39421383924782|3.900671496020994,9.513690157607195|3.7663901342151913,9.78972165174782|4.029451836036109,10.17424313612282|4.317077987367724,9.88585202284157'); 