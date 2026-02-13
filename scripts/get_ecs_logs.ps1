# Script pour récupérer les logs ECS

$cluster = "yukpo-cluster"
$service = "yukpo-backend-service"
$region = "eu-west-1"
$logGroup = "/ecs/yukpo-backend"

Write-Host "Recuperation des logs ECS..." -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""

# Récupérer la dernière tâche
$tasks = aws ecs list-tasks `
    --cluster $cluster `
    --service-name $service `
    --desired-status RUNNING `
    --region $region `
    --output json | ConvertFrom-Json

if ($tasks.taskArns.Count -eq 0) {
    Write-Host "Aucune tache en cours d'execution" -ForegroundColor Red
    exit 1
}

$taskArn = $tasks.taskArns[0]
$taskId = $taskArn.Split('/')[-1]

Write-Host "Task ID: $taskId" -ForegroundColor Yellow
Write-Host ""

# Récupérer les détails de la tâche pour obtenir le log stream
$taskDetails = aws ecs describe-tasks `
    --cluster $cluster `
    --tasks $taskArn `
    --region $region `
    --output json | ConvertFrom-Json

$containerName = $taskDetails.tasks[0].containers[0].name

# Construire le nom du log stream
$logStream = "ecs/$containerName/$taskId"

Write-Host "Log Stream: $logStream" -ForegroundColor Yellow
Write-Host ""
Write-Host "Derniers logs (50 lignes):" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""

# Récupérer les logs
try {
    $logEvents = aws logs get-log-events `
        --log-group-name $logGroup `
        --log-stream-name $logStream `
        --region $region `
        --limit 50 `
        --output json | ConvertFrom-Json
    
    if ($logEvents.events) {
        foreach ($event in $logEvents.events) {
            $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($event.timestamp).LocalDateTime.ToString("yyyy-MM-dd HH:mm:ss")
            Write-Host "[$timestamp] $($event.message)" -ForegroundColor White
        }
    } else {
        Write-Host "Aucun log trouve" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Tentative de recuperation depuis les derniers streams..." -ForegroundColor Yellow
        
        # Essayer de récupérer depuis les derniers streams
        $streams = aws logs describe-log-streams `
            --log-group-name $logGroup `
            --region $region `
            --order-by LastEventTime `
            --descending `
            --max-items 3 `
            --output json | ConvertFrom-Json
        
        foreach ($stream in $streams.logStreams) {
            Write-Host ""
            Write-Host "Stream: $($stream.logStreamName)" -ForegroundColor Yellow
            Write-Host "Derniers evenements:" -ForegroundColor Gray
            
            $events = aws logs get-log-events `
                --log-group-name $logGroup `
                --log-stream-name $stream.logStreamName `
                --region $region `
                --limit 10 `
                --output json | ConvertFrom-Json
            
            if ($events.events) {
                foreach ($event in $events.events) {
                    $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($event.timestamp).LocalDateTime.ToString("yyyy-MM-dd HH:mm:ss")
                    Write-Host "[$timestamp] $($event.message)" -ForegroundColor White
                }
            }
        }
    }
} catch {
    Write-Host "Erreur lors de la recuperation des logs: $_" -ForegroundColor Red
}

