# Script pour récupérer les logs récents de CloudWatch
param(
    [int]$Limit = 100
)

$logGroup = "/ecs/yukpomnang-backend"
$region = "eu-west-1"

Write-Host "Recuperation des logs du groupe: $logGroup" -ForegroundColor Cyan

# Récupérer le dernier log stream
$logStreams = aws logs describe-log-streams `
    --log-group-name $logGroup `
    --order-by LastEventTime `
    --descending `
    --max-items 1 `
    --region $region | ConvertFrom-Json

if ($logStreams.logStreams.Count -eq 0) {
    Write-Host "Aucun log stream trouve" -ForegroundColor Red
    exit 1
}

$logStreamName = $logStreams.logStreams[0].logStreamName
Write-Host "Log stream: $logStreamName" -ForegroundColor Yellow

# Récupérer les événements
$events = aws logs get-log-events `
    --log-group-name $logGroup `
    --log-stream-name $logStreamName `
    --region $region `
    --limit $Limit | ConvertFrom-Json

Write-Host "`n=== DERNIERS LOGS ($($events.events.Count) evenements) ===" -ForegroundColor Green
foreach ($event in $events.events) {
    $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($event.timestamp).ToString("yyyy-MM-dd HH:mm:ss")
    Write-Host "[$timestamp] $($event.message)"
}




