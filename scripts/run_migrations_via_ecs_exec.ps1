# Script pour exécuter les migrations via ECS Exec sur une tâche existante
# Cette méthode fonctionne car les tâches du service ont déjà accès aux secrets

$ErrorActionPreference = "Stop"

$REGION = "us-east-1"
$CLUSTER_NAME = "yukpomnang-cluster"
$SERVICE_NAME = "yukpomnang-backend-service"

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "🚀 Exécution des migrations via ECS Exec" -ForegroundColor Cyan
Write-Host "=================================================================================="
Write-Host ""

# Étape 1: Trouver une tâche en cours d'exécution
Write-Host "📋 Étape 1: Recherche d'une tâche en cours d'exécution..." -ForegroundColor Yellow

try {
    $tasks = aws ecs list-tasks `
        --cluster $CLUSTER_NAME `
        --service-name $SERVICE_NAME `
        --desired-status RUNNING `
        --region $REGION `
        --query 'taskArns[]' `
        --output json | ConvertFrom-Json
    
    if (-not $tasks -or $tasks.Count -eq 0) {
        Write-Host "❌ Aucune tâche en cours d'exécution trouvée" -ForegroundColor Red
        Write-Host "   Le service doit être démarré pour utiliser ECS Exec" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "💡 Alternatives:" -ForegroundColor Cyan
        Write-Host "   1. Démarrer le service: aws ecs update-service --cluster $CLUSTER_NAME --service $SERVICE_NAME --desired-count 1 --region $REGION" -ForegroundColor Gray
        Write-Host "   2. Utiliser une tâche one-shot (nécessite permissions SSM): .\scripts\run_migrations_ecs_direct.ps1" -ForegroundColor Gray
        exit 1
    }
    
    $taskArn = $tasks[0]
    $taskId = $taskArn -replace '.*/', ''
    
    Write-Host "✅ Tâche trouvée: $taskId" -ForegroundColor Green
    Write-Host "   ARN: $taskArn" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "❌ Erreur lors de la recherche de tâche: $_" -ForegroundColor Red
    exit 1
}

# Étape 2: Vérifier que ECS Exec est activé
Write-Host "📋 Étape 2: Vérification de ECS Exec..." -ForegroundColor Yellow

try {
    $service = aws ecs describe-services `
        --cluster $CLUSTER_NAME `
        --services $SERVICE_NAME `
        --region $REGION `
        --query 'services[0].enableExecuteCommand' `
        --output text
    
    if ($service -ne "True") {
        Write-Host "⚠️ ECS Exec n'est pas activé sur le service" -ForegroundColor Yellow
        Write-Host "   Activation de ECS Exec..." -ForegroundColor Gray
        
        aws ecs update-service `
            --cluster $CLUSTER_NAME `
            --service $SERVICE_NAME `
            --enable-execute-command `
            --region $REGION `
            --output json | Out-Null
        
        Write-Host "✅ ECS Exec activé" -ForegroundColor Green
        Write-Host "   ⏳ Attente de 30 secondes pour que le changement prenne effet..." -ForegroundColor Yellow
        Start-Sleep -Seconds 30
    } else {
        Write-Host "✅ ECS Exec est déjà activé" -ForegroundColor Green
    }
    Write-Host ""
} catch {
    Write-Host "⚠️ Impossible de vérifier/activer ECS Exec: $_" -ForegroundColor Yellow
    Write-Host "   Continuons quand même..." -ForegroundColor Gray
    Write-Host ""
}

# Étape 3: Exécuter les migrations via ECS Exec
Write-Host "📋 Étape 3: Exécution des migrations..." -ForegroundColor Yellow
Write-Host ""
Write-Host "💡 Cette commande va ouvrir un shell interactif dans le conteneur" -ForegroundColor Cyan
Write-Host "   Exécutez les commandes suivantes:" -ForegroundColor Gray
Write-Host "   1. cd /app/backend" -ForegroundColor White
Write-Host "   2. sqlx migrate info" -ForegroundColor White
Write-Host "   3. sqlx migrate run" -ForegroundColor White
Write-Host "   4. exit" -ForegroundColor White
Write-Host ""
Write-Host "   Ou utilisez cette commande non-interactive:" -ForegroundColor Cyan
Write-Host ""

# Commande non-interactive (nécessite Session Manager Plugin)
$command = "cd /app/backend && sqlx migrate info && sqlx migrate run"

Write-Host "🚀 Exécution de la commande..." -ForegroundColor Cyan
Write-Host "   Commande: $command" -ForegroundColor Gray
Write-Host ""

try {
    # Vérifier si Session Manager Plugin est installé
    $ssmPlugin = Get-Command session-manager-plugin -ErrorAction SilentlyContinue
    
    if (-not $ssmPlugin) {
        Write-Host "⚠️ Session Manager Plugin n'est pas installé" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "📋 Option 1: Installer Session Manager Plugin" -ForegroundColor Cyan
        Write-Host "   Windows: winget install Amazon.SessionManagerPlugin" -ForegroundColor White
        Write-Host "   Ou télécharger: https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html" -ForegroundColor White
        Write-Host ""
        Write-Host "📋 Option 2: Exécuter manuellement via AWS Console" -ForegroundColor Cyan
        Write-Host "   1. Allez dans ECS Console → Clusters → $CLUSTER_NAME" -ForegroundColor White
        Write-Host "   2. Tasks → Sélectionnez la tâche $taskId" -ForegroundColor White
        Write-Host "   3. Execute Command → Execute" -ForegroundColor White
        Write-Host "   4. Exécutez: cd /app/backend && sqlx migrate run" -ForegroundColor White
        Write-Host ""
        Write-Host "📋 Option 3: Utiliser AWS CLI directement (si plugin installé)" -ForegroundColor Cyan
        Write-Host "   aws ecs execute-command \`" -ForegroundColor White
        Write-Host "     --cluster $CLUSTER_NAME \`" -ForegroundColor White
        Write-Host "     --task $taskArn \`" -ForegroundColor White
        Write-Host "     --container backend \`" -ForegroundColor White
        Write-Host "     --command `"$command`" \`" -ForegroundColor White
        Write-Host "     --interactive \`" -ForegroundColor White
        Write-Host "     --region $REGION" -ForegroundColor White
        Write-Host ""
        exit 0
    }
    
    # Exécuter la commande
    Write-Host "✅ Session Manager Plugin trouvé, exécution de la commande..." -ForegroundColor Green
    Write-Host ""
    
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
    } else {
        Write-Host ""
        Write-Host "⚠️ La commande a retourné un code de sortie: $LASTEXITCODE" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host ""
    Write-Host "❌ Erreur lors de l'exécution: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Essayez d'exécuter manuellement:" -ForegroundColor Yellow
    Write-Host "   aws ecs execute-command --cluster $CLUSTER_NAME --task $taskArn --container backend --command `"$command`" --interactive --region $REGION" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "✅ Terminé!" -ForegroundColor Green
Write-Host "=================================================================================="
Write-Host ""



