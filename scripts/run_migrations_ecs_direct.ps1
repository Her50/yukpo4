# Script pour exécuter les migrations directement via une tâche ECS one-shot
# Fonctionne même si la base de données est dans un VPC privé

$ErrorActionPreference = "Stop"

$REGION = "us-east-1"
$CLUSTER_NAME = "yukpomnang-cluster"
$TASK_DEFINITION = "yukpomnang-backend"
$SERVICE_NAME = "yukpomnang-backend-service"

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "🚀 Exécution des migrations via ECS Task" -ForegroundColor Cyan
Write-Host "=================================================================================="
Write-Host ""

# Étape 1: Récupérer la configuration réseau depuis le service existant
Write-Host "📋 Étape 1: Récupération de la configuration réseau..." -ForegroundColor Yellow
try {
    $service = aws ecs describe-services `
        --cluster $CLUSTER_NAME `
        --services $SERVICE_NAME `
        --region $REGION `
        --query 'services[0]' `
        --output json | ConvertFrom-Json
    
    if (-not $service -or $service.status -ne "ACTIVE") {
        Write-Host "❌ Service $SERVICE_NAME non trouvé ou inactif" -ForegroundColor Red
        exit 1
    }
    
    $networkConfig = $service.networkConfiguration.awsvpcConfiguration
    $subnetId = $networkConfig.subnets[0]
    $securityGroupId = $networkConfig.securityGroups[0]
    
    Write-Host "✅ Configuration réseau récupérée" -ForegroundColor Green
    Write-Host "   Subnet: $subnetId" -ForegroundColor Gray
    Write-Host "   Security Group: $securityGroupId" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "❌ Erreur lors de la récupération de la config réseau: $_" -ForegroundColor Red
    exit 1
}

# Étape 2: Créer une tâche ECS qui exécute sqlx migrate run
Write-Host "📋 Étape 2: Création de la tâche ECS..." -ForegroundColor Yellow

# Utiliser la syntaxe inline pour éviter les problèmes d'échappement JSON
$networkConfigStr = "awsvpcConfiguration={subnets=[$subnetId],securityGroups=[$securityGroupId],assignPublicIp=DISABLED}"
$overridesStr = '{"containerOverrides":[{"name":"backend","command":["sqlx","migrate","run"]}]}'

try {
    Write-Host "   Exécution de la tâche ECS..." -ForegroundColor Gray
    
    $taskResult = aws ecs run-task `
        --cluster $CLUSTER_NAME `
        --task-definition $TASK_DEFINITION `
        --launch-type FARGATE `
        --network-configuration $networkConfigStr `
        --overrides $overridesStr `
        --region $REGION `
        --output json 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erreur lors de la création de la tâche:" -ForegroundColor Red
        Write-Host $taskResult -ForegroundColor Red
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
    
    # Étape 3: Attendre la fin de l'exécution
    Write-Host "📋 Étape 3: Attente de la fin de l'exécution..." -ForegroundColor Yellow
    Write-Host "   (Cela peut prendre 1-3 minutes)" -ForegroundColor Gray
    Write-Host ""
    
    $maxWait = 300 # 5 minutes (augmenté car sqlx peut prendre du temps)
    $elapsed = 0
    $completed = $false
    $lastStatus = ""
    
    while ($elapsed -lt $maxWait -and -not $completed) {
        Start-Sleep -Seconds 15
        $elapsed += 15
        
        try {
            $taskInfo = aws ecs describe-tasks `
                --cluster $CLUSTER_NAME `
                --tasks $taskArn `
                --region $REGION `
                --query 'tasks[0]' `
                --output json | ConvertFrom-Json
            
            if (-not $taskInfo) {
                Write-Host "   ⚠️ Tâche non trouvée, attente..." -ForegroundColor Yellow
                continue
            }
            
            $currentStatus = $taskInfo.lastStatus
            $desiredStatus = $taskInfo.desiredStatus
            
            if ($currentStatus -ne $lastStatus) {
                Write-Host "   Statut: $currentStatus ($elapsed s)" -ForegroundColor Gray
                $lastStatus = $currentStatus
            }
            
            if ($currentStatus -eq "STOPPED") {
                $completed = $true
                $exitCode = $taskInfo.containers[0].exitCode
                
                Write-Host ""
                if ($exitCode -eq 0) {
                    Write-Host "✅ Tâche terminée avec succès (code: $exitCode)" -ForegroundColor Green
                } else {
                    Write-Host "⚠️ Tâche terminée avec code: $exitCode" -ForegroundColor Yellow
                    if ($taskInfo.containers[0].reason) {
                        Write-Host "   Raison: $($taskInfo.containers[0].reason)" -ForegroundColor Yellow
                    }
                }
            }
        } catch {
            Write-Host "   ⚠️ Erreur lors de la vérification: $_" -ForegroundColor Yellow
        }
    }
    
    if (-not $completed) {
        Write-Host ""
        Write-Host "⚠️ Timeout atteint ($maxWait secondes)" -ForegroundColor Yellow
        Write-Host "   La tâche est peut-être encore en cours d'exécution" -ForegroundColor Gray
        Write-Host "   Vérifiez manuellement: aws ecs describe-tasks --cluster $CLUSTER_NAME --tasks $taskArn --region $REGION" -ForegroundColor Gray
    }
    
    Write-Host ""
    
    # Étape 4: Récupérer les logs
    Write-Host "📋 Étape 4: Récupération des logs..." -ForegroundColor Yellow
    
    $logGroup = "/ecs/yukpomnang-backend"
    $logStream = "backend/backend/$taskId"
    
    Start-Sleep -Seconds 10 # Attendre que les logs soient disponibles
    
    try {
        $logs = aws logs get-log-events `
            --log-group-name $logGroup `
            --log-stream-name $logStream `
            --region $REGION `
            --start-time $([DateTimeOffset]::Now.AddMinutes(-10).ToUnixTimeMilliseconds()) `
            --query 'events[*].message' `
            --output text 2>&1
        
        if ($logs -and $logs -notmatch "ResourceNotFoundException") {
            Write-Host ""
            Write-Host "📊 Logs de migration:" -ForegroundColor Cyan
            
            # Afficher tous les logs (ils sont pertinents pour les migrations)
            $logLines = $logs -split "`t" | Where-Object { $_.Trim() -ne "" }
            
            if ($logLines) {
                $logLines | ForEach-Object {
                    $line = $_.Trim()
                    if ($line -match "migration|Migration|ALTER|CREATE|preparation_time|storage_location|column") {
                        Write-Host "   $line" -ForegroundColor Green
                    } else {
                        Write-Host "   $line" -ForegroundColor Gray
                    }
                }
            } else {
                Write-Host "   (Aucun log trouvé)" -ForegroundColor Gray
            }
        } else {
            Write-Host "   ⚠️ Logs non disponibles ou en cours de traitement" -ForegroundColor Yellow
            Write-Host "   Vérifiez manuellement: aws logs tail $logGroup --follow --region $REGION" -ForegroundColor Gray
        }
    } catch {
        Write-Host "   ⚠️ Impossible de récupérer les logs: $_" -ForegroundColor Yellow
        Write-Host "   Vérifiez manuellement: aws logs tail $logGroup --follow --region $REGION" -ForegroundColor Gray
    }
    
    Write-Host ""
    
    # Étape 5: Vérification finale
    Write-Host "📋 Étape 5: Résumé..." -ForegroundColor Yellow
    Write-Host ""
    
    if ($completed -and $exitCode -eq 0) {
        Write-Host "✅ Migrations exécutées avec succès!" -ForegroundColor Green
        Write-Host ""
        Write-Host "💡 Les migrations suivantes ont été appliquées:" -ForegroundColor Cyan
        Write-Host "   - Toutes les migrations SQLx dans backend/migrations/" -ForegroundColor Gray
        Write-Host "   - Les colonnes de product_delivery_config:" -ForegroundColor Gray
        Write-Host "     * preparation_time_minutes" -ForegroundColor White
        Write-Host "     * storage_location_id" -ForegroundColor White
        Write-Host "     * max_preparation_time_minutes" -ForegroundColor White
        Write-Host "     * availability_days" -ForegroundColor White
        Write-Host "     * is_immediately_available" -ForegroundColor White
    } else {
        Write-Host "⚠️ Vérifiez les logs ci-dessus pour plus de détails" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "📋 Pour vérifier manuellement les migrations:" -ForegroundColor Cyan
    Write-Host "   aws logs tail $logGroup --follow --region $REGION" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "❌ Erreur lors de l'exécution: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Vérifiez que:" -ForegroundColor Yellow
    Write-Host "   - Le cluster ECS existe: $CLUSTER_NAME" -ForegroundColor Gray
    Write-Host "   - La task definition existe: $TASK_DEFINITION" -ForegroundColor Gray
    Write-Host "   - Vous avez les permissions AWS nécessaires" -ForegroundColor Gray
    Write-Host "   - Le service $SERVICE_NAME est actif" -ForegroundColor Gray
    exit 1
}

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "✅ Terminé!" -ForegroundColor Green
Write-Host "=================================================================================="
Write-Host ""



