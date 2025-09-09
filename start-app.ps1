# Script de démarrage Yukpo
Write-Host "Démarrage de Yukpo..." -ForegroundColor Yellow

# Backend
Write-Host "Démarrage du backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; cargo run"

# Attendre 3 secondes
Start-Sleep -Seconds 3

# Frontend
Write-Host "Démarrage du frontend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "Application démarrée!" -ForegroundColor Green 