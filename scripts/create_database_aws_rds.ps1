# 🔧 Script PowerShell pour créer la base de données 'yukpo' sur AWS RDS
# Usage: .\create_database_aws_rds.ps1

param(
    [string]$DatabaseUrl = $env:DATABASE_URL
)

Write-Host "🔧 Création de la base de données 'yukpo' sur AWS RDS..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que DATABASE_URL est définie
if ([string]::IsNullOrEmpty($DatabaseUrl)) {
    Write-Host "❌ ERREUR: DATABASE_URL non définie" -ForegroundColor Red
    Write-Host "   Usage: `$env:DATABASE_URL='postgresql://user:pass@host:5432/postgres'; .\create_database_aws_rds.ps1" -ForegroundColor Yellow
    Write-Host "   OU: .\create_database_aws_rds.ps1 -DatabaseUrl 'postgresql://user:pass@host:5432/postgres'" -ForegroundColor Yellow
    exit 1
}

# Vérifier que psql est disponible
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "❌ ERREUR: psql n'est pas installé ou n'est pas dans le PATH" -ForegroundColor Red
    Write-Host "   Installez PostgreSQL client pour Windows" -ForegroundColor Yellow
    Write-Host "   Téléchargement: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    exit 1
}

# Extraire les composants de DATABASE_URL
$dbHost = if ($DatabaseUrl -match '@([^:]+):') { $matches[1] } else { $null }
$dbPort = if ($DatabaseUrl -match ':(\d+)/') { $matches[1] } else { "5432" }
$dbUser = if ($DatabaseUrl -match '://([^:]+):') { $matches[1] } else { $null }
$dbPass = if ($DatabaseUrl -match '://[^:]+:([^@]+)@') { $matches[1] } else { $null }
$dbName = "yukpo"

# Construire l'URL pour la base 'postgres' (base par défaut)
$adminDbUrl = $DatabaseUrl -replace '/[^/]+$', '/postgres'

Write-Host "📊 Informations de connexion:" -ForegroundColor Yellow
Write-Host "   Host: $dbHost" -ForegroundColor Gray
Write-Host "   Port: $dbPort" -ForegroundColor Gray
Write-Host "   User: $dbUser" -ForegroundColor Gray
Write-Host "   Database à créer: $dbName" -ForegroundColor Gray
Write-Host ""

# Vérifier la connectivité
Write-Host "🔍 Vérification de la connectivité..." -ForegroundColor Yellow
$env:PGPASSWORD = $dbPass
$testResult = psql $adminDbUrl -c "SELECT version();" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERREUR: Impossible de se connecter à la base de données" -ForegroundColor Red
    Write-Host "   Vérifiez vos identifiants et que l'instance RDS est accessible" -ForegroundColor Yellow
    Write-Host "   Erreur: $testResult" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Connexion réussie" -ForegroundColor Green

# Vérifier si la base existe déjà
Write-Host "🔍 Vérification de l'existence de la base '$dbName'..." -ForegroundColor Yellow
$dbExistsQuery = "SELECT 1 FROM pg_database WHERE datname='$dbName'"
$dbExistsResult = psql $adminDbUrl -tAc $dbExistsQuery 2>&1
$dbExists = ($dbExistsResult -match "^\s*1\s*$")

if ($dbExists) {
    Write-Host "✅ La base '$dbName' existe déjà" -ForegroundColor Green
    Write-Host "   Aucune action nécessaire" -ForegroundColor Gray
    exit 0
}

# Créer la base de données
Write-Host "🛠️  Création de la base '$dbName'..." -ForegroundColor Yellow
$createQuery = "CREATE DATABASE `"$dbName`";"
$createResult = psql $adminDbUrl -v ON_ERROR_STOP=1 -c $createQuery 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Base '$dbName' créée avec succès" -ForegroundColor Green
} else {
    Write-Host "❌ ERREUR: Impossible de créer la base '$dbName'" -ForegroundColor Red
    Write-Host "   Vérifiez que l'utilisateur '$dbUser' a les permissions nécessaires" -ForegroundColor Yellow
    Write-Host "   Note: Sur AWS RDS, seul le superuser peut créer des bases de données" -ForegroundColor Yellow
    Write-Host "   Solution: Utilisez l'utilisateur master ou créez la base via AWS Console" -ForegroundColor Yellow
    Write-Host "   Erreur: $createResult" -ForegroundColor Red
    exit 1
}

# Vérifier que la base a bien été créée
Write-Host "🔍 Vérification finale..." -ForegroundColor Yellow
$verifyResult = psql $adminDbUrl -tAc $dbExistsQuery 2>&1
$verified = ($verifyResult -match "^\s*1\s*$")

if ($verified) {
    Write-Host "✅ Base '$dbName' vérifiée et prête à l'emploi" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Prochaines étapes:" -ForegroundColor Cyan
    Write-Host "   1. Vérifiez que DATABASE_URL pointe vers la base 'yukpo'" -ForegroundColor Gray
    Write-Host "   2. Redémarrez le backend pour appliquer les migrations" -ForegroundColor Gray
    Write-Host "   3. Les migrations s'appliqueront automatiquement si ENABLE_AUTO_MIGRATIONS=true" -ForegroundColor Gray
} else {
    Write-Host "⚠️  WARNING: La base semble avoir été créée mais la vérification a échoué" -ForegroundColor Yellow
    Write-Host "   Vérifiez manuellement avec: psql `"$adminDbUrl`" -c `"\l`"" -ForegroundColor Yellow
}

