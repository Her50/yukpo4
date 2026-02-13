# Script Rapide pour Creer la Base de Donnees 'yukpo' sur AWS RDS
# Usage: .\create_database_aws_rds_quick.ps1

param(
    [string]$RdsEndpoint = "yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com",
    [string]$RdsUsername = "yukpo_admin",
    [string]$RdsPassword = "PYvHBVetTuWIKNkXgqJcFiU48D39SLwd",
    [string]$DatabaseName = "yukpo"
)

Write-Host "Creation rapide de la base de donnees 'yukpo' sur AWS RDS..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Verifier que psql est disponible
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "ERREUR: psql n'est pas installe ou n'est pas dans le PATH" -ForegroundColor Red
    Write-Host "   Installez PostgreSQL client pour Windows" -ForegroundColor Yellow
    Write-Host "   Telechargement: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Alternative: Utilisez AWS RDS Query Editor" -ForegroundColor Yellow
    exit 1
}

# Construire l'URL pour la base 'postgres' (base par defaut)
$adminDbUrl = "postgresql://${RdsUsername}:${RdsPassword}@${RdsEndpoint}:5432/postgres"

Write-Host "Informations de connexion:" -ForegroundColor Yellow
Write-Host "   Host: $RdsEndpoint" -ForegroundColor Gray
Write-Host "   Port: 5432" -ForegroundColor Gray
Write-Host "   User: $RdsUsername" -ForegroundColor Gray
Write-Host "   Database a creer: $DatabaseName" -ForegroundColor Gray
Write-Host ""

# Verifier la connectivite
Write-Host "Verification de la connectivite..." -ForegroundColor Yellow
$env:PGPASSWORD = $RdsPassword
$testResult = psql $adminDbUrl -c "SELECT version();" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Impossible de se connecter a la base de donnees" -ForegroundColor Red
    Write-Host "   Verifiez vos identifiants et que l'instance RDS est accessible" -ForegroundColor Yellow
    Write-Host "   Erreur: $testResult" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Solution: Utilisez AWS RDS Query Editor" -ForegroundColor Yellow
    exit 1
}
Write-Host "Connexion reussie" -ForegroundColor Green

# Verifier si la base existe deja
Write-Host "Verification de l'existence de la base '$DatabaseName'..." -ForegroundColor Yellow
$dbExistsQuery = "SELECT 1 FROM pg_database WHERE datname='$DatabaseName'"
$dbExistsResult = psql $adminDbUrl -tAc $dbExistsQuery 2>&1
$dbExists = ($dbExistsResult -match "^\s*1\s*$")

if ($dbExists) {
    Write-Host "La base '$DatabaseName' existe deja" -ForegroundColor Green
    Write-Host "   Aucune action necessaire" -ForegroundColor Gray
    exit 0
}

# Creer la base de donnees
Write-Host "Creation de la base '$DatabaseName'..." -ForegroundColor Yellow
$createQuery = "CREATE DATABASE `"$DatabaseName`";"
$createResult = psql $adminDbUrl -v ON_ERROR_STOP=1 -c $createQuery 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Base '$DatabaseName' creee avec succes" -ForegroundColor Green
} else {
    Write-Host "ERREUR: Impossible de creer la base '$DatabaseName'" -ForegroundColor Red
    Write-Host "   L'utilisateur '$RdsUsername' n'a pas les permissions SUPERUSER necessaires" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "SOLUTION IMMEDIATE: Utilisez AWS RDS Query Editor" -ForegroundColor Cyan
    Write-Host "   1. Allez sur https://console.aws.amazon.com/rds/" -ForegroundColor Gray
    Write-Host "   2. Selectionnez l'instance: $RdsEndpoint" -ForegroundColor Gray
    Write-Host "   3. Ouvrez Query Editor" -ForegroundColor Gray
    Write-Host "   4. Connectez-vous avec:" -ForegroundColor Gray
    Write-Host "      - Username: $RdsUsername" -ForegroundColor Gray
    Write-Host "      - Password: (depuis terraform.tfvars)" -ForegroundColor Gray
    Write-Host "      - Database: postgres" -ForegroundColor Gray
    Write-Host "   5. Executez: CREATE DATABASE `"$DatabaseName`";" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Erreur: $createResult" -ForegroundColor Red
    exit 1
}

# Verifier que la base a bien ete creee
Write-Host "Verification finale..." -ForegroundColor Yellow
$verifyResult = psql $adminDbUrl -tAc $dbExistsQuery 2>&1
$verified = ($verifyResult -match "^\s*1\s*$")

if ($verified) {
    Write-Host "Base '$DatabaseName' verifiee et prete a l'emploi" -ForegroundColor Green
    Write-Host ""
    Write-Host "Prochaines etapes:" -ForegroundColor Cyan
    Write-Host "   1. Verifiez que DATABASE_URL dans AWS Secrets Manager pointe vers la base '$DatabaseName'" -ForegroundColor Gray
    Write-Host "   2. Redemarrez le backend ECS pour appliquer les migrations" -ForegroundColor Gray
    Write-Host "   3. Les migrations s'appliqueront automatiquement si ENABLE_AUTO_MIGRATIONS=true" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Format DATABASE_URL attendu:" -ForegroundColor Yellow
    Write-Host "   postgresql://${RdsUsername}:<password>@${RdsEndpoint}:5432/${DatabaseName}" -ForegroundColor Gray
} else {
    Write-Host "WARNING: La base semble avoir ete creee mais la verification a echoue" -ForegroundColor Yellow
    Write-Host "   Verifiez manuellement avec: psql `"$adminDbUrl`" -c `"\l`"" -ForegroundColor Yellow
}
