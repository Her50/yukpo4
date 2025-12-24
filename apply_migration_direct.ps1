# Script pour appliquer directement la migration hybrid_image_search
Write-Host "Application directe de la migration hybrid_image_search..." -ForegroundColor Cyan

# Lire DATABASE_URL depuis .env
$envPath = "backend\.env"
if (-Not (Test-Path $envPath)) {
    Write-Host "ERREUR: Fichier .env introuvable!" -ForegroundColor Red
    exit 1
}

# Extraire DATABASE_URL
$envContent = Get-Content $envPath | Where-Object { $_ -match "^DATABASE_URL=" }
if (-Not $envContent) {
    Write-Host "ERREUR: DATABASE_URL introuvable dans .env!" -ForegroundColor Red
    exit 1
}

$databaseUrl = $envContent -replace "DATABASE_URL=", ""

# Parser l'URL PostgreSQL (support postgres:// et postgresql://)
$regexPattern = 'postgres(ql)?://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)'
if ($databaseUrl -match $regexPattern) {
    $dbUser = $matches[2]
    $dbPass = $matches[3]
    $dbHost = $matches[4]
    $dbPort = if ($matches[5]) { $matches[5] } else { "5432" }
    $dbName = $matches[6]
} else {
    Write-Host "ERREUR: DATABASE_URL mal formee!" -ForegroundColor Red
    exit 1
}

Write-Host "Connexion a: ${dbHost}:${dbPort}/${dbName} (user: ${dbUser})" -ForegroundColor Yellow

# Définir le mot de passe
$env:PGPASSWORD = $dbPass

# Appliquer la migration
$migrationFile = "backend\migrations\20251224_improve_hybrid_image_search_language_and_relevance.sql"

if (-Not (Test-Path $migrationFile)) {
    Write-Host "ERREUR: Fichier de migration introuvable: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "Application de la migration..." -ForegroundColor Yellow

$sqlContent = Get-Content -Path $migrationFile -Raw -Encoding UTF8

# Exécuter via psql
$result = $sqlContent | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -v ON_ERROR_STOP=1 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCES: Migration appliquee avec succes!" -ForegroundColor Green
    Write-Host $result -ForegroundColor White
} else {
    Write-Host "ERREUR lors de l'application de la migration:" -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
    exit 1
}

Write-Host "`nMigration terminee!" -ForegroundColor Green
