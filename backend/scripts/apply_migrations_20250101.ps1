# Script pour appliquer les migrations du 2025-01-01
# Usage: .\backend\scripts\apply_migrations_20250101.ps1

Write-Host "🔍 Application des migrations 2025-01-01..." -ForegroundColor Cyan

# Vérifier si DATABASE_URL est définie
$databaseUrl = $env:DATABASE_URL
if (-not $databaseUrl) {
    Write-Host "❌ Erreur: DATABASE_URL n'est pas définie" -ForegroundColor Red
    Write-Host "Définissez-la avec: `$env:DATABASE_URL='postgresql://user:password@host:port/database'" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ DATABASE_URL trouvée" -ForegroundColor Green

# Extraire les informations de connexion depuis DATABASE_URL
# Format: postgresql://user:password@host:port/database
if ($databaseUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
    $dbUser = $matches[1]
    $dbPassword = $matches[2]
    $dbHost = $matches[3]
    $dbPort = $matches[4]
    $dbName = $matches[5]
    
    Write-Host "📊 Connexion à: $dbHost:$dbPort/$dbName" -ForegroundColor Cyan
} else {
    Write-Host "❌ Erreur: Format DATABASE_URL invalide" -ForegroundColor Red
    exit 1
}

# Fonction pour exécuter un fichier SQL
function Execute-SqlFile {
    param (
        [string]$FilePath,
        [string]$Description
    )
    
    Write-Host "`n🔧 Application: $Description" -ForegroundColor Yellow
    
    if (-not (Test-Path $FilePath)) {
        Write-Host "❌ Fichier non trouvé: $FilePath" -ForegroundColor Red
        return $false
    }
    
    $sqlContent = Get-Content $FilePath -Raw
    
    # Utiliser psql pour exécuter le SQL
    $env:PGPASSWORD = $dbPassword
    $psqlCommand = "psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f `"$FilePath`""
    
    try {
        $result = Invoke-Expression $psqlCommand 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Migration appliquée avec succès" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Erreur lors de l'application:" -ForegroundColor Red
            Write-Host $result -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ Erreur: $_" -ForegroundColor Red
        return $false
    } finally {
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    }
}

# Appliquer les migrations
$migrations = @(
    @{
        Path = "backend\migrations\20250101_ALIGN_SEARCH_GPS_FINAL_WITH_KEYWORD_SEARCH.sql"
        Description = "Alignement search_services_gps_final avec keyword_search_with_gps"
    },
    @{
        Path = "backend\migrations\20250101_OPTIMIZE_HYBRID_IMAGE_SEARCH_WITH_UNACCENT_SIMILARITY.sql"
        Description = "Optimisation hybrid_image_search avec unaccent() et similarity()"
    }
)

$successCount = 0
$failCount = 0

foreach ($migration in $migrations) {
    $fullPath = Join-Path $PSScriptRoot "..\.." $migration.Path
    $fullPath = Resolve-Path $fullPath -ErrorAction SilentlyContinue
    
    if ($fullPath) {
        if (Execute-SqlFile -FilePath $fullPath -Description $migration.Description) {
            $successCount++
        } else {
            $failCount++
        }
    } else {
        Write-Host "❌ Fichier non trouvé: $($migration.Path)" -ForegroundColor Red
        $failCount++
    }
}

Write-Host "`n📊 Résumé:" -ForegroundColor Cyan
Write-Host "  ✅ Succès: $successCount" -ForegroundColor Green
Write-Host "  ❌ Échecs: $failCount" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Red" })

if ($failCount -eq 0) {
    Write-Host "`n✅ Toutes les migrations ont été appliquées avec succès!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n❌ Certaines migrations ont échoué" -ForegroundColor Red
    exit 1
}

