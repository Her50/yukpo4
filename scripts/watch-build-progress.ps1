# Script pour visualiser progressivement l'évolution du build Docker
param(
    [switch]$Follow = $true,  # Mode suivi continu
    [int]$Interval = 2          # Intervalle de mise à jour en secondes (plus rapide pour meilleure visualisation)
)

$ErrorActionPreference = "SilentlyContinue"

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   📊 VISUALISATION PROGRESSIVE DU BUILD DOCKER" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   Appuyez sur Ctrl+C pour arrêter" -ForegroundColor Gray
Write-Host ""

$startTime = Get-Date
$lastImageSize = 0
$buildStartDetected = $false

function Get-BuildProgress {
    $progress = @{
        CargoRunning     = $false
        DockerRunning    = $false
        CargoCPU         = 0
        DockerCPU        = 0
        CargoMemory      = 0
        DockerMemory     = 0
        ImageSize        = 0
        ImageSizeMB      = 0
        ElapsedTime      = 0
        ElapsedMinutes   = 0
        BuildStage       = "Démarrage"
        ProgressPercent  = 0
        RedisRunning     = $false
    }
    
    # Vérifier les processus Cargo
    $cargoProcs = Get-Process | Where-Object { $_.ProcessName -eq "cargo" } -ErrorAction SilentlyContinue
    if ($cargoProcs) {
        $progress.CargoRunning = $true
        $cargoStats = $cargoProcs | Measure-Object -Property CPU, WorkingSet -Sum
        $progress.CargoCPU = [math]::Round($cargoStats.Sum.CPU, 2)
        $progress.CargoMemory = [math]::Round($cargoStats.Sum.WorkingSet / 1MB, 2)
    }
    
    # Vérifier les processus Docker
    $dockerProcs = Get-Process | Where-Object { 
        $_.ProcessName -like "*docker*" -or 
        $_.ProcessName -eq "docker-buildx" -or
        $_.ProcessName -like "*com.docker.build*"
    } -ErrorAction SilentlyContinue
    
    if ($dockerProcs) {
        $progress.DockerRunning = $true
        $dockerStats = $dockerProcs | Measure-Object -Property CPU, WorkingSet -Sum
        $progress.DockerCPU = [math]::Round($dockerStats.Sum.CPU, 2)
        $progress.DockerMemory = [math]::Round($dockerStats.Sum.WorkingSet / 1MB, 2)
    }
    
    # Vérifier la taille de l'image Docker
    try {
        $imageSizeStr = docker images --filter "reference=yukpomnang-backend:latest" --format "{{.Size}}" 2>&1
        if ($imageSizeStr -and $imageSizeStr -notmatch "error" -and $imageSizeStr -notmatch "Cannot connect") {
            if ($imageSizeStr -match "(\d+(?:\.\d+)?)\s*(KB|MB|GB|TB)") {
                $size = [double]$matches[1]
                $unit = $matches[2]
                switch ($unit) {
                    "KB" { $progress.ImageSizeMB = $size / 1024 }
                    "MB" { $progress.ImageSizeMB = $size }
                    "GB" { $progress.ImageSizeMB = $size * 1024 }
                    "TB" { $progress.ImageSizeMB = $size * 1024 * 1024 }
                }
                $progress.ImageSize = $size
            }
        }
    } catch {
        # Ignorer
    }
    
    # Vérifier Redis
    try {
        $redisContainers = docker ps --filter "name=redis" --format "{{.Names}}" 2>&1
        if ($redisContainers -and $redisContainers -notmatch "error") {
            $progress.RedisRunning = $true
        }
    } catch {
        # Ignorer
    }
    
    # Temps écoulé
    $elapsed = (Get-Date) - $startTime
    $progress.ElapsedTime = $elapsed.TotalSeconds
    $progress.ElapsedMinutes = [math]::Round($elapsed.TotalMinutes, 1)
    
    # Déterminer l'étape du build
    if ($progress.ElapsedMinutes -lt 2) {
        $progress.BuildStage = "[1/4] Preparation Docker"
        $progress.ProgressPercent = 5
    } elseif ($progress.ElapsedMinutes -lt 5) {
        $progress.BuildStage = "[2/4] Telechargement dependances"
        $progress.ProgressPercent = 10 + ([math]::Min(($progress.ElapsedMinutes - 2) / 3 * 20, 20))
    } elseif ($progress.CargoRunning) {
        $progress.BuildStage = "[3/4] Compilation Rust (Cargo)"
        # Estimation: compilation Rust prend 15-25 minutes
        $compileProgress = [math]::Min(($progress.ElapsedMinutes - 5) / 25 * 65, 65)
        $progress.ProgressPercent = 30 + $compileProgress
    } elseif ($progress.DockerRunning) {
        $progress.BuildStage = "[4/4] Finalisation image Docker"
        $progress.ProgressPercent = 95
    } else {
        $progress.BuildStage = "[OK] Build termine ou en attente"
        $progress.ProgressPercent = 100
    }
    
    return $progress
}

function Show-ProgressBar {
    param($Percent, $Width = 50)
    
    $filled = [math]::Floor($Percent / 100 * $Width)
    $empty = $Width - $filled
    
    $bar = "█" * $filled + "░" * $empty
    return $bar
}

