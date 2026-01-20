# Script simplifie pour suivre la progression du build Docker
param(
    [switch]$Follow = $false,
    [int]$Interval = 5
)

Write-Host "Surveillance du build Docker" -ForegroundColor Cyan
Write-Host "Appuyez sur Ctrl+C pour arreter" -ForegroundColor Gray
Write-Host ""

$startTime = Get-Date

function Get-BuildStatus {
    $status = @{
        CargoRunning = $false
        DockerRunning = $false
        CargoCPU = 0
        DockerCPU = 0
        CargoMemory = 0
        DockerMemory = 0
        ImageSize = 0
        ElapsedTime = 0
    }
    
    # Verifier les processus Cargo
    $cargoProcess = Get-Process -Name "cargo" -ErrorAction SilentlyContinue
    if ($cargoProcess) {
        $status.CargoRunning = $true
        $cargoStats = $cargoProcess | Measure-Object -Property CPU, WorkingSet -Sum
        $status.CargoCPU = [math]::Round($cargoStats.Sum.CPU, 2)
        $status.CargoMemory = [math]::Round($cargoStats.Sum.WorkingSet / 1MB, 2)
    }
    
    # Verifier les processus Docker build
    $dockerProcesses = Get-Process -ErrorAction SilentlyContinue | Where-Object { 
        $_.ProcessName -like "*docker*" -or 
        $_.ProcessName -eq "docker-buildx" -or
        $_.ProcessName -like "*com.docker.build*"
    }
    
    if ($dockerProcesses) {
        $status.DockerRunning = $true
        $dockerStats = $dockerProcesses | Measure-Object -Property CPU, WorkingSet -Sum
        $status.DockerCPU = [math]::Round($dockerStats.Sum.CPU, 2)
        $status.DockerMemory = [math]::Round($dockerStats.Sum.WorkingSet / 1MB, 2)
    }
    
    # Verifier la taille de l'image
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
    } catch {
        # Ignorer les erreurs
    }
    
    $status.ElapsedTime = [math]::Round(((Get-Date) - $startTime).TotalMinutes, 1)
    
    return $status
}

function Show-Status {
    param($Status)
    
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "Etat du build" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "Temps ecoule: $($Status.ElapsedTime) minutes" -ForegroundColor Yellow
    Write-Host ""
    
    Write-Host "Cargo (Compilateur Rust):" -ForegroundColor Cyan
    if ($Status.CargoRunning) {
        Write-Host "  [OK] En cours d'execution" -ForegroundColor Green
        Write-Host "  CPU: $($Status.CargoCPU) secondes" -ForegroundColor White
        Write-Host "  Memoire: $($Status.CargoMemory) MB" -ForegroundColor White
    } else {
        Write-Host "  [ATTENTE] Non detecte" -ForegroundColor Yellow
    }
    Write-Host ""
    
    Write-Host "Docker (Build image):" -ForegroundColor Cyan
    if ($Status.DockerRunning) {
        Write-Host "  [OK] En cours d'execution" -ForegroundColor Green
        Write-Host "  CPU: $($Status.DockerCPU) secondes" -ForegroundColor White
        Write-Host "  Memoire: $($Status.DockerMemory) MB" -ForegroundColor White
    } else {
        Write-Host "  [ATTENTE] Non detecte" -ForegroundColor Yellow
    }
    Write-Host ""
    
    if ($Status.ImageSize -gt 0) {
        Write-Host "Image Docker: $([math]::Round($Status.ImageSize, 2)) MB" -ForegroundColor Magenta
        Write-Host "  (Taille finale attendue: ~500-800 MB)" -ForegroundColor Gray
        Write-Host ""
    }
    
    Write-Host "Estimation:" -ForegroundColor Cyan
    if ($Status.ElapsedTime -lt 20) {
        Write-Host "  Phase: Compilation Rust (la plus longue)" -ForegroundColor Yellow
        $progress = [math]::Round(($Status.ElapsedTime / 30) * 100)
        Write-Host "  Progression: ~$progress%" -ForegroundColor White
        $remaining = [math]::Round(30 - $Status.ElapsedTime, 0)
        Write-Host "  Temps restant: ~$remaining minutes" -ForegroundColor White
    } elseif ($Status.ElapsedTime -lt 35) {
        Write-Host "  Phase: Finalisation image Docker" -ForegroundColor Yellow
        $progress = [math]::Round((($Status.ElapsedTime - 20) / 15) * 100 + 67)
        Write-Host "  Progression: ~$progress%" -ForegroundColor White
        $remaining = [math]::Round(35 - $Status.ElapsedTime, 0)
        Write-Host "  Temps restant: ~$remaining minutes" -ForegroundColor White
    } else {
        Write-Host "  [OK] Build devrait etre termine ou presque" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Cyan
}

# Boucle principale
$iteration = 0
try {
    while ($true) {
        $status = Get-BuildStatus
        
        if ($Follow) {
            # Mode suivi continu
            Clear-Host
            Write-Host "Surveillance du build (iteration $iteration) - Ctrl+C pour arreter" -ForegroundColor Cyan
            Show-Status $status
            
            if (-not $status.CargoRunning -and -not $status.DockerRunning) {
                Write-Host ""
                Write-Host "[ATTENTE] Aucun processus de build detecte" -ForegroundColor Yellow
                Write-Host "Le build peut etre termine ou pas encore demarre" -ForegroundColor Gray
            }
        } else {
            # Mode unique
            Show-Status $status
            break
        }
        
        $iteration++
        Start-Sleep -Seconds $Interval
    }
} catch {
    Write-Host ""
    Write-Host "[ERREUR] $_" -ForegroundColor Red
} finally {
    Write-Host ""
    Write-Host "Pour verifier si le build est termine:" -ForegroundColor Cyan
    Write-Host "  docker images | Select-String yukpomnang-backend" -ForegroundColor Gray
}




