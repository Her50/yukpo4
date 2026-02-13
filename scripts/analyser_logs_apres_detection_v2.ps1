# Script pour analyser les logs après le message de détection
# Utilise une approche simple avec redirection de fichier

param(
    [string]$LogGroup = "/ecs/yukpo-backend",
    [string]$Region = "eu-west-1",
    [int]$Limit = 100
)

$ErrorActionPreference = "Continue"

# Forcer UTF-8 pour AWS CLI (qui utilise Python)
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

Write-Host "Analyse des logs apres detection" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Récupérer le stream le plus récent
$streamsJson = aws logs describe-log-streams `
    --log-group-name $LogGroup `
    --region $Region `
    --order-by LastEventTime `
    --descending `
    --max-items 1 `
    --output json 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur: $streamsJson" -ForegroundColor Red
    exit 1
}

$streams = $streamsJson | ConvertFrom-Json

if (-not $streams.logStreams -or $streams.logStreams.Count -eq 0) {
    Write-Host "Aucun stream trouve" -ForegroundColor Red
    exit 1
}

$streamName = $streams.logStreams[0].logStreamName
Write-Host "Stream: $streamName" -ForegroundColor Yellow
Write-Host ""

# Récupérer les logs dans un fichier JSON
$tempJson = "temp-logs-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
Write-Host "Recuperation des logs..." -ForegroundColor Cyan

# Utiliser Start-Process pour éviter les problèmes d'encodage
$process = Start-Process -FilePath "aws" `
    -ArgumentList "logs", "get-log-events", "--log-group-name", $LogGroup, "--log-stream-name", $streamName, "--region", $Region, "--limit", $Limit, "--output", "json" `
    -RedirectStandardOutput $tempJson `
    -RedirectStandardError "temp-errors.txt" `
    -NoNewWindow `
    -Wait `
    -PassThru

if ($process.ExitCode -eq 0 -and (Test-Path $tempJson)) {
    $size = (Get-Item $tempJson).Length
    Write-Host "  Fichier cree: $tempJson ($size bytes)" -ForegroundColor Green
    
    if ($size -gt 100) {
        Write-Host ""
        Write-Host "Parsing du JSON..." -ForegroundColor Cyan
        
        try {
            $jsonContent = [System.IO.File]::ReadAllText($tempJson, [System.Text.Encoding]::UTF8)
            $jsonObj = $jsonContent | ConvertFrom-Json
            
            if ($jsonObj.events -and $jsonObj.events.Count -gt 0) {
                Write-Host "  $($jsonObj.events.Count) evenement(s) trouve(s)" -ForegroundColor Green
                Write-Host ""
                
                # Chercher le message de détection
                $found = $false
                for ($i = 0; $i -lt $jsonObj.events.Count; $i++) {
                    $message = $jsonObj.events[$i].message
                    
                    if ($message -match "Base.*yukpo.*inexistante|WARNING.*base.*yukpo.*detectee|base.*yukpo.*n'a pas été détectée|Base 'yukpo' inexistante") {
                        $found = $true
                        $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($jsonObj.events[$i].timestamp).LocalDateTime
                        
                        Write-Host "========================================" -ForegroundColor Cyan
                        Write-Host "  MESSAGE DE DETECTION TROUVE" -ForegroundColor Cyan
                        Write-Host "========================================" -ForegroundColor Cyan
                        Write-Host ""
                        Write-Host "Index: $i" -ForegroundColor Yellow
                        Write-Host "Timestamp: $($timestamp.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor White
                        Write-Host "Message: $message" -ForegroundColor White
                        Write-Host ""
                        Write-Host "Evenements suivants (40 lignes):" -ForegroundColor Cyan
                        Write-Host "----------------------------------------" -ForegroundColor Cyan
                        Write-Host ""
                        
                        $endIndex = [Math]::Min($i + 40, $jsonObj.events.Count - 1)
                        for ($j = $i + 1; $j -le $endIndex; $j++) {
                            $nextEvent = $jsonObj.events[$j]
                            $nextTimestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($nextEvent.timestamp).LocalDateTime
                            $nextMessage = $nextEvent.message
                            
                            Write-Host "[$($nextTimestamp.ToString('yyyy-MM-dd HH:mm:ss'))] $nextMessage" -ForegroundColor White
                        }
                        
                        break
                    }
                }
                
                if (-not $found) {
                    Write-Host "Message de detection non trouve" -ForegroundColor Yellow
                    Write-Host ""
                    Write-Host "Affichage des 30 derniers evenements:" -ForegroundColor Yellow
                    Write-Host "----------------------------------------" -ForegroundColor Cyan
                    Write-Host ""
                    
                    $lastEvents = $jsonObj.events[-30..-1]
                    foreach ($event in $lastEvents) {
                        $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($event.timestamp).LocalDateTime
                        Write-Host "[$($timestamp.ToString('yyyy-MM-dd HH:mm:ss'))] $($event.message)" -ForegroundColor White
                    }
                }
            } else {
                Write-Host "  Aucun evenement dans le JSON" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "  Erreur de parsing: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "  Fichier trop petit" -ForegroundColor Yellow
    }
    
    # Nettoyer
    Remove-Item $tempJson -Force -ErrorAction SilentlyContinue
    if (Test-Path "temp-errors.txt") {
        Remove-Item "temp-errors.txt" -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "  Erreur lors de la recuperation" -ForegroundColor Red
    if (Test-Path "temp-errors.txt") {
        Write-Host "  Erreurs:" -ForegroundColor Yellow
        Get-Content "temp-errors.txt" -Encoding UTF8
        Remove-Item "temp-errors.txt" -Force -ErrorAction SilentlyContinue
    }
}

