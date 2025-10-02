# Test simple de l'application
Write-Host "Test de l'application Yukpomnang" -ForegroundColor Green

# Verifier le repertoire
if (-not (Test-Path "package.json")) {
    Write-Host "Erreur: package.json non trouve" -ForegroundColor Red
    exit 1
}

Write-Host "Repertoire correct" -ForegroundColor Green

# Verifier les dependances
if (-not (Test-Path "node_modules")) {
    Write-Host "Erreur: node_modules non trouve. Executez npm install" -ForegroundColor Red
    exit 1
}

Write-Host "Dependances OK" -ForegroundColor Green

# Demarrer l'application
Write-Host "Demarrage de l'application..." -ForegroundColor Green
npm start
