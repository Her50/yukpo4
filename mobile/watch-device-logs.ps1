# Script pour surveiller les logs de l'appareil Android en temps réel

Write-Host "📱 SURVEILLANCE DES LOGS ANDROID" -ForegroundColor Cyan
Write-Host "Ce script affiche les logs de votre appareil/émulateur en temps réel" -ForegroundColor Yellow
Write-Host ""

# Vérifier si ADB est installé
$adbPath = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adbPath) {
    Write-Host "❌ ADB n'est pas trouvé dans le PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Solutions:" -ForegroundColor Yellow
    Write-Host "1. Installez Android Studio qui inclut ADB" -ForegroundColor White
    Write-Host "2. Ou installez les Android SDK Platform Tools" -ForegroundColor White
    Write-Host "3. Ajoutez le chemin de ADB au PATH système" -ForegroundColor White
    Write-Host ""
    Write-Host "Chemin typique: C:\Users\$env:USERNAME\AppData\Local\Android\Sdk\platform-tools" -ForegroundColor Gray
    exit 1
}

Write-Host "✅ ADB trouvé: $($adbPath.Source)" -ForegroundColor Green
Write-Host ""

# Vérifier les appareils connectés
Write-Host "🔍 Recherche des appareils connectés..." -ForegroundColor Cyan
$devices = adb devices | Select-Object -Skip 1 | Where-Object { $_.Trim() -ne "" }

if (-not $devices) {
    Write-Host "❌ Aucun appareil/émulateur connecté" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Solutions:" -ForegroundColor Yellow
    Write-Host "1. Connectez votre appareil Android via USB" -ForegroundColor White
    Write-Host "2. Activez le débogage USB dans les options de développeur" -ForegroundColor White
    Write-Host "3. Ou lancez un émulateur Android" -ForegroundColor White
    Write-Host ""
    Write-Host "Vérifiez avec: adb devices" -ForegroundColor Gray
    exit 1
}

Write-Host "✅ Appareils détectés:" -ForegroundColor Green
$devices | ForEach-Object { Write-Host "   $_" -ForegroundColor White }
Write-Host ""

# Créer un fichier de log
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile = "device-logs-$timestamp.txt"

Write-Host "📋 Les logs seront sauvegardés dans: $logFile" -ForegroundColor Yellow
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "🎬 DÉBUT DE LA SURVEILLANCE (Ctrl+C pour arrêter)" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

# Nettoyer les logs existants
adb logcat -c

# Filtres pour Yukpomnang, React Native, Expo et erreurs
$filters = @(
    "Yukpo",
    "ReactNative",
    "ReactNativeJS",
    "Expo",
    "ExpoModules",
    "AndroidRuntime",
    "FATAL",
    "ERROR",
    "chromium",
    "WebRTC"
)

$filterPattern = $filters -join "|"

# Surveiller les logs avec couleurs
adb logcat -v time 2>&1 | ForEach-Object {
    $line = $_
    
    # Sauvegarder dans le fichier
    Add-Content -Path $logFile -Value $line
    
    # Afficher avec couleurs selon le niveau
    if ($line -match "FATAL|AndroidRuntime") {
        Write-Host $line -ForegroundColor Red
    }
    elseif ($line -match "ERROR|E/") {
        Write-Host $line -ForegroundColor Red
    }
    elseif ($line -match "WARN|W/") {
        Write-Host $line -ForegroundColor Yellow
    }
    elseif ($line -match "INFO|I/") {
        Write-Host $line -ForegroundColor Cyan
    }
    elseif ($line -match "DEBUG|D/") {
        Write-Host $line -ForegroundColor Gray
    }
    elseif ($line -match $filterPattern) {
        Write-Host $line -ForegroundColor White
    }
    else {
        Write-Host $line -ForegroundColor DarkGray
    }
} | Select-String -Pattern $filterPattern

Write-Host ""
Write-Host "📋 Logs sauvegardés dans: $logFile" -ForegroundColor Green

