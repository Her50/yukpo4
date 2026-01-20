# Script pour suivre la progression du build Docker en temps réel
param(
    [switch]$Follow = $false,  # Mode suivi continu
    [int]$Interval = 5          # Intervalle de mise à jour en secondes
)

Write-Host "🔍 Surveillance du build Docker en temps réel" -ForegroundColor Cyan
Write-Host "   Appuyez sur Ctrl+C pour arrêter" -ForegroundColor Gray
Write-Host ""

$startTime = Get-Date
$lastCargoCpu = 0
$lastDockerCpu = 0

function Get-BuildStatus {
    $status = @{
        CargoRunning  = $false
        DockerRunning = $false
        CargoCPU      = 0
        DockerCPU     = 0
        CargoMemory   = 0
        DockerMemory  = 0
        ImageSize     = 0
        ElapsedTime   = 0
    }
    
    # Vérifier les processus Cargo
    $cargoProcess = Get-Process | Where-Object { $_.ProcessName -eq "cargo" } | Measure-Object
    if ($cargoProcess.Count -gt 0) {
        $status.CargoRunning = $true
        $cargoStats = Get-Process | Where-Object { $_.ProcessName -eq "cargo" } | 
        Measure-Object -Property CPU, WorkingSet -Sum
        $status.CargoCPU = [math]::Round($cargoStats.Sum.CPU, 2)
        $status.CargoMemory = [math]::Round($cargoStats.Sum.WorkingSet / 1MB, 2)
    }
    
    # Vérifier les processus Docker build
    $dockerBuildProcess = Get-Process | Where-Object { 
        $_.ProcessName -like "*docker*" -or 
        $_.ProcessName -eq "docker-buildx" -or
        $_.ProcessName -like "*com.docker.build*"
    } | Measure-Object
    
    if ($dockerBuildProcess.Count -gt 0) {
        $status.DockerRunning = $true
        $dockerStats = Get-Process | Where-Object { 
            $_.ProcessName -like "*docker*" -or 
            $_.ProcessName -eq "docker-buildx" -or
            $_.ProcessName -like "*com.docker.build*"
        } | Measure-Object -Property CPU, WorkingSet -Sum
        $status.DockerCPU = [math]::Round($dockerStats.Sum.CPU, 2)
        $status.DockerMemory = [math]::Round($dockerStats.Sum.WorkingSet / 1MB, 2)
    }
    
    # Vérifier la taille de l'image en cours de construction
    try {
        $image = docker images --filter "reference=yukpomnang-backend:latest" --format "{{.Size}}" 2>&1
        if ($image -and $image -notmatch "error" -and $image -notmatch "Cannot connect") {
            if ($image -match "(\d+(?:\.\d+)?)\s*(KB|MB|GB|TB)") {
                $size = [double]$matches[1]
                $unit = $matches[2]
                switch ($unit) {
                    "KB" { $status.ImageSize = $size / 1024 }
                    "MB" { $status.ImageSize = $size }
                    "GB" { $status.ImageSize = $size * 1024 }
                    default { $status.ImageSize = $size }
                }
            }
        }
    }
    catch {
        # Ignorer les erreurs
    }
    
    $status.ElapsedTime = [math]::Round(((Get-Date) - $startTime).TotalMinutes, 1)
    
    return $status
}

function Show-Status {
    param($Status)
    
    # Effacer la ligne précédente
    Write-Host "`r" -NoNewline
    
    # État général
    $buildActive = $Status.CargoRunning -or $Status.DockerRunning
    if ($buildActive) {
        $color = "Green"
        $icon = "✅"
    }
    else {
        $color = "Yellow"
        $icon = "⚠️"
    }
    
    Write-Host "$icon Build en cours - " -ForegroundColor $color -NoNewline
    Write-Host "Temps: $($Status.ElapsedTime) min" -ForegroundColor Cyan -NoNewline
    
    if ($Status.CargoRunning) {
        Write-Host " | Cargo: CPU $($Status.CargoCPU)s, RAM $($Status.CargoMemory)MB" -ForegroundColor Green -NoNewline
    }
    
    if ($Status.DockerRunning) {
        Write-Host " | Docker: CPU $($Status.DockerCPU)s, RAM $($Status.DockerMemory)MB" -ForegroundColor Blue -NoNewline
    }
    
    if ($Status.ImageSize -gt 0) {
        Write-Host " | Image: $([math]::Round($Status.ImageSize, 2))MB" -ForegroundColor Magenta -NoNewline
    }
    
    # Estimation du temps restant (basé sur l'expérience : 20-30 min pour un build complet)
    if ($Status.ElapsedTime -lt 30) {
        $estimatedTotal = 30
        $remaining = [math]::Max(0, $estimatedTotal - $Status.ElapsedTime)
        Write-Host " | ⏱️  ~$([math]::Round($remaining, 0)) min restantes" -ForegroundColor Yellow -NoNewline
    }
    
    # Nouvelle ligne pour la prochaine mise à jour
    Write-Host "   " -NoNewline
}

