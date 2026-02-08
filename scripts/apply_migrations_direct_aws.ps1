# Script pour appliquer les migrations directement sur AWS
# Utilise ECS Exec si disponible, sinon donne des instructions

$ErrorActionPreference = "Continue"

$REGION = "us-east-1"
$CLUSTER_NAME = "yukpomnang-cluster"
$SERVICE_NAME = "yukpomnang-backend-service"

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "🚀 Application des migrations de configuration de livraison" -ForegroundColor Cyan
Write-Host "=================================================================================="
Write-Host ""

# Trouver une tâche en cours
Write-Host "📋 Recherche d'une tâche en cours..." -ForegroundColor Yellow

$taskArn = aws ecs list-tasks `
    --cluster $CLUSTER_NAME `
    --service-name $SERVICE_NAME `
    --desired-status RUNNING `
    --region $REGION `
    --query 'taskArns[0]' `
    --output text

if (-not $taskArn) {
    Write-Host "❌ Aucune tâche en cours. Démarrage du service..." -ForegroundColor Red
    aws ecs update-service `
        --cluster $CLUSTER_NAME `
        --service $SERVICE_NAME `
        --desired-count 1 `
        --region $REGION | Out-Null
    
    Write-Host "⏳ Attente de 30 secondes..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    
    $taskArn = aws ecs list-tasks `
        --cluster $CLUSTER_NAME `
        --service-name $SERVICE_NAME `
        --desired-status RUNNING `
        --region $REGION `
        --query 'taskArns[0]' `
        --output text
}

if (-not $taskArn) {
    Write-Host "❌ Impossible de trouver une tâche" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Solution: Redémarrer le service pour appliquer les migrations automatiquement" -ForegroundColor Yellow
    Write-Host "   .\scripts\restart_ecs_and_apply_migrations.ps1" -ForegroundColor White
    exit 1
}

$taskId = $taskArn -replace '.*/', ''
Write-Host "✅ Tâche trouvée: $taskId" -ForegroundColor Green
Write-Host ""

# Vérifier Session Manager Plugin
$ssmPlugin = Get-Command session-manager-plugin -ErrorAction SilentlyContinue

if ($ssmPlugin) {
    Write-Host "✅ Session Manager Plugin trouvé" -ForegroundColor Green
    Write-Host "🚀 Exécution des migrations via ECS Exec..." -ForegroundColor Cyan
    Write-Host ""
    
    $command = 'cd /app/backend && sqlx migrate run'
    
    aws ecs execute-command `
        --cluster $CLUSTER_NAME `
        --task $taskArn `
        --container backend `
        --command $command `
        --interactive `
        --region $REGION
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Migrations exécutées avec succès!" -ForegroundColor Green
        exit 0
    } else {
        Write-Host ""
        Write-Host "⚠️ Code de sortie: $LASTEXITCODE" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️ Session Manager Plugin non trouvé" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📋 Options disponibles:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Option 1: Installer Session Manager Plugin et réessayer" -ForegroundColor Yellow
    Write-Host "   winget install Amazon.SessionManagerPlugin" -ForegroundColor White
    Write-Host "   Puis relancez ce script" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Option 2: Exécuter via AWS Console" -ForegroundColor Yellow
    Write-Host "   1. Allez dans ECS Console → Clusters → $CLUSTER_NAME" -ForegroundColor White
    Write-Host "   2. Tasks → Sélectionnez la tâche $taskId" -ForegroundColor White
    Write-Host "   3. Execute Command → Execute" -ForegroundColor White
    Write-Host "   4. Exécutez: cd /app/backend && sqlx migrate run" -ForegroundColor White
    Write-Host ""
    Write-Host "Option 3: Redémarrer le service (migrations appliquées automatiquement)" -ForegroundColor Yellow
    Write-Host "   .\scripts\restart_ecs_and_apply_migrations.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "Option 4: Commande AWS CLI directe (si plugin installé)" -ForegroundColor Yellow
    Write-Host "   aws ecs execute-command \`" -ForegroundColor White
    Write-Host "     --cluster $CLUSTER_NAME \`" -ForegroundColor White
    Write-Host "     --task $taskArn \`" -ForegroundColor White
    Write-Host "     --container backend \`" -ForegroundColor White
    Write-Host "     --command `"cd /app/backend && sqlx migrate run`" \`" -ForegroundColor White
    Write-Host "     --interactive \`" -ForegroundColor White
    Write-Host "     --region $REGION" -ForegroundColor White
    Write-Host ""
}

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "✅ Instructions affichées" -ForegroundColor Green
Write-Host "=================================================================================="
Write-Host ""

