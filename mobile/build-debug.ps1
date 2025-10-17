# Script pour builder et déboguer avec EAS

param(
    [string]$Profile = "preview-debug",
    [switch]$ShowLogs = $true,
    [switch]$AutoInstall = $false
)

Write-Host "🔨 BUILD DEBUG YUKPOMNANG" -ForegroundColor Cyan
Write-Host "Profile: $Profile" -ForegroundColor Yellow
Write-Host ""

# Fonction pour afficher les étapes
function Write-Step {
    param($Step, $Message)
    Write-Host "[$Step] $Message" -ForegroundColor Green
}

# Étape 1: Vérifier l'authentification EAS
Write-Step 1 "Vérification de l'authentification EAS..."
$easWhoami = npx eas whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Non authentifié. Connexion nécessaire..." -ForegroundColor Red
    npx eas login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Échec de l'authentification" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ Authentifié: $easWhoami" -ForegroundColor Green
Write-Host ""

# Étape 2: Nettoyer les caches locaux
Write-Step 2 "Nettoyage des caches locaux..."
if (Test-Path ".expo") { Remove-Item -Recurse -Force ".expo" }
if (Test-Path "node_modules/.cache") { Remove-Item -Recurse -Force "node_modules/.cache" }
Write-Host "✅ Caches nettoyés" -ForegroundColor Green
Write-Host ""

# Étape 3: Lancer le build
Write-Step 3 "Lancement du build EAS (profil: $Profile)..."
Write-Host "Commande: npx eas build --platform android --profile $Profile" -ForegroundColor Gray
Write-Host ""
Write-Host "⏳ Ce build peut prendre 10-20 minutes..." -ForegroundColor Yellow
Write-Host "📋 Les logs détaillés s'afficheront ci-dessous..." -ForegroundColor Yellow
Write-Host ""

# Créer un fichier de log
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile = "build-log-$timestamp.txt"

# Lancer le build et capturer les logs
if ($ShowLogs) {
    npx eas build --platform android --profile $Profile --non-interactive 2>&1 | Tee-Object -FilePath $logFile
} else {
    npx eas build --platform android --profile $Profile --non-interactive
}

$buildExitCode = $LASTEXITCODE

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

if ($buildExitCode -eq 0) {
    Write-Host "✅ BUILD RÉUSSI !" -ForegroundColor Green
    Write-Host ""
    Write-Host "📱 PROCHAINES ÉTAPES:" -ForegroundColor Cyan
    Write-Host "1. Téléchargez l'APK depuis le lien fourni ci-dessus" -ForegroundColor White
    Write-Host "2. Installez l'APK sur votre appareil Android" -ForegroundColor White
    Write-Host "3. Pour voir les logs en temps réel:" -ForegroundColor White
    Write-Host "   .\watch-device-logs.ps1" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "💡 ASTUCE: Pour debug approfondi, utilisez:" -ForegroundColor Cyan
    Write-Host "   adb logcat | Select-String 'Yukpo|ReactNative|Expo'" -ForegroundColor Yellow
} else {
    Write-Host "❌ BUILD ÉCHOUÉ" -ForegroundColor Red
    Write-Host ""
    Write-Host "📋 Logs sauvegardés dans: $logFile" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "🔍 DIAGNOSTIC:" -ForegroundColor Cyan
    Write-Host "Vérifiez les erreurs ci-dessus ou consultez le fichier de log" -ForegroundColor White
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

