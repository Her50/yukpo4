# Script pour tester Yukpomnang directement sur votre téléphone

Write-Host "====================================" -ForegroundColor Cyan
Write-Host " Test sur téléphone" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Préparation du serveur de développement..." -ForegroundColor Yellow
Write-Host ""

Write-Host "MÉTHODE 1: Expo Go (recommandé - plus rapide)" -ForegroundColor Cyan
Write-Host "  1. Installez 'Expo Go' sur votre téléphone:" -ForegroundColor White
Write-Host "     - Android: https://play.google.com/store/apps/details?id=host.exp.exponent" -ForegroundColor Gray
Write-Host "     - iOS: https://apps.apple.com/app/expo-go/id982107779" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Assurez-vous que votre téléphone et PC sont sur le même WiFi" -ForegroundColor White
Write-Host ""
Write-Host "  3. Scannez le QR code qui va apparaître" -ForegroundColor White
Write-Host ""

Write-Host "MÉTHODE 2: Development Build (si vous avez déjà installé l'APK)" -ForegroundColor Cyan
Write-Host "  - L'app se connectera automatiquement au serveur" -ForegroundColor White
Write-Host ""

Write-Host "====================================" -ForegroundColor Yellow
Write-Host " Démarrage du serveur..." -ForegroundColor Yellow
Write-Host "====================================" -ForegroundColor Yellow
Write-Host ""

# Démarrer Expo
npx expo start --clear

Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host " Serveur arrêté" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green

