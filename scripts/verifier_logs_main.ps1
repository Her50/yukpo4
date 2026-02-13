# Script pour vérifier les logs [MAIN] après l'ajout de MONGODB_URL

$ErrorActionPreference = "Stop"

$cluster = "yukpo-cluster"
$service = "yukpo-backend-service"
$region = "eu-west-1"
$logGroup = "/ecs/yukpo-backend"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VÉRIFICATION LOGS [MAIN]" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Attendre que les nouvelles tâches démarrent
Write-Host "Attente de 30 secondes pour que les tâches démarrent..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Récupérer les tâches en cours
Write-Host "Récupération des tâches en cours..." -ForegroundColor Cyan
$runningTasks = aws ecs list-tasks --cluster $cluster --service-name $service --desired-status RUNNING --region $region --max-items 5 --output json | ConvertFrom-Json

if (-not $runningTasks.taskArns -or $runningTasks.taskArns.Count -eq 0) {
    Write-Host "❌ Aucune tâche en cours" -ForegroundColor Red
    exit 1
}

Write-Host "Tâches trouvées: $($runningTasks.taskArns.Count)" -ForegroundColor Green
Write-Host ""

# Analyser chaque tâche
foreach ($taskArn in $runningTasks.taskArns) {
    $taskId = $taskArn.Split('/')[-1]
    Write-Host "Analyse de la tâche: $taskId" -ForegroundColor Yellow
    Write-Host "----------------------------------------" -ForegroundColor Gray
    
    # Détails de la tâche
    $taskDetails = aws ecs describe-tasks --cluster $cluster --tasks $taskArn --region $region --output json | ConvertFrom-Json
    if ($taskDetails.tasks) {
        $task = $taskDetails.tasks[0]
        Write-Host "  Task Definition: $($task.taskDefinitionArn.Split('/')[-1])" -ForegroundColor White
        Write-Host "  Health Status: $($task.containers[0].healthStatus)" -ForegroundColor $(if ($task.containers[0].healthStatus -eq "HEALTHY") { "Green" } elseif ($task.containers[0].healthStatus -eq "UNKNOWN") { "Yellow" } else { "Red" })
        Write-Host "  Started At: $($task.startedAt)" -ForegroundColor Gray
        Write-Host ""
    }
    
    # Récupérer les logs
    $streamName = "backend/backend/$taskId"
    Write-Host "  Log Stream: $streamName" -ForegroundColor Gray
    
    try {
        $logEvents = aws logs get-log-events --log-group-name $logGroup --log-stream-name $streamName --region $region --limit 200 --output json 2>&1 | ConvertFrom-Json
        
        if ($logEvents.events) {
            Write-Host "  Total d'événements: $($logEvents.events.Count)" -ForegroundColor White
            Write-Host ""
            
            # Rechercher les logs [MAIN]
            $mainLogs = $logEvents.events | Where-Object { $_.message -match "\[MAIN\]" }
            
            if ($mainLogs) {
                Write-Host "  ✅ LOGS [MAIN] TROUVÉS! ($($mainLogs.Count) événements)" -ForegroundColor Green
                Write-Host ""
                Write-Host "  LOGS [MAIN]:" -ForegroundColor Cyan
                Write-Host "  ========================================" -ForegroundColor Gray
                $mainLogs | ForEach-Object {
                    $msg = $_.message
                    Write-Host "    $msg" -ForegroundColor Cyan
                }
                Write-Host ""
                
                # Vérifier MONGODB_URL spécifiquement
                $mongoLogs = $mainLogs | Where-Object { $_.message -match "MONGODB_URL" }
                if ($mongoLogs) {
                    Write-Host "  ✅ MONGODB_URL détectée dans les logs!" -ForegroundColor Green
                    foreach ($log in $mongoLogs) {
                        Write-Host "    $($log.message)" -ForegroundColor Green
                    }
                } else {
                    Write-Host "  ⚠️ MONGODB_URL non trouvée dans les logs [MAIN]" -ForegroundColor Yellow
                }
                Write-Host ""
                
                # Afficher les derniers logs pour contexte
                Write-Host "  Derniers logs (tous):" -ForegroundColor Yellow
                $logEvents.events | Select-Object -Last 30 | ForEach-Object {
                    $msg = $_.message
                    if ($msg -match "\[MAIN\]") {
                        Write-Host "    $msg" -ForegroundColor Cyan
                    } elseif ($msg -match "MongoDB|mongo|✅.*Mongo") {
                        Write-Host "    $msg" -ForegroundColor Green
                    } elseif ($msg -match "PostgreSQL|postgres|✅.*PostgreSQL") {
                        Write-Host "    $msg" -ForegroundColor Green
                    } elseif ($msg -match "Serveur|serveur|server|Server|HTTP|http|✅.*Serveur|bind|🚀.*Serveur") {
                        Write-Host "    $msg" -ForegroundColor Cyan
                    } elseif ($msg -match "error|Error|ERROR|fail|Fail|FAIL|❌|panic|Panic") {
                        Write-Host "    $msg" -ForegroundColor Red
                    } else {
                        Write-Host "    $msg" -ForegroundColor White
                    }
                }
                
                Write-Host ""
                Write-Host "  ✅ SUCCÈS - L'application démarre correctement!" -ForegroundColor Green
                break
            } else {
                Write-Host "  ❌ AUCUN LOG [MAIN] TROUVÉ" -ForegroundColor Red
                Write-Host ""
                Write-Host "  Derniers logs de cette tâche:" -ForegroundColor Yellow
                $logEvents.events | Select-Object -Last 20 | ForEach-Object {
                    Write-Host "    $($_.message)" -ForegroundColor White
                }
            }
        } else {
            Write-Host "  ⚠️ Aucun log disponible pour le moment" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  ❌ Erreur lors de la récupération des logs: $_" -ForegroundColor Red
    }
    
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VÉRIFICATION TERMINÉE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

