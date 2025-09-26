# Script pour voir les logs de l'application en temps réel
# Utilise adb pour Android et les outils Expo pour voir les erreurs

Write-Host "📱 Visualisation des logs de l'application mobile" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Vérifier si adb est disponible
Write-Host "`n🔍 Vérification des outils de débogage..." -ForegroundColor Yellow

try {
    $adbVersion = adb version 2>$null
    Write-Host "✅ ADB disponible" -ForegroundColor Green
} catch {
    Write-Host "❌ ADB non trouvé. Installation d'Android SDK..." -ForegroundColor Red
    Write-Host "Veuillez installer Android Studio ou Android SDK Platform Tools" -ForegroundColor Yellow
}

# Lister les appareils connectés
Write-Host "`n📱 Appareils connectés:" -ForegroundColor Yellow
adb devices

# Vérifier si l'application est installée
Write-Host "`n🔍 Vérification de l'installation de l'application..." -ForegroundColor Yellow
$packageName = "com.yukpomnang.mobile"
$isInstalled = adb shell pm list packages | Select-String $packageName

if ($isInstalled) {
    Write-Host "✅ Application installée: $packageName" -ForegroundColor Green
} else {
    Write-Host "❌ Application non installée. Installez d'abord l'APK." -ForegroundColor Red
    Write-Host "Utilisez le lien de téléchargement du build EAS." -ForegroundColor Yellow
}

# Afficher les logs en temps réel
Write-Host "`n📋 Logs de l'application en temps réel:" -ForegroundColor Green
Write-Host "Appuyez sur Ctrl+C pour arrêter." -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Cyan

# Filtrer les logs pour l'application
adb logcat | Select-String -Pattern "yukpomnang|ReactNative|Expo|Yukpo"

Write-Host "`n✅ Visualisation des logs terminée." -ForegroundColor Green


