# Script de débogage pour l'application mobile
# Ce script permet de voir les logs en temps réel et diagnostiquer les problèmes

Write-Host "🔍 Script de débogage pour l'application mobile Yukpomnang" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# Vérifier si Expo CLI est installé
Write-Host "`n📱 Vérification de l'environnement..." -ForegroundColor Yellow
try {
    $expoVersion = npx expo --version 2>$null
    Write-Host "✅ Expo CLI version: $expoVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Expo CLI non trouvé. Installation..." -ForegroundColor Red
    npm install -g @expo/cli
}

# Vérifier si l'application est en cours d'exécution
Write-Host "`n🔍 Vérification de l'état de l'application..." -ForegroundColor Yellow

# Démarrer l'application en mode debug
Write-Host "`n🚀 Démarrage de l'application en mode debug..." -ForegroundColor Green
Write-Host "Les logs seront affichés ci-dessous. Appuyez sur Ctrl+C pour arrêter." -ForegroundColor Yellow
Write-Host "=================================================" -ForegroundColor Cyan

# Démarrer avec logs détaillés
npx expo start --dev-client --clear

Write-Host "`n✅ Débogage terminé." -ForegroundColor Green

