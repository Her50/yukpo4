# Script de diagnostic complet pour ECS
# Vérifie la configuration du health check, le port, les variables d'environnement et les logs

param(
    [string]$Cluster = "yukpo-cluster",
    [string]$Service = "yukpo-backend-service",
    [string]$TaskDefinition = "yukpo-backend",
    [string]$Region = "eu-west-1",
    [string]$LogGroup = "/ecs/yukpo-backend"
)

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DIAGNOSTIC COMPLET ECS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier la configuration du health check
Write-Host "1. VERIFICATION DU HEALTH CHECK" -ForegroundColor Yellow
Write-Host "=================================" -ForegroundColor Yellow
Write-Host ""

$taskDefJson = aws ecs describe-task-definition `
    --task-definition $TaskDefinition `
    --region $Region `
    --output json 2>&1

if ($LASTEXITCODE -eq 0) {
    $taskDef = $taskDefJson | ConvertFrom-Json
    $containerDef = $taskDef.taskDefinition.containerDefinitions[0]
    
    Write-Host "Task Definition: $TaskDefinition" -ForegroundColor Gray
    Write-Host "Revision: $($taskDef.taskDefinition.revision)" -ForegroundColor Gray
    Write-Host ""
    
    # Health check
    if ($containerDef.healthCheck) {
        Write-Host "Health Check CONFIGURE:" -ForegroundColor Green
        Write-Host "  Command: $($containerDef.healthCheck.command -join ' ')" -ForegroundColor White
        Write-Host "  Interval: $($containerDef.healthCheck.interval) secondes" -ForegroundColor White
        Write-Host "  Timeout: $($containerDef.healthCheck.timeout) secondes" -ForegroundColor White
        Write-Host "  Retries: $($containerDef.healthCheck.retries)" -ForegroundColor White
        Write-Host "  Start Period: $($containerDef.healthCheck.startPeriod) secondes" -ForegroundColor White
        Write-Host ""
        
        # Vérifier si le health check utilise le bon port
        $healthCheckCmd = $containerDef.healthCheck.command -join ' '
        if ($healthCheckCmd -match ':8080' -or $healthCheckCmd -match '8080') {
            Write-Host "  Port 8080 detecte dans le health check" -ForegroundColor Green
        } else {
            Write-Host "  ATTENTION: Port 8080 non detecte dans le health check" -ForegroundColor Yellow
            Write-Host "  Commande: $healthCheckCmd" -ForegroundColor Gray
        }
    } else {
        Write-Host "Health Check NON CONFIGURE!" -ForegroundColor Red
        Write-Host "  Le health check doit etre configure dans la task definition" -ForegroundColor Yellow
    }
    
    # Port mappings
    Write-Host ""
    Write-Host "Port Mappings:" -ForegroundColor Cyan
    if ($containerDef.portMappings) {
        foreach ($portMapping in $containerDef.portMappings) {
            Write-Host "  Container Port: $($portMapping.containerPort)" -ForegroundColor White
            Write-Host "  Protocol: $($portMapping.protocol)" -ForegroundColor White
            if ($portMapping.hostPort) {
                Write-Host "  Host Port: $($portMapping.hostPort)" -ForegroundColor White
            }
            Write-Host ""
            
            if ($portMapping.containerPort -eq 8080) {
                Write-Host "  Port 8080 correctement configure" -ForegroundColor Green
            } else {
                Write-Host "  ATTENTION: Port configure est $($portMapping.containerPort), attendu: 8080" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "  Aucun port mapping configure!" -ForegroundColor Red
    }
} else {
    Write-Host "Erreur lors de la recuperation de la task definition: $taskDefJson" -ForegroundColor Red
}

Write-Host ""
Write-Host ""

# 2. Vérifier les variables d'environnement
Write-Host "2. VERIFICATION DES VARIABLES D'ENVIRONNEMENT" -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Yellow
Write-Host ""

if ($containerDef) {
    Write-Host "Variables d'environnement:" -ForegroundColor Cyan
    
    # Variables d'environnement directes
    if ($containerDef.environment) {
        Write-Host "  Variables directes:" -ForegroundColor Gray
        foreach ($env in $containerDef.environment) {
            if ($env.name -eq "DATABASE_URL" -or $env.name -match "DATABASE" -or $env.name -match "PORT" -or $env.name -match "HOST") {
                Write-Host "    $($env.name) = $($env.value)" -ForegroundColor White
            } else {
                Write-Host "    $($env.name) = [masque]" -ForegroundColor Gray
            }
        }
        Write-Host ""
    }
    
    # Secrets (variables depuis Secrets Manager ou SSM)
    if ($containerDef.secrets) {
        Write-Host "  Secrets (depuis Secrets Manager/SSM):" -ForegroundColor Gray
        foreach ($secret in $containerDef.secrets) {
            Write-Host "    $($secret.name) = $($secret.valueFrom)" -ForegroundColor White
            
            # Vérifier DATABASE_URL
            if ($secret.name -eq "DATABASE_URL") {
                Write-Host ""
                Write-Host "  Verification de DATABASE_URL..." -ForegroundColor Cyan
                
                if ($secret.valueFrom -match "secretsmanager") {
                    # Extraire le nom du secret
                    $secretArn = $secret.valueFrom -replace ':DATABASE_URL::', ''
                    $secretName = $secretArn.Split('/')[-1]
                    
                    Write-Host "    Secret ARN: $secretArn" -ForegroundColor Gray
                    Write-Host "    Secret Name: $secretName" -ForegroundColor Gray
                    
                    # Récupérer la valeur du secret
                    try {
                        $secretValue = aws secretsmanager get-secret-value `
                            --secret-id $secretName `
                            --region $Region `
                            --query 'SecretString' `
                            --output text 2>&1
                        
                        if ($LASTEXITCODE -eq 0) {
                            $secretJson = $secretValue | ConvertFrom-Json
                            
                            if ($secretJson.DATABASE_URL) {
                                $dbUrl = $secretJson.DATABASE_URL
                                Write-Host "    DATABASE_URL trouve" -ForegroundColor Green
                                
                                # Vérifier que l'URL se termine par /yukpo
                                if ($dbUrl -match '/yukpo(\?|$)') {
                                    Write-Host "    Base de donnees: yukpo" -ForegroundColor Green
                                } elseif ($dbUrl -match '/postgres(\?|$)') {
                                    Write-Host "    ERREUR: Base de donnees pointe vers 'postgres' au lieu de 'yukpo'!" -ForegroundColor Red
                                } else {
                                    Write-Host "    ATTENTION: Format de DATABASE_URL non reconnu" -ForegroundColor Yellow
                                    Write-Host "    URL: $($dbUrl.Substring(0, [Math]::Min(80, $dbUrl.Length)))..." -ForegroundColor Gray
                                }
                                
                                # Vérifier le format de l'URL
                                if ($dbUrl -match '^postgresql://') {
                                    Write-Host "    Format: PostgreSQL (correct)" -ForegroundColor Green
                                } else {
                                    Write-Host "    ATTENTION: Format d'URL non standard" -ForegroundColor Yellow
                                }
                            } else {
                                Write-Host "    ERREUR: DATABASE_URL non trouve dans le secret" -ForegroundColor Red
                            }
                        } else {
                            Write-Host "    Erreur lors de la recuperation du secret: $secretValue" -ForegroundColor Red
                        }
                    } catch {
                        Write-Host "    Exception: $_" -ForegroundColor Red
                    }
                } elseif ($secret.valueFrom -match "ssm") {
                    Write-Host "    Source: SSM Parameter Store" -ForegroundColor Gray
                    Write-Host "    ARN: $($secret.valueFrom)" -ForegroundColor Gray
                }
            }
        }
    } else {
        Write-Host "  Aucun secret configure" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host ""

# 3. Vérifier la configuration du service (health check grace period)
Write-Host "3. VERIFICATION DE LA CONFIGURATION DU SERVICE" -ForegroundColor Yellow
Write-Host "===============================================" -ForegroundColor Yellow
Write-Host ""

$serviceJson = aws ecs describe-services `
    --cluster $Cluster `
    --services $Service `
    --region $Region `
    --output json 2>&1

if ($LASTEXITCODE -eq 0) {
    $service = ($serviceJson | ConvertFrom-Json).services[0]
    
    Write-Host "Service: $Service" -ForegroundColor Gray
    Write-Host "Health Check Grace Period: $($service.healthCheckGracePeriodSeconds) secondes" -ForegroundColor White
    
    if ($service.healthCheckGracePeriodSeconds -eq 0) {
        Write-Host "  ATTENTION: Grace period a 0 - le health check commence immediatement" -ForegroundColor Yellow
        Write-Host "  Recommande: 60-120 secondes pour laisser l'application demarrer" -ForegroundColor Yellow
    } else {
        Write-Host "  Grace period configure" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "Deployment Configuration:" -ForegroundColor Cyan
    Write-Host "  Maximum Percent: $($service.deploymentConfiguration.maximumPercent)%" -ForegroundColor White
    Write-Host "  Minimum Healthy Percent: $($service.deploymentConfiguration.minimumHealthyPercent)%" -ForegroundColor White
} else {
    Write-Host "Erreur lors de la recuperation du service: $serviceJson" -ForegroundColor Red
}

Write-Host ""
Write-Host ""

# 4. Examiner les logs des tâches arrêtées
Write-Host "4. EXAMEN DES LOGS DES TACHES ARRETEES" -ForegroundColor Yellow
Write-Host "======================================" -ForegroundColor Yellow
Write-Host ""

Write-Host "Recherche des taches arretees recemment..." -ForegroundColor Cyan

# Récupérer les tâches arrêtées
$stoppedTasksJson = aws ecs list-tasks `
    --cluster $Cluster `
    --service-name $Service `
    --desired-status STOPPED `
    --region $Region `
    --max-items 5 `
    --output json 2>&1

if ($LASTEXITCODE -eq 0) {
    $stoppedTasks = $stoppedTasksJson | ConvertFrom-Json
    
    if ($stoppedTasks.taskArns -and $stoppedTasks.taskArns.Count -gt 0) {
        Write-Host "  $($stoppedTasks.taskArns.Count) tache(s) arretee(s) trouvee(s)" -ForegroundColor Green
        Write-Host ""
        
        # Récupérer les détails des tâches arrêtées
        $tasksDetailsJson = aws ecs describe-tasks `
            --cluster $Cluster `
            --tasks $stoppedTasks.taskArns `
            --region $Region `
            --output json 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            $tasksDetails = $tasksDetailsJson | ConvertFrom-Json
            
            foreach ($task in $tasksDetails.tasks) {
                $taskId = $task.taskArn.Split('/')[-1]
                Write-Host "  Tache: $taskId" -ForegroundColor Yellow
                Write-Host "    Stopped At: $($task.stoppedAt)" -ForegroundColor Gray
                Write-Host "    Stopped Reason: $($task.stoppedReason)" -ForegroundColor Gray
                Write-Host "    Last Status: $($task.lastStatus)" -ForegroundColor Gray
                
                # Vérifier les containers
                foreach ($container in $task.containers) {
                    Write-Host "    Container: $($container.name)" -ForegroundColor Cyan
                    Write-Host "      Exit Code: $($container.exitCode)" -ForegroundColor $(if ($container.exitCode -eq 0) { "Green" } else { "Red" })
                    if ($container.reason) {
                        Write-Host "      Reason: $($container.reason)" -ForegroundColor $(if ($container.reason -match "error|failed") { "Red" } else { "Yellow" })
                    }
                }
                
                Write-Host ""
                Write-Host "    Tentative de recuperation des logs..." -ForegroundColor Cyan
                
                # Essayer de récupérer les logs
                $streamFormats = @(
                    "backend/backend/$taskId",
                    "ecs/backend/$taskId"
                )
                
                $logsFound = $false
                foreach ($streamFormat in $streamFormats) {
                    $tempLogFile = [System.IO.Path]::GetTempFileName()
                    
                    aws logs get-log-events `
                        --log-group-name $LogGroup `
                        --log-stream-name $streamFormat `
                        --region $Region `
                        --limit 20 `
                        --output json 2>&1 | Out-File -FilePath $tempLogFile -Encoding utf8
                    
                    if ($LASTEXITCODE -eq 0) {
                        $logContent = [System.IO.File]::ReadAllText($tempLogFile, [System.Text.Encoding]::UTF8)
                        Remove-Item $tempLogFile -Force -ErrorAction SilentlyContinue
                        
                        if ($logContent -and $logContent -match '"message"') {
                            try {
                                $logJson = $logContent | ConvertFrom-Json
                                if ($logJson.events -and $logJson.events.Count -gt 0) {
                                    $logsFound = $true
                                    Write-Host "      Logs trouves dans: $streamFormat" -ForegroundColor Green
                                    Write-Host "      Derniers logs:" -ForegroundColor Gray
                                    
                                    $lastLogs = $logJson.events[-5..-1]
                                    foreach ($logEvent in $lastLogs) {
                                        $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($logEvent.timestamp).LocalDateTime
                                        $message = $logEvent.message
                                        Write-Host "        [$($timestamp.ToString('HH:mm:ss'))] $message" -ForegroundColor White
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
                    Write-Host "      Aucun log trouve pour cette tache" -ForegroundColor Yellow
                }
                
                Write-Host ""
            }
        }
    } else {
        Write-Host "  Aucune tache arretee trouvee" -ForegroundColor Yellow
    }
} else {
    Write-Host "  Erreur lors de la recuperation des taches arretees: $stoppedTasksJson" -ForegroundColor Red
}

