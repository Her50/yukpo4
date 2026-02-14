# Script PowerShell pour récupérer TOUS les logs d'une tâche ECS
# Gère l'encodage UTF-8 correctement

$ErrorActionPreference = "Stop"

$logGroupName = "/ecs/yukpo-backend"
$region = "eu-west-1"

Write-Host "Recherche des tâches récentes..." -ForegroundColor Cyan

# Récupérer les tâches arrêtées récemment
$stoppedTasks = aws ecs list-tasks `
    --cluster yukpo-cluster `
    --desired-status STOPPED `
    --region $region `
    --max-items 5 `
    --output json | ConvertFrom-Json

if ($stoppedTasks.taskArns) {
    Write-Host "`nTâches arrêtées trouvées: $($stoppedTasks.taskArns.Count)" -ForegroundColor Yellow
    
    # Récupérer les détails de la première tâche
    $taskArn = $stoppedTasks.taskArns[0]
    Write-Host "Analyse de la tâche: $taskArn" -ForegroundColor Cyan
    
    # Extraire l'ID de la tâche
    $taskId = $taskArn.Split('/')[-1]
    Write-Host "Task ID: $taskId" -ForegroundColor White
    
    # Récupérer les détails de la tâche
    $taskDetails = aws ecs describe-tasks `
        --cluster yukpo-cluster `
        --tasks $taskArn `
        --region $region `
        --output json | ConvertFrom-Json
    
    if ($taskDetails.tasks -and $taskDetails.tasks.Count -gt 0) {
        $task = $taskDetails.tasks[0]
        $stoppedAt = $task.stoppedAt
        $stopCode = $task.stopCode
        $exitCode = $task.containers[0].exitCode
        
        Write-Host "`nDétails de la tâche:" -ForegroundColor Yellow
        Write-Host "  Arrêtée à: $stoppedAt" -ForegroundColor White
        Write-Host "  Stop Code: $stopCode" -ForegroundColor White
        Write-Host "  Exit Code: $exitCode" -ForegroundColor $(if ($exitCode -eq 0) { "Green" } else { "Red" })
        Write-Host "  Stopped Reason: $($task.stoppedReason)" -ForegroundColor White
    }
    
    # Rechercher les log streams pour cette tâche
    Write-Host "`nRecherche des log streams..." -ForegroundColor Cyan
    
    # Le format est généralement: backend/backend/{task-id}
    $streamPrefix = "backend/backend/$taskId"
    
    # Lister tous les streams qui correspondent
    $allStreams = aws logs describe-log-streams `
        --log-group-name $logGroupName `
        --log-stream-name-prefix $streamPrefix `
        --region $region `
        --max-items 10 `
        --output json | ConvertFrom-Json
    
    if ($allStreams.logStreams -and $allStreams.logStreams.Count -gt 0) {
        $stream = $allStreams.logStreams[0]
        $streamName = $stream.logStreamName
        
        Write-Host "Log stream trouvé: $streamName" -ForegroundColor Green
        Write-Host "  Dernier événement: $($stream.lastEventTimestamp)" -ForegroundColor Gray
        
        # Récupérer TOUS les logs (limite 10000 événements)
        Write-Host "`nRécupération de TOUS les logs (peut prendre du temps)..." -ForegroundColor Cyan
        
        $allEvents = @()
        $nextToken = $null
        $batchCount = 0
        
        do {
            $batchCount++
            Write-Host "  Batch $batchCount..." -ForegroundColor Gray
            
            $params = @{
                logGroupName = $logGroupName
                logStreamName = $streamName
                region = $region
                limit = 10000
            }
            
            if ($nextToken) {
                $params.nextToken = $nextToken
            }
            
            # Utiliser un fichier temporaire pour éviter les problèmes d'encodage
            $tempFile = [System.IO.Path]::GetTempFileName()
            
            $jsonOutput = aws logs get-log-events `
                --log-group-name $logGroupName `
                --log-stream-name $streamName `
                --region $region `
                --limit 10000 `
                --start-from-head `
                $(if ($nextToken) { "--next-token $nextToken" }) `
                --output json 2>&1 | Out-File -FilePath $tempFile -Encoding utf8
            
            $events = Get-Content $tempFile -Raw -Encoding UTF8 | ConvertFrom-Json
            
            if ($events.events) {
                $allEvents += $events.events
                Write-Host "    Récupéré $($events.events.Count) événements (total: $($allEvents.Count))" -ForegroundColor Gray
            }
            
            $nextToken = $events.nextForwardToken
            Remove-Item $tempFile -Force
            
            # Limiter à 10 batches pour éviter une boucle infinie
            if ($batchCount -ge 10) {
                Write-Host "  Limite de 10 batches atteinte" -ForegroundColor Yellow
                break
            }
            
        } while ($nextToken -and $events.events.Count -eq 10000)
        
        Write-Host "`nTotal d'événements récupérés: $($allEvents.Count)" -ForegroundColor Green
        
        # Sauvegarder dans un fichier
        $outputFile = "logs-complets-$taskId-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
        Write-Host "`nSauvegarde dans: $outputFile" -ForegroundColor Cyan
        
        $content = @()
        foreach ($event in $allEvents | Sort-Object { [DateTimeOffset]::FromUnixTimeMilliseconds($_.timestamp).DateTime }) {
            $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($_.timestamp).ToString("yyyy-MM-dd HH:mm:ss.fff")
            $message = $event.message
            $content += "$timestamp $message"
        }
        
        $content | Out-File -FilePath $outputFile -Encoding UTF8
        
        Write-Host "✅ Logs sauvegardés dans: $outputFile" -ForegroundColor Green
        Write-Host "`nAnalyse des logs..." -ForegroundColor Cyan
        
        # Analyser les logs pour trouver les erreurs
        $errorLines = $content | Select-String -Pattern "error|Error|ERROR|panic|Panic|PANIC|fail|Fail|FAIL|crash|Crash|CRASH" -CaseSensitive:$false
        if ($errorLines) {
            Write-Host "`n⚠️ Lignes avec erreurs trouvées:" -ForegroundColor Red
            $errorLines | Select-Object -First 20 | ForEach-Object {
                Write-Host "  $_" -ForegroundColor Yellow
            }
        } else {
            Write-Host "`n✅ Aucune erreur explicite trouvée dans les logs" -ForegroundColor Green
        }
        
        # Chercher les dernières lignes
        Write-Host "`nDernières 20 lignes:" -ForegroundColor Cyan
        $content | Select-Object -Last 20 | ForEach-Object {
            Write-Host "  $_" -ForegroundColor White
        }
        
        Write-Host "`n✅ Analyse terminée. Fichier complet: $outputFile" -ForegroundColor Green
        
    } else {
        Write-Host "❌ Aucun log stream trouvé pour cette tâche" -ForegroundColor Red
    }
    
} else {
    Write-Host "❌ Aucune tâche arrêtée trouvée" -ForegroundColor Red
    Write-Host "Tentative de récupération des tâches en cours..." -ForegroundColor Yellow
    
    $runningTasks = aws ecs list-tasks `
        --cluster yukpo-cluster `
        --desired-status RUNNING `
        --region $region `
        --max-items 1 `
        --output json | ConvertFrom-Json
    
    if ($runningTasks.taskArns) {
        Write-Host "Tâche en cours trouvée: $($runningTasks.taskArns[0])" -ForegroundColor Green
        Write-Host "Utilisez cette commande pour récupérer les logs:" -ForegroundColor Cyan
        Write-Host "  .\scripts\get_all_logs_complet.ps1" -ForegroundColor White
    }
}

