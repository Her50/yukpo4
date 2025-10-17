# Réinstallation propre de toutes les dépendances

Write-Host "====================================" -ForegroundColor Cyan
Write-Host " Réinstallation propre" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"

# 1. Supprimer node_modules
Write-Host "[1/5] Suppression de node_modules..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  OK node_modules supprime" -ForegroundColor Green
}

# 2. Supprimer package-lock.json
Write-Host "[2/5] Suppression de package-lock.json..." -ForegroundColor Yellow
if (Test-Path "package-lock.json") {
    Remove-Item -Path "package-lock.json" -Force -ErrorAction SilentlyContinue
    Write-Host "  OK package-lock.json supprime" -ForegroundColor Green
}

# 3. Nettoyer les caches
Write-Host "[3/5] Nettoyage des caches..." -ForegroundColor Yellow
if (Test-Path ".expo") {
    Remove-Item -Path ".expo" -Recurse -Force -ErrorAction SilentlyContinue
}
npm cache clean --force 2>$null
Write-Host "  OK Caches nettoyes" -ForegroundColor Green

# 4. Réinstaller les dépendances
Write-Host "[4/5] Reinstallation des dependances (cela peut prendre 5-10 min)..." -ForegroundColor Yellow
npm install --legacy-peer-deps

if ($LASTEXITCODE -eq 0) {
    Write-Host "  OK Dependances installees" -ForegroundColor Green
}
else {
    Write-Host "  ERREUR lors de l installation" -ForegroundColor Red
    exit 1
}

# 5. Corriger les exports Metro
Write-Host "[5/5] Correction des exports Metro..." -ForegroundColor Yellow
powershell -ExecutionPolicy Bypass -File fix-metro-exports-all.ps1
Write-Host ""

Write-Host "====================================" -ForegroundColor Green
Write-Host " Reinstallation terminee" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Lancez maintenant:" -ForegroundColor Cyan
Write-Host "  npx expo start" -ForegroundColor White
Write-Host ""

