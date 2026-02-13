# Script pour analyser les logs après le message de détection de la base
# Cherche ce qui se passe après "Base 'yukpo' inexistante"

param(
    [string]$Cluster = "yukpo-cluster",
    [string]$Service = "yukpo-backend-service",
    [string]$Region = "eu-west-1",
    [string]$LogGroup = "/ecs/yukpo-backend",
    [int]$Lines = 200
)

$ErrorActionPreference = "Continue"

Write-Host "Analyse des logs apres detection de la base" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Créer un fichier de sortie
$outputFile = "logs-apres-detection-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

"Analyse des logs apres detection - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File -FilePath $outputFile -Encoding utf8
"Cluster: $Cluster" | Out-File -FilePath $outputFile -Append -Encoding utf8
"Service: $Service`n" | Out-File -FilePath $outputFile -Append -Encoding utf8

Write-Host "Recuperation des logs (derniers $Lines evenements)..." -ForegroundColor Yellow
Write-Host ""

# Fonction pour récupérer les logs d'un stream
function Get-LogsFromStream {
    param(
        [string]$StreamName
    )
    
    $tempJson = [System.IO.Path]::GetTempFileName()
    
    try {
        aws logs get-log-events `
            --log-group-name $LogGroup `
            --log-stream-name $StreamName `
            --region $Region `
            --limit $Lines `
            --output json 2>&1 | Out-File -FilePath $tempJson -Encoding utf8
        
        if ($LASTEXITCODE -ne 0) {
            return $null
        }
        
        $jsonContent = [System.IO.File]::ReadAllText($tempJson, [System.Text.Encoding]::UTF8)
        
        if ([string]::IsNullOrWhiteSpace($jsonContent)) {
            return $null
        }
        
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
$tempStreams = [System.IO.Path]::GetTempFileName()
aws logs describe-log-streams `
    --log-group-name $LogGroup `
    --region $Region `
    --order-by LastEventTime `
    --descending `
    --max-items 5 `
    --output json 2>&1 | Out-File -FilePath $tempStreams -Encoding utf8

$allEvents = @()

if ($LASTEXITCODE -eq 0) {
    $streamsContent = [System.IO.File]::ReadAllText($tempStreams, [System.Text.Encoding]::UTF8)
    $streams = $streamsContent | ConvertFrom-Json
    
    if ($streams.logStreams) {
        Write-Host "Recuperation des logs depuis $($streams.logStreams.Count) stream(s)..." -ForegroundColor Cyan
        
        foreach ($stream in $streams.logStreams) {
            $streamName = $stream.logStreamName
            Write-Host "  Stream: $streamName" -ForegroundColor Gray
            
            $events = Get-LogsFromStream -StreamName $streamName
            
            if ($events -and $events.Count -gt 0) {
                $allEvents += $events
                Write-Host "    $($events.Count) evenement(s)" -ForegroundColor Green
            }
        }
    }
}

Remove-Item $tempStreams -Force -ErrorAction SilentlyContinue

if ($allEvents.Count -eq 0) {
    Write-Host "Aucun log trouve" -ForegroundColor Red
    exit 1
}

# Trier par timestamp
$allEvents = $allEvents | Sort-Object { $_.timestamp }

Write-Host ""
Write-Host "Analyse de $($allEvents.Count) evenements..." -ForegroundColor Cyan
Write-Host ""

# Chercher le message de détection et analyser ce qui suit
$foundDetection = $false
$afterDetection = @()
$detectionIndex = -1

for ($i = 0; $i -lt $allEvents.Count; $i++) {
    $event = $allEvents[$i]
    $message = $event.message
    
    # Chercher le message de détection
    if ($message -match "Base 'yukpo' inexistante|WARNING: La base 'yukpo' n'a pas été détectée") {
        $foundDetection = $true
        $detectionIndex = $i
        Write-Host "Message de detection trouve a l'index $i" -ForegroundColor Yellow
        
        # Récupérer les 50 événements suivants
        $afterDetection = $allEvents[$i..([Math]::Min($i + 50, $allEvents.Count - 1))]
        break
    }
}

if (-not $foundDetection) {
    Write-Host "Message de detection non trouve dans les logs recents" -ForegroundColor Yellow
    Write-Host "Affichage des derniers 50 evenements..." -ForegroundColor Yellow
    $afterDetection = $allEvents[-50..-1]
}

# Analyser les événements après la détection
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  EVENEMENTS APRES LA DETECTION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$analysis = @{
    ConnectionAttempts = 0
    ConnectionSuccess = 0
    ConnectionErrors = 0
    MigrationAttempts = 0
    MigrationSuccess = 0
    MigrationErrors = 0
    ServerStart = 0
    ServerErrors = 0
    HealthCheck = 0
    OtherMessages = 0
}

$relevantEvents = @()

foreach ($event in $afterDetection) {
    $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($event.timestamp).LocalDateTime
    $timeStr = $timestamp.ToString("yyyy-MM-dd HH:mm:ss")
    $message = $event.message
    
    $relevant = $false
    $category = ""
    
    # Catégoriser les messages
    if ($message -match "(?i)(connect|connexion|database|base de données)") {
        $analysis.ConnectionAttempts++
        $category = "CONNEXION"
        $relevant = $true
        
        if ($message -match "(?i)(success|réussi|ok|✅|accessible)") {
            $analysis.ConnectionSuccess++
        } elseif ($message -match "(?i)(error|erreur|failed|échec|❌)") {
            $analysis.ConnectionErrors++
        }
    }
    
    if ($message -match "(?i)(migration|sqlx migrate)") {
        $analysis.MigrationAttempts++
        $category = "MIGRATION"
        $relevant = $true
        
        if ($message -match "(?i)(success|réussi|ok|✅|completed)") {
            $analysis.MigrationSuccess++
        } elseif ($message -match "(?i)(error|erreur|failed|échec|❌)") {
            $analysis.MigrationErrors++
        }
    }
    
    if ($message -match "(?i)(server|serveur|listening|écoute|started|démarré|🚀)") {
        $analysis.ServerStart++
        $category = "SERVEUR"
        $relevant = $true
    }
    
    if ($message -match "(?i)(health|healthcheck|health check)") {
        $analysis.HealthCheck++
        $category = "HEALTH"
        $relevant = $true
    }
    
    if ($message -match "(?i)(error|erreur|exception|panic|fatal|❌)") {
        $analysis.ServerErrors++
        $category = "ERREUR"
        $relevant = $true
    }
    
    if ($message -match "(?i)(redis|redis|elastica)") {
        $category = "REDIS"
        $relevant = $true
    }
    
    if (-not $relevant -and $message.Length -gt 20) {
        $analysis.OtherMessages++
    }
    
    if ($relevant -or $message.Length -gt 50) {
        $relevantEvents += [PSCustomObject]@{
            Timestamp = $timeStr
            Category = $category
            Message = $message
        }
        
        # Écrire dans le fichier
        $logLine = "[$timeStr] [$category] $message`n"
        [System.IO.File]::AppendAllText($outputFile, $logLine, $utf8NoBom)
    }
}