function Show-DetailedStatus {
    param($Status)
    
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "📊 État détaillé du build" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    
    # Temps écoulé
    $elapsed = New-TimeSpan -Start $startTime -End (Get-Date)
    Write-Host "⏱️  Temps écoulé: " -NoNewline -ForegroundColor Yellow
    Write-Host "$([math]::Round($elapsed.TotalMinutes, 1)) minutes" -ForegroundColor White
    
    # État Cargo
    Write-Host ""
    Write-Host "🦀 Cargo (Compilateur Rust):" -ForegroundColor Cyan
    if ($Status.CargoRunning) {
        Write-Host "   ✅ En cours d'exécution" -ForegroundColor Green
        Write-Host "   📊 CPU cumulé: $($Status.CargoCPU) secondes" -ForegroundColor White
        Write-Host "   💾 Mémoire: $($Status.CargoMemory) MB" -ForegroundColor White
    }
    else {
        Write-Host "   ⚠️  Non détecté (peut être terminé ou en attente)" -ForegroundColor Yellow
    }
    
    # État Docker
    Write-Host ""
    Write-Host "Docker (Build de l'image):" -ForegroundColor Cyan
    if ($Status.DockerRunning) {
        Write-Host "   ✅ En cours d'exécution" -ForegroundColor Green
        Write-Host "   📊 CPU cumulé: $($Status.DockerCPU) secondes" -ForegroundColor White
        Write-Host "   💾 Mémoire: $($Status.DockerMemory) MB" -ForegroundColor White
    }
    else {
        Write-Host "   ⚠️  Non détecté" -ForegroundColor Yellow
    }
    
    # Taille de l'image
    if ($Status.ImageSize -gt 0) {
        Write-Host ""
        Write-Host "📦 Image Docker:" -ForegroundColor Cyan
        Write-Host "   Taille actuelle: $([math]::Round($Status.ImageSize, 2)) MB" -ForegroundColor White
        Write-Host "   (Taille finale attendue: ~500-800 MB)" -ForegroundColor Gray
    }
    
    # Estimation
    Write-Host ""
    Write-Host "⏱️  Estimation:" -ForegroundColor Cyan
    if ($Status.ElapsedTime -lt 20) {
        Write-Host "   ⚡ Phase: Compilation Rust (la plus longue)" -ForegroundColor Yellow
        Write-Host "   📈 Progression: ~$([math]::Round(($Status.ElapsedTime / 30) * 100))%" -ForegroundColor White
        Write-Host "   ⏳ Temps restant estimé: ~$([math]::Round(30 - $Status.ElapsedTime, 0)) minutes" -ForegroundColor White
    }
    elseif ($Status.ElapsedTime -lt 35) {
        Write-Host "   ⚡ Phase: Finalisation de l'image Docker" -ForegroundColor Yellow
        Write-Host "   📈 Progression: ~$([math]::Round((($Status.ElapsedTime - 20) / 15) * 100 + 67))%" -ForegroundColor White
        Write-Host "   ⏳ Temps restant estimé: ~$([math]::Round(35 - $Status.ElapsedTime, 0)) minutes" -ForegroundColor White
    }
    else {
        Write-Host "   ✅ Build devrait être terminé ou presque" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
}

# Boucle principale
$iteration = 0
try {
    while ($true) {
        $status = Get-BuildStatus
        
        if ($Follow) {
            # Mode suivi continu (ligne mise à jour)
            if ($iteration % 10 -eq 0) {
                # Afficher le statut détaillé toutes les 10 itérations
                Show-DetailedStatus $status
            }
            else {
                # Afficher le statut en une ligne
                Show-Status $status
            }
        }
        else {
            # Mode unique (affichage statique)
            Show-DetailedStatus $status
            
            if (-not $status.CargoRunning -and -not $status.DockerRunning) {
                Write-Host ""
                Write-Host "⚠️  Aucun processus de build détecté" -ForegroundColor Yellow
                Write-Host "   Le build peut être terminé ou pas encore démarré" -ForegroundColor Gray
                break
            }
            
            break
        }
        
        $iteration++
        Start-Sleep -Seconds $Interval
    }
}
catch {
    Write-Host ""
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
}
finally {
    Write-Host ""
    Write-Host ""
    Write-Host "💡 Pour vérifier si le build est terminé:" -ForegroundColor Cyan
    Write-Host "   docker images | Select-String yukpomnang-backend" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Astuce: Pour voir les logs du build Docker:" -ForegroundColor Cyan
    Write-Host "   docker build --progress=plain -t yukpomnang-backend:latest -f backend/Dockerfile.cloud backend" -ForegroundColor Gray
}

