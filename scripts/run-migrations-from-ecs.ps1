# Script PowerShell pour exécuter les migrations directement depuis ECS via AWS CLI
# Usage: Exécuter depuis une machine avec accès AWS CLI et accès réseau à RDS

$ErrorActionPreference = "Stop"

# Configuration
$REGION = "us-east-1"
$PROJECT_NAME = "yukpomnang"
$ENVIRONMENT = "production"
$SSM_DATABASE_URL_PATH = "/${PROJECT_NAME}/${ENVIRONMENT}/DATABASE_URL"
$CLUSTER_NAME = "${PROJECT_NAME}-cluster"
$SERVICE_NAME = "${PROJECT_NAME}-backend-service"
$TASK_FAMILY = "${PROJECT_NAME}-backend"

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "🔄 Exécution des migrations depuis ECS Task" -ForegroundColor Cyan
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

# Option 1: Exécuter via ECS Exec (si activé)
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
    Write-Host "🚀 Exécution des migrations via ECS Exec..." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Commande à exécuter dans ECS:" -ForegroundColor Yellow
    Write-Host "  export DATABASE_URL='$databaseUrl'" -ForegroundColor Gray
    Write-Host "  cd /app/backend" -ForegroundColor Gray
    Write-Host "  sqlx migrate info" -ForegroundColor Gray
    Write-Host "  sqlx migrate run" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Pour exécuter via AWS CLI:" -ForegroundColor Yellow
    Write-Host "  aws ecs execute-command --cluster $CLUSTER_NAME --task $taskArn --container backend --command `/bin/bash` --interactive --region $REGION" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "⚠️ Aucune tâche ECS en cours d'exécution" -ForegroundColor Yellow
    Write-Host ""
}

# Option 2: Exécuter directement si on a accès à la base
Write-Host "🔍 Vérification de l'accès à la base de données..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Pour exécuter les migrations localement (si vous avez accès réseau à RDS):" -ForegroundColor Yellow
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

Write-Host "=================================================================================="
Write-Host "✅ Instructions affichées" -ForegroundColor Green
Write-Host "=================================================================================="





