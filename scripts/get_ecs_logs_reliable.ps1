# Script fiable pour récupérer les logs ECS depuis CloudWatch Logs
# Gère correctement l'encodage et affiche les logs de manière lisible

param(
    [string]$Cluster = "yukpo-cluster",
    [string]$Service = "yukpo-backend-service",
    [string]$Region = "eu-west-1",
    [string]$LogGroup = "/ecs/yukpo-backend",
    [int]$Lines = 50,
    [switch]$ErrorsOnly,
    [switch]$Follow
)

$ErrorActionPreference = "Continue"

# Configurer l'encodage UTF-8 pour la sortie
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "Recuperation des logs ECS" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host "Cluster: $Cluster" -ForegroundColor Gray
Write-Host "Service: $Service" -ForegroundColor Gray
Write-Host "Log Group: $LogGroup" -ForegroundColor Gray
Write-Host ""

# Fonction pour récupérer les logs d'un stream
function Get-LogStreamEvents {
    param(
        [string]$StreamName,
        [int]$Limit = 50
    )
    
    try {
        # Utiliser un fichier temporaire pour éviter les problèmes d'encodage
        $tempFile = [System.IO.Path]::GetTempFileName()
        
        $result = aws logs get-log-events `
            --log-group-name $LogGroup `
            --log-stream-name $StreamName `
            --region $Region `
            --limit $Limit `
            --output json 2>&1 | Out-File -FilePath $tempFile -Encoding utf8
        
        if ($LASTEXITCODE -ne 0) {
            $errorContent = Get-Content $tempFile -Raw -ErrorAction SilentlyContinue
            Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
            if ($errorContent -notmatch "ResourceNotFoundException") {
                Write-Host "   Erreur lors de la recuperation" -ForegroundColor Red
            }
            return $null
        }
        
        # Lire le fichier avec UTF-8
        $content = Get-Content $tempFile -Raw -Encoding utf8
        Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
        
        if ([string]::IsNullOrWhiteSpace($content)) {
            return $null
        }
        
        # Nettoyer le contenu pour éviter les problèmes de parsing
        # Supprimer les caractères de contrôle et les BOM
        $content = $content.TrimStart([char]0xFEFF)
        
        try {
            # Parser le JSON
            $events = $content | ConvertFrom-Json
            
            if ($events -and $events.events) {
                return $events.events
            }
            return $null
        } catch {
            # Si le parsing échoue, essayer de récupérer au moins les messages
            Write-Host "   Erreur de parsing JSON, tentative de recuperation alternative..." -ForegroundColor Yellow
            return $null
        }
    } catch {
        Write-Host "   Exception: $_" -ForegroundColor Red
        return $null
    }
}

# Fonction pour nettoyer les caractères problématiques
function Clean-Message {
    param([string]$Message)
    
    if ([string]::IsNullOrEmpty($Message)) {
        return $Message
    }
    
    # Convertir en bytes UTF-8 puis revenir en string pour nettoyer les caractères problématiques
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Message)
        $cleanMessage = [System.Text.Encoding]::UTF8.GetString($bytes)
        return $cleanMessage
    } catch {
        # Si ça échoue, retourner le message original
        return $Message
    }
}

# Fonction pour formater et afficher les logs
function Show-LogEvents {
    param(
        [array]$Events,
        [string]$StreamName
    )
    
    if (-not $Events -or $Events.Count -eq 0) {
        return
    }
    
    Write-Host "Stream: $StreamName" -ForegroundColor Yellow
    Write-Host ("=" * 80) -ForegroundColor Gray
    Write-Host ""
    
    # Configurer la sortie en UTF-8
    $OutputEncoding = [System.Text.Encoding]::UTF8
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    
    foreach ($event in $Events) {
        # Convertir le timestamp
        $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($event.timestamp).LocalDateTime
        $timeStr = $timestamp.ToString("yyyy-MM-dd HH:mm:ss")
        
        # Récupérer le message et nettoyer l'encodage
        $message = $event.message
        $message = Clean-Message -Message $message
        
        # Filtrer les erreurs si demandé
        if ($ErrorsOnly) {
            if ($message -notmatch "(?i)(error|exception|failed|panic|fatal|critical)") {
                continue
            }
        }
        
        # Afficher avec couleur selon le type
        $color = "White"
        if ($message -match "(?i)(error|exception|failed|panic|fatal)") {
            $color = "Red"
        } elseif ($message -match "(?i)(warn|warning)") {
            $color = "Yellow"
        } elseif ($message -match "(?i)(info|starting|listening|ready)") {
            $color = "Green"
        }
        
        try {
            Write-Host "[$timeStr] " -NoNewline -ForegroundColor Gray
            Write-Host $message -ForegroundColor $color
        } catch {
            # Si l'affichage échoue, utiliser une méthode alternative
            $cleanMsg = [System.Text.Encoding]::UTF8.GetString([System.Text.Encoding]::Default.GetBytes($message))
            Write-Host "[$timeStr] $cleanMsg" -ForegroundColor $color
        }
    }
    
    Write-Host ""
}

# 1. Récupérer les tâches en cours
Write-Host "1. Recherche des taches en cours..." -ForegroundColor Cyan

$tasksJson = aws ecs list-tasks `
    --cluster $Cluster `
    --service-name $Service `
    --desired-status RUNNING `
    --region $Region `
    --output json 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors de la recuperation des taches: $tasksJson" -ForegroundColor Red
    exit 1
}

$tasks = $tasksJson | ConvertFrom-Json

if ($tasks.taskArns.Count -eq 0) {
    Write-Host "Aucune tache en cours d'execution" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Recherche dans les derniers streams de logs..." -ForegroundColor Cyan
} else {
    Write-Host "   $($tasks.taskArns.Count) tache(s) trouvee(s)" -ForegroundColor Green
    Write-Host ""
    
    # Pour chaque tâche, récupérer les logs
    foreach ($taskArn in $tasks.taskArns) {
        $taskId = $taskArn.Split('/')[-1]
        Write-Host "2. Recuperation des logs pour la tache: $taskId" -ForegroundColor Cyan
        
        # Essayer différents formats de stream name
        $streamFormats = @(
            "ecs/backend/$taskId",
            "backend/backend/$taskId",
            "backend/$taskId"
        )
        
        $found = $false
        foreach ($streamName in $streamFormats) {
            $events = Get-LogStreamEvents -StreamName $streamName -Limit $Lines
            
            if ($events -and $events.Count -gt 0) {
                Show-LogEvents -Events $events -StreamName $streamName
                $found = $true
                break
            }
        }
        
        if (-not $found) {
            Write-Host "   Aucun log trouve pour cette tache (formats tries: $($streamFormats -join ', '))" -ForegroundColor Yellow
            Write-Host ""
        }
    }
}

# 3. Récupérer les derniers streams de logs (au cas où les streams des tâches n'existent pas encore)
Write-Host "3. Recherche dans les derniers streams de logs..." -ForegroundColor Cyan
Write-Host ""

$streamsJson = aws logs describe-log-streams `
    --log-group-name $LogGroup `
    --region $Region `
    --order-by LastEventTime `
    --descending `
    --max-items 5 `
    --output json 2>&1

if ($LASTEXITCODE -eq 0) {
    $streams = $streamsJson | ConvertFrom-Json
    
    if ($streams.logStreams) {
        Write-Host "   $($streams.logStreams.Count) stream(s) trouve(s)" -ForegroundColor Green
        Write-Host ""
        
        foreach ($stream in $streams.logStreams) {
            $streamName = $stream.logStreamName
            $lastEvent = [DateTimeOffset]::FromUnixTimeMilliseconds($stream.lastEventTime).LocalDateTime
            $timeSince = (Get-Date) - $lastEvent
            
            Write-Host "   Stream: $streamName" -ForegroundColor Gray
            Write-Host "   Dernier evenement: $($lastEvent.ToString('yyyy-MM-dd HH:mm:ss')) (il y a $([math]::Round($timeSince.TotalMinutes, 1)) minutes)" -ForegroundColor Gray
            
            # Récupérer les logs de ce stream
            $events = Get-LogStreamEvents -StreamName $streamName -Limit $Lines
            
            if ($events) {
                Show-LogEvents -Events $events -StreamName $streamName
            }
        }
    } else {
        Write-Host "   Aucun stream trouve dans le log group" -ForegroundColor Yellow
    }
} else {
    Write-Host "   Erreur lors de la recuperation des streams: $streamsJson" -ForegroundColor Red
}

# 4. Mode suivi si activé
if ($Follow) {
    Write-Host ""
    Write-Host "Mode suivi active - Appuyez sur Ctrl+C pour arreter" -ForegroundColor Yellow
    Write-Host ""
    
    $lastTimestamp = 0
    
    while ($true) {
        Start-Sleep -Seconds 5
        
        # Récupérer les nouveaux logs
        $streamsJson = aws logs describe-log-streams `
            --log-group-name $LogGroup `
            --region $Region `
            --order-by LastEventTime `
            --descending `
            --max-items 1 `
            --output json 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            $streams = $streamsJson | ConvertFrom-Json
            
            if ($streams.logStreams -and $streams.logStreams.Count -gt 0) {
                $latestStream = $streams.logStreams[0]
                $events = Get-LogStreamEvents -StreamName $latestStream.logStreamName -Limit 10
                
                if ($events) {
                    foreach ($event in $events) {
                        if ($event.timestamp -gt $lastTimestamp) {
                            $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($event.timestamp).LocalDateTime
                            $timeStr = $timestamp.ToString("yyyy-MM-dd HH:mm:ss")
                            
                            $color = "White"
                            if ($event.message -match "(?i)(error|exception|failed|panic|fatal)") {
                                $color = "Red"
                            } elseif ($event.message -match "(?i)(warn|warning)") {
                                $color = "Yellow"
                            } elseif ($event.message -match "(?i)(info|starting|listening|ready)") {
                                $color = "Green"
                            }
                            
                            Write-Host "[$timeStr] " -NoNewline -ForegroundColor Gray
                            Write-Host $event.message -ForegroundColor $color
                            
                            $lastTimestamp = $event.timestamp
                        }
                    }
                }
            }
        }
    }
}

Write-Host ""
Write-Host "Fin de la recuperation des logs" -ForegroundColor Cyan

