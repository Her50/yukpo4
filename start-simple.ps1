# Script simple pour demarrer Yukpo
Write-Host "Demarrage de Yukpo..." -ForegroundColor Green

# Verifier la structure
if (-not (Test-Path "backend/Cargo.toml")) {
    Write-Host "Erreur: backend/Cargo.toml non trouve" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "frontend/package.json")) {
    Write-Host "Erreur: frontend/package.json non trouve" -ForegroundColor Red
    exit 1
}

# Creer .env si manquant
if (-not (Test-Path "frontend/.env")) {
    Write-Host "Creation du fichier .env..." -ForegroundColor Yellow
    
    $content = "# Configuration Google Maps API`nVITE_APP_GOOGLE_MAPS_API_KEY=VOTRE_CLE_API_GOOGLE_MAPS`n`n# Configuration Backend`nVITE_APP_API_URL=http://localhost:3001`n`n# Configuration Environnement`nVITE_APP_ENV=development"
    $content | Out-File -FilePath "frontend/.env" -Encoding UTF8
    
    Write-Host "Fichier .env cree. Configurez votre cle API Google Maps !" -ForegroundColor Yellow
}

Write-Host "Demarrage du backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; cargo run"

Write-Host "Attente de 5 secondes..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "Demarrage du frontend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "Yukpo demarre !" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "Backend: http://localhost:3001" -ForegroundColor White 