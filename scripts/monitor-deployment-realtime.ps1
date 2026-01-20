# Script de monitoring en temps réel du déploiement ECS
param(
    [int]$IntervalSeconds = 10,
    [int]$MaxIterations = 30
)

$ErrorActionPreference = "Continue"

Write-Host "=== MONITORING EN TEMPS REEL ===`n" -ForegroundColor Cyan
Write-Host "Intervalle: $IntervalSeconds secondes" -ForegroundColor White
Write-Host "Maximum: $MaxIterations iterations`n" -ForegroundColor White
Write-Host "Appuyez sur Ctrl+C pour arreter`n" -ForegroundColor Yellow

$iteration = 0
$clusterName = "yukpomnang-cluster"
$serviceName = "yukpomnang-backend-service"
$region = "eu-west-1"

while ($iteration -lt $MaxIterations) {
    $iteration++
    $timestamp = Get-Date -Format "HH:mm:ss"
    
    Write-Host "`n[$timestamp] Iteration $iteration/$MaxIterations" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Gray
    
    # Service ECS
    try {
        $service = aws ecs describe-services --cluster $clusterName --services $serviceName --region $region --query 'services[0].{Status:status,DesiredCount:desiredCount,RunningCount:runningCount,PendingCount:pendingCount,Deployments:deployments[*].{Status:status,TaskDef:taskDefinition,RunningCount:runningCount,DesiredCount:desiredCount}}' --output json | ConvertFrom-Json
        
        Write-Host "Service ECS:" -ForegroundColor Yellow
        Write-Host "  Status: $($service.Status)" -ForegroundColor $(if($service.Status -eq "ACTIVE"){"Green"}else{"Yellow"})
        Write-Host "  Running: $($service.RunningCount) / Desired: $($service.DesiredCount)" -ForegroundColor White
        Write-Host "  Pending: $($service.PendingCount)" -ForegroundColor $(if($service.PendingCount -gt 0){"Yellow"}else{"Green"})
        
        if ($service.Deployments) {
            Write-Host "  Deployments:" -ForegroundColor Yellow
            foreach($dep in $service.Deployments) {
                $def = $dep.TaskDef.Split('/')[-1]
                $statusColor = if($dep.Status -eq "PRIMARY"){"Green"}else{"Gray"}
                Write-Host "    - $def ($($dep.Status)): $($dep.RunningCount)/$($dep.DesiredCount)" -ForegroundColor $statusColor
            }
        }
    } catch {
        Write-Host "  Erreur: $_" -ForegroundColor Red
    }
    
    # Targets
    try {
        $tgArn = aws elbv2 describe-target-groups --region $region --names yukpomnang-backend-tg --query 'TargetGroups[0].TargetGroupArn' --output text
        $targets = aws elbv2 describe-target-health --target-group-arn $tgArn --region $region --query 'TargetHealthDescriptions[*].{Target:Target.Id,Health:TargetHealth.State,Reason:TargetHealth.Reason}' --output json | ConvertFrom-Json
        
        $healthy = ($targets | Where-Object { $_.Health -eq "healthy" }).Count
        Write-Host "`nTargets:" -ForegroundColor Yellow
        Write-Host "  Healthy: $healthy / $($targets.Count)" -ForegroundColor $(if($healthy -gt 0){"Green"}else{"Yellow"})
        
        foreach($tgt in $targets) {
            if($tgt.Health -ne "draining") {
                $color = switch($tgt.Health) {
                    "healthy" {"Green"}
                    "initial" {"Yellow"}
                    "unhealthy" {"Red"}
                    default {"White"}
                }
                Write-Host "    $($tgt.Target): $($tgt.Health)" -ForegroundColor $color
                if($tgt.Reason) {
                    Write-Host "      $($tgt.Reason)" -ForegroundColor Gray
                }
            }
        }
        
        # Si tous les targets sont healthy, on peut arrêter
        if ($healthy -eq $targets.Count -and $targets.Count -gt 0) {
            Write-Host "`n=== SUCCES! Tous les targets sont healthy! ===" -ForegroundColor Green
            break
        }
    } catch {
        Write-Host "  Erreur: $_" -ForegroundColor Red
    }
    
    # Tâches récentes
    try {
        $tasks = aws ecs list-tasks --cluster $clusterName --service-name $serviceName --region $region --query 'taskArns' --output json | ConvertFrom-Json
        if ($tasks.Count -gt 0) {
            Write-Host "`nTaches actives: $($tasks.Count)" -ForegroundColor Yellow
            $recentTasks = $tasks | Select-Object -First 3
            foreach($t in $recentTasks) {
                $task = aws ecs describe-tasks --cluster $clusterName --tasks $t --region $region --query 'tasks[0].{LastStatus:lastStatus,StartedAt:startedAt,HealthStatus:healthStatus,Containers:containers[*].{Name:name,LastStatus:lastStatus,Reason:reason}}' --output json | ConvertFrom-Json
                $id = $t.Split('/')[-1]
                $statusColor = if($task.LastStatus -eq "RUNNING"){"Green"}else{"Yellow"}
                Write-Host "  $($id.Substring(0,15)): $($task.LastStatus)" -ForegroundColor $statusColor
                if($task.HealthStatus) {
                    $healthColor = if($task.HealthStatus -eq "HEALTHY"){"Green"}else{"Yellow"}
                    Write-Host "    Health: $($task.HealthStatus)" -ForegroundColor $healthColor
                }
            }
        }
    } catch {
        Write-Host "  Erreur: $_" -ForegroundColor Red
    }
    
    Write-Host ("`n" + ("=" * 60)) -ForegroundColor Gray
    
    if ($iteration -lt $MaxIterations) {
        Write-Host "Attente de $IntervalSeconds secondes... (Ctrl+C pour arreter)" -ForegroundColor Gray
        Start-Sleep -Seconds $IntervalSeconds
    }
}

Write-Host "`n=== FIN DU MONITORING ===" -ForegroundColor Cyan