function Show-BuildStatus {
    param($Progress)
    
    # Effacer la console (simulé avec plusieurs lignes vides)
    Clear-Host
    
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "   📊 BUILD DOCKER - ÉVOLUTION PROGRESSIVE" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    
    # Barre de progression principale
    Write-Host "   Progression: " -NoNewline -ForegroundColor Yellow
    $bar = Show-ProgressBar -Percent $Progress.ProgressPercent
    Write-Host "$bar" -NoNewline -ForegroundColor Cyan
    Write-Host " $([math]::Round($Progress.ProgressPercent, 1))%" -ForegroundColor White
    Write-Host ""
    
    # Étape actuelle
    Write-Host "   🎯 Étape: " -NoNewline -ForegroundColor Yellow
    Write-Host "$($Progress.BuildStage)" -ForegroundColor White
    Write-Host ""
    
    # Temps
    Write-Host "   ⏱️  Temps écoulé: " -NoNewline -ForegroundColor Yellow
    Write-Host "$($Progress.ElapsedMinutes) minutes" -ForegroundColor White
    
    # Estimation temps restant
    if ($Progress.ProgressPercent -lt 100 -and $Progress.ProgressPercent -gt 0) {
        $estimatedTotal = 30
        $remaining = [math]::Max(0, $estimatedTotal - $Progress.ElapsedMinutes)
        Write-Host "   ⏳ Temps restant estimé: " -NoNewline -ForegroundColor Yellow
        Write-Host "~$([math]::Round($remaining, 0)) minutes" -ForegroundColor White
    }
    Write-Host ""
    
    # Processus actifs
    Write-Host "   📈 Activité:" -ForegroundColor Yellow
    if ($Progress.CargoRunning) {
        Write-Host "      🦀 Cargo: " -NoNewline -ForegroundColor Green
        Write-Host "CPU: $($Progress.CargoCPU)s | RAM: $($Progress.CargoMemory) MB" -ForegroundColor White
    } else {
        Write-Host "      🦀 Cargo: " -NoNewline -ForegroundColor Gray
        Write-Host "Inactif" -ForegroundColor Gray
    }
    
    if ($Progress.DockerRunning) {
        Write-Host "      🐳 Docker: " -NoNewline -ForegroundColor Blue
        Write-Host "CPU: $($Progress.DockerCPU)s | RAM: $($Progress.DockerMemory) MB" -ForegroundColor White
    } else {
        Write-Host "      🐳 Docker: " -NoNewline -ForegroundColor Gray
        Write-Host "Inactif" -ForegroundColor Gray
    }
    Write-Host ""
    
    # Taille de l'image
    if ($Progress.ImageSizeMB -gt 0) {
        Write-Host "   📦 Image Docker: " -NoNewline -ForegroundColor Yellow
        Write-Host "$([math]::Round($Progress.ImageSizeMB, 2)) MB" -ForegroundColor Magenta
        if ($Progress.ImageSizeMB -gt $lastImageSize) {
            $diff = $Progress.ImageSizeMB - $lastImageSize
            Write-Host "      ↗️  +$([math]::Round($diff, 2)) MB depuis la dernière vérification" -ForegroundColor Green
        }
        $script:lastImageSize = $Progress.ImageSizeMB
    }
    Write-Host ""
    
    # Redis
    Write-Host "   🔴 Redis: " -NoNewline -ForegroundColor Yellow
    if ($Progress.RedisRunning) {
        Write-Host "✅ En cours d'exécution" -ForegroundColor Green
    } else {
        Write-Host "⏸️  Non détecté (normal si build sans Redis)" -ForegroundColor Gray
    }
    Write-Host ""
    
    # Timeline visuelle
    Write-Host "   📅 Timeline estimée:" -ForegroundColor Yellow
    $phases = @(
        @{ Name = "Préparation"; Time = "0-2 min"; Current = $Progress.ElapsedMinutes -lt 2 },
        @{ Name = "Dépendances"; Time = "2-5 min"; Current = $Progress.ElapsedMinutes -ge 2 -and $Progress.ElapsedMinutes -lt 5 },
        @{ Name = "Compilation Rust"; Time = "5-25 min"; Current = $Progress.ElapsedMinutes -ge 5 -and $Progress.CargoRunning },
        @{ Name = "Finalisation"; Time = "25-30 min"; Current = $Progress.ElapsedMinutes -ge 25 -and -not $Progress.CargoRunning }
    )
    
    foreach ($phase in $phases) {
        $icon = if ($phase.Current) { "▶️ " } else { "  " }
        $color = if ($phase.Current) { "Cyan" } else { "Gray" }
        Write-Host "      $icon $($phase.Name) ($($phase.Time))" -ForegroundColor $color
    }
    
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   💡 Astuce: Surveillez l'activité CPU dans le Gestionnaire de tâches" -ForegroundColor Gray
    Write-Host "   📝 Dernière mise à jour: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Gray
    Write-Host ""
}

# Boucle principale
try {
    $iteration = 0
    while ($true) {
        $progress = Get-BuildProgress
        Show-BuildStatus -Progress $progress
        
        if ($Follow) {
            Start-Sleep -Seconds $Interval
            $iteration++
        } else {
            break
        }
    }
} catch {
    Write-Host ""
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
} finally {
    Write-Host ""
    Write-Host "[INFO] Pour verifier l'image finale:" -ForegroundColor Cyan
    Write-Host "   docker images | Select-String yukpomnang-backend" -ForegroundColor Gray
    Write-Host ""
    Write-Host "[INFO] Pour voir les logs du build:" -ForegroundColor Cyan
    Write-Host "   docker build --progress=plain -t yukpomnang-backend:latest -f backend/Dockerfile.cloud backend" -ForegroundColor Gray
}

