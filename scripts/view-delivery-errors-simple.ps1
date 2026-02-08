# Script simple pour voir les erreurs de sauvegarde configuration
$env:AWS_PAGER = ""

Write-Host "=== RECHERCHE ERREURS SAUVEGARDE CONFIG ===" -ForegroundColor Cyan
Write-Host ""

# Récupérer le dernier log stream
$streams = aws logs describe-log-streams `
    --log-group-name "/ecs/yukpomnang-backend" `
    --order-by LastEventTime `
    --descending `
    --max-items 1 `
    --region us-east-1 `
    --output json | ConvertFrom-Json

if (-not $streams.logStreams -or $streams.logStreams.Count -eq 0) {
    Write-Host "Aucun log stream trouve" -ForegroundColor Red
    exit
}

$streamName = $streams.logStreams[0].logStreamName
Write-Host "Stream: $streamName" -ForegroundColor Yellow
Write-Host ""

# Récupérer les 100 derniers événements
$eventsJson = aws logs get-log-events `
    --log-group-name "/ecs/yukpomnang-backend" `
    --log-stream-name $streamName `
    --region us-east-1 `
    --limit 100 `
    --output json

$events = $eventsJson | ConvertFrom-Json

# Filtrer les erreurs
$errors = $events.events | Where-Object {
    $_.message -match "save_product_delivery_config" -or
    ($_.message -match "ERROR" -and $_.message -match "500")
}

if ($errors) {
    Write-Host "*** ERREURS TROUVEES ***" -ForegroundColor Red
    Write-Host ""
    foreach ($err in $errors) {
        $ts = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$err.timestamp).LocalDateTime
        Write-Host "[$($ts.ToString('yyyy-MM-dd HH:mm:ss'))]" -ForegroundColor Gray -NoNewline
        Write-Host " $($err.message)" -ForegroundColor Red
    }
} else {
    Write-Host "Aucune erreur trouvee dans les 100 derniers evenements" -ForegroundColor Green
    Write-Host ""
    Write-Host "Derniers evenements (pour verification):" -ForegroundColor Gray
    $events.events | Select-Object -Last 5 | ForEach-Object {
        $ts = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$_.timestamp).LocalDateTime
        Write-Host "[$($ts.ToString('HH:mm:ss'))] $($_.message.Substring(0, [Math]::Min(100, $_.message.Length)))" -ForegroundColor Gray
    }
}



