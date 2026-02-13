# Script pour vérifier l'état de santé du service ECS

$cluster = "yukpo-cluster"
$service = "yukpo-backend-service"
$region = "eu-west-1"

Write-Host "Verification de l'etat du service ECS..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. État du service
Write-Host "1. Etat du service:" -ForegroundColor Yellow
$serviceInfo = aws ecs describe-services `
    --cluster $cluster `
    --services $service `
    --region $region `
    --output json | ConvertFrom-Json

$svc = $serviceInfo.services[0]
Write-Host "   Status: $($svc.status)" -ForegroundColor $(if ($svc.status -eq "ACTIVE") { "Green" } else { "Red" })
Write-Host "   Desired Count: $($svc.desiredCount)" -ForegroundColor Gray
Write-Host "   Running Count: $($svc.runningCount)" -ForegroundColor Gray
Write-Host "   Pending Count: $($svc.pendingCount)" -ForegroundColor Gray
Write-Host ""

# 2. Déploiements
Write-Host "2. Deploiements:" -ForegroundColor Yellow
foreach ($deployment in $svc.deployments) {
    $statusColor = if ($deployment.status -eq "PRIMARY") { "Green" } else { "Yellow" }
    Write-Host "   Status: $($deployment.status)" -ForegroundColor $statusColor
    Write-Host "   Running: $($deployment.runningCount)/$($deployment.desiredCount)" -ForegroundColor Gray
    Write-Host "   Rollout State: $($deployment.rolloutState)" -ForegroundColor Gray
    Write-Host ""
}

# 3. Tâches en cours
Write-Host "3. Taches en cours:" -ForegroundColor Yellow
$tasks = aws ecs list-tasks `
    --cluster $cluster `
    --service-name $service `
    --desired-status RUNNING `
    --region $region `
    --output json | ConvertFrom-Json

if ($tasks.taskArns.Count -gt 0) {
    $taskArn = $tasks.taskArns[0]
    $taskId = $taskArn.Split('/')[-1]
    
    $taskDetails = aws ecs describe-tasks `
        --cluster $cluster `
        --tasks $taskArn `
        --region $region `
        --output json | ConvertFrom-Json
    
    $task = $taskDetails.tasks[0]
    Write-Host "   Task ID: $taskId" -ForegroundColor Gray
    Write-Host "   Last Status: $($task.lastStatus)" -ForegroundColor $(if ($task.lastStatus -eq "RUNNING") { "Green" } else { "Red" })
    Write-Host "   Health Status: $($task.healthStatus)" -ForegroundColor $(if ($task.healthStatus -eq "HEALTHY") { "Green" } elseif ($task.healthStatus -eq "UNKNOWN") { "Yellow" } else { "Red" })
    
    foreach ($container in $task.containers) {
        Write-Host "   Container: $($container.name)" -ForegroundColor Gray
        Write-Host "     Status: $($container.lastStatus)" -ForegroundColor Gray
        Write-Host "     Health: $($container.healthStatus)" -ForegroundColor $(if ($container.healthStatus -eq "HEALTHY") { "Green" } elseif ($container.healthStatus -eq "UNKNOWN") { "Yellow" } else { "Red" })
        if ($container.reason) {
            Write-Host "     Reason: $($container.reason)" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "   Aucune tache en cours d'execution" -ForegroundColor Red
}
Write-Host ""

# 4. Événements récents
Write-Host "4. Evenements recents:" -ForegroundColor Yellow
$events = $svc.events[0..4]
foreach ($event in $events) {
    $time = $event.createdAt
    $message = $event.message
    Write-Host "   [$time] $message" -ForegroundColor Gray
}
Write-Host ""

# 5. Résumé
Write-Host "5. Resume:" -ForegroundColor Yellow
if ($svc.runningCount -eq $svc.desiredCount -and $svc.runningCount -gt 0) {
    $primaryDeployment = $svc.deployments | Where-Object { $_.status -eq "PRIMARY" }
    if ($primaryDeployment.rolloutState -eq "COMPLETED") {
        Write-Host "   Service operationnel!" -ForegroundColor Green
    } else {
        Write-Host "   Deploiement en cours..." -ForegroundColor Yellow
    }
} else {
    Write-Host "   Probleme detecte - certaines taches ne sont pas en cours d'execution" -ForegroundColor Red
}

