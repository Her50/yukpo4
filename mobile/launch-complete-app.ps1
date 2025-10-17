# Lancement de l'application complète avec analyse automatique des logs

Write-Host "====================================" -ForegroundColor Cyan
Write-Host " LANCEMENT APP COMPLETE" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/6] Verification de l'app..." -ForegroundColor Yellow
if (Test-Path "App.tsx.backup")
{
    Write-Host "  OK App originale sauvegardee" -ForegroundColor Green
}
Write-Host "Contenu App.tsx:" -ForegroundColor Cyan
Get-Content App.tsx | Select-Object -First 5

Write-Host ""
Write-Host "[2/6] Correction rapide des dependances..." -ForegroundColor Yellow
# Forcer l'installation des dependances sans mise a jour Metro
npm install --legacy-peer-deps --no-audit
Write-Host "  OK Dependances installees" -ForegroundColor Green

Write-Host ""
Write-Host "[3/6] Nettoyage des caches..." -ForegroundColor Yellow
if (Test-Path ".expo")
{
    Remove-Item -Path ".expo" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  OK Cache Expo supprime" -ForegroundColor Green
}

Write-Host ""
Write-Host "[4/6] Verification des plugins..." -ForegroundColor Yellow
$pluginsPath = "node_modules\expo\plugins"
if (Test-Path $pluginsPath)
{
    Write-Host "  OK Plugins Expo presents" -ForegroundColor Green
}
else
{
    Write-Host "  ATTENTION: Plugins Expo manquants" -ForegroundColor Red
}

Write-Host ""
Write-Host "[5/6] Lancement du serveur avec logs detailles..." -ForegroundColor Yellow
Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host " SERVEUR EXPO DEMARRE" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "📱 TESTEZ MAINTENANT:" -ForegroundColor Cyan
Write-Host "  1. Scannez le QR code avec Expo Go" -ForegroundColor White
Write-Host "  2. L'app complete va se charger" -ForegroundColor White
Write-Host "  3. Si erreur → logs affiches ci-dessous" -ForegroundColor White
Write-Host ""
Write-Host "🔍 LOGS EN TEMPS REEL:" -ForegroundColor Yellow
Write-Host "  (Toutes les erreurs seront affichees ici)" -ForegroundColor Gray
Write-Host ""
Write-Host "Pour arreter: Ctrl+C" -ForegroundColor Gray
Write-Host "====================================" -ForegroundColor Green
Write-Host ""

# Lancer avec logs detailles
$env:EXPO_DEBUG = "1"
$env:DEBUG = "*"
npx expo start --clear --verbose

Write-Host ""
Write-Host "====================================" -ForegroundColor Red
Write-Host " SERVEUR ARRETE" -ForegroundColor Red
Write-Host "====================================" -ForegroundColor Red
