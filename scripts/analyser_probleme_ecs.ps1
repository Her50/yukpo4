# Script pour analyser en profondeur le problème ECS
# Récupère les logs et identifie la cause racine

param(
    [string]$Cluster = "yukpo-cluster",
    [string]$Service = "yukpo-backend-service",
    [string]$Region = "eu-west-1",
    [string]$LogGroup = "/ecs/yukpo-backend"
)

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ANALYSE APPROFONDIE DU PROBLEME ECS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Récupérer les tâches arrêtées récemment
Write-Host "1. Analyse des taches arretees..." -ForegroundColor Yellow

$stoppedTasksJson = aws ecs list-tasks `
    --cluster $Cluster `
    --service-name $Service `
    --region $Region `
    --desired-status STOPPED `
    --max-items 5 `
    --output json 2>&1

if ($LASTEXITCODE -eq 0) {
    $stoppedTasks = $stoppedTasksJson | ConvertFrom-Json
    
    if ($stoppedTasks.taskArns -and $stoppedTasks.taskArns.Count -gt 0) {
        Write-Host "   $($stoppedTasks.taskArns.Count) tache(s) arretee(s) trouvee(s)" -ForegroundColor Green
        
        # Analyser chaque tâche
        foreach ($taskArn in $stoppedTasks.taskArns[0..2]) {
            $taskId = $taskArn.Split('/')[-1]
            Write-Host "`n   Tache: $taskId" -ForegroundColor Cyan
            
            $taskDetailsJson = aws ecs describe-tasks `
                --cluster $Cluster `
                --tasks $taskArn `
                --region $Region `
                --output json 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                $taskDetails = $taskDetailsJson | ConvertFrom-Json
                $task = $taskDetails.tasks[0]
                
                Write-Host "     Stopped Reason: $($task.stoppedReason)" -ForegroundColor White
                Write-Host "     Exit Code: $($task.containers[0].exitCode)" -ForegroundColor $(if ($task.containers[0].exitCode -eq 0) { "Green" } else { "Red" })
                
                if ($task.containers[0].reason) {
                    Write-Host "     Reason: $($task.containers[0].reason)" -ForegroundColor Yellow
                }
                
                # Analyser le code de sortie
                if ($task.containers[0].exitCode -eq 137) {
                    Write-Host "     ANALYSE: Code 137 = SIGKILL (processus tue)" -ForegroundColor Red
                    Write-Host "       Causes possibles:" -ForegroundColor Yellow
                    Write-Host "         - OOM (Out of Memory)" -ForegroundColor White
                    Write-Host "         - Health check timeout (tue par ECS)" -ForegroundColor White
                    Write-Host "         - Processus tue manuellement" -ForegroundColor White
                }
            }
        }
    }
}

Write-Host ""
Write-Host ""

# 2. Récupérer les logs de la dernière tâche arrêtée
Write-Host "2. Recuperation des logs de la derniere tache arretee..." -ForegroundColor Yellow

