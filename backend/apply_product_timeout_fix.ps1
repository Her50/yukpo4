# Script pour appliquer la migration fix_product_creation_timeout
Write-Host "Application de la migration fix_product_creation_timeout..." -ForegroundColor Cyan

# Lire la DATABASE_URL depuis les variables d'environnement
$databaseUrl = $env:DATABASE_URL

if (-not $databaseUrl) {
    Write-Host "DATABASE_URL n'est pas definie dans les variables d'environnement" -ForegroundColor Red
    Write-Host "Veuillez definir DATABASE_URL ou utiliser psql directement" -ForegroundColor Yellow
    exit 1
}

Write-Host "DATABASE_URL trouvee" -ForegroundColor Green

# Parser la DATABASE_URL manuellement
# Format: postgresql://user:password@host:port/database
$url = $databaseUrl -replace "postgresql://", ""
$parts = $url -split "@"
if ($parts.Length -ne 2) {
    Write-Host "Format de DATABASE_URL invalide" -ForegroundColor Red
    exit 1
}

$credentials = $parts[0] -split ":"
$dbUser = $credentials[0]
$dbPassword = $credentials[1]

$hostPart = $parts[1] -split "/"
$dbName = $hostPart[1]

$hostPort = $hostPart[0] -split ":"
$dbHost = $hostPort[0]
$dbPort = if ($hostPort.Length -gt 1) { $hostPort[1] } else { "5432" }

Write-Host "Connexion a: ${dbHost}:${dbPort}/${dbName} (user: ${dbUser})" -ForegroundColor Cyan

# Définir le mot de passe pour psql
$env:PGPASSWORD = $dbPassword

# Lire le fichier SQL de migration
$migrationFile = "migrations\20251231_fix_product_creation_timeout.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Host "Fichier de migration introuvable: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "Application du fichier: $migrationFile" -ForegroundColor Cyan

# Exécuter la migration via psql
try {
    $result = & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $migrationFile 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Migration appliquee avec succes!" -ForegroundColor Green
        Write-Host $result -ForegroundColor Gray
    } else {
        Write-Host "Erreur lors de l'application de la migration:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Erreur lors de l'execution: $_" -ForegroundColor Red
    exit 1
} finally {
    # Nettoyer le mot de passe
    $env:PGPASSWORD = $null
}

Write-Host "`nMigration terminee!" -ForegroundColor Green
