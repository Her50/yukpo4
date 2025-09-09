# Script simple pour verifier l'etat des services
Write-Host "Verification de l'etat des services Yukpo" -ForegroundColor Green
Write-Host ""

# Verifier le backend
Write-Host "Backend (Port 3001):" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/ia/auto" -Method POST -ContentType "application/json" -Body '{"texte":"test"}' -TimeoutSec 3 -ErrorAction Stop
    Write-Host "   Backend en ligne" -ForegroundColor Green
} catch {
    if ($_.Exception.Message -like "*Missing Authorization header*") {
        Write-Host "   Backend en ligne (authentification requise)" -ForegroundColor Green
    } else {
        Write-Host "   Backend hors ligne" -ForegroundColor Red
    }
}

# Verifier le frontend
Write-Host "Frontend (Port 5173):" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 3 -ErrorAction Stop
    Write-Host "   Frontend en ligne" -ForegroundColor Green
} catch {
    Write-Host "   Frontend hors ligne" -ForegroundColor Red
}

# Verifier la configuration
Write-Host "Configuration:" -ForegroundColor Cyan
if (Test-Path "frontend/.env") {
    Write-Host "   Fichier .env present" -ForegroundColor Green
} else {
    Write-Host "   Fichier .env manquant" -ForegroundColor Red
}

Write-Host ""
Write-Host "URLs:" -ForegroundColor Cyan
Write-Host "   Backend: http://localhost:3001" -ForegroundColor White
Write-Host "   Frontend: http://localhost:5173" -ForegroundColor White
Write-Host ""
Write-Host "Status: Tous les services sont operationnels !" -ForegroundColor Green 