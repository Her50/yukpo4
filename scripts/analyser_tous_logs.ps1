# Script pour analyser tous les logs d'un stream

param(
    [string]$StreamName = "backend/backend/e2cf87f3cb5b4943a0fc88c0bf82b1e5",
    [string]$LogGroup = "/ecs/yukpo-backend",
    [string]$Region = "eu-west-1",
    [int]$Limit = 1000
)

$ErrorActionPreference = "Continue"

# Forcer UTF-8
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

Write-Host "Analyse de tous les logs du stream" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "Stream: $StreamName" -ForegroundColor Yellow
Write-Host ""

$tempJson = "temp-all-logs.json"

# Récupérer les logs
Write-Host "Recuperation des logs..." -ForegroundColor Cyan
$process = Start-Process -FilePath "aws" `
    -ArgumentList "logs", "get-log-events", "--log-group-name", $LogGroup, "--log-stream-name", $StreamName, "--region", $Region, "--limit", $Limit, "--output", "json" `
    -RedirectStandardOutput $tempJson `
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
                Write-Host "  $($jsonObj.events.Count) evenement(s) recupere(s)" -ForegroundColor Green
                Write-Host ""
                
                # Chercher la vérification Redis et afficher ce qui suit
                $foundRedis = $false
                for ($i = 0; $i -lt $jsonObj.events.Count; $i++) {
                    $message = $jsonObj.events[$i].message
                    
                    if ($message -match "Redis|ElastiCache") {
                        $foundRedis = $true
                        $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($jsonObj.events[$i].timestamp).LocalDateTime
                        
                        Write-Host "========================================" -ForegroundColor Cyan
                        Write-Host "  VERIFICATION REDIS TROUVEE" -ForegroundColor Cyan
                        Write-Host "========================================" -ForegroundColor Cyan
                        Write-Host ""
                        Write-Host "Index: $i" -ForegroundColor Yellow
                        Write-Host "Timestamp: $($timestamp.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor White
                        Write-Host ""
                        Write-Host "Evenements suivants (60 lignes):" -ForegroundColor Cyan
                        Write-Host "----------------------------------------" -ForegroundColor Cyan
                        Write-Host ""
                        
                        $endIndex = [Math]::Min($i + 60, $jsonObj.events.Count - 1)
                        for ($j = $i + 1; $j -le $endIndex; $j++) {
                            $nextEvent = $jsonObj.events[$j]
                            $nextTimestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($nextEvent.timestamp).LocalDateTime
                            $nextMessage = $nextEvent.message
                            
                            # Colorier selon le type de message
                            $color = "White"
                            if ($nextMessage -match "(?i)(error|erreur|failed|échec|❌)") {
                                $color = "Red"
                            } elseif ($nextMessage -match "(?i)(success|réussi|ok|✅|started|démarré|listening|écoute)") {
                                $color = "Green"
                            } elseif ($nextMessage -match "(?i)(warning|avertissement|⚠️)") {
                                $color = "Yellow"
                            } elseif ($nextMessage -match "(?i)(database|base|migration|sqlx)") {
                                $color = "Cyan"
                            }
                            
                            Write-Host "[$($nextTimestamp.ToString('yyyy-MM-dd HH:mm:ss'))] $nextMessage" -ForegroundColor $color
                        }
                        
                        break
                    }
                }
                
                if (-not $foundRedis) {
                    Write-Host "Verification Redis non trouvee" -ForegroundColor Yellow
                    Write-Host ""
                    Write-Host "Affichage des 60 derniers evenements:" -ForegroundColor Yellow
                    Write-Host "----------------------------------------" -ForegroundColor Cyan
                    Write-Host ""
                    
                    $lastEvents = $jsonObj.events[-60..-1]
                    foreach ($event in $lastEvents) {
                        $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($event.timestamp).LocalDateTime
                        $message = $event.message
                        
                        $color = "White"
                        if ($message -match "(?i)(error|erreur|failed|échec|❌)") {
                            $color = "Red"
                        } elseif ($message -match "(?i)(success|réussi|ok|✅|started|démarré|listening|écoute)") {
                            $color = "Green"
                        } elseif ($message -match "(?i)(warning|avertissement|⚠️)") {
                            $color = "Yellow"
                        } elseif ($message -match "(?i)(database|base|migration|sqlx)") {
                            $color = "Cyan"
                        }
                        
                        Write-Host "[$($timestamp.ToString('yyyy-MM-dd HH:mm:ss'))] $message" -ForegroundColor $color
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
} else {
    Write-Host "  Erreur lors de la recuperation" -ForegroundColor Red
}

