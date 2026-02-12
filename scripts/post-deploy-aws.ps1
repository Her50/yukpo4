# 🔧 Script PowerShell de post-déploiement AWS
# Vérifie et crée la base de données si nécessaire après Terraform

param(
    [string]$RdsPassword = $null
)

Write-Host "🔧 Post-déploiement AWS - Vérification de la base de données..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que Terraform a été appliqué
if (-not (Test-Path "infra/aws/terraform.tfstate") -and -not (Test-Path "infra/aws/terraform.tfstate.backup")) {
    Write-Host "⚠️ WARNING: Terraform state not found" -ForegroundColor Yellow
    Write-Host "   Run 'terraform apply' first in infra/aws/" -ForegroundColor Yellow
    exit 1
}

# Récupérer les informations depuis Terraform
Push-Location infra/aws

try {
    # Extraire les informations de RDS depuis Terraform output
    $rdsEndpoint = terraform output -raw rds_endpoint 2>$null
    $rdsUsername = terraform output -raw rds_username 2>$null
    $rdsPassword = if ($RdsPassword) { $RdsPassword } else { terraform output -raw rds_password 2>$null }
    $rdsDbName = terraform output -raw rds_database_name 2>$null

    # Si les outputs ne sont pas disponibles, essayer depuis terraform.tfvars
    if ([string]::IsNullOrEmpty($rdsEndpoint)) {
        Write-Host "📋 Récupération des informations depuis terraform.tfvars..." -ForegroundColor Yellow
        if (Test-Path "terraform.tfvars") {
            $tfvarsContent = Get-Content terraform.tfvars -Raw
            if ($tfvarsContent -match 'rds_database_name\s*=\s*"([^"]+)"') {
                $rdsDbName = $matches[1]
            }
            if ($tfvarsContent -match 'rds_username\s*=\s*"([^"]+)"') {
                $rdsUsername = $matches[1]
            }
            if ($tfvarsContent -match 'aws_region\s*=\s*"([^"]+)"') {
                $awsRegion = $matches[1]
            } else {
                $awsRegion = "eu-west-1"
            }
            if ($tfvarsContent -match 'project_name\s*=\s*"([^"]+)"') {
                $projectName = $matches[1]
            } else {
                $projectName = "yukpo"
            }
        }

        # Récupérer l'endpoint depuis AWS
        if (Get-Command aws -ErrorAction SilentlyContinue) {
            $rdsEndpoint = aws rds describe-db-instances `
                --db-instance-identifier "${projectName}-db" `
                --region "$awsRegion" `
                --query 'DBInstances[0].Endpoint.Address' `
                --output text 2>$null
        }
    }
} finally {
    Pop-Location
}

if ([string]::IsNullOrEmpty($rdsEndpoint) -or [string]::IsNullOrEmpty($rdsDbName)) {
    Write-Host "❌ ERREUR: Impossible de récupérer les informations RDS" -ForegroundColor Red
    Write-Host "   Vérifiez que Terraform a été appliqué et que RDS existe" -ForegroundColor Yellow
    exit 1
}

Write-Host "📊 Informations RDS:" -ForegroundColor Yellow
Write-Host "   Endpoint: $rdsEndpoint" -ForegroundColor Gray
Write-Host "   Database: $rdsDbName" -ForegroundColor Gray
Write-Host "   Username: $rdsUsername" -ForegroundColor Gray
Write-Host ""

# Vérifier que psql est disponible
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "❌ ERREUR: psql n'est pas installé ou n'est pas dans le PATH" -ForegroundColor Red
    Write-Host "   Installez PostgreSQL client pour Windows" -ForegroundColor Yellow
    Write-Host "   Téléchargement: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    exit 1
}

# Demander le mot de passe si non fourni
if ([string]::IsNullOrEmpty($rdsPassword)) {
    Write-Host "🔐 Mot de passe RDS requis" -ForegroundColor Yellow
    $securePassword = Read-Host "Entrez le mot de passe pour $rdsUsername" -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $rdsPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
}

# Construire l'URL de connexion
$adminDbUrl = "postgresql://${rdsUsername}:${rdsPassword}@${rdsEndpoint}/postgres"

# Vérifier la connectivité
Write-Host "🔍 Vérification de la connectivité..." -ForegroundColor Yellow
$env:PGPASSWORD = $rdsPassword
$testResult = psql $adminDbUrl -c "SELECT version();" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERREUR: Impossible de se connecter à RDS" -ForegroundColor Red
    Write-Host "   Vérifiez vos identifiants et que l'instance RDS est accessible" -ForegroundColor Yellow
    Write-Host "   Erreur: $testResult" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Connexion réussie" -ForegroundColor Green

# Vérifier si la base existe
Write-Host "🔍 Vérification de l'existence de la base '$rdsDbName'..." -ForegroundColor Yellow
$dbExistsQuery = "SELECT 1 FROM pg_database WHERE datname='$rdsDbName'"
$dbExistsResult = psql $adminDbUrl -tAc $dbExistsQuery 2>&1
$dbExists = ($dbExistsResult -match "^\s*1\s*$")

if ($dbExists) {
    Write-Host "✅ La base '$rdsDbName' existe déjà" -ForegroundColor Green
    Write-Host "   Aucune action nécessaire" -ForegroundColor Gray
    exit 0
}

# Créer la base de données
Write-Host "🛠️  Création de la base '$rdsDbName'..." -ForegroundColor Yellow
$createQuery = "CREATE DATABASE `"$rdsDbName`";"
$createResult = psql $adminDbUrl -v ON_ERROR_STOP=1 -c $createQuery 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Base '$rdsDbName' créée avec succès" -ForegroundColor Green
} else {
    Write-Host "❌ ERREUR: Impossible de créer la base '$rdsDbName'" -ForegroundColor Red
    Write-Host "   Vérifiez que l'utilisateur '$rdsUsername' a les permissions nécessaires" -ForegroundColor Yellow
    Write-Host "   Note: Sur AWS RDS, seul le superuser peut créer des bases de données" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📋 SOLUTION: Créez la base manuellement via AWS RDS Query Editor" -ForegroundColor Cyan
    Write-Host "   1. AWS Console → RDS → ${projectName}-db" -ForegroundColor Gray
    Write-Host "   2. Ouvrez Query Editor" -ForegroundColor Gray
    Write-Host "   3. Exécutez: CREATE DATABASE `"$rdsDbName`";" -ForegroundColor Gray
    Write-Host "   Erreur: $createResult" -ForegroundColor Red
    exit 1
}

# Vérifier que la base a bien été créée
Write-Host "🔍 Vérification finale..." -ForegroundColor Yellow
$verifyResult = psql $adminDbUrl -tAc $dbExistsQuery 2>&1
$verified = ($verifyResult -match "^\s*1\s*$")

if ($verified) {
    Write-Host "✅ Base '$rdsDbName' vérifiée et prête à l'emploi" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Prochaines étapes:" -ForegroundColor Cyan
    Write-Host "   1. Vérifiez que DATABASE_URL pointe vers la base '$rdsDbName'" -ForegroundColor Gray
    Write-Host "   2. Redémarrez le service ECS pour appliquer les migrations" -ForegroundColor Gray
    Write-Host "   3. Les migrations s'appliqueront automatiquement si ENABLE_AUTO_MIGRATIONS=true" -ForegroundColor Gray
} else {
    Write-Host "⚠️  WARNING: La base semble avoir été créée mais la vérification a échoué" -ForegroundColor Yellow
    Write-Host "   Vérifiez manuellement avec: psql `"$adminDbUrl`" -c `"\l`"" -ForegroundColor Yellow
}

