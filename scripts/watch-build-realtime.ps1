# Script pour observer en temps reel l'evolution du build Docker
param(
    [int]$Interval = 3  # Intervalle de mise a jour en secondes
)

$ErrorActionPreference = "SilentlyContinue"

Write-Host "Observation en temps reel du build Docker" -ForegroundColor Cyan
Write-Host "Mise a jour toutes les $Interval secondes" -ForegroundColor Gray
Write-Host "Appuyez sur Ctrl+C pour arreter" -ForegroundColor Yellow
Write-Host ""

$startTime = Get-Date
$iteration = 0

while ($true) {
    Clear-Host
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "BUILD DOCKER - Suivi en temps reel" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "Iteration: $iteration | Intervalle: ${Interval}s" -ForegroundColor Gray
    Write-Host ""
    
    # Temps ecoule
    $elapsed = (Get-Date) - $startTime
    $elapsedMinutes = [math]::Round($elapsed.TotalMinutes, 1)
    Write-Host "[Temps] $elapsedMinutes minutes ecoulees" -ForegroundColor Yellow
    Write-Host ""
    
    # Verifier Cargo
    $cargoProcess = Get-Process -Name "cargo" -ErrorAction SilentlyContinue
    if ($cargoProcess) {
        $cargoCpu = ($cargoProcess | Measure-Object -Property CPU -Sum).Sum
        $cargoMem = ($cargoProcess | Measure-Object -Property WorkingSet -Sum).Sum / 1MB
        Write-Host "[CARGO] ACTIF" -ForegroundColor Green
        Write-Host "  CPU cumule: $([math]::Round($cargoCpu, 2))s" -ForegroundColor White
        Write-Host "  Memoire: $([math]::Round($cargoMem, 2)) MB" -ForegroundColor White
    } else {
        Write-Host "[CARGO] INACTIF" -ForegroundColor Red
    }
    Write-Host ""
    
    # Verifier Docker
    $dockerProcesses = Get-Process -ErrorAction SilentlyContinue | Where-Object { 
        $_.ProcessName -like "*docker*" -or 
        $_.ProcessName -eq "docker-buildx"
    }
    if ($dockerProcesses) {
        $dockerCpu = ($dockerProcesses | Measure-Object -Property CPU -Sum).Sum
        $dockerMem = ($dockerProcesses | Measure-Object -Property WorkingSet -Sum).Sum / 1MB
        Write-Host "[DOCKER] ACTIF" -ForegroundColor Green
        Write-Host "  CPU cumule: $([math]::Round($dockerCpu, 2))s" -ForegroundColor White
        Write-Host "  Memoire: $([math]::Round($dockerMem, 2)) MB" -ForegroundColor White
        Write-Host "  Processus actifs: $($dockerProcesses.Count)" -ForegroundColor White
    } else {
        Write-Host "[DOCKER] INACTIF" -ForegroundColor Red
    }
    Write-Host ""
    
    # Verifier l'image
    try {
        $imageSize = docker images --filter "reference=yukpomnang-backend:latest" --format "{{.Size}}" 2>&1
        if ($imageSize -and $imageSize -notmatch "error" -and $imageSize -notmatch "Cannot") {
            Write-Host "[IMAGE] Taille actuelle: $imageSize" -ForegroundColor Magenta
        } else {
            Write-Host "[IMAGE] Pas encore creee" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[IMAGE] Erreur de verification" -ForegroundColor Yellow
    }
    Write-Host ""
    
    # Estimation
    Write-Host "[ESTIMATION]" -ForegroundColor Cyan
    if ($elapsedMinutes -lt 20) {
        $progress = [math]::Round(($elapsedMinutes / 30) * 100)
        $remaining = [math]::Round(30 - $elapsedMinutes, 0)
        Write-Host "  Phase: Compilation Rust" -ForegroundColor Yellow
        Write-Host "  Progression: ~$progress%" -ForegroundColor White
        Write-Host "  Temps restant: ~$remaining minutes" -ForegroundColor White
    } elseif ($elapsedMinutes -lt 35) {
        $progress = [math]::Round((($elapsedMinutes - 20) / 15) * 100 + 67)
        $remaining = [math]::Round(35 - $elapsedMinutes, 0)
        Write-Host "  Phase: Finalisation Docker" -ForegroundColor Yellow
        Write-Host "  Progression: ~$progress%" -ForegroundColor White
        Write-Host "  Temps restant: ~$remaining minutes" -ForegroundColor White
    } else {
        Write-Host "  Build devrait etre termine!" -ForegroundColor Green
    }
    Write-Host ""
    
    # Indicateur visuel de progression
    $barLength = 50
    if ($elapsedMinutes -lt 30) {
        $filled = [math]::Floor(($elapsedMinutes / 30) * $barLength)
    } else {
        $filled = $barLength
    }
    $empty = $barLength - $filled
    $progressBar = "[" + ("=" * $filled) + (" " * $empty) + "]"
    Write-Host $progressBar -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "Prochaine mise a jour dans $Interval secondes..." -ForegroundColor Gray
    Write-Host "Ctrl+C pour arreter" -ForegroundColor Yellow
    
    $iteration++
    Start-Sleep -Seconds $Interval
}




