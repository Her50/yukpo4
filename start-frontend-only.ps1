# Script pour demarrer uniquement le frontend
Write-Host "Demarrage du frontend..." -ForegroundColor Green

# Aller dans le dossier frontend
Set-Location frontend

Write-Host "Demarrage du serveur de developpement..." -ForegroundColor Yellow
npm run dev 