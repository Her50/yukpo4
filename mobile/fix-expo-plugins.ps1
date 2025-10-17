# Correction des plugins Expo manquants

Write-Host "====================================" -ForegroundColor Cyan
Write-Host " Correction plugins Expo" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Le probleme identifie: Plugins Expo manquants" -ForegroundColor Yellow
Write-Host ""

Write-Host "[1/4] Nettoyage des caches..." -ForegroundColor Yellow
if (Test-Path ".expo")
{
    Remove-Item -Path ".expo" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  OK Cache Expo supprime" -ForegroundColor Green
}

Write-Host "[2/4] Reinstallation des plugins Expo..." -ForegroundColor Yellow
npm install @expo/metro-config --save-dev
Write-Host "  OK Metro config installe" -ForegroundColor Green

Write-Host "[3/4] Regeneration de la configuration..." -ForegroundColor Yellow
npx expo install --fix
Write-Host "  OK Dependances Expo alignees" -ForegroundColor Green

Write-Host "[4/4] Test de la correction..." -ForegroundColor Yellow
Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host " Correction terminee" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Testez maintenant:" -ForegroundColor Cyan
Write-Host "1. Scannez le QR code (port 8082)" -ForegroundColor White
Write-Host "2. L'app devrait maintenant fonctionner" -ForegroundColor White
Write-Host ""

# Verifier que les plugins sont maintenant presents
$pluginsPath = "node_modules\expo\plugins"
if (Test-Path $pluginsPath)
{
    Write-Host "✅ Plugins Expo maintenant presents!" -ForegroundColor Green
}
else
{
    Write-Host "❌ Plugins toujours manquants - autre solution necessaire" -ForegroundColor Red
}

Write-Host ""
Write-Host "Si ca ne marche toujours pas:" -ForegroundColor Yellow
Write-Host "  powershell -ExecutionPolicy Bypass -File reinstall-propre.ps1" -ForegroundColor White
