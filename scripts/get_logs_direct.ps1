# Script pour récupérer les logs directement et les analyser
# Écrit dans un fichier pour éviter les problèmes d'encodage

param(
    [string]$LogGroup = "/ecs/yukpo-backend",
    [string]$Region = "eu-west-1",
    [int]$Limit = 100
)

$ErrorActionPreference = "Continue"

# Configurer l'encodage UTF-8
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['*:Encoding'] = 'utf8'

Write-Host "Recuperation directe des logs" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""

# Récupérer les streams
$streamsJson = aws logs describe-log-streams `
    --log-group-name $LogGroup `
    --region $Region `
    --order-by LastEventTime `
    --descending `
    --max-items 3 `
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

# Créer le fichier de sortie
$outputFile = "logs-direct-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

"Logs ECS - Recuperation directe" | Out-File -FilePath $outputFile -Encoding utf8
"Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n" | Out-File -FilePath $outputFile -Append -Encoding utf8

$foundLogs = $false

foreach ($stream in $streams.logStreams) {
    $streamName = $stream.logStreamName
    Write-Host "Stream: $streamName" -ForegroundColor Yellow
    
    # Récupérer les logs dans un fichier temporaire
    $tempJson = [System.IO.Path]::GetTempFileName()
    
    $null = aws logs get-log-events `
        --log-group-name $LogGroup `
        --log-stream-name $streamName `
        --region $Region `
        --limit $Limit `
        --output json 2>&1 | Out-File -FilePath $tempJson -Encoding utf8NoBOM
    
    if ($LASTEXITCODE -eq 0) {
        $jsonContent = [System.IO.File]::ReadAllText($tempJson, [System.Text.Encoding]::UTF8)
        
        if (-not [string]::IsNullOrWhiteSpace($jsonContent)) {
            try {
                $jsonObj = $jsonContent | ConvertFrom-Json
                
                if ($jsonObj.events -and $jsonObj.events.Count -gt 0) {
                    $foundLogs = $true
                    Write-Host "  $($jsonObj.events.Count) evenement(s)" -ForegroundColor Green
                    
                    # Écrire dans le fichier de sortie
                    [System.IO.File]::AppendAllText($outputFile, "`n========================================`n", $utf8NoBom)
                    [System.IO.File]::AppendAllText($outputFile, "Stream: $streamName`n", $utf8NoBom)
                    [System.IO.File]::AppendAllText($outputFile, "========================================`n`n", $utf8NoBom)
                    
                    foreach ($event in $jsonObj.events) {
                        $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($event.timestamp).LocalDateTime
                        $timeStr = $timestamp.ToString("yyyy-MM-dd HH:mm:ss")
                        $message = $event.message
                        
                        $logLine = "[$timeStr] $message`n"
                        [System.IO.File]::AppendAllText($outputFile, $logLine, $utf8NoBom)
                    }
                } else {
                    Write-Host "  Aucun evenement" -ForegroundColor Gray
                }
            } catch {
                Write-Host "  Erreur de parsing JSON: $_" -ForegroundColor Red
                Write-Host "  Contenu (premiers 200 caracteres): $($jsonContent.Substring(0, [Math]::Min(200, $jsonContent.Length)))" -ForegroundColor Gray
            }
        } else {
            Write-Host "  Fichier vide" -ForegroundColor Gray
        }
    } else {
        $errorContent = [System.IO.File]::ReadAllText($tempJson, [System.Text.Encoding]::UTF8)
        Write-Host "  Erreur: $errorContent" -ForegroundColor Red
    }
    
    Remove-Item $tempJson -Force -ErrorAction SilentlyContinue
    Write-Host ""
}

if ($foundLogs) {
    Write-Host "Logs sauvegardes dans: $outputFile" -ForegroundColor Green
    Write-Host ""
    Write-Host "Analyse des logs..." -ForegroundColor Cyan
    
    # Lire le fichier et analyser
    $logContent = [System.IO.File]::ReadAllText($outputFile, [System.Text.Encoding]::UTF8)
    $lines = $logContent -split "`n"
    
    $detectionFound = $false
    $afterDetection = @()
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match "Base 'yukpo' inexistante|WARNING: La base 'yukpo' n'a pas été détectée") {
            $detectionFound = $true
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host "  MESSAGE DE DETECTION TROUVE" -ForegroundColor Cyan
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "Ligne $i : $($lines[$i])" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Evenements suivants (30 lignes):" -ForegroundColor Cyan
            Write-Host "----------------------------------------" -ForegroundColor Cyan
            Write-Host ""
            
            $endIndex = [Math]::Min($i + 30, $lines.Count - 1)
            for ($j = $i + 1; $j -le $endIndex; $j++) {
                if ($lines[$j].Length -gt 0) {
                    Write-Host $lines[$j] -ForegroundColor White
                    $afterDetection += $lines[$j]
                }
            }
            break
        }
    }
    
    if (-not $detectionFound) {
        Write-Host ""
        Write-Host "Message de detection non trouve" -ForegroundColor Yellow
        Write-Host "Affichage des 30 dernieres lignes:" -ForegroundColor Yellow
        Write-Host ""
        
        $lastLines = $lines[-30..-1]
        foreach ($line in $lastLines) {
            if ($line.Length -gt 0) {
                Write-Host $line -ForegroundColor White
            }
        }
    }
    
    Write-Host ""
    Write-Host "Pour afficher tous les logs:" -ForegroundColor Yellow
    Write-Host "  Get-Content $outputFile -Encoding UTF8" -ForegroundColor Cyan
} else {
    Write-Host "Aucun log trouve" -ForegroundColor Red
}

