# Script pour analyser les logs d'une tâche arrêtée

$ErrorActionPreference = "Continue"

$cluster = "yukpo-cluster"
$service = "yukpo-backend-service"
$region = "eu-west-1"
$logGroup = "/ecs/yukpo-backend"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ANALYSE LOGS TACHE ARRETEE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Récupérer les tâches arrêtées récemment
Write-Host "Récupération des tâches arrêtées récemment..." -ForegroundColor Cyan
$stoppedTasks = aws ecs list-tasks --cluster $cluster --service-name $service --desired-status STOPPED --region $region --max-items 3 --output json | ConvertFrom-Json

if (-not $stoppedTasks.taskArns -or $stoppedTasks.taskArns.Count -eq 0) {
    Write-Host "❌ Aucune tâche arrêtée trouvée" -ForegroundColor Red
    exit 1
}

Write-Host "Tâches arrêtées trouvées: $($stoppedTasks.taskArns.Count)" -ForegroundColor Yellow
Write-Host ""

# Analyser la tâche la plus récente
$taskArn = $stoppedTasks.taskArns[0]
$taskId = $taskArn.Split('/')[-1]

Write-Host "Analyse de la tâche: $taskId" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

# Détails de la tâche
$taskDetails = aws ecs describe-tasks --cluster $cluster --tasks $taskArn --region $region --output json | ConvertFrom-Json
if ($taskDetails.tasks) {
    $task = $taskDetails.tasks[0]
    Write-Host "  Task Definition: $($task.taskDefinitionArn.Split('/')[-1])" -ForegroundColor White
    Write-Host "  Last Status: $($task.lastStatus)" -ForegroundColor $(if ($task.lastStatus -eq "RUNNING") { "Green" } else { "Red" })
    Write-Host "  Stop Code: $($task.stopCode)" -ForegroundColor $(if ($task.stopCode -eq "EssentialContainerExited") { "Red" } else { "Yellow" })
    Write-Host "  Stopped Reason: $($task.stoppedReason)" -ForegroundColor White
    Write-Host "  Started At: $($task.startedAt)" -ForegroundColor Gray
    Write-Host "  Stopped At: $($task.stoppedAt)" -ForegroundColor Gray
    
    if ($task.containers) {
        $container = $task.containers[0]
        Write-Host "  Exit Code: $($container.exitCode)" -ForegroundColor $(if ($container.exitCode -eq 0) { "Green" } else { "Red" })
        Write-Host "  Reason: $($container.reason)" -ForegroundColor White
    }
    Write-Host ""
}

# Récupérer les logs
$streamName = "backend/backend/$taskId"
Write-Host "  Log Stream: $streamName" -ForegroundColor Gray
Write-Host ""

# Sauvegarder les logs dans un fichier temporaire
$tempFile = "temp-logs-$taskId.txt"
Write-Host "  Récupération des logs..." -ForegroundColor Cyan

try {
    # Utiliser --output text pour éviter les problèmes d'encodage JSON
    $logOutput = aws logs get-log-events --log-group-name $logGroup --log-stream-name $streamName --region $region --limit 200 --output text 2>&1 | Out-String
    
    if ($logOutput) {
        # Extraire les messages des logs
        $lines = $logOutput -split "`n"
        $messages = @()
        
        foreach ($line in $lines) {
            if ($line -match "EVENTS\s+\d+\s+(.+)") {
                $message = $matches[1]
                $messages += $message
            }
        }
        
        if ($messages.Count -gt 0) {
            Write-Host "  Total de messages: $($messages.Count)" -ForegroundColor White
            Write-Host ""
            
            # Rechercher les logs [MAIN]
            $mainLogs = $messages | Where-Object { $_ -match "\[MAIN\]" }
            
            if ($mainLogs) {
                Write-Host "  ✅ LOGS [MAIN] TROUVÉS! ($($mainLogs.Count) messages)" -ForegroundColor Green
                Write-Host ""
                Write-Host "  LOGS [MAIN]:" -ForegroundColor Cyan
                Write-Host "  ========================================" -ForegroundColor Gray
                $mainLogs | ForEach-Object {
                    Write-Host "    $_" -ForegroundColor Cyan
                }
                Write-Host ""
            } else {
                Write-Host "  ❌ AUCUN LOG [MAIN] TROUVÉ" -ForegroundColor Red
                Write-Host ""
            }
            
            # Rechercher MONGODB_URL
            $mongoLogs = $messages | Where-Object { $_ -match "MONGODB_URL" }
            if ($mongoLogs) {
                Write-Host "  ✅ MONGODB_URL détectée dans les logs!" -ForegroundColor Green
                $mongoLogs | ForEach-Object {
                    Write-Host "    $_" -ForegroundColor Green
                }
                Write-Host ""
            }
            
            # Afficher les derniers logs
            Write-Host "  Derniers logs (tous):" -ForegroundColor Yellow
            Write-Host "  ========================================" -ForegroundColor Gray
            $messages | Select-Object -Last 30 | ForEach-Object {
                $msg = $_
                if ($msg -match "\[MAIN\]") {
                    Write-Host "    $msg" -ForegroundColor Cyan
                } elseif ($msg -match "MongoDB|mongo|MONGODB") {
                    Write-Host "    $msg" -ForegroundColor Green
                } elseif ($msg -match "PostgreSQL|postgres|DATABASE") {
                    Write-Host "    $msg" -ForegroundColor Green
                } elseif ($msg -match "Serveur|serveur|server|Server|HTTP|http|bind|8080") {
                    Write-Host "    $msg" -ForegroundColor Cyan
                } elseif ($msg -match "error|Error|ERROR|fail|Fail|FAIL|❌|panic|Panic|crash") {
                    Write-Host "    $msg" -ForegroundColor Red
                } elseif ($msg -match "Vérification|Lancement|Démarrage|WARNING|INFO") {
                    Write-Host "    $msg" -ForegroundColor Yellow
                } else {
                    Write-Host "    $msg" -ForegroundColor White
                }
            }
        } else {
            Write-Host "  ⚠️ Aucun message extrait des logs" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ⚠️ Aucun log disponible" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ❌ Erreur lors de la récupération des logs: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ANALYSE TERMINÉE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