Write-Host ""
Write-Host ""

# 5. Résumé et recommandations
Write-Host "5. RESUME ET RECOMMANDATIONS" -ForegroundColor Yellow
Write-Host "============================" -ForegroundColor Yellow
Write-Host ""

$issues = @()
$warnings = @()

# Vérifications
if (-not $containerDef.healthCheck) {
    $issues += "Health check non configure dans la task definition"
}

if ($containerDef.portMappings -and $containerDef.portMappings[0].containerPort -ne 8080) {
    $issues += "Port container different de 8080"
}

if ($service.healthCheckGracePeriodSeconds -eq 0) {
    $warnings += "Health check grace period a 0 - devrait etre 60-120 secondes"
}

if ($issues.Count -gt 0) {
    Write-Host "PROBLEMES CRITIQUES:" -ForegroundColor Red
    foreach ($issue in $issues) {
        Write-Host "  - $issue" -ForegroundColor Red
    }
    Write-Host ""
}

if ($warnings.Count -gt 0) {
    Write-Host "AVERTISSEMENTS:" -ForegroundColor Yellow
    foreach ($warning in $warnings) {
        Write-Host "  - $warning" -ForegroundColor Yellow
    }
    Write-Host ""
}

if ($issues.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-Host "Configuration semble correcte" -ForegroundColor Green
    Write-Host "Le probleme peut venir de:" -ForegroundColor Yellow
    Write-Host "  - L'application ne demarre pas correctement" -ForegroundColor White
    Write-Host "  - Erreur de connexion a la base de donnees" -ForegroundColor White
    Write-Host "  - Erreur dans le code de l'application" -ForegroundColor White
    Write-Host "  - Timeout du health check trop court" -ForegroundColor White
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  FIN DU DIAGNOSTIC" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

