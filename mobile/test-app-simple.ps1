# Test avec app minimale pour diagnostiquer l'erreur

Write-Host "====================================" -ForegroundColor Cyan
Write-Host " Test avec app minimale" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Remplacement temporaire de App.tsx par AppMinimal.tsx..." -ForegroundColor Yellow

# Sauvegarder l'app originale
if (Test-Path "App.tsx") {
    Copy-Item "App.tsx" "App.tsx.backup" -Force
    Write-Host "  OK App.tsx sauvegarde dans App.tsx.backup" -ForegroundColor Green
}

# Remplacer par l'app minimale
Copy-Item "AppMinimal.tsx" "App.tsx" -Force
Write-Host "  OK AppMinimal.tsx copie vers App.tsx" -ForegroundColor Green

Write-Host ""
Write-Host "Lancement du serveur avec app minimale..." -ForegroundColor Yellow
Write-Host ""
Write-Host "INSTRUCTIONS:" -ForegroundColor Cyan
Write-Host "  1. Scannez le QR code avec Expo Go" -ForegroundColor White
Write-Host "  2. Si l'app minimale fonctionne → le probleme est dans les composants" -ForegroundColor White
Write-Host "  3. Si ca crash encore → probleme de dependances" -ForegroundColor White
Write-Host "  4. Appuyez sur Ctrl+C pour arreter" -ForegroundColor White
Write-Host ""

npx expo start

Write-Host ""
Write-Host "====================================" -ForegroundColor Yellow
Write-Host " Restauration de l'app originale..." -ForegroundColor Yellow
Write-Host "====================================" -ForegroundColor Yellow

if (Test-Path "App.tsx.backup") {
    Copy-Item "App.tsx.backup" "App.tsx" -Force
    Write-Host "  OK App.tsx restaure" -ForegroundColor Green
}
else {
    Write-Host "  ATTENTION: App.tsx.backup introuvable!" -ForegroundColor Red
}
