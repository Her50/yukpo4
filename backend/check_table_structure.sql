-- Vérification de la structure de la table services
-- Base de donnees: yukpo_db

SELECT '=== VÉRIFICATION STRUCTURE TABLE SERVICES ===' as test_name;

-- 1. Vérifier les colonnes de la table services
SELECT '1. Colonnes de la table services' as etape;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'services' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Vérifier les contraintes
SELECT '2. Contraintes de la table services' as etape;
SELECT 
    constraint_name,
    constraint_type,
    table_name
FROM information_schema.table_constraints 
WHERE table_name = 'services' 
AND table_schema = 'public';

-- 3. Vérifier les index
SELECT '3. Index de la table services' as etape;
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'services';

-- 4. Vérifier un exemple de données
SELECT '4. Exemple de données dans services' as etape;
SELECT 
    id,
    user_id,
    data,
    gps,
    is_active,
    created_at
FROM services 
LIMIT 3;

-- 5. Vérifier la structure du champ data (JSON)
SELECT '5. Structure du champ data (JSON)' as etape;
SELECT 
    id,
    data->>'titre_service' as titre_service,
    data->>'description' as description,
    data->>'category' as category,
    data->>'gps_fixe' as gps_fixe,
    gps
FROM services 
WHERE data IS NOT NULL
LIMIT 5;

-- 6. Vérifier les types de données dans le champ data
SELECT '6. Types de données dans le champ data' as etape;
SELECT DISTINCT
    jsonb_typeof(data) as type_data,
    COUNT(*) as nombre
FROM services 
WHERE data IS NOT NULL
GROUP BY jsonb_typeof(data);

-- 7. Vérifier les clés disponibles dans le champ data
SELECT '7. Clés disponibles dans le champ data' as etape;
SELECT DISTINCT
    jsonb_object_keys(data) as cle_json
FROM services 
WHERE data IS NOT NULL
ORDER BY cle_json;

SELECT '=== FIN DE LA VÉRIFICATION ===' as fin_test; 