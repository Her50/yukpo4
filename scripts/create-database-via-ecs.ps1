# 🔧 Script pour créer la base de données via ECS Task
# Utilise une tâche ECS pour créer la base de données dans le VPC privé

param(
    [string]$ClusterName = "yukpo-cluster",
    [string]$Region = "eu-west-1"
)

Write-Host "🔧 Création de la base de données via ECS Task..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que AWS CLI est disponible
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ERREUR: AWS CLI n'est pas installé" -ForegroundColor Red
    exit 1
}

# Récupérer les informations depuis Terraform ou AWS
Push-Location infra/aws
try {
    $rdsEndpoint = terraform output -raw rds_endpoint 2>$null
    $rdsUsername = terraform output -raw rds_username 2>$null
    $rdsPassword = terraform output -raw rds_password 2>$null
    $rdsDbName = terraform output -raw rds_database_name 2>$null
} finally {
    Pop-Location
}

if ([string]::IsNullOrEmpty($rdsEndpoint) -or [string]::IsNullOrEmpty($rdsDbName)) {
    Write-Host "❌ ERREUR: Impossible de récupérer les informations RDS" -ForegroundColor Red
    Write-Host "   Vérifiez que Terraform a été appliqué" -ForegroundColor Yellow
    exit 1
}

Write-Host "📊 Informations RDS:" -ForegroundColor Yellow
Write-Host "   Endpoint: $rdsEndpoint" -ForegroundColor Gray
Write-Host "   Database: $rdsDbName" -ForegroundColor Gray
Write-Host "   Username: $rdsUsername" -ForegroundColor Gray
Write-Host ""

# Créer une tâche ECS one-shot pour créer la base
Write-Host "🚀 Lancement d'une tâche ECS pour créer la base de données..." -ForegroundColor Yellow

# Récupérer la task definition
$taskDef = aws ecs describe-task-definition `
    --task-definition yukpo-backend `
    --region $Region `
    --query 'taskDefinition.taskDefinitionArn' `
    --output text

if ([string]::IsNullOrEmpty($taskDef)) {
    Write-Host "❌ ERREUR: Impossible de récupérer la task definition" -ForegroundColor Red
    exit 1
}

# Récupérer les subnets privés
$subnets = aws ec2 describe-subnets `
    --filters "Name=tag:Name,Values=yukpo-private-subnet-*" `
    --region $Region `
    --query 'Subnets[*].SubnetId' `
    --output text

if ([string]::IsNullOrEmpty($subnets)) {
    Write-Host "❌ ERREUR: Impossible de trouver les subnets privés" -ForegroundColor Red
    exit 1
}

# Récupérer le security group ECS
$securityGroup = aws ec2 describe-security-groups `
    --filters "Name=tag:Name,Values=yukpo-ecs-sg" `
    --region $Region `
    --query 'SecurityGroups[0].GroupId' `
    --output text

# Construire la commande SQL
$createDbSql = "CREATE DATABASE `"$rdsDbName`";"

# Créer un script SQL temporaire
$sqlScript = @"
-- Script pour créer la base de données
$createDbSql

-- Vérifier que la base existe
SELECT datname FROM pg_database WHERE datname = '$rdsDbName';
"@

$sqlFile = [System.IO.Path]::GetTempFileName() + ".sql"
$sqlScript | Out-File -FilePath $sqlFile -Encoding UTF8

Write-Host "📝 Script SQL créé: $sqlFile" -ForegroundColor Gray
Write-Host ""

# Exécuter la commande via ECS run-task
Write-Host "🔄 Exécution de la commande via ECS..." -ForegroundColor Yellow

# Note: Cette approche nécessite que psql soit disponible dans le conteneur
# Alternative: Utiliser AWS RDS Query Editor ou une instance EC2

Write-Host "⚠️  NOTE: Cette méthode nécessite psql dans le conteneur" -ForegroundColor Yellow
Write-Host "   Alternative recommandée: Utiliser AWS RDS Query Editor" -ForegroundColor Yellow
Write-Host ""
Write-Host "📋 SOLUTION MANUELLE:" -ForegroundColor Cyan
Write-Host "   1. Allez sur AWS Console → RDS → yukpo-db" -ForegroundColor Gray
Write-Host "   2. Ouvrez Query Editor" -ForegroundColor Gray
Write-Host "   3. Exécutez: CREATE DATABASE `"$rdsDbName`";" -ForegroundColor Gray
Write-Host ""
Write-Host "   OU utilisez le script: .\scripts\post-deploy-aws.ps1" -ForegroundColor Gray

# Nettoyer
Remove-Item $sqlFile -ErrorAction SilentlyContinue

