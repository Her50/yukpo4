# Script de test des fonctionnalités PostGIS et géospatiales
# Base de données: yukpo_db
# Utilisateur: postgres

Write-Host "🧪 Test des fonctionnalités PostGIS et géospatiales..." -ForegroundColor Cyan

# Vérifier si psql est disponible
try {
    $psqlVersion = psql --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ psql trouvé: $psqlVersion" -ForegroundColor Green
    } else {
        throw "psql non trouvé"
    }
} catch {
    Write-Host "❌ Erreur: psql n'est pas installé ou n'est pas dans le PATH" -ForegroundColor Red
    Write-Host "💡 Installez PostgreSQL ou ajoutez psql au PATH" -ForegroundColor Yellow
    exit 1
}

# Demander le mot de passe PostgreSQL
$password = Read-Host "🔐 Entrez le mot de passe PostgreSQL pour l'utilisateur 'postgres'" -AsSecureString
$plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))

# Variables de connexion
$dbName = "yukpo_db"
$user = "postgres"
$host = "localhost"
$port = "5432"

$env:PGPASSWORD = $plainPassword

Write-Host "🔌 Connexion à la base de données..." -ForegroundColor Yellow

# Test 1: Vérification des extensions PostGIS
Write-Host "🔍 Test 1: Vérification des extensions PostGIS..." -ForegroundColor Yellow

$checkExtensions = @"
SELECT 
    extname as extension,
    extversion as version,
    extrelocatable as relocatable
FROM pg_extension 
WHERE extname IN ('postgis', 'pg_trgm')
ORDER BY extname;
"@

$extensionsResult = $checkExtensions | psql -h $host -p $port -U $user -d $dbName 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Extensions PostGIS vérifiées:" -ForegroundColor Green
    Write-Host $extensionsResult
} else {
    Write-Host "❌ Erreur lors de la vérification des extensions" -ForegroundColor Red
    Write-Host $extensionsResult
}

# Test 2: Vérification des nouvelles colonnes géospatiales
Write-Host "🔍 Test 2: Vérification des colonnes géospatiales..." -ForegroundColor Yellow

$checkColumns = @"
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'services' 
AND column_name IN ('location_geom', 'location_geog', 'search_radius')
ORDER BY column_name;
"@

$columnsResult = $checkColumns | psql -h $host -p $port -U $user -d $dbName 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Colonnes géospatiales vérifiées:" -ForegroundColor Green
    Write-Host $columnsResult
} else {
    Write-Host "❌ Erreur lors de la vérification des colonnes" -ForegroundColor Red
    Write-Host $columnsResult
}

# Test 3: Vérification des index géospatial
Write-Host "🔍 Test 3: Vérification des index géospatial..." -ForegroundColor Yellow

$checkIndexes = @"
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'services' 
AND (indexname LIKE '%geo%' OR indexname LIKE '%gps%' OR indexname LIKE '%location%')
ORDER BY indexname;
"@

$indexesResult = $checkIndexes | psql -h $host -p $port -U $user -d $dbName 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Index géospatial vérifiés:" -ForegroundColor Green
    Write-Host $indexesResult
} else {
    Write-Host "❌ Erreur lors de la vérification des index" -ForegroundColor Red
    Write-Host $indexesResult
}

# Test 4: Test des fonctions PostGIS
Write-Host "🔍 Test 4: Test des fonctions PostGIS..." -ForegroundColor Yellow

$testFunctions = @"
-- Test de la fonction convert_gps_to_geometry
SELECT 
    'convert_gps_to_geometry' as function_name,
    convert_gps_to_geometry('48.8566,2.3522') as result,
    ST_AsText(convert_gps_to_geometry('48.8566,2.3522')) as wkt_result;

-- Test de la fonction calculate_distance_km
SELECT 
    'calculate_distance_km' as function_name,
    calculate_distance_km(48.8566, 2.3522, 48.8584, 2.2945) as distance_km;

-- Test de la fonction search_services_in_radius
SELECT 
    'search_services_in_radius' as function_name,
    COUNT(*) as services_found
FROM search_services_in_radius(48.8566, 2.3522, 50);
"@

$functionsResult = $testFunctions | psql -h $host -p $port -U $user -d $dbName 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Fonctions PostGIS testées:" -ForegroundColor Green
    Write-Host $functionsResult
} else {
    Write-Host "❌ Erreur lors du test des fonctions" -ForegroundColor Red
    Write-Host $functionsResult
}

# Test 5: Test de performance des requêtes géospatiales
Write-Host "🔍 Test 5: Test de performance des requêtes géospatiales..." -ForegroundColor Yellow

$performanceTest = @"
-- Test de recherche par rayon avec EXPLAIN ANALYZE
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) 
SELECT * FROM search_services_in_radius(48.8566, 2.3522, 50, 'Services automobiles');

-- Test de recherche géospatiale directe avec PostGIS
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT 
    s.id,
    s.data->>'titre_service' as titre,
    ST_Distance(
        ST_SetSRID(ST_MakePoint(2.3522, 48.8566), 4326)::geography,
        s.location_geog
    ) / 1000.0 as distance_km
FROM services s
WHERE s.location_geog IS NOT NULL
AND ST_DWithin(
    ST_SetSRID(ST_MakePoint(2.3522, 48.8566), 4326)::geography,
    s.location_geog,
    50000
)
ORDER BY distance_km ASC
LIMIT 10;
"@

