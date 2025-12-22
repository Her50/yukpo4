# Script pour vérifier et corriger les types de colis dans la base de données
# Usage: .\scripts\check_parcel_types.ps1

$ErrorActionPreference = "Stop"

# Charger les variables d'environnement depuis .env si disponible
if (Test-Path ".\.env") {
    Get-Content ".\.env" | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

$DATABASE_URL = $env:DATABASE_URL
if (-not $DATABASE_URL) {
    Write-Host "❌ DATABASE_URL non définie. Définissez-la dans .env ou comme variable d'environnement." -ForegroundColor Red
    exit 1
}

Write-Host "🔍 Vérification des types de colis dans la base de données..." -ForegroundColor Cyan

# Extraire les informations de connexion depuis DATABASE_URL
# Format: postgresql://user:password@host:port/database
if ($DATABASE_URL -match 'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)') {
    $dbUser = $matches[1]
    $dbPassword = $matches[2]
    $dbHost = $matches[3]
    $dbPort = $matches[4]
    $dbName = $matches[5]
    
    Write-Host "📊 Connexion à: $dbHost:$dbPort/$dbName" -ForegroundColor Yellow
    
    # Vérifier si psql est disponible
    $psqlPath = Get-Command psql -ErrorAction SilentlyContinue
    if (-not $psqlPath) {
        Write-Host "❌ psql n'est pas installé ou n'est pas dans le PATH." -ForegroundColor Red
        Write-Host "💡 Installez PostgreSQL client ou utilisez Docker: docker run -it --rm postgres psql" -ForegroundColor Yellow
        exit 1
    }
    
    # Requête SQL pour lister tous les types de colis
    $query = @"
SELECT 
    id,
    slug,
    display_name,
    description,
    max_weight_kg,
    max_volume_cm3,
    created_at
FROM parcel_types
ORDER BY id;
"@
    
    Write-Host "`n📦 Types de colis existants:" -ForegroundColor Green
    Write-Host "=" * 80
    
    # Exécuter la requête
    $env:PGPASSWORD = $dbPassword
    $query | & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -A -F "|"
    
    Write-Host "`n" + ("=" * 80)
    
    # Vérifier si les types attendus existent
    $expectedTypes = @('bike', 'motorcycle', 'tricycle', 'car', 'pickup', 'van', 'truck', 'walking')
    $checkQuery = @"
SELECT slug FROM parcel_types WHERE slug IN ('bike', 'motorcycle', 'tricycle', 'car', 'pickup', 'van', 'truck', 'walking');
"@
    
    Write-Host "`n✅ Vérification des types attendus (basés sur véhicules):" -ForegroundColor Green
    $checkQuery | & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -A
    
    Write-Host "`n💡 Si des types manquent, exécutez la migration:" -ForegroundColor Yellow
    Write-Host "   cargo run --bin yukpomnang_backend" -ForegroundColor Cyan
    Write-Host "   (La migration auto s'exécutera au démarrage)" -ForegroundColor Gray
    
} else {
    Write-Host "❌ Format DATABASE_URL invalide. Format attendu: postgresql://user:password@host:port/database" -ForegroundColor Red
    exit 1
}

