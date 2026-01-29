# Script PowerShell pour exécuter TOUTES les migrations SQLx depuis ECS
# Usage: Exécuter depuis une machine avec accès AWS CLI et accès réseau à RDS

$ErrorActionPreference = "Stop"

# Configuration
$REGION = "us-east-1"
$PROJECT_NAME = "yukpomnang"
$ENVIRONMENT = "production"
$SSM_DATABASE_URL_PATH = "/${PROJECT_NAME}/${ENVIRONMENT}/DATABASE_URL"
$CLUSTER_NAME = "${PROJECT_NAME}-cluster"
$SERVICE_NAME = "${PROJECT_NAME}-backend-service"

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "🔄 Exécution de TOUTES les migrations SQLx depuis ECS" -ForegroundColor Cyan
Write-Host "=================================================================================="
Write-Host ""

# Récupérer DATABASE_URL depuis SSM
Write-Host "🔍 Récupération de DATABASE_URL depuis SSM: $SSM_DATABASE_URL_PATH" -ForegroundColor Cyan
$databaseUrl = aws ssm get-parameter `
    --name $SSM_DATABASE_URL_PATH `
    --region $REGION `
    --with-decryption `
    --query 'Parameter.Value' `
    --output text

if (-not $databaseUrl) {
    Write-Host "❌ Impossible de récupérer DATABASE_URL depuis SSM" -ForegroundColor Red
    exit 1
}

Write-Host "✅ DATABASE_URL récupérée" -ForegroundColor Green
Write-Host ""

# Rechercher une tâche ECS en cours d'exécution
Write-Host "🔍 Recherche d'une tâche ECS en cours d'exécution..." -ForegroundColor Cyan
$tasks = aws ecs list-tasks `
    --cluster $CLUSTER_NAME `
    --service-name $SERVICE_NAME `
    --region $REGION `
    --query 'taskArns[]' `
    --output text

if ($tasks) {
    $taskArn = ($tasks -split "`t")[0]
    Write-Host "✅ Tâche trouvée: $taskArn" -ForegroundColor Green
    Write-Host ""
    Write-Host "🚀 Commandes à exécuter dans ECS:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  # 1. Se connecter à la tâche ECS" -ForegroundColor Gray
    Write-Host "  aws ecs execute-command \`" -ForegroundColor Gray
    Write-Host "    --cluster $CLUSTER_NAME \`" -ForegroundColor Gray
    Write-Host "    --task $taskArn \`" -ForegroundColor Gray
    Write-Host "    --container backend \`" -ForegroundColor Gray
    Write-Host "    --command `/bin/bash` \`" -ForegroundColor Gray
    Write-Host "    --interactive \`" -ForegroundColor Gray
    Write-Host "    --region $REGION" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  # 2. Dans le shell ECS, exécuter:" -ForegroundColor Gray
    Write-Host "  export DATABASE_URL='$databaseUrl'" -ForegroundColor Gray
    Write-Host "  cd /app/backend" -ForegroundColor Gray
    Write-Host "  sqlx migrate info" -ForegroundColor Gray
    Write-Host "  sqlx migrate run" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "⚠️ Aucune tâche ECS en cours d'exécution" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternative: Exécuter les migrations localement (si vous avez accès réseau à RDS):" -ForegroundColor Yellow
    Write-Host "  1. Exporter DATABASE_URL:" -ForegroundColor Gray
    Write-Host "     `$env:DATABASE_URL = '$databaseUrl'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2. Installer sqlx-cli si nécessaire:" -ForegroundColor Gray
    Write-Host "     cargo install sqlx-cli --version 0.8.6 --locked --no-default-features --features postgres" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  3. Exécuter les migrations:" -ForegroundColor Gray
    Write-Host "     cd backend" -ForegroundColor Gray
    Write-Host "     sqlx migrate info" -ForegroundColor Gray
    Write-Host "     sqlx migrate run" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "=================================================================================="
Write-Host "✅ Instructions affichées" -ForegroundColor Green
Write-Host "=================================================================================="