if ($stoppedTasks.taskArns -and $stoppedTasks.taskArns.Count -gt 0) {
    $lastTaskId = $stoppedTasks.taskArns[0].Split('/')[-1]
    Write-Host "   Task ID: $lastTaskId" -ForegroundColor Gray
    
    # Essayer différents formats de stream
    $streamFormats = @(
        "backend/backend/$lastTaskId",
        "ecs/backend/$lastTaskId"
    )
    
    $logsFound = $false
    foreach ($streamFormat in $streamFormats) {
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
                        Write-Host "   Logs trouves dans: $streamFormat ($($json.events.Count) evenements)" -ForegroundColor Green
                        Write-Host ""
                        
                        # Analyser les logs pour trouver des patterns d'erreur
                        Write-Host "   Analyse des logs pour patterns d'erreur..." -ForegroundColor Cyan
                        
                        $errors = @()
                        $warnings = @()
                        $databaseErrors = @()
                        $startupMessages = @()
                        
                        foreach ($event in $json.events) {
                            $message = $event.message -replace '[^\x20-\x7E\n\r\t]', ''
                            
                            if ($message -match "(?i)(error|exception|failed|panic|fatal)") {
                                $errors += $message
                            }
                            if ($message -match "(?i)(warn|warning)") {
                                $warnings += $message
                            }
                            if ($message -match "(?i)(database|postgres|connection|refused|denied|cannot connect)") {
                                $databaseErrors += $message
                            }
                            if ($message -match "(?i)(starting|listening|ready|server|bind|port)") {
                                $startupMessages += $message
                            }
                        }
                        
                        Write-Host "     Erreurs trouvees: $($errors.Count)" -ForegroundColor $(if ($errors.Count -gt 0) { "Red" } else { "Green" })
                        Write-Host "     Warnings: $($warnings.Count)" -ForegroundColor $(if ($warnings.Count -gt 0) { "Yellow" } else { "Gray" })
                        Write-Host "     Erreurs DB: $($databaseErrors.Count)" -ForegroundColor $(if ($databaseErrors.Count -gt 0) { "Red" } else { "Green" })
                        Write-Host "     Messages de demarrage: $($startupMessages.Count)" -ForegroundColor $(if ($startupMessages.Count -gt 0) { "Green" } else { "Yellow" })
                        
                        Write-Host ""
                        
                        # Afficher les premières erreurs
                        if ($errors.Count -gt 0) {
                            Write-Host "   Premieres erreurs:" -ForegroundColor Red
                            $errors | Select-Object -First 5 | ForEach-Object {
                                Write-Host "     $_" -ForegroundColor Red
                            }
                            Write-Host ""
                        }
                        
                        # Afficher les erreurs de base de données
                        if ($databaseErrors.Count -gt 0) {
                            Write-Host "   Erreurs de base de donnees:" -ForegroundColor Red
                            $databaseErrors | Select-Object -First 3 | ForEach-Object {
                                Write-Host "     $_" -ForegroundColor Red
                            }
                            Write-Host ""
                        }
                        
                        # Afficher les messages de démarrage
                        if ($startupMessages.Count -gt 0) {
                            Write-Host "   Messages de demarrage:" -ForegroundColor Green
                            $startupMessages | Select-Object -First 5 | ForEach-Object {
                                Write-Host "     $_" -ForegroundColor Green
                            }
                            Write-Host ""
                        }
                        
                        # Afficher les derniers logs
                        Write-Host "   Derniers logs (10 derniers):" -ForegroundColor Cyan
                        $lastLogs = $json.events[-10..-1]
                        foreach ($logEvent in $lastLogs) {
                            $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($logEvent.timestamp).LocalDateTime
                            $message = $logEvent.message -replace '[^\x20-\x7E\n\r\t]', ''
                            $color = if ($message -match "(?i)(error|exception|failed)") { "Red" } elseif ($message -match "(?i)(warn)") { "Yellow" } else { "White" }
                            Write-Host "     [$($timestamp.ToString('HH:mm:ss'))] $message" -ForegroundColor $color
                        }
                        
                        break
                    }
                } catch {
                    # Ignorer les erreurs de parsing
                }
            }
        }
    }
    
    if (-not $logsFound) {
        Write-Host "   Aucun log trouve pour cette tache" -ForegroundColor Yellow
        Write-Host "   Les logs peuvent ne pas avoir ete ecrits ou le stream n'existe pas" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host ""

# 3. Résumé et recommandations
Write-Host "3. RESUME ET DIAGNOSTIC" -ForegroundColor Yellow
Write-Host "=======================" -ForegroundColor Yellow
Write-Host ""

Write-Host "Probleme identifie:" -ForegroundColor Cyan
Write-Host "  Les taches echouent systematiquement les health checks" -ForegroundColor Red
Write-Host "  Code de sortie: 137 (SIGKILL)" -ForegroundColor Red
Write-Host ""

if ($databaseErrors.Count -gt 0) {
    Write-Host "CAUSE PROBABLE: Probleme de connexion a la base de donnees" -ForegroundColor Red
    Write-Host "  - Verifier DATABASE_URL" -ForegroundColor Yellow
    Write-Host "  - Verifier les permissions de la base" -ForegroundColor Yellow
    Write-Host "  - Verifier que la base existe" -ForegroundColor Yellow
} elseif ($startupMessages.Count -eq 0) {
    Write-Host "CAUSE PROBABLE: L'application ne demarre pas" -ForegroundColor Red
    Write-Host "  - Verifier que l'image Docker contient l'application" -ForegroundColor Yellow
    Write-Host "  - Verifier les erreurs de compilation" -ForegroundColor Yellow
    Write-Host "  - Verifier les variables d'environnement" -ForegroundColor Yellow
} elseif ($errors.Count -gt 0) {
    Write-Host "CAUSE PROBABLE: Erreur dans l'application" -ForegroundColor Red
    Write-Host "  - Examiner les erreurs dans les logs" -ForegroundColor Yellow
    Write-Host "  - Verifier la configuration de l'application" -ForegroundColor Yellow
} else {
    Write-Host "CAUSE PROBABLE: Health check echoue" -ForegroundColor Red
    Write-Host "  - L'application demarre mais /health ne repond pas" -ForegroundColor Yellow
    Write-Host "  - Verifier que l'endpoint /health existe" -ForegroundColor Yellow
    Write-Host "  - Verifier que l'application ecoute sur le port 8080" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

