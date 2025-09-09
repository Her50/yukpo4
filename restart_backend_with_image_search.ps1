# Script pour redémarrer le backend avec la feature image_search
Write-Host "Redemarrage du backend avec la feature image_search..." -ForegroundColor Green

# Arreter le backend actuel
Write-Host "Arret du backend actuel..." -ForegroundColor Cyan
try {
    $process = Get-Process -Name "yukpomnang_backend" -ErrorAction SilentlyContinue
    if ($process) {
        Stop-Process -Name "yukpomnang_backend" -Force
        Write-Host "Backend arrete" -ForegroundColor Green
        Start-Sleep -Seconds 2
    } else {
        Write-Host "Aucun backend en cours d'execution" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Erreur lors de l'arret du backend: $($_.Exception.Message)" -ForegroundColor Red
}

# Verifier que le port 3001 est libre
Write-Host "Verification du port 3001..." -ForegroundColor Cyan
try {
    $portCheck = netstat -ano | findstr ":3001"
    if ($portCheck) {
        Write-Host "Port 3001 encore occupe, attente..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    } else {
        Write-Host "Port 3001 libre" -ForegroundColor Green
    }
} catch {
    Write-Host "Impossible de verifier le port" -ForegroundColor Yellow
}

# Redemarrer le backend avec la feature image_search
Write-Host "Redemarrage du backend avec image_search..." -ForegroundColor Cyan
try {
    Set-Location backend
    Write-Host "Compilation avec la feature image_search..." -ForegroundColor Yellow
    
    # Compiler avec la feature image_search
    $buildResult = cargo build --features image_search --release
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Compilation reussie!" -ForegroundColor Green
        
        # Demarrer le backend
        Write-Host "Demarrage du backend..." -ForegroundColor Yellow
        Start-Process -FilePath "target\release\yukpomnang_backend.exe" -WorkingDirectory "backend" -WindowStyle Minimized
        
        # Attendre que le backend soit demarre
        Write-Host "Attente du demarrage..." -ForegroundColor Cyan
        Start-Sleep -Seconds 10
        
        # Verifier que le backend est accessible
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:3001/api/image-search/upload" -Method GET -TimeoutSec 5
            Write-Host "Backend demarre avec image_search!" -ForegroundColor Green
        } catch {
            Write-Host "Backend demarre mais image_search pas encore accessible" -ForegroundColor Yellow
        }
        
    } else {
        Write-Host "Erreur de compilation" -ForegroundColor Red
        Write-Host $buildResult -ForegroundColor Red
    }
    
    Set-Location ..
    
} catch {
    Write-Host "Erreur lors du redemarrage: $($_.Exception.Message)" -ForegroundColor Red
    Set-Location ..
}

Write-Host "Redemarrage termine!" -ForegroundColor Green 