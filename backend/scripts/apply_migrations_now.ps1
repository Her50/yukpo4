# Script pour appliquer les migrations 2025-01-01 directement
# Charge .env et applique les migrations SQL

$ErrorActionPreference = "Stop"

Write-Host "Application des migrations 2025-01-01..." -ForegroundColor Cyan

# Charger .env
$envFile = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envFile) {
    Write-Host "Chargement .env..." -ForegroundColor Yellow
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

# Verifier DATABASE_URL
if (-not $env:DATABASE_URL) {
    Write-Host "Erreur: DATABASE_URL non trouvee dans .env" -ForegroundColor Red
    exit 1
}

Write-Host "DATABASE_URL trouvee" -ForegroundColor Green

# Extraire les infos de connexion
# Format: postgresql://user:password@host:port/database ou postgresql://user:password@host/database
$dbUrl = $env:DATABASE_URL

# Essayer avec port explicite
if ($dbUrl -match 'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)') {
    $dbUser = $matches[1]
    $dbPassword = $matches[2]
    $dbHost = $matches[3]
    $dbPort = $matches[4]
    $dbName = $matches[5]
} elseif ($dbUrl -match 'postgresql://([^:]+):([^@]+)@([^/]+)/(.+)') {
    # Format sans port (port par defaut 5432)
    $dbUser = $matches[1]
    $dbPassword = $matches[2]
    $dbHost = $matches[3]
    $dbPort = "5432"
    $dbName = $matches[4]
    
    Write-Host "Connexion a: ${dbHost}:${dbPort}/${dbName}" -ForegroundColor Cyan
    
    # Appliquer migration 1
    Write-Host ""
    Write-Host "Migration 1: Alignement search_services_gps_final..." -ForegroundColor Yellow
    $migration1 = Join-Path $PSScriptRoot "..\migrations\20250101_ALIGN_SEARCH_GPS_FINAL_WITH_KEYWORD_SEARCH.sql"
    $env:PGPASSWORD = $dbPassword
    $result1 = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $migration1 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Migration 1 appliquee" -ForegroundColor Green
    } else {
        Write-Host "Erreur migration 1:" -ForegroundColor Red
        Write-Host $result1 -ForegroundColor Red
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
        exit 1
    }
    
    # Appliquer migration 2
    Write-Host ""
    Write-Host "Migration 2: Optimisation hybrid_image_search..." -ForegroundColor Yellow
    $migration2 = Join-Path $PSScriptRoot "..\migrations\20250101_OPTIMIZE_HYBRID_IMAGE_SEARCH_WITH_UNACCENT_SIMILARITY.sql"
    $result2 = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $migration2 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Migration 2 appliquee" -ForegroundColor Green
    } else {
        Write-Host "Erreur migration 2:" -ForegroundColor Red
        Write-Host $result2 -ForegroundColor Red
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
        exit 1
    }
    
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "Toutes les migrations appliquees avec succes!" -ForegroundColor Green
} else {
    Write-Host "Format DATABASE_URL invalide" -ForegroundColor Red
    exit 1
}
