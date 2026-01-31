# Script PowerShell pour corriger le DATABASE_URL dans AWS SSM Parameter Store
# Usage: .\fix_database_url_aws.ps1 -RdsEndpoint "endpoint" -DbUser "user" -DbPassword "password" -DbName "dbname"

param(
    [string]$RdsEndpoint = "",
    [string]$DbUser = "yukpo_db_user",
    [string]$DbPassword = "",
    [string]$DbName = "yukpo_db",
    [string]$Region = "us-east-1",
    [string]$ParameterName = "/yukpomnang/production/DATABASE_URL"
)

Write-Host "🔧 Script de Correction DATABASE_URL pour AWS" -ForegroundColor Green
Write-Host ""

# Vérifier que AWS CLI est installé
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "❌ AWS CLI n'est pas installé" -ForegroundColor Red
    Write-Host "Installez-le depuis: https://aws.amazon.com/cli/"
    exit 1
}

# Vérifier que les credentials AWS sont configurés
try {
    $null = aws sts get-caller-identity 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "AWS credentials non configurées"
    }
} catch {
    Write-Host "❌ AWS credentials non configurées" -ForegroundColor Red
    Write-Host "Configurez-les avec: aws configure"
    exit 1
}

# Si RDS_ENDPOINT n'est pas fourni, essayer de le trouver automatiquement
if ([string]::IsNullOrEmpty($RdsEndpoint)) {
    Write-Host "⚠️  Endpoint RDS non fourni, tentative de détection automatique..." -ForegroundColor Yellow
    
    # Lister les bases de données RDS
    $rdsDbs = aws rds describe-db-instances `
        --region $Region `
        --query 'DBInstances[?Engine==`postgres`].[DBInstanceIdentifier,Endpoint.Address]' `
        --output text 2>&1
    
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrEmpty($rdsDbs)) {
        Write-Host "❌ Aucune base de données PostgreSQL trouvée dans RDS" -ForegroundColor Red
        Write-Host ""
        Write-Host "Trouvez manuellement l'endpoint RDS:"
        Write-Host "1. Console AWS → RDS → Databases"
        Write-Host "2. Sélectionnez votre base de données PostgreSQL"
        Write-Host "3. Copiez l'endpoint (ex: yukpomnang-db.xxxxx.us-east-1.rds.amazonaws.com)"
        Write-Host ""
        Write-Host "Usage: .\fix_database_url_aws.ps1 -RdsEndpoint 'endpoint' -DbPassword 'password'"
        exit 1
    }
    
    Write-Host "✅ Bases de données PostgreSQL trouvées:" -ForegroundColor Green
    $rdsDbs | ForEach-Object {
        Write-Host "  - $_"
    }
    
    # Prendre le premier endpoint (deuxième colonne)
    $RdsEndpoint = ($rdsDbs -split "`t" | Select-Object -Skip 1 -First 1)
    Write-Host ""
    Write-Host "⚠️  Utilisation du premier endpoint trouvé: $RdsEndpoint" -ForegroundColor Yellow
    Write-Host "   Si ce n'est pas le bon, spécifiez-le manuellement avec -RdsEndpoint"
    Write-Host ""
}

# Demander le mot de passe si non fourni
if ([string]::IsNullOrEmpty($DbPassword)) {
    Write-Host "⚠️  Mot de passe non fourni" -ForegroundColor Yellow
    $securePassword = Read-Host "Entrez le mot de passe de la base de données" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $DbPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

# Construire le DATABASE_URL
# Format: postgresql://user:password@host:port/database?sslmode=require
$DatabaseUrl = "postgresql://${DbUser}:${DbPassword}@${RdsEndpoint}:5432/${DbName}?sslmode=require"

Write-Host "✅ DATABASE_URL construit:" -ForegroundColor Green
Write-Host "   postgresql://${DbUser}:***@${RdsEndpoint}:5432/${DbName}?sslmode=require"
Write-Host ""

# Vérifier que le paramètre existe
Write-Host "🔍 Vérification du paramètre SSM..." -ForegroundColor Yellow
try {
    $null = aws ssm get-parameter --name $ParameterName --region $Region 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Paramètre trouvé: $ParameterName" -ForegroundColor Green
        
        # Afficher l'ancienne valeur (masquée)
        $oldValue = aws ssm get-parameter `
            --name $ParameterName `
            --region $Region `
            --with-decryption `
            --query 'Parameter.Value' `
            --output text
        
        if ($oldValue -match '@([^:]+):') {
            $oldEndpoint = $matches[1]
            Write-Host "   Ancienne valeur: postgresql://***@${oldEndpoint}:***/***" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "⚠️  Paramètre non trouvé, création..." -ForegroundColor Yellow
}

Write-Host ""
$confirm = Read-Host "Voulez-vous mettre à jour le paramètre SSM? (y/N)"

if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "⚠️  Opération annulée" -ForegroundColor Yellow
    exit 0
}

# Mettre à jour le paramètre SSM
Write-Host "🔄 Mise à jour du paramètre SSM..." -ForegroundColor Yellow
aws ssm put-parameter `
    --name $ParameterName `
    --value $DatabaseUrl `
    --type "SecureString" `
    --region $Region `
    --overwrite

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Paramètre SSM mis à jour avec succès!" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: Redéployez le service ECS pour que les changements prennent effet" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Pour redéployer:"
    Write-Host "1. Console AWS → ECS → Clusters → yukpomnang-cluster"
    Write-Host "2. Services → yukpomnang-backend-service"
    Write-Host "3. Update → Force new deployment"
    Write-Host ""
    Write-Host "Ou via AWS CLI:"
    Write-Host "aws ecs update-service --cluster yukpomnang-cluster --service yukpomnang-backend-service --force-new-deployment --region $Region"
} else {
    Write-Host "❌ Erreur lors de la mise à jour du paramètre SSM" -ForegroundColor Red
    exit 1
}