# Afficher les résultats
Write-Host "STATISTIQUES:" -ForegroundColor Cyan
Write-Host "  Tentatives de connexion: $($analysis.ConnectionAttempts)" -ForegroundColor White
Write-Host "  Connexions reussies: $($analysis.ConnectionSuccess)" -ForegroundColor $(if ($analysis.ConnectionSuccess -gt 0) { "Green" } else { "Red" })
Write-Host "  Erreurs de connexion: $($analysis.ConnectionErrors)" -ForegroundColor $(if ($analysis.ConnectionErrors -eq 0) { "Green" } else { "Red" })
Write-Host "  Tentatives de migration: $($analysis.MigrationAttempts)" -ForegroundColor White
Write-Host "  Migrations reussies: $($analysis.MigrationSuccess)" -ForegroundColor $(if ($analysis.MigrationSuccess -gt 0) { "Green" } else { "Yellow" })
Write-Host "  Erreurs de migration: $($analysis.MigrationErrors)" -ForegroundColor $(if ($analysis.MigrationErrors -eq 0) { "Green" } else { "Red" })
Write-Host "  Demarrage serveur: $($analysis.ServerStart)" -ForegroundColor $(if ($analysis.ServerStart -gt 0) { "Green" } else { "Yellow" })
Write-Host "  Health checks: $($analysis.HealthCheck)" -ForegroundColor White
Write-Host "  Erreurs serveur: $($analysis.ServerErrors)" -ForegroundColor $(if ($analysis.ServerErrors -eq 0) { "Green" } else { "Red" })
Write-Host ""

# Afficher les événements pertinents
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  EVENEMENTS PERTINENTS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

foreach ($event in $relevantEvents) {
    $color = switch ($event.Category) {
        "CONNEXION" { "Cyan" }
        "MIGRATION" { "Yellow" }
        "SERVEUR" { "Green" }
        "ERREUR" { "Red" }
        "HEALTH" { "Magenta" }
        "REDIS" { "Gray" }
        default { "White" }
    }
    
    Write-Host "[$($event.Timestamp)] [$($event.Category)]" -ForegroundColor $color -NoNewline
    Write-Host " $($event.Message)" -ForegroundColor White
}

Write-Host ""
Write-Host "Logs detailles sauvegardes dans: $outputFile" -ForegroundColor Green
Write-Host ""
Write-Host "Pour afficher les logs:" -ForegroundColor Yellow
Write-Host "  Get-Content $outputFile -Encoding UTF8" -ForegroundColor Cyan

