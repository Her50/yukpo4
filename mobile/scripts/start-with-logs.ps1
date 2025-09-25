# Script pour démarrer l'app avec logs visibles
# Utilise Expo Dev Tools pour voir les erreurs en temps réel

Write-Host "📱 Démarrage de l'application avec logs visibles" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Vérifier si Expo CLI est installé
Write-Host "`n🔍 Vérification d'Expo CLI..." -ForegroundColor Yellow
try {
    $expoVersion = npx expo --version 2>$null
    Write-Host "✅ Expo CLI version: $expoVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Expo CLI non trouvé. Installation..." -ForegroundColor Red
    npm install -g @expo/cli
}

Write-Host "`n🚀 Démarrage de l'application en mode développement..." -ForegroundColor Green
Write-Host "Les erreurs seront visibles dans:" -ForegroundColor Yellow
Write-Host "1. Le terminal ci-dessous" -ForegroundColor White
Write-Host "2. L'application Expo Go sur votre téléphone" -ForegroundColor White
Write-Host "3. Le navigateur web (http://localhost:19002)" -ForegroundColor White
Write-Host "`n📋 Instructions:" -ForegroundColor Yellow
Write-Host "- Scannez le QR code avec Expo Go" -ForegroundColor White
Write-Host "- Reproduisez l'erreur (connexion -> écran blanc)" -ForegroundColor White
Write-Host "- Copiez les erreurs du terminal et envoyez-les moi" -ForegroundColor White
Write-Host "=============================================" -ForegroundColor Cyan

# Démarrer avec logs détaillés
npx expo start --dev-client --clear --verbose

Write-Host "`n✅ Session terminée." -ForegroundColor Green

