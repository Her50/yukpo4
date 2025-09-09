# Script simplifié pour appliquer les migrations
Write-Host "🚀 Application des migrations PostgreSQL..." -ForegroundColor Cyan

# Demander le mot de passe
$password = Read-Host "🔐 Entrez le mot de passe PostgreSQL pour l'utilisateur 'postgres'" -AsSecureString
$plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))

# Variables de connexion
$dbName = "yukpo_db"
$user = "postgres"
$host = "localhost"
$port = "5432"

# Tester la connexion
$env:PGPASSWORD = $plainPassword
Write-Host "🔌 Test de connexion à la base de données..." -ForegroundColor Yellow

$testResult = psql -h $host -p $port -U $user -d $dbName -c "SELECT 'Connexion réussie' as status;" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Connexion réussie à $dbName" -ForegroundColor Green
    
    # Appliquer la migration PostGIS
    Write-Host "🗺️ Application de la migration PostGIS..." -ForegroundColor Yellow
    
    $migrationFile = "..\backend\migrations\20250830_002_add_postgis_geospatial.sql"
    
    if (Test-Path $migrationFile) {
        Write-Host "📁 Fichier de migration trouvé: $migrationFile" -ForegroundColor Green
        
        $migrationResult = Get-Content $migrationFile | psql -h $host -p $port -U $user -d $dbName 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Migration PostGIS appliquée avec succès!" -ForegroundColor Green
        } else {
            Write-Host "❌ Erreur lors de l'application de la migration" -ForegroundColor Red
            Write-Host "📋 Détails de l'erreur:" -ForegroundColor Yellow
            Write-Host $migrationResult
        }
    } else {
        Write-Host "❌ Fichier de migration non trouvé: $migrationFile" -ForegroundColor Red
    }
    
    # Appliquer la migration d'optimisation des index
    Write-Host "🔧 Application de la migration d'optimisation des index..." -ForegroundColor Yellow
    
    $indexMigrationFile = "..\backend\migrations\20250830_003_optimize_indexes.sql"
    
    if (Test-Path $indexMigrationFile) {
        Write-Host "📁 Fichier de migration des index trouvé: $indexMigrationFile" -ForegroundColor Green
        
        $indexMigrationResult = Get-Content $indexMigrationFile | psql -h $host -p $port -U $user -d $dbName 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Migration des index appliquée avec succès!" -ForegroundColor Green
        } else {
            Write-Host "❌ Erreur lors de l'application de la migration des index" -ForegroundColor Red
            Write-Host "📋 Détails de l'erreur:" -ForegroundColor Yellow
            Write-Host $indexMigrationResult
        }
    } else {
        Write-Host "❌ Fichier de migration des index non trouvé: $indexMigrationFile" -ForegroundColor Red
    }
    
    # Vérification finale
    Write-Host "🔍 Vérification finale des migrations..." -ForegroundColor Yellow
    
    $finalCheck = @"
SELECT 
    'Extensions' as type,
    extname as name,
    extversion as version
FROM pg_extension 
WHERE extname IN ('postgis', 'pg_trgm')
UNION ALL
SELECT 
    'Colonnes' as type,
    column_name as name,
    data_type as version
FROM information_schema.columns 
WHERE table_name = 'services' 
AND column_name IN ('location_geom', 'location_geog', 'search_radius')
ORDER BY type, name;
"@
    
    $finalResult = $finalCheck | psql -h $host -p $port -U $user -d $dbName 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Vérification finale réussie:" -ForegroundColor Green
        Write-Host $finalResult
    } else {
        Write-Host "❌ Erreur lors de la vérification finale" -ForegroundColor Red
        Write-Host $finalResult
    }
    
} else {
    Write-Host "❌ Échec de la connexion à la base de données" -ForegroundColor Red
    Write-Host "💡 Vérifiez que PostgreSQL est démarré et que les paramètres sont corrects" -ForegroundColor Yellow
}

# Nettoyer le mot de passe
Remove-Variable -Name PGPASSWORD -ErrorAction SilentlyContinue

Write-Host "🎉 Script de migration terminé!" -ForegroundColor Green 