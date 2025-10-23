# Script pour corriger le problème de dépendance BlurView
Write-Host "🔧 Correction du problème de dépendance BlurView..." -ForegroundColor Green

# 1. Nettoyer le cache npm
Write-Host "📦 Nettoyage du cache npm..." -ForegroundColor Yellow
npm cache clean --force

# 2. Supprimer node_modules et package-lock.json
Write-Host "🗑️ Suppression des dépendances existantes..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force "node_modules"
    Write-Host "✅ node_modules supprimé" -ForegroundColor Green
}

if (Test-Path "package-lock.json") {
    Remove-Item -Force "package-lock.json"
    Write-Host "✅ package-lock.json supprimé" -ForegroundColor Green
}

# 3. Réinstaller les dépendances
Write-Host "📥 Réinstallation des dépendances..." -ForegroundColor Yellow
npm install

# 4. Vérifier que expo-blur est bien installé
Write-Host "🔍 Vérification d'expo-blur..." -ForegroundColor Yellow
$expoBlurInstalled = npm list expo-blur 2>$null
if ($expoBlurInstalled) {
    Write-Host "✅ expo-blur est installé" -ForegroundColor Green
}
else {
    Write-Host "❌ expo-blur n'est pas installé" -ForegroundColor Red
    npm install expo-blur
}

# 5. Vérifier que @react-native-community/blur n'est plus installé
Write-Host "🔍 Vérification de @react-native-community/blur..." -ForegroundColor Yellow
$communityBlurInstalled = npm list @react-native-community/blur 2>$null
if ($communityBlurInstalled) {
    Write-Host "⚠️ @react-native-community/blur est encore installé" -ForegroundColor Yellow
    npm uninstall @react-native-community/blur
    Write-Host "✅ @react-native-community/blur supprimé" -ForegroundColor Green
}
else {
    Write-Host "✅ @react-native-community/blur n'est plus installé" -ForegroundColor Green
}

# 6. Nettoyer le cache Expo
Write-Host "🧹 Nettoyage du cache Expo..." -ForegroundColor Yellow
npx expo install --fix

Write-Host "🎉 Correction terminée !" -ForegroundColor Green
Write-Host "📋 Résumé des changements:" -ForegroundColor Cyan
Write-Host "   - Suppression de @react-native-community/blur" -ForegroundColor White
Write-Host "   - Utilisation exclusive d'expo-blur" -ForegroundColor White
Write-Host "   - Cache nettoyé" -ForegroundColor White
Write-Host "   - Dépendances réinstallées" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Vous pouvez maintenant relancer le build EAS:" -ForegroundColor Green
Write-Host "   eas build --platform android" -ForegroundColor White

