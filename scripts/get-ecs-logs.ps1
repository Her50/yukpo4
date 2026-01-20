# Script pour récupérer les logs ECS sans problèmes d'encodage
param(
    [int]$Limit = 50
)

$ErrorActionPreference = "Continue"
$env:AWS_PAGER = ""

Write-Host "=== LOGS ECS CLOUDWATCH ===" -ForegroundColor Cyan
Write-Host ""

# Récupérer les log streams
$logStreams = aws logs describe-log-streams `
    --log-group-name "/ecs/yukpomnang-backend" `
    --region eu-west-1 `
    --order-by LastEventTime `
    --descending `
    --max-items 2 `
    --output json | ConvertFrom-Json

if (-not $logStreams.logStreams -or $logStreams.logStreams.Count -eq 0) {
    Write-Host "Aucun log stream trouvé" -ForegroundColor Yellow
    exit
}

foreach ($stream in $logStreams.logStreams) {
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "STREAM: $($stream.logStreamName)" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    
    # Récupérer les événements en JSON
    $eventsJson = aws logs get-log-events `
        --log-group-name "/ecs/yukpomnang-backend" `
        --log-stream-name $stream.logStreamName `
        --region eu-west-1 `
        --limit $Limit `
        --output json 2>&1
    
    # Sauvegarder dans un fichier temporaire
    $tempFile = "temp_logs_$([System.Guid]::NewGuid().ToString().Substring(0,8)).json"
    $eventsJson | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline
    
    try {
        # Lire et parser le JSON
        $content = Get-Content $tempFile -Raw -Encoding UTF8
        $events = $content | ConvertFrom-Json
        
        if ($events.events) {
            Write-Host "Dernières lignes:" -ForegroundColor Cyan
            Write-Host ""
            
            $events.events | Select-Object -Last 30 | ForEach-Object {
                $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$_.timestamp).LocalDateTime
                $timeStr = $timestamp.ToString("HH:mm:ss")
                $message = $_.message
                
                # Nettoyer les caractères non-ASCII
                $cleanMsg = $message -replace '[^\x20-\x7E]', '?'
                
                # Déterminer la couleur
                $color = "White"
                if ($cleanMsg -match "error|ERROR|panic|PANIC|fail|FAIL|unable|Unable|exception|Exception") {
                    $color = "Red"
                } elseif ($cleanMsg -match "warn|WARN|warning|Warning") {
                    $color = "Yellow"
                } elseif ($cleanMsg -match "Serveur|listening|started|OK|health|Health|listening on|8080") {
                    $color = "Green"
                } elseif ($cleanMsg -match "DATABASE|database|PostgreSQL|postgres|connection|Connection|connecting|RDS") {
                    $color = "Cyan"
                }
                
                Write-Host "[$timeStr] $cleanMsg" -ForegroundColor $color
            }
        }
    } catch {
        Write-Host "Erreur lors du parsing: $_" -ForegroundColor Red
        Write-Host "Contenu brut (premiers 500 caractères):" -ForegroundColor Yellow
        if (Test-Path $tempFile) {
            $rawContent = Get-Content $tempFile -Raw -Encoding UTF8
            Write-Host $rawContent.Substring(0, [Math]::Min(500, $rawContent.Length)) -ForegroundColor Gray
        }
    } finally {
        if (Test-Path $tempFile) {
            Remove-Item $tempFile -ErrorAction SilentlyContinue
        }
    }
    
    Write-Host ""
}




