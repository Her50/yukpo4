# Script de surveillance en temps reel du build Docker
# Usage: powershell -ExecutionPolicy Bypass -File scripts/monitor-build-realtime.ps1

$ErrorActionPreference = "SilentlyContinue"
$startTime = Get-Date
$iteration = 0

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SURVEILLANCE BUILD DOCKER - TEMPS REEL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Appuyez sur Ctrl+C pour arreter" -ForegroundColor Gray
Write-Host ""

while ($true) {
    $elapsed = (Get-Date) - $startTime
    $minutes = [math]::Floor($elapsed.TotalMinutes)
    $seconds = [math]::Floor($elapsed.Seconds)
    
    Clear-Host
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  SURVEILLANCE BUILD DOCKER - TEMPS REEL" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Appuyez sur Ctrl+C pour arreter" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "Temps total: $minutes min $seconds sec" -ForegroundColor Yellow
    Write-Host ""
    
    Write-Host "--- ACTIVITE PROCESSUS ---" -ForegroundColor Cyan
    $cargoProcs = Get-Process -Name "cargo" -ErrorAction SilentlyContinue
    $dockerProcs = Get-Process | Where-Object { $_.ProcessName -like "*docker*" } -ErrorAction SilentlyContinue
    
    if ($cargoProcs) {
        $cpu = ($cargoProcs | Measure-Object -Property CPU -Sum).Sum
        $mem = ($cargoProcs | Measure-Object -Property WorkingSet -Sum).Sum / 1MB
        Write-Host "  [OK] Cargo Rust:" -ForegroundColor Green
        Write-Host "      - Processus: $($cargoProcs.Count)" -ForegroundColor White
        Write-Host "      - CPU: $([math]::Round($cpu, 1))s" -ForegroundColor White
        Write-Host "      - RAM: $([math]::Round($mem, 0)) MB" -ForegroundColor White
    } else {
        Write-Host "  [ ] Cargo Rust: Inactif (compilation terminee ou en pause)" -ForegroundColor Gray
    }
    
    if ($dockerProcs) {
        $cpu = ($dockerProcs | Measure-Object -Property CPU -Sum).Sum
        $mem = ($dockerProcs | Measure-Object -Property WorkingSet -Sum).Sum / 1MB
        Write-Host "  [OK] Docker:" -ForegroundColor Blue
        Write-Host "      - Processus: $($dockerProcs.Count)" -ForegroundColor White
        Write-Host "      - CPU: $([math]::Round($cpu, 1))s" -ForegroundColor White
        Write-Host "      - RAM: $([math]::Round($mem, 0)) MB" -ForegroundColor White
    } else {
        Write-Host "  [ ] Docker: Inactif" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "--- ESTIMATION PROGRESSION ---" -ForegroundColor Cyan
    
    $buildActive = ($cargoProcs -or $dockerProcs)
    if ($buildActive) {
        if ($elapsed.TotalMinutes -lt 2) {
            $stage = "[1/4] Preparation Docker"
            $percent = [math]::Min(($elapsed.TotalMinutes / 2) * 10, 10)
        } elseif ($elapsed.TotalMinutes -lt 5) {
            $stage = "[2/4] Telechargement dependances"
            $percent = 10 + [math]::Min((($elapsed.TotalMinutes - 2) / 3) * 15, 15)
        } elseif ($cargoProcs) {
            $stage = "[3/4] Compilation Rust (en cours)"
            $percent = 25 + [math]::Min((($elapsed.TotalMinutes - 5) / 25) * 60, 60)
        } else {
            $stage = "[4/4] Finalisation image Docker"
            $percent = 85 + [math]::Min((($elapsed.TotalMinutes - 30) / 5) * 15, 15)
        }
        
        Write-Host "  Etape: $stage" -ForegroundColor Yellow
        
        # Barre de progression
        $barWidth = 40
        $filled = [math]::Floor($percent / 100 * $barWidth)
        $empty = $barWidth - $filled
        $bar = ("#" * $filled) + ("." * $empty)
        Write-Host "  Progression: [$bar] $([math]::Round($percent, 1))%" -ForegroundColor White
        
        $estimatedTotal = 30
        $remaining = [math]::Max(0, $estimatedTotal - $elapsed.TotalMinutes)
        if ($remaining -gt 0) {
            Write-Host "  Temps restant estime: ~$([math]::Round($remaining, 0)) minutes" -ForegroundColor Gray
        }
    } else {
        Write-Host "  [OK] Build termine ou non demarre" -ForegroundColor Green
        Write-Host "  Pour verifier: docker images | Select-String yukpomnang" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "--- STATISTIQUES ---" -ForegroundColor Cyan
    Write-Host "  Iterations: $iteration" -ForegroundColor White
    Write-Host "  Derniere mise a jour: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor White
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    
    $iteration++
    Start-Sleep -Seconds 3
}




