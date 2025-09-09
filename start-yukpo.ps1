# Script simple pour demarrer Yukpo
Write-Host "🚀 Démarrage de l'application Yukpo..." -ForegroundColor Yellow
Write-Host "=====================" -ForegroundColor Cyan

# Verifier le fichier .env
if (-not (Test-Path ".env")) {
    Write-Host "ERREUR: Fichier .env non trouve" -ForegroundColor Red
    exit 1
}

Write-Host "Configuration detectee:" -ForegroundColor Yellow
Write-Host "- Backend: Port 3001 (127.0.0.1)" -ForegroundColor White
Write-Host "- Embedding: Port 8000 (localhost)" -ForegroundColor White
Write-Host "- Frontend: Port 5173 (localhost)" -ForegroundColor White

# Demarrer les services dans des fenetres separees
Write-Host "`nDemarrage des services..." -ForegroundColor Yellow

# 1. Microservice d'embedding
Write-Host "1. Microservice d'embedding (port 8000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd microservice_embedding; .\venv\Scripts\Activate.ps1; python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload" -WindowStyle Normal

# 2. Backend Rust
Write-Host "📦 Démarrage du backend Rust..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; cargo run" -WindowStyle Normal

# Attendre un peu pour que le backend démarre
Start-Sleep -Seconds 3

# 3. Frontend
Write-Host "🎨 Démarrage du frontend React..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev" -WindowStyle Normal

# Attendre un peu pour que le frontend démarre
Start-Sleep -Seconds 3

Write-Host "`nServices en cours de demarrage..." -ForegroundColor Green
Write-Host "URLs:" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "Backend: http://localhost:3001" -ForegroundColor White
Write-Host "Embedding: http://localhost:8000" -ForegroundColor White

Write-Host "✅ Application Yukpo démarrée!" -ForegroundColor Green
Write-Host "Backend: http://localhost:3001" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:5173 (ou le port suivant si occupé)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Pour arrêter l'application, fermez les fenêtres PowerShell ou appuyez sur Ctrl+C dans chacune." -ForegroundColor Gray

Write-Host "`nPour verifier l'etat: .\check-yukpo-status.ps1" -ForegroundColor Yellow 