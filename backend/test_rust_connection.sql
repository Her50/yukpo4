-- Test simple de connexion et paramètres
SELECT '=== TEST: Connexion et paramètres ===' as test_name;

-- Test 1: Vérifier la version de PostgreSQL
SELECT version() as postgres_version;

-- Test 2: Vérifier la base de données actuelle
SELECT current_database() as current_db;

-- Test 3: Vérifier l'utilisateur actuel
SELECT current_user as current_user;

-- Test 4: Test simple avec les paramètres exacts du backend
SELECT 'Test paramètres exacts backend' as type, COUNT(*) as resultats
FROM search_services_gps_final(
    'restaurant', 
    '4.319816771690625,9.39146725721657|3.7732417319535783,9.694964571669695|3.917112652092171,10.115191622450945|4.31160038907942,9.914691134169695', 
    50, 
    20
);

-- Test 5: Vérifier que la fonction retourne bien des colonnes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'search_services_gps_final' 
ORDER BY ordinal_position; 