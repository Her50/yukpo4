# Script d'analyse approfondie de toutes les configurations AWS
# Vérifie que tout est correctement configuré après l'ajout de MONGODB_URL

$ErrorActionPreference = "Stop"

$region = "eu-west-1"
$cluster = "yukpo-cluster"
$service = "yukpo-backend-service"
$taskDefinition = "yukpo-backend"
$secretId = "yukpo/backend/secrets"

$report = @()

function Add-ReportItem {
    param($Category, $Item, $Status, $Details = "")
    $report += [PSCustomObject]@{
        Category = $Category
        Item = $Item
        Status = $Status
        Details = $Details
        Timestamp = Get-Date
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ANALYSE APPROFONDIE CONFIGURATIONS AWS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host ""

# ========================================
# 1. VÉRIFICATION SECRETS MANAGER
# ========================================
Write-Host "1. VÉRIFICATION SECRETS MANAGER" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    $secret = aws secretsmanager get-secret-value --secret-id $secretId --region $region --query 'SecretString' --output text 2>&1 | ConvertFrom-Json
    
    if ($secret) {
        Write-Host "  Secret: $secretId" -ForegroundColor White
        
        $criticalVars = @("DATABASE_URL", "REDIS_URL", "MONGODB_URL", "JWT_SECRET", "PORT", "HOST")
        $missing = @()
        $present = @()
        
        foreach ($var in $criticalVars) {
            if ($secret.$var) {
                $present += $var
                $value = $secret.$var
                $displayValue = if ($value.Length -gt 50) { $value.Substring(0, 50) + "..." } else { $value }
                Write-Host "    ✅ $var : $displayValue" -ForegroundColor Green
            } else {
                $missing += $var
                Write-Host "    ❌ $var : MANQUANTE" -ForegroundColor Red
            }
        }
        
        if ($missing.Count -eq 0) {
            Add-ReportItem -Category "Secrets Manager" -Item "Critical Variables" -Status "OK" -Details "Toutes présentes"
            Write-Host "  ✅ Toutes les variables critiques sont présentes" -ForegroundColor Green
        } else {
            Add-ReportItem -Category "Secrets Manager" -Item "Critical Variables" -Status "ERROR" -Details "Manquantes: $($missing -join ', ')"
            Write-Host "  ❌ Variables manquantes: $($missing -join ', ')" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "  ❌ Erreur: $_" -ForegroundColor Red
    Add-ReportItem -Category "Secrets Manager" -Item "Secret Access" -Status "ERROR" -Details $_.ToString()
}

Write-Host ""

# ========================================
# 2. VÉRIFICATION TASK DEFINITION
# ========================================
Write-Host "2. VÉRIFICATION TASK DEFINITION" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    $taskDef = aws ecs describe-task-definition --task-definition $taskDefinition --region $region --output json | ConvertFrom-Json
    if ($taskDef.taskDefinition) {
        $td = $taskDef.taskDefinition
        $container = $td.containerDefinitions[0]
        
        Write-Host "  Task Definition: $($td.family):$($td.revision)" -ForegroundColor White
        Write-Host "  Status: $($td.status)" -ForegroundColor $(if ($td.status -eq "ACTIVE") { "Green" } else { "Red" })
        
        # Vérifier les secrets référencés
        Write-Host "  Secrets référencés:" -ForegroundColor Cyan
        $requiredSecrets = @("DATABASE_URL", "REDIS_URL", "JWT_SECRET", "MONGODB_URL", "ENABLE_AUTO_MIGRATIONS")
        $foundSecrets = @()
        $missingSecrets = @()
        
        foreach ($secret in $container.secrets) {
            $foundSecrets += $secret.name
            if ($requiredSecrets -contains $secret.name) {
                Write-Host "    ✅ $($secret.name)" -ForegroundColor Green
            } else {
                Write-Host "    - $($secret.name)" -ForegroundColor Gray
            }
        }
        
        foreach ($reqSecret in $requiredSecrets) {
            if ($foundSecrets -notcontains $reqSecret) {
                $missingSecrets += $reqSecret
                Write-Host "    ❌ $reqSecret : MANQUANTE" -ForegroundColor Red
            }
        }
        
        if ($missingSecrets.Count -eq 0) {
            Add-ReportItem -Category "Task Definition" -Item "Required Secrets" -Status "OK" -Details "Tous présents"
            Write-Host "  ✅ Tous les secrets requis sont référencés" -ForegroundColor Green
        } else {
            Add-ReportItem -Category "Task Definition" -Item "Required Secrets" -Status "ERROR" -Details "Manquants: $($missingSecrets -join ', ')"
            Write-Host "  ❌ Secrets manquants: $($missingSecrets -join ', ')" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "  ❌ Erreur: $_" -ForegroundColor Red
    Add-ReportItem -Category "Task Definition" -Item "Task Definition Info" -Status "ERROR" -Details $_.ToString()
}

Write-Host ""

# ========================================
# 3. VÉRIFICATION SERVICE ECS
# ========================================
Write-Host "3. VÉRIFICATION SERVICE ECS" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    $serviceInfo = aws ecs describe-services --cluster $cluster --services $service --region $region --output json | ConvertFrom-Json
    if ($serviceInfo.services) {
        $svc = $serviceInfo.services[0]
        Write-Host "  Service: $($svc.serviceName)" -ForegroundColor White
        Write-Host "  Status: $($svc.status)" -ForegroundColor $(if ($svc.status -eq "ACTIVE") { "Green" } else { "Red" })
        Write-Host "  Task Definition: $($svc.taskDefinition.Split('/')[-1])" -ForegroundColor White
        Write-Host "  Desired: $($svc.desiredCount)" -ForegroundColor White
        Write-Host "  Running: $($svc.runningCount)" -ForegroundColor $(if ($svc.runningCount -gt 0) { "Green" } else { "Red" })
        Write-Host "  Pending: $($svc.pendingCount)" -ForegroundColor White
        
        if ($svc.runningCount -gt 0) {
            Add-ReportItem -Category "ECS Service" -Item "Service Status" -Status "OK" -Details "Running: $($svc.runningCount)"
        } else {
            Add-ReportItem -Category "ECS Service" -Item "Service Status" -Status "WARNING" -Details "No running tasks"
        }
    }
} catch {
    Write-Host "  ❌ Erreur: $_" -ForegroundColor Red
    Add-ReportItem -Category "ECS Service" -Item "Service Info" -Status "ERROR" -Details $_.ToString()
}

Write-Host ""

# ========================================
# 4. VÉRIFICATION TÂCHES EN COURS
# ========================================
Write-Host "4. VÉRIFICATION TÂCHES EN COURS" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    $runningTasks = aws ecs list-tasks --cluster $cluster --service-name $service --desired-status RUNNING --region $region --max-items 3 --output json | ConvertFrom-Json
    
    if ($runningTasks.taskArns -and $runningTasks.taskArns.Count -gt 0) {
        Write-Host "  Tâches en cours: $($runningTasks.taskArns.Count)" -ForegroundColor Green
        
        foreach ($taskArn in $runningTasks.taskArns) {
            $taskId = $taskArn.Split('/')[-1]
            $taskDetails = aws ecs describe-tasks --cluster $cluster --tasks $taskArn --region $region --output json | ConvertFrom-Json
            if ($taskDetails.tasks) {
                $task = $taskDetails.tasks[0]
                Write-Host "    Tâche: $taskId" -ForegroundColor White
                Write-Host "      Task Definition: $($task.taskDefinitionArn.Split('/')[-1])" -ForegroundColor Gray
                Write-Host "      Health Status: $($task.containers[0].healthStatus)" -ForegroundColor $(if ($task.containers[0].healthStatus -eq "HEALTHY") { "Green" } elseif ($task.containers[0].healthStatus -eq "UNKNOWN") { "Yellow" } else { "Red" })
                Write-Host "      Started: $($task.startedAt)" -ForegroundColor Gray
            }
        }
        
        Add-ReportItem -Category "Tasks" -Item "Running Tasks" -Status "OK" -Details "$($runningTasks.taskArns.Count) tasks"
    } else {
        Write-Host "  ⚠️ Aucune tâche en cours" -ForegroundColor Yellow
        Add-ReportItem -Category "Tasks" -Item "Running Tasks" -Status "WARNING" -Details "No running tasks"
    }
} catch {
    Write-Host "  ❌ Erreur: $_" -ForegroundColor Red
    Add-ReportItem -Category "Tasks" -Item "Tasks Info" -Status "ERROR" -Details $_.ToString()
}

Write-Host ""

# ========================================
# 5. VÉRIFICATION LOGS [MAIN]
# ========================================
Write-Host "5. VÉRIFICATION LOGS [MAIN]" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    $runningTasks = aws ecs list-tasks --cluster $cluster --service-name $service --desired-status RUNNING --region $region --max-items 1 --output json | ConvertFrom-Json
    
    if ($runningTasks.taskArns) {
        $taskArn = $runningTasks.taskArns[0]
        $taskId = $taskArn.Split('/')[-1]
        $streamName = "backend/backend/$taskId"
        $logGroup = "/ecs/yukpo-backend"
        
        Write-Host "  Analyse de la tâche: $taskId" -ForegroundColor White
        Write-Host "  Log Stream: $streamName" -ForegroundColor Gray
        
        try {
            $logEvents = aws logs get-log-events --log-group-name $logGroup --log-stream-name $streamName --region $region --limit 200 --output json 2>&1 | ConvertFrom-Json
            
            if ($logEvents.events) {
                Write-Host "  Total d'événements: $($logEvents.events.Count)" -ForegroundColor White
                
                # Rechercher les logs [MAIN]
                $mainLogs = $logEvents.events | Where-Object { $_.message -match "\[MAIN\]" }
                
                if ($mainLogs) {
                    Write-Host "  ✅ LOGS [MAIN] TROUVÉS! ($($mainLogs.Count) événements)" -ForegroundColor Green
                    Write-Host ""
                    Write-Host "  Derniers logs [MAIN]:" -ForegroundColor Cyan
                    $mainLogs | Select-Object -Last 10 | ForEach-Object {
                        Write-Host "    $($_.message)" -ForegroundColor Cyan
                    }
                    
                    # Vérifier MONGODB_URL spécifiquement
                    $mongoLogs = $mainLogs | Where-Object { $_.message -match "MONGODB_URL" }
                    if ($mongoLogs) {
                        Write-Host ""
                        Write-Host "  ✅ MONGODB_URL détectée dans les logs!" -ForegroundColor Green
                        Add-ReportItem -Category "Logs" -Item "MONGODB_URL in Logs" -Status "OK" -Details "MONGODB_URL found in logs"
                    } else {
                        Write-Host ""
                        Write-Host "  ⚠️ MONGODB_URL non trouvée dans les logs [MAIN]" -ForegroundColor Yellow
                        Add-ReportItem -Category "Logs" -Item "MONGODB_URL in Logs" -Status "WARNING" -Details "MONGODB_URL not found in logs"
                    }
                    
                    Add-ReportItem -Category "Logs" -Item "MAIN Logs" -Status "OK" -Details "$($mainLogs.Count) MAIN logs found"
                } else {
                    Write-Host "  ❌ AUCUN LOG [MAIN] TROUVÉ" -ForegroundColor Red
                    Write-Host ""
                    Write-Host "  Derniers logs (sans [MAIN]):" -ForegroundColor Yellow
                    $logEvents.events | Select-Object -Last 10 | ForEach-Object {
                        Write-Host "    $($_.message)" -ForegroundColor White
                    }
                    Add-ReportItem -Category "Logs" -Item "MAIN Logs" -Status "ERROR" -Details "No MAIN logs found"
                }
            } else {
                Write-Host "  ⚠️ Aucun log disponible pour le moment" -ForegroundColor Yellow
                Add-ReportItem -Category "Logs" -Item "Log Events" -Status "WARNING" -Details "No log events available"
            }
        } catch {
            Write-Host "  ⚠️ Erreur lors de la récupération des logs: $_" -ForegroundColor Yellow
            Add-ReportItem -Category "Logs" -Item "Log Access" -Status "WARNING" -Details $_.ToString()
        }
    } else {
        Write-Host "  ⚠️ Aucune tâche en cours pour vérifier les logs" -ForegroundColor Yellow
        Add-ReportItem -Category "Logs" -Item "Log Check" -Status "WARNING" -Details "No running tasks"
    }
} catch {
    Write-Host "  ❌ Erreur: $_" -ForegroundColor Red
    Add-ReportItem -Category "Logs" -Item "Log Check" -Status "ERROR" -Details $_.ToString()
}

Write-Host ""

# ========================================
# 6. RÉSUMÉ FINAL
# ========================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RÉSUMÉ FINAL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$okCount = ($report | Where-Object { $_.Status -eq "OK" }).Count
$warningCount = ($report | Where-Object { $_.Status -eq "WARNING" }).Count
$errorCount = ($report | Where-Object { $_.Status -eq "ERROR" }).Count

Write-Host "  ✅ OK: $okCount" -ForegroundColor Green
Write-Host "  ⚠️ WARNINGS: $warningCount" -ForegroundColor Yellow
Write-Host "  ❌ ERREURS: $errorCount" -ForegroundColor Red
Write-Host ""

if ($errorCount -eq 0 -and $warningCount -eq 0) {
    Write-Host "  ✅ TOUT EST CORRECT!" -ForegroundColor Green
} elseif ($errorCount -eq 0) {
    Write-Host "  ⚠️ Quelques avertissements, mais pas d'erreurs critiques" -ForegroundColor Yellow
} else {
    Write-Host "  ❌ Des erreurs critiques ont été détectées" -ForegroundColor Red
}

Write-Host ""
Write-Host "Détails:" -ForegroundColor Cyan
$report | ForEach-Object {
    $color = if ($_.Status -eq "OK") { "Green" } elseif ($_.Status -eq "WARNING") { "Yellow" } else { "Red" }
    Write-Host "  [$($_.Status)] $($_.Category) - $($_.Item): $($_.Details)" -ForegroundColor $color
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ANALYSE TERMINÉE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