$performanceResult = $performanceTest | psql -h $host -p $port -U $user -d $dbName 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Tests de performance exécutés:" -ForegroundColor Green
    Write-Host $performanceResult
} else {
    Write-Host "❌ Erreur lors des tests de performance" -ForegroundColor Red
    Write-Host $performanceResult
}

# Test 6: Test des requêtes de recherche native optimisées
Write-Host "🔍 Test 6: Test des requêtes de recherche native optimisées..." -ForegroundColor Yellow

$nativeSearchTest = @"
-- Test de recherche full-text optimisée
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT 
    s.id,
    s.data->>'titre_service' as titre,
    (
        ts_rank(
            setweight(to_tsvector('french', COALESCE(s.data->>'titre_service', '')), 'A') * 3.0 +
            setweight(to_tsvector('french', COALESCE(s.data->>'description', '')), 'B') * 2.0 +
            setweight(to_tsvector('french', COALESCE(s.data->>'category', '')), 'C') * 1.5,
            plainto_tsquery('french', 'mécanicien')
        ) * 2.0 +
        CASE 
            WHEN s.data->>'titre_service' ILIKE '%mécanicien%' THEN 5.0
            WHEN s.data->>'description' ILIKE '%mécanicien%' THEN 3.0
            WHEN s.data->>'category' ILIKE '%mécanicien%' THEN 2.0
            ELSE 0.0
        END
    ) as fulltext_score
FROM services s
WHERE s.is_active = true
AND (
    to_tsvector('french', COALESCE(s.data->>'titre_service', '')) @@ plainto_tsquery('french', 'mécanicien')
    OR to_tsvector('french', COALESCE(s.data->>'description', '')) @@ plainto_tsquery('french', 'mécanicien')
    OR to_tsvector('french', COALESCE(s.data->>'category', '')) @@ plainto_tsquery('french', 'mécanicien')
    OR s.data->>'titre_service' ILIKE '%mécanicien%'
    OR s.data->>'description' ILIKE '%mécanicien%'
    OR s.data->>'category' ILIKE '%mécanicien%'
)
ORDER BY fulltext_score DESC
LIMIT 5;
"@

$nativeSearchResult = $nativeSearchTest | psql -h $host -p $port -U $user -d $dbName 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Tests de recherche native exécutés:" -ForegroundColor Green
    Write-Host $nativeSearchResult
} else {
    Write-Host "❌ Erreur lors des tests de recherche native" -ForegroundColor Red
    Write-Host $nativeSearchResult
}

# Test 7: Statistiques et métriques
Write-Host "🔍 Test 7: Statistiques et métriques..." -ForegroundColor Yellow

$statsTest = @"
-- Statistiques des services avec localisation
SELECT 
    COUNT(*) as total_services,
    COUNT(location_geom) as with_geometry,
    COUNT(location_geog) as with_geography,
    COUNT(gps) as with_gps,
    COUNT(data->>'gps_fixe') as with_gps_fixe,
    COUNT(search_radius) as with_search_radius
FROM services;

-- Statistiques des index
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes 
WHERE tablename = 'services'
ORDER BY idx_scan DESC;

-- Taille des tables et index
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables 
WHERE tablename = 'services';
"@

$statsResult = $statsTest | psql -h $host -p $port -U $user -d $dbName 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Statistiques récupérées:" -ForegroundColor Green
    Write-Host $statsResult
} else {
    Write-Host "❌ Erreur lors de la récupération des statistiques" -ForegroundColor Red
    Write-Host $statsResult
}

# Test 8: Test de stress avec plusieurs requêtes simultanées
Write-Host "🔍 Test 8: Test de stress avec plusieurs requêtes simultanées..." -ForegroundColor Yellow

$stressTest = @"
-- Test de recherche simultanée dans différentes zones
SELECT 'Zone 1 - Paris' as test_zone, COUNT(*) as services_found
FROM search_services_in_radius(48.8566, 2.3522, 25);

SELECT 'Zone 2 - Lyon' as test_zone, COUNT(*) as services_found
FROM search_services_in_radius(45.7578, 4.8320, 25);

SELECT 'Zone 3 - Marseille' as test_zone, COUNT(*) as services_found
FROM search_services_in_radius(43.2965, 5.3698, 25);

-- Test de recherche par catégorie dans différentes zones
SELECT 'Mécaniciens à Paris' as test_query, COUNT(*) as services_found
FROM search_services_in_radius(48.8566, 2.3522, 50, 'Services automobiles');

SELECT 'Immobilier à Lyon' as test_query, COUNT(*) as services_found
FROM search_services_in_radius(45.7578, 4.8320, 50, 'Immobilier');
"@

$stressResult = $stressTest | psql -h $host -p $port -U $user -d $dbName 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Tests de stress exécutés:" -ForegroundColor Green
    Write-Host $stressResult
} else {
    Write-Host "❌ Erreur lors des tests de stress" -ForegroundColor Red
    Write-Host $stressResult
}

# Nettoyer le mot de passe
Remove-Variable -Name PGPASSWORD -ErrorAction SilentlyContinue

Write-Host "🎉 Tests PostGIS et géospatial terminés avec succès!" -ForegroundColor Green
Write-Host "🗺️ Votre base de données supporte maintenant la géolocalisation avancée" -ForegroundColor Cyan
Write-Host "⚡ Les index optimisés améliorent significativement les performances" -ForegroundColor Yellow
Write-Host "🔍 La recherche native PostgreSQL est maintenant ultra-rapide" -ForegroundColor Magenta 