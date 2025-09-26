# Script pour capturer les erreurs de l'application mobile
# Ce script sauvegarde les logs dans un fichier que vous pouvez m'envoyer

Write-Host "📱 Capture des erreurs de l'application mobile" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Vérifier si adb est disponible
Write-Host "`n🔍 Vérification d'ADB..." -ForegroundColor Yellow
try {
    $adbVersion = adb version 2>$null
    Write-Host "✅ ADB disponible" -ForegroundColor Green
} catch {
    Write-Host "❌ ADB non trouvé. Installation nécessaire..." -ForegroundColor Red
    Write-Host "1. Installez Android Studio" -ForegroundColor Yellow
    Write-Host "2. Ou téléchargez Android SDK Platform Tools" -ForegroundColor Yellow
    Write-Host "3. Ajoutez le dossier 'platform-tools' à votre PATH" -ForegroundColor Yellow
    exit 1
}

# Vérifier les appareils connectés
Write-Host "`n📱 Vérification des appareils connectés..." -ForegroundColor Yellow
$devices = adb devices
Write-Host $devices

if ($devices -notmatch "device$") {
    Write-Host "❌ Aucun appareil Android connecté" -ForegroundColor Red
    Write-Host "Connectez votre téléphone via USB et activez le débogage USB" -ForegroundColor Yellow
    exit 1
}

# Créer le dossier de logs s'il n'existe pas
$logsDir = "logs"
if (!(Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir
}

# Générer un nom de fichier avec timestamp
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile = "$logsDir\app-errors-$timestamp.txt"

Write-Host "`n📋 Capture des logs en cours..." -ForegroundColor Green
Write-Host "Fichier de sortie: $logFile" -ForegroundColor Yellow
Write-Host "Appuyez sur Ctrl+C pour arrêter la capture" -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Cyan

# Capturer les logs avec filtres pour l'application
try {
    adb logcat -c  # Nettoyer les logs précédents
    adb logcat | Tee-Object -FilePath $logFile | Select-String -Pattern "yukpomnang|ReactNative|Expo|Yukpo|ERROR|FATAL|Exception"
} catch {
    Write-Host "`n❌ Erreur lors de la capture des logs" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host "`n✅ Logs sauvegardés dans: $logFile" -ForegroundColor Green
Write-Host "📧 Envoyez-moi ce fichier pour analyse" -ForegroundColor Yellow


