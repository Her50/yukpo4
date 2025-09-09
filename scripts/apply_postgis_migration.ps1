# Script pour appliquer la migration PostGIS
# Base de données: yukpo_db
# Utilisateur: postgres

Write-Host "🗺️ Application de la migration PostGIS..." -ForegroundColor Cyan

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

Write-Host "🔌 Connexion à la base de données..." -ForegroundColor Yellow

# Tester la connexion
$testConnection = "psql -h $host -p $port -U $user -d $dbName -c 'SELECT version();'"
$env:PGPASSWORD = $plainPassword

try {
    $result = Invoke-Expression $testConnection 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Connexion réussie à $dbName" -ForegroundColor Green
    } else {
        throw "Échec de la connexion"
    }
} catch {
    Write-Host "❌ Erreur de connexion à la base de données" -ForegroundColor Red
    Write-Host "💡 Vérifiez que PostgreSQL est démarré et que les paramètres sont corrects" -ForegroundColor Yellow
    exit 1
}

# Vérifier la structure actuelle de la table services
Write-Host "📋 Vérification de la structure de la table services..." -ForegroundColor Yellow

$checkStructure = @"
\dt services;
\d services;
"@

$env:PGPASSWORD = $plainPassword
$structureResult = $checkStructure | psql -h $host -p $port -U $user -d $dbName

Write-Host "📊 Structure actuelle de la table services:" -ForegroundColor Cyan
Write-Host $structureResult

# Vérifier les extensions existantes
Write-Host "🔍 Vérification des extensions PostgreSQL..." -ForegroundColor Yellow

$checkExtensions = @"
SELECT extname, extversion 
FROM pg_extension 
WHERE extname IN ('postgis', 'pg_trgm');
"@

$env:PGPASSWORD = $plainPassword
$extensionsResult = $checkExtensions | psql -h $host -p $port -U $user -d $dbName

Write-Host "📦 Extensions disponibles:" -ForegroundColor Cyan
Write-Host $extensionsResult

# Appliquer la migration PostGIS
Write-Host "🚀 Application de la migration PostGIS..." -ForegroundColor Cyan

$migrationFile = "..\backend\migrations\20250830_002_add_postgis_geospatial.sql"

if (Test-Path $migrationFile) {
    Write-Host "📁 Fichier de migration trouvé: $migrationFile" -ForegroundColor Green
    
    $env:PGPASSWORD = $plainPassword
    $migrationResult = Get-Content $migrationFile | psql -h $host -p $port -U $user -d $dbName 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migration PostGIS appliquée avec succès!" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur lors de l'application de la migration" -ForegroundColor Red
        Write-Host "📋 Détails de l'erreur:" -ForegroundColor Yellow
        Write-Host $migrationResult
        exit 1
    }
} else {
    Write-Host "❌ Fichier de migration non trouvé: $migrationFile" -ForegroundColor Red
    exit 1
}

# Vérifier les nouvelles colonnes et index
Write-Host "🔍 Vérification des nouvelles colonnes géospatiales..." -ForegroundColor Yellow

$checkNewColumns = @"
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'services' 
AND column_name IN ('location_geom', 'location_geog', 'search_radius')
ORDER BY column_name;
"@

$env:PGPASSWORD = $plainPassword
$newColumnsResult = $checkNewColumns | psql -h $host -p $port -U $user -d $dbName

Write-Host "📊 Nouvelles colonnes géospatiales:" -ForegroundColor Cyan
Write-Host $newColumnsResult

# Vérifier les nouveaux index
Write-Host "🔍 Vérification des nouveaux index géospatial..." -ForegroundColor Yellow

$checkNewIndexes = @"
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'services' 
AND (indexname LIKE '%geo%' OR indexname LIKE '%gps%' OR indexname LIKE '%location%')
ORDER BY indexname;
"@

$env:PGPASSWORD = $plainPassword
$newIndexesResult = $checkNewIndexes | psql -h $host -p $port -U $user -d $dbName

Write-Host "📊 Nouveaux index géospatial:" -ForegroundColor Cyan
Write-Host $newIndexesResult

# Vérifier les fonctions PostGIS
Write-Host "🔍 Vérification des fonctions PostGIS..." -ForegroundColor Yellow

$checkFunctions = @"
SELECT 
    proname as function_name,
    prosrc as function_source
FROM pg_proc 
WHERE proname IN ('convert_gps_to_geometry', 'calculate_distance_km', 'search_services_in_radius')
ORDER BY proname;
"@

$env:PGPASSWORD = $plainPassword
$functionsResult = $checkFunctions | psql -h $host -p $port -U $user -d $dbName

Write-Host "🔧 Fonctions PostGIS créées:" -ForegroundColor Cyan
Write-Host $functionsResult

# Test de performance avec EXPLAIN
Write-Host "⚡ Test de performance des requêtes géospatiales..." -ForegroundColor Yellow

$performanceTest = @"
-- Test de recherche par rayon
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM search_services_in_radius(48.8566, 2.3522, 50, 'Services automobiles');

-- Test de recherche géospatiale avec PostGIS
EXPLAIN (ANALYZE, BUFFERS)
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

$env:PGPASSWORD = $plainPassword
$performanceResult = $performanceTest | psql -h $host -p $port -U $user -d $dbName

Write-Host "⚡ Résultats des tests de performance:" -ForegroundColor Cyan
Write-Host $performanceResult

# Statistiques finales
Write-Host "📊 Statistiques finales de la migration..." -ForegroundColor Yellow

$finalStats = @"
SELECT 
    COUNT(*) as total_services,
    COUNT(location_geom) as with_geometry,
    COUNT(location_geog) as with_geography,
    COUNT(gps) as with_gps,
    COUNT(data->>'gps_fixe') as with_gps_fixe,
    COUNT(search_radius) as with_search_radius
FROM services;
"@

$env:PGPASSWORD = $plainPassword
$finalStatsResult = $finalStats | psql -h $host -p $port -U $user -d $dbName

Write-Host "📊 Statistiques finales:" -ForegroundColor Cyan
Write-Host $finalStatsResult

# Nettoyer le mot de passe
Remove-Variable -Name PGPASSWORD -ErrorAction SilentlyContinue

Write-Host "🎉 Migration PostGIS terminée avec succès!" -ForegroundColor Green
Write-Host "🗺️ Votre base de données supporte maintenant la géolocalisation avancée avec PostGIS" -ForegroundColor Cyan
Write-Host "💡 Vous pouvez maintenant utiliser les fonctions géospatiales dans vos requêtes" -ForegroundColor Yellow 