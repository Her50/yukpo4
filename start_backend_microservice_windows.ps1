# Script pour lancer Backend + Microservice dans des fenêtres séparées
# Usage: .\start_backend_microservice_windows.ps1

Write-Host "🚀 Lancement Backend + Microservice dans des fenêtres séparées" -ForegroundColor Green
Write-Host "=============================================================" -ForegroundColor Cyan

# Vérification rapide
if (-not (Test-Path "backend\Cargo.toml")) {
    Write-Host "❌ Cargo.toml non trouvé dans backend/" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "microservice_embedding\main.py")) {
    Write-Host "❌ main.py non trouvé dans microservice_embedding/" -ForegroundColor Red
    exit 1
}

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "- Backend: Port 3001 (127.0.0.1)" -ForegroundColor White
Write-Host "- Microservice: Port 8000 (localhost)" -ForegroundColor White

# Démarrage du microservice dans une nouvelle fenêtre
Write-Host "`n🐍 Lancement du microservice dans une nouvelle fenêtre..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd microservice_embedding; if (Test-Path 'venv\Scripts\Activate.ps1') { .\venv\Scripts\Activate.ps1 }; python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload" -WindowStyle Normal

# Attendre 3 secondes
Start-Sleep -Seconds 3

# Démarrage du backend dans une nouvelle fenêtre
Write-Host "🦀 Lancement du backend dans une nouvelle fenêtre..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; cargo run" -WindowStyle Normal

Write-Host "`n✅ Services lancés dans des fenêtres séparées!" -ForegroundColor Green
Write-Host "URLs:" -ForegroundColor Cyan
Write-Host "Backend: http://localhost:3001" -ForegroundColor White
Write-Host "Microservice: http://localhost:8000" -ForegroundColor White

Write-Host "`n💡 Pour arrêter les services, fermez les fenêtres PowerShell ou appuyez sur Ctrl+C dans chacune." -ForegroundColor Yellow 