# Script pour appliquer la migration des colonnes calculées pour deliveries
# Cette migration crée pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, store_lat, store_lng

# Chercher .env dans le dossier parent (racine du projet)
$envPath = "..\.env"
if (-Not (Test-Path $envPath)) {
    # Si pas trouvé, essayer à la racine du projet
    $envPath = ".\.env"
    if (-Not (Test-Path $envPath)) {
        Write-Host "Fichier .env introuvable !" -ForegroundColor Red
        Write-Host "Recherché dans: $(Resolve-Path .)" -ForegroundColor Yellow
        exit 1
    }
}

# Extraction de DATABASE_URL
$dbUrl = (Get-Content $envPath | Select-String "DATABASE_URL" | Select-Object -First 1) -replace "DATABASE_URL=", ""

# Parsing de l'URL PostgreSQL
if ($dbUrl -match "postgres://([^:]+):([^@]+)@([^/]+)/(.+)$") {
    $dbUser = $matches[1]
    $dbPass = $matches[2]
    $hostPort = $matches[3] -split ":"
    $dbHost = $hostPort[0]
    $dbPort = if ($hostPort.Length -gt 1) { $hostPort[1] } else { "5432" }
    $dbName = $matches[4]
} else {
    Write-Host "DATABASE_URL mal formée !" -ForegroundColor Red
    exit 1
}

Write-Host "Application de la migration pour les colonnes calculées deliveries..." -ForegroundColor Yellow
Write-Host "Base: $dbName sur $dbHost" -ForegroundColor Cyan

# Lire le fichier de migration
$migrationFile = "migrations\20260114_optimize_delivery_queries_performance.sql"
if (-Not (Test-Path $migrationFile)) {
    Write-Host "Fichier de migration introuvable: $migrationFile" -ForegroundColor Red
    exit 1
}

$sql = Get-Content -Path $migrationFile -Raw

# Définir le mot de passe PostgreSQL
$env:PGPASSWORD = $dbPass

# Exécuter la migration via psql
Write-Host "`nExécution de la migration..." -ForegroundColor Yellow
$result = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -c $sql 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Migration appliquée avec succès !" -ForegroundColor Green
    Write-Host "Les colonnes pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, store_lat, store_lng ont été créées." -ForegroundColor Green
} else {
    Write-Host "`n❌ Erreur lors de l'application de la migration:" -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
    exit 1
}

# Nettoyer la variable d'environnement
Remove-Item Env:\PGPASSWORD

