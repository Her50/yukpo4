# Script pour trouver les erreurs de sauvegarde configuration livraison
param(
    [int]$Limit = 100,
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Continue"
$env:AWS_PAGER = ""

$logGroup = "/ecs/yukpomnang-backend"

Write-Host "=== RECHERCHE ERREURS SAUVEGARDE CONFIG LIVRAISON ===" -ForegroundColor Cyan
Write-Host "Log Group: $logGroup" -ForegroundColor Yellow
Write-Host "Region: $Region" -ForegroundColor Yellow
Write-Host ""

# Récupérer les log streams récents
Write-Host "Recuperation des log streams..." -ForegroundColor Yellow
$logStreamsJson = aws logs describe-log-streams `
    --log-group-name $logGroup `
    --order-by LastEventTime `
    --descending `
    --max-items 3 `
    --region $Region `
    --output json 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors de la recuperation des log streams: $logStreamsJson" -ForegroundColor Red
    exit 1
}

$logStreams = $logStreamsJson | ConvertFrom-Json

if (-not $logStreams.logStreams -or $logStreams.logStreams.Count -eq 0) {
    Write-Host "Aucun log stream trouve" -ForegroundColor Red
    exit 1
}

Write-Host "Trouve $($logStreams.logStreams.Count) log stream(s)" -ForegroundColor Green
Write-Host ""

$errorFound = $false

foreach ($stream in $logStreams.logStreams) {
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "STREAM: $($stream.logStreamName)" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    
    # Récupérer les événements
    $eventsJson = aws logs get-log-events `
        --log-group-name $logGroup `
        --log-stream-name $stream.logStreamName `
        --region $Region `
        --limit $Limit `
        --output json 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Erreur lors de la recuperation des evenements" -ForegroundColor Red
        continue
    }
    
    $events = $eventsJson | ConvertFrom-Json
    
    if (-not $events.events) {
        Write-Host "Aucun evenement dans ce stream" -ForegroundColor Gray
        Write-Host ""
        continue
    }
    
    # Filtrer les événements pertinents
    $relevantEvents = $events.events | Where-Object {
        $msg = $_.message
        $msg -match "save_product_delivery_config" -or
        ($msg -match "ERROR" -and $msg -match "product-config") -or
        $msg -match "Erreur.*sauvegarde" -or
        $msg -match "Erreur SQL.*sauvegarde"
    }
    
    if ($relevantEvents) {
        $errorFound = $true
        Write-Host "*** ERREURS TROUVEES ***" -ForegroundColor Red
        Write-Host ""
        
        foreach ($event in $relevantEvents) {
            $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$event.timestamp).LocalDateTime
            $timeStr = $timestamp.ToString("yyyy-MM-dd HH:mm:ss")
            $message = $event.message
            
            Write-Host "[$timeStr]" -ForegroundColor Gray -NoNewline
            Write-Host " $message" -ForegroundColor Red
        }
        
        Write-Host ""
    } else {
        Write-Host "Aucune erreur trouvee dans ce stream" -ForegroundColor Gray
        Write-Host ""
    }
}

if (-not $errorFound) {
    Write-Host "=== AUCUNE ERREUR TROUVEE ===" -ForegroundColor Green
    Write-Host "Les logs ne contiennent pas d'erreur de sauvegarde de configuration" -ForegroundColor Yellow
    Write-Host "Essayez d'augmenter -Limit (ex: -Limit 200) ou verifiez une periode plus recente" -ForegroundColor Yellow
} else {
    Write-Host "=== FIN DE LA RECHERCHE ===" -ForegroundColor Cyan
}



