# 🔧 Script pour créer la base de données IMMÉDIATEMENT
# Utilise AWS RDS Data API ou Query Editor si disponible

param(
    [string]$Region = "eu-west-1"
)

Write-Host "🔧 Création IMMÉDIATE de la base de données..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Récupérer les informations depuis Terraform
Push-Location infra/aws
try {
    $rdsEndpoint = terraform output -raw rds_endpoint 2>$null
    $rdsUsername = terraform output -raw rds_username 2>$null
    $rdsPassword = terraform output -raw rds_password 2>$null
    $rdsDbName = terraform output -raw rds_database_name 2>$null
    $rdsIdentifier = terraform output -raw rds_identifier 2>$null
} finally {
    Pop-Location
}

if ([string]::IsNullOrEmpty($rdsIdentifier)) {
    $rdsIdentifier = "yukpo-db"
}

if ([string]::IsNullOrEmpty($rdsDbName)) {
    $rdsDbName = "yukpo"
}

Write-Host "📊 Informations RDS:" -ForegroundColor Yellow
Write-Host "   Identifier: $rdsIdentifier" -ForegroundColor Gray
Write-Host "   Database: $rdsDbName" -ForegroundColor Gray
Write-Host ""

# Méthode 1 : Utiliser AWS RDS Data API (si activé)
Write-Host "🔍 Tentative via AWS RDS Data API..." -ForegroundColor Yellow

# Vérifier si Data API est disponible
$clusterArn = aws rds describe-db-clusters `
    --db-cluster-identifier $rdsIdentifier `
    --region $Region `
    --query 'DBClusters[0].DBClusterArn' `
    --output text 2>$null

if (-not [string]::IsNullOrEmpty($clusterArn)) {
    Write-Host "   Data API disponible pour les clusters Aurora" -ForegroundColor Gray
    Write-Host "   Mais cette instance est PostgreSQL standard, pas Aurora" -ForegroundColor Gray
}

# Méthode 2 : Utiliser psql si disponible
Write-Host ""
Write-Host "🔍 Tentative via psql..." -ForegroundColor Yellow

if (Get-Command psql -ErrorAction SilentlyContinue) {
    if ([string]::IsNullOrEmpty($rdsEndpoint) -or [string]::IsNullOrEmpty($rdsPassword)) {
        Write-Host "   Informations RDS manquantes" -ForegroundColor Yellow
        Write-Host "   Récupération depuis AWS..." -ForegroundColor Yellow
        
        $rdsInfo = aws rds describe-db-instances `
            --db-instance-identifier $rdsIdentifier `
            --region $Region `
            --query 'DBInstances[0].{Endpoint:Endpoint.Address,MasterUsername:MasterUsername}' `
            --output json | ConvertFrom-Json
        
        if ($rdsInfo) {
            $rdsEndpoint = $rdsInfo.Endpoint
            $rdsUsername = $rdsInfo.MasterUsername
        }
        
        if ([string]::IsNullOrEmpty($rdsPassword)) {
            Write-Host "🔐 Mot de passe requis" -ForegroundColor Yellow
            $securePassword = Read-Host "Entrez le mot de passe pour $rdsUsername" -AsSecureString
            $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
            $rdsPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
        }
    }
    
    $adminDbUrl = "postgresql://${rdsUsername}:${rdsPassword}@${rdsEndpoint}/postgres"
    
    Write-Host "   Connexion à RDS..." -ForegroundColor Gray
    $env:PGPASSWORD = $rdsPassword
    
    # Vérifier si la base existe
    $dbExistsQuery = "SELECT 1 FROM pg_database WHERE datname='$rdsDbName'"
    $dbExistsResult = psql $adminDbUrl -tAc $dbExistsQuery 2>&1
    $dbExists = ($dbExistsResult -match "^\s*1\s*$")
    
    if ($dbExists) {
        Write-Host "✅ La base '$rdsDbName' existe déjà" -ForegroundColor Green
        exit 0
    }
    
    # Créer la base
    Write-Host "   Création de la base '$rdsDbName'..." -ForegroundColor Gray
    $createQuery = "CREATE DATABASE `"$rdsDbName`";"
    $createResult = psql $adminDbUrl -v ON_ERROR_STOP=1 -c $createQuery 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Base '$rdsDbName' créée avec succès!" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "❌ Échec de la création (permissions insuffisantes)" -ForegroundColor Red
        Write-Host "   Erreur: $createResult" -ForegroundColor Red
    }
} else {
    Write-Host "   psql n'est pas disponible" -ForegroundColor Yellow
}

# Méthode 3 : Instructions manuelles
Write-Host ""
Write-Host "📋 SOLUTION MANUELLE (Recommandée):" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Ouvrez AWS Console:" -ForegroundColor Yellow
Write-Host "   https://console.aws.amazon.com/rds/home?region=$Region#databases:" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Sélectionnez l'instance: $rdsIdentifier" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. Ouvrez Query Editor:" -ForegroundColor Yellow
Write-Host "   - Onglet 'Connectivity & security'" -ForegroundColor Gray
Write-Host "   - Cliquez sur 'Query Editor' ou 'Query Editor v2'" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Connectez-vous:" -ForegroundColor Yellow
Write-Host "   - Username: $rdsUsername" -ForegroundColor Gray
Write-Host "   - Password: (depuis terraform.tfvars ou Secrets Manager)" -ForegroundColor Gray
Write-Host "   - Database: postgres" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Exécutez cette commande SQL:" -ForegroundColor Yellow
Write-Host "   CREATE DATABASE `"$rdsDbName`";" -ForegroundColor Green
Write-Host ""
Write-Host "6. Vérifiez:" -ForegroundColor Yellow
Write-Host "   SELECT datname FROM pg_database WHERE datname = '$rdsDbName';" -ForegroundColor Gray
Write-Host ""

# Ouvrir le navigateur si possible
$consoleUrl = "https://console.aws.amazon.com/rds/home?region=$Region#databases:"
Write-Host "🌐 Voulez-vous ouvrir la console AWS dans votre navigateur? (O/N)" -ForegroundColor Cyan
$response = Read-Host
if ($response -eq "O" -or $response -eq "o" -or $response -eq "Y" -or $response -eq "y") {
    Start-Process $consoleUrl
}

