# Script pour récupérer les logs d'une tâche arrêtée

param(
    [string]$TaskId = "",
    [string]$LogGroup = "/ecs/yukpo-backend",
    [string]$Region = "eu-west-1"
)

$ErrorActionPreference = "Continue"

if ([string]::IsNullOrEmpty($TaskId)) {
    Write-Host "Recherche de la derniere tache arretee..." -ForegroundColor Cyan
    
    $stoppedTasksJson = aws ecs list-tasks `
        --cluster yukpo-cluster `
        --service-name yukpo-backend-service `
        --region $Region `
        --desired-status STOPPED `
        --max-items 1 `
        --output json 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        $stoppedTasks = $stoppedTasksJson | ConvertFrom-Json
        if ($stoppedTasks.taskArns -and $stoppedTasks.taskArns.Count -gt 0) {
            $TaskId = $stoppedTasks.taskArns[0].Split('/')[-1]
            Write-Host "Tache trouvee: $TaskId" -ForegroundColor Green
        } else {
            Write-Host "Aucune tache arretee trouvee" -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "Erreur lors de la recuperation des taches: $stoppedTasksJson" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Recuperation des logs pour la tache: $TaskId" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Récupérer les détails de la tâche
Write-Host "Details de la tache:" -ForegroundColor Yellow
$taskDetailsJson = aws ecs describe-tasks `
    --cluster yukpo-cluster `
    --tasks "arn:aws:ecs:$Region:108964700972:task/yukpo-cluster/$TaskId" `
    --region $Region `
    --output json 2>&1

if ($LASTEXITCODE -eq 0) {
    $taskDetails = $taskDetailsJson | ConvertFrom-Json
    $task = $taskDetails.tasks[0]
    
    Write-Host "  Stopped At: $($task.stoppedAt)" -ForegroundColor White
    Write-Host "  Stopped Reason: $($task.stoppedReason)" -ForegroundColor White
    Write-Host "  Last Status: $($task.lastStatus)" -ForegroundColor White
    
    foreach ($container in $task.containers) {
        Write-Host "  Container: $($container.name)" -ForegroundColor Cyan
        Write-Host "    Exit Code: $($container.exitCode)" -ForegroundColor $(if ($container.exitCode -eq 0) { "Green" } else { "Red" })
        if ($container.reason) {
            Write-Host "    Reason: $($container.reason)" -ForegroundColor $(if ($container.reason -match "error|failed") { "Red" } else { "Yellow" })
        }
    }
}

Write-Host ""
Write-Host "Recuperation des logs..." -ForegroundColor Yellow

# Essayer différents formats de stream
$streamFormats = @(
    "backend/backend/$TaskId",
    "ecs/backend/$TaskId",
    "backend/$TaskId"
)

$logsFound = $false
$outputFile = "logs-tache-$TaskId-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

"Logs de la tache $TaskId" | Out-File -FilePath $outputFile -Encoding utf8
"Stopped At: $($task.stoppedAt)" | Out-File -FilePath $outputFile -Append -Encoding utf8
"Stopped Reason: $($task.stoppedReason)" | Out-File -FilePath $outputFile -Append -Encoding utf8
"Exit Code: $($task.containers[0].exitCode)`n" | Out-File -FilePath $outputFile -Append -Encoding utf8

foreach ($streamFormat in $streamFormats) {
    Write-Host "  Essai avec: $streamFormat" -ForegroundColor Gray
    
    $tempFile = [System.IO.Path]::GetTempFileName()
    
    aws logs get-log-events `
        --log-group-name $LogGroup `
        --log-stream-name $streamFormat `
        --region $Region `
        --limit 100 `
        --output json 2>&1 | Out-File -FilePath $tempFile -Encoding utf8
    
    if ($LASTEXITCODE -eq 0) {
        $content = [System.IO.File]::ReadAllText($tempFile, [System.Text.Encoding]::UTF8)
        Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
        
        if ($content -and $content -match '"events"') {
            try {
                $json = $content | ConvertFrom-Json
                
                if ($json.events -and $json.events.Count -gt 0) {
                    $logsFound = $true
                    Write-Host "  Logs trouves dans: $streamFormat ($($json.events.Count) evenements)" -ForegroundColor Green
                    Write-Host ""
                    
                    # Écrire dans le fichier
                    [System.IO.File]::AppendAllText($outputFile, "========================================`n", $utf8NoBom)
                    [System.IO.File]::AppendAllText($outputFile, "Stream: $streamFormat`n", $utf8NoBom)
                    [System.IO.File]::AppendAllText($outputFile, "Evenements: $($json.events.Count)`n", $utf8NoBom)
                    [System.IO.File]::AppendAllText($outputFile, "========================================`n`n", $utf8NoBom)
                    
                    # Afficher et sauvegarder les logs
                    Write-Host "Derniers logs:" -ForegroundColor Cyan
                    Write-Host "==============" -ForegroundColor Cyan
                    
                    $lastLogs = $json.events[-30..-1]
                    foreach ($logEvent in $lastLogs) {
                        $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($logEvent.timestamp).LocalDateTime
                        $message = $logEvent.message
                        
                        # Nettoyer le message pour l'affichage (supprimer les caractères problématiques)
                        $cleanMessage = $message -replace '[^\x20-\x7E\n\r\t]', ''
                        
                        $logLine = "[$($timestamp.ToString('yyyy-MM-dd HH:mm:ss'))] $cleanMessage`n"
                        [System.IO.File]::AppendAllText($outputFile, $logLine, $utf8NoBom)
                        
                        # Afficher avec couleur selon le contenu
                        $color = "White"
                        if ($cleanMessage -match "(?i)(error|exception|failed|panic|fatal|kill)") {
                            $color = "Red"
                        } elseif ($cleanMessage -match "(?i)(warn|warning)") {
                            $color = "Yellow"
                        } elseif ($cleanMessage -match "(?i)(info|starting|listening|ready|connected)") {
                            $color = "Green"
                        }
                        
                        Write-Host "[$($timestamp.ToString('HH:mm:ss'))] $cleanMessage" -ForegroundColor $color
                    }
                    
                    break
                }
            } catch {
                Write-Host "  Erreur de parsing: $_" -ForegroundColor Yellow
            }
        }
    } else {
        $errorContent = Get-Content $tempFile -Raw -Encoding utf8 -ErrorAction SilentlyContinue
        Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
        
        if ($errorContent -notmatch "ResourceNotFoundException") {
            Write-Host "  Erreur: $errorContent" -ForegroundColor Red
        }
    }
}

if (-not $logsFound) {
    Write-Host "  Aucun log trouve pour cette tache" -ForegroundColor Yellow
    Write-Host "  Les logs peuvent ne pas avoir ete ecrits ou le stream n'existe pas encore" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "Logs sauvegardes dans: $outputFile" -ForegroundColor Green
    Write-Host ""
    Write-Host "Pour afficher les logs:" -ForegroundColor Yellow
    Write-Host "  Get-Content $outputFile -Encoding UTF8" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Pour afficher uniquement les erreurs:" -ForegroundColor Yellow
    Write-Host "  Get-Content $outputFile -Encoding UTF8 | Select-String -Pattern '(?i)(error|exception|failed|panic|fatal)'" -ForegroundColor Cyan
}

Write-Host ""

