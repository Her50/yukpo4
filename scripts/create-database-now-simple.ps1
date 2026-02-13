# 🚀 Script Simple pour Créer la Base de Données 'yukpo' sur AWS RDS
# Ce script lit les informations depuis terraform.tfvars et tente de créer la base
# Si cela échoue (permissions insuffisantes), il fournit des instructions pour AWS Console

param(
    [string]$TerraformDir = "infra/aws"
)

Write-Host "🚀 Création de la base de données 'yukpo' sur AWS RDS..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Lire les informations depuis terraform.tfvars
$tfvarsPath = Join-Path $TerraformDir "terraform.tfvars"
if (-not (Test-Path $tfvarsPath)) {
    Write-Host "❌ ERREUR: terraform.tfvars introuvable dans $TerraformDir" -ForegroundColor Red
    exit 1
}

Write-Host "📖 Lecture de terraform.tfvars..." -ForegroundColor Yellow
$tfvarsContent = Get-Content $tfvarsPath -Raw

# Extraire les valeurs (format simple key = value)
$rdsEndpoint = "yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com"  # Depuis les logs
$rdsUsername = if ($tfvarsContent -match 'rds_username\s*=\s*"([^"]+)"') { $matches[1] } else { "yukpo_admin" }
$rdsPassword = if ($tfvarsContent -match 'rds_password\s*=\s*"([^"]+)"') { $matches[1] } else { $null }
$rdsDbName = if ($tfvarsContent -match 'rds_database_name\s*=\s*"([^"]+)"') { $matches[1] } else { "yukpo" }

if ([string]::IsNullOrEmpty($rdsPassword)) {
    Write-Host "❌ ERREUR: Impossible de lire rds_password depuis terraform.tfvars" -ForegroundColor Red
    Write-Host "   Vérifiez que le fichier contient: rds_password = \"...\"" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Informations récupérées:" -ForegroundColor Green
Write-Host "   Endpoint: $rdsEndpoint" -ForegroundColor Gray
Write-Host "   Username: $rdsUsername" -ForegroundColor Gray
Write-Host "   Database: $rdsDbName" -ForegroundColor Gray
Write-Host ""

# Construire l'URL de connexion pour la base 'postgres'
$adminDbUrl = "postgresql://${rdsUsername}:${rdsPassword}@${rdsEndpoint}:5432/postgres"

# Vérifier si psql est disponible
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "⚠️  psql n'est pas installé sur ce système" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📋 SOLUTION: Créer la base via AWS RDS Query Editor" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Ouvrez AWS Console: https://console.aws.amazon.com/rds/" -ForegroundColor White
    Write-Host "2. Région: eu-west-1 (Irlande)" -ForegroundColor White
    Write-Host "3. Sélectionnez l'instance: yukpo-db" -ForegroundColor White
    Write-Host "4. Cliquez sur 'Query Editor' ou 'Query Editor v2'" -ForegroundColor White
    Write-Host "5. Connectez-vous avec:" -ForegroundColor White
    Write-Host "   - Username: $rdsUsername" -ForegroundColor Gray
    Write-Host "   - Password: $rdsPassword" -ForegroundColor Gray
    Write-Host "   - Database: postgres" -ForegroundColor Gray
    Write-Host "6. Exécutez cette commande SQL:" -ForegroundColor White
    Write-Host ""
    Write-Host "   CREATE DATABASE `"$rdsDbName`";" -ForegroundColor Green
    Write-Host ""
    Write-Host "7. Vérifiez avec:" -ForegroundColor White
    Write-Host ""
    Write-Host "   SELECT datname FROM pg_database WHERE datname = '$rdsDbName';" -ForegroundColor Green
    Write-Host ""
    exit 0
}

# Tenter de créer la base avec psql
Write-Host "🔍 Tentative de création via psql..." -ForegroundColor Yellow
$env:PGPASSWORD = $rdsPassword

# Vérifier la connectivité
Write-Host "   Vérification de la connectivité..." -ForegroundColor Gray
$testResult = psql $adminDbUrl -c "SELECT version();" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERREUR: Impossible de se connecter à RDS" -ForegroundColor Red
    Write-Host "   Vérifiez que:" -ForegroundColor Yellow
    Write-Host "   - L'instance RDS est accessible" -ForegroundColor Yellow
    Write-Host "   - Les security groups autorisent votre IP" -ForegroundColor Yellow
    Write-Host "   - Les identifiants sont corrects" -ForegroundColor Yellow
    Write-Host "   Erreur: $testResult" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Connexion réussie" -ForegroundColor Green

# Vérifier si la base existe déjà
Write-Host "   Vérification de l'existence de la base '$rdsDbName'..." -ForegroundColor Gray
$dbExistsQuery = "SELECT 1 FROM pg_database WHERE datname='$rdsDbName'"
$dbExistsResult = psql $adminDbUrl -tAc $dbExistsQuery 2>&1
$dbExists = ($dbExistsResult -match "^\s*1\s*$")

if ($dbExists) {
    Write-Host ""
    Write-Host "✅ La base '$rdsDbName' existe déjà!" -ForegroundColor Green
    Write-Host "   Aucune action nécessaire" -ForegroundColor Gray
    exit 0
}

# Tenter de créer la base
Write-Host "   Création de la base '$rdsDbName'..." -ForegroundColor Gray
$createQuery = "CREATE DATABASE `"$rdsDbName`";"
$createResult = psql $adminDbUrl -v ON_ERROR_STOP=1 -c $createQuery 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Base '$rdsDbName' créée avec succès!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Prochaines étapes:" -ForegroundColor Cyan
    Write-Host "   1. Redémarrez le backend ECS" -ForegroundColor Gray
    Write-Host "   2. Les migrations s'appliqueront automatiquement" -ForegroundColor Gray
    exit 0
} else {
    Write-Host ""
    Write-Host "❌ ERREUR: Impossible de créer la base automatiquement" -ForegroundColor Red
    Write-Host "   Raison: L'utilisateur '$rdsUsername' n'a pas les permissions SUPERUSER" -ForegroundColor Yellow
    Write-Host "   Erreur: $createResult" -ForegroundColor Red
    Write-Host ""
    Write-Host "📋 SOLUTION: Créer la base via AWS RDS Query Editor" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Ouvrez AWS Console: https://console.aws.amazon.com/rds/" -ForegroundColor White
    Write-Host "2. Région: eu-west-1 (Irlande)" -ForegroundColor White
    Write-Host "3. Sélectionnez l'instance: yukpo-db" -ForegroundColor White
    Write-Host "4. Cliquez sur 'Query Editor' ou 'Query Editor v2'" -ForegroundColor White
    Write-Host "5. Connectez-vous avec:" -ForegroundColor White
    Write-Host "   - Username: $rdsUsername" -ForegroundColor Gray
    Write-Host "   - Password: $rdsPassword" -ForegroundColor Gray
    Write-Host "   - Database: postgres" -ForegroundColor Gray
    Write-Host "6. Exécutez cette commande SQL:" -ForegroundColor White
    Write-Host ""
    Write-Host "   CREATE DATABASE `"$rdsDbName`";" -ForegroundColor Green
    Write-Host ""
    Write-Host "7. Vérifiez avec:" -ForegroundColor White
    Write-Host ""
    Write-Host "   SELECT datname FROM pg_database WHERE datname = '$rdsDbName';" -ForegroundColor Green
    Write-Host ""
    exit 1
}

