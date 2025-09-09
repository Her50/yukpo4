# Script pour demarrer manuellement le frontend
Write-Host "Demarrage manuel du frontend..." -ForegroundColor Green

# Aller dans le dossier frontend
Set-Location frontend

# Verifier que package.json existe
if (-not (Test-Path "package.json")) {
    Write-Host "Erreur: package.json non trouve dans le dossier frontend" -ForegroundColor Red
    exit 1
}

# Verifier si node_modules existe
if (-not (Test-Path "node_modules")) {
    Write-Host "Installation des dependances..." -ForegroundColor Yellow
    npm install
}

Write-Host "Demarrage du serveur de developpement..." -ForegroundColor Yellow
npm run dev 