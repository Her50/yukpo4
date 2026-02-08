# Script pour exécuter les migrations directement via ECS
# Essaie d'abord ECS Exec, puis crée une tâche one-shot si nécessaire

$ErrorActionPreference = "Stop"

$REGION = "us-east-1"
$CLUSTER_NAME = "yukpomnang-cluster"
$SERVICE_NAME = "yukpomnang-backend-service"
$TASK_DEFINITION = "yukpomnang-backend"

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "🚀 Exécution des migrations de configuration de livraison" -ForegroundColor Cyan
Write-Host "=================================================================================="
Write-Host ""

# Méthode 1: Essayer ECS Exec sur une tâche existante
Write-Host "📋 Méthode 1: Tentative via ECS Exec..." -ForegroundColor Yellow

try {
    $tasks = aws ecs list-tasks `
        --cluster $CLUSTER_NAME `
        --service-name $SERVICE_NAME `
        --desired-status RUNNING `
        --region $REGION `
        --query 'taskArns[0]' `
        --output text
    
    if ($tasks) {
        $taskArn = $tasks
        $taskId = $taskArn -replace '.*/', ''
        
        Write-Host "✅ Tâche trouvée: $taskId" -ForegroundColor Green
        Write-Host "   Tentative d'exécution via ECS Exec..." -ForegroundColor Gray
        
        # Commande pour exécuter les migrations
        $command = "cd /app/backend && sqlx migrate run"
        
        # Vérifier si Session Manager Plugin est disponible
        $ssmPlugin = Get-Command session-manager-plugin -ErrorAction SilentlyContinue
        
        if ($ssmPlugin) {
            Write-Host "   ✅ Session Manager Plugin trouvé" -ForegroundColor Green
            Write-Host "   Exécution de la commande..." -ForegroundColor Gray
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
                Write-Host "✅ Migrations exécutées avec succès via ECS Exec!" -ForegroundColor Green
                exit 0
            }
        } else {
            Write-Host "   ⚠️ Session Manager Plugin non trouvé" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "   ⚠️ ECS Exec non disponible: $_" -ForegroundColor Yellow
}

Write-Host ""

# Méthode 2: Créer une tâche one-shot avec les variables d'environnement du service
Write-Host "📋 Méthode 2: Création d'une tâche one-shot..." -ForegroundColor Yellow

try {
    # Récupérer la configuration réseau
    $service = aws ecs describe-services `
        --cluster $CLUSTER_NAME `
        --services $SERVICE_NAME `
        --region $REGION `
        --query 'services[0]' `
        --output json | ConvertFrom-Json
    
    $networkConfig = $service.networkConfiguration.awsvpcConfiguration
    $subnetId = $networkConfig.subnets[0]
    $securityGroupId = $networkConfig.securityGroups[0]
    
    Write-Host "✅ Configuration réseau récupérée" -ForegroundColor Green
    Write-Host "   Subnet: $subnetId" -ForegroundColor Gray
    Write-Host "   Security Group: $securityGroupId" -ForegroundColor Gray
    
    # Récupérer les variables d'environnement de la task definition
    $taskDef = aws ecs describe-task-definition `
        --task-definition $TASK_DEFINITION `
        --region $REGION `
        --query 'taskDefinition.containerDefinitions[0].environment' `
        --output json | ConvertFrom-Json
    
    # Créer les overrides avec les variables d'environnement
    $envVars = @()
    if ($taskDef) {
        foreach ($env in $taskDef) {
            $envVars += @{
                name = $env.name
                value = $env.value
            }
        }
    }
    
    # Ajouter DATABASE_URL si disponible dans les secrets (on essaie de le récupérer)
    # Note: Si les secrets SSM ne sont pas accessibles, cette méthode échouera
    # Dans ce cas, on utilisera les variables d'environnement de la task definition
    
    $overridesObj = @{
        containerOverrides = @(
            @{
                name = "backend"
                command = @("sqlx", "migrate", "run")
                environment = $envVars
            }
        )
    }
    
    $overrides = $overridesObj | ConvertTo-Json -Depth 10 -Compress
    $networkConfigStr = "awsvpcConfiguration={subnets=[$subnetId],securityGroups=[$securityGroupId],assignPublicIp=DISABLED}"
    
    Write-Host "   Création de la tâche..." -ForegroundColor Gray
    
    $taskResult = aws ecs run-task `
        --cluster $CLUSTER_NAME `
        --task-definition $TASK_DEFINITION `
        --launch-type FARGATE `
        --network-configuration $networkConfigStr `
        --overrides $overrides `
        --region $REGION `
        --output json 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erreur lors de la création de la tâche:" -ForegroundColor Red
        Write-Host $taskResult -ForegroundColor Red
        Write-Host ""
        Write-Host "💡 Solution alternative:" -ForegroundColor Yellow
        Write-Host "   1. Installer Session Manager Plugin: winget install Amazon.SessionManagerPlugin" -ForegroundColor White
        Write-Host "   2. Exécuter: .\scripts\run_migrations_via_ecs_exec.ps1" -ForegroundColor White
        Write-Host "   3. Ou redémarrer le service pour appliquer les migrations automatiquement" -ForegroundColor White
        exit 1
    }
    
    $taskJson = $taskResult | ConvertFrom-Json
    
    if (-not $taskJson.tasks -or $taskJson.tasks.Count -eq 0) {
        Write-Host "❌ Aucune tâche créée" -ForegroundColor Red
        if ($taskJson.failures) {
            Write-Host "   Raison: $($taskJson.failures[0].reason)" -ForegroundColor Red
        }
        exit 1
    }
    
    $task = $taskJson.tasks[0]
    $taskArn = $task.taskArn
    $taskId = $taskArn -replace '.*/', ''
    
    Write-Host "✅ Tâche créée: $taskId" -ForegroundColor Green
    Write-Host "   ARN: $taskArn" -ForegroundColor Gray
    Write-Host ""
    Write-Host "⏳ Attente de la fin de l'exécution (peut prendre 1-3 minutes)..." -ForegroundColor Yellow
    
    $maxWait = 300
    $elapsed = 0
    $completed = $false
    
    while ($elapsed -lt $maxWait -and -not $completed) {
        Start-Sleep -Seconds 15
        $elapsed += 15
        
        $taskInfo = aws ecs describe-tasks `
            --cluster $CLUSTER_NAME `
            --tasks $taskArn `
            --region $REGION `
            --query 'tasks[0]' `
            --output json | ConvertFrom-Json
        
        if ($taskInfo) {
            $status = $taskInfo.lastStatus
            Write-Host "   Statut: $status ($elapsed s)" -ForegroundColor Gray
            
            if ($status -eq "STOPPED") {
                $completed = $true
                $exitCode = $taskInfo.containers[0].exitCode
                Write-Host ""
                if ($exitCode -eq 0) {
                    Write-Host "✅ Migrations exécutées avec succès! (code: $exitCode)" -ForegroundColor Green
                } else {
                    Write-Host "⚠️ Code de sortie: $exitCode" -ForegroundColor Yellow
                    if ($taskInfo.containers[0].reason) {
                        Write-Host "   Raison: $($taskInfo.containers[0].reason)" -ForegroundColor Yellow
                    }
                }
            }
        }
    }
    
    if (-not $completed) {
        Write-Host ""
        Write-Host "⚠️ Timeout atteint" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host ""
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Solutions alternatives:" -ForegroundColor Yellow
    Write-Host "   1. Redémarrer le service (les migrations s'appliquent automatiquement):" -ForegroundColor White
    Write-Host "      aws ecs update-service --cluster $CLUSTER_NAME --service $SERVICE_NAME --force-new-deployment --region $REGION" -ForegroundColor Gray
    Write-Host "   2. Utiliser ECS Exec (nécessite Session Manager Plugin):" -ForegroundColor White
    Write-Host "      .\scripts\run_migrations_via_ecs_exec.ps1" -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "✅ Terminé!" -ForegroundColor Green
Write-Host "=================================================================================="
Write-Host ""



