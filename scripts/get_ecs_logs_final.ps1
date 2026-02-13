# Script final pour récupérer les logs ECS de manière fiable
# Utilise des fichiers temporaires pour éviter tous les problèmes d'encodage

param(
    [string]$Cluster = "yukpo-cluster",
    [string]$Service = "yukpo-backend-service",
    [string]$Region = "eu-west-1",
    [string]$LogGroup = "/ecs/yukpo-backend",
    [int]$Lines = 50
)

$ErrorActionPreference = "Continue"

Write-Host "Recuperation des logs ECS" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""

# Créer un fichier de sortie
$outputFile = "ecs-logs-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

"Logs ECS - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File -FilePath $outputFile -Encoding utf8
"Cluster: $Cluster" | Out-File -FilePath $outputFile -Append -Encoding utf8
"Service: $Service" | Out-File -FilePath $outputFile -Append -Encoding utf8
"Log Group: $LogGroup`n" | Out-File -FilePath $outputFile -Append -Encoding utf8

Write-Host "Les logs seront sauvegardes dans: $outputFile" -ForegroundColor Yellow
Write-Host ""

# Fonction pour récupérer les logs d'un stream
function Get-LogsFromStream {
    param(
        [string]$StreamName
    )
    
    $tempJson = [System.IO.Path]::GetTempFileName()
    
    try {
        # Récupérer les logs en JSON dans un fichier
        aws logs get-log-events `
            --log-group-name $LogGroup `
            --log-stream-name $StreamName `
            --region $Region `
            --limit $Lines `
            --output json 2>&1 | Out-File -FilePath $tempJson -Encoding utf8
        
        if ($LASTEXITCODE -ne 0) {
            return $null
        }
        
        # Lire le fichier JSON
        $jsonContent = [System.IO.File]::ReadAllText($tempJson, [System.Text.Encoding]::UTF8)
        
        if ([string]::IsNullOrWhiteSpace($jsonContent)) {
            return $null
        }
        
        # Parser le JSON
        $jsonObj = $jsonContent | ConvertFrom-Json
        
        return $jsonObj.events
    } catch {
        return $null
    } finally {
        if (Test-Path $tempJson) {
            Remove-Item $tempJson -Force -ErrorAction SilentlyContinue
        }
    }
}

# Récupérer les derniers streams
Write-Host "Recuperation des derniers streams de logs..." -ForegroundColor Cyan

$tempStreams = [System.IO.Path]::GetTempFileName()
aws logs describe-log-streams `
    --log-group-name $LogGroup `
    --region $Region `
    --order-by LastEventTime `
    --descending `
    --max-items 10 `
    --output json 2>&1 | Out-File -FilePath $tempStreams -Encoding utf8

if ($LASTEXITCODE -eq 0) {
    $streamsContent = [System.IO.File]::ReadAllText($tempStreams, [System.Text.Encoding]::UTF8)
    $streams = $streamsContent | ConvertFrom-Json
    
    if ($streams.logStreams) {
        Write-Host "   $($streams.logStreams.Count) stream(s) trouve(s)" -ForegroundColor Green
        Write-Host ""
        
        $foundLogs = $false
        
        foreach ($stream in $streams.logStreams) {
            $streamName = $stream.logStreamName
            Write-Host "   Stream: $streamName" -ForegroundColor Yellow
            
            $events = Get-LogsFromStream -StreamName $streamName
            
            if ($events -and $events.Count -gt 0) {
                $foundLogs = $true
                
                # Écrire dans le fichier de sortie
                [System.IO.File]::AppendAllText($outputFile, "`n========================================`n", $utf8NoBom)
                [System.IO.File]::AppendAllText($outputFile, "Stream: $streamName`n", $utf8NoBom)
                [System.IO.File]::AppendAllText($outputFile, "========================================`n`n", $utf8NoBom)
                
                foreach ($event in $events) {
                    $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($event.timestamp).LocalDateTime
                    $timeStr = $timestamp.ToString("yyyy-MM-dd HH:mm:ss")
                    $message = $event.message
                    
                    $logLine = "[$timeStr] $message`n"
                    [System.IO.File]::AppendAllText($outputFile, $logLine, $utf8NoBom)
                }
                
                Write-Host "     $($events.Count) evenement(s) recupere(s)" -ForegroundColor Green
                
                # Limiter à 3 streams avec des logs
                break
            } else {
                Write-Host "     Aucun log" -ForegroundColor Gray
            }
        }
        
        if (-not $foundLogs) {
            Write-Host "   Aucun log trouve dans les streams recents" -ForegroundColor Yellow
        }
    }
}

Remove-Item $tempStreams -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Logs sauvegardes dans: $outputFile" -ForegroundColor Green
Write-Host ""
Write-Host "Pour afficher les logs:" -ForegroundColor Yellow
Write-Host "  Get-Content $outputFile -Encoding UTF8" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pour afficher uniquement les erreurs:" -ForegroundColor Yellow
Write-Host "  Get-Content $outputFile -Encoding UTF8 | Select-String -Pattern '(?i)(error|exception|failed|panic|fatal)'" -ForegroundColor Cyan

