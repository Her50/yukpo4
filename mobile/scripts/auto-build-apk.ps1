# Script de build automatique APK pour Yukpomnang Mobile
# Usage: .\scripts\auto-build-apk.ps1 [preview|production]

param(
    [Parameter(Mandatory = $false)]
    [ValidateSet("preview", "production")]
    [string]$Profile = "preview"
)

Write-Host "🚀 Build APK automatique - Profil: $Profile" -ForegroundColor Green

# Vérifier le répertoire
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Erreur: Exécutez ce script depuis le répertoire mobile" -ForegroundColor Red
    exit 1
}

# Configurer le token EAS
$env:EXPO_TOKEN = "12jDNlGCXduPK_xGvu6_1D8g9FgoSf3nQRwgzxd_"

# Vérifier EAS CLI
try {
    $easVersion = npx eas --version 2>$null
    Write-Host "✅ EAS CLI: $easVersion" -ForegroundColor Green
}
catch {
    Write-Host "❌ EAS CLI manquant. Installation..." -ForegroundColor Yellow
    npm install -g @expo/eas-cli
}

# Vérifier la connexion
try {
    $user = npx eas whoami 2>$null
    Write-Host "✅ Connecté: $user" -ForegroundColor Green
}
catch {
    Write-Host "❌ Connexion EAS échouée" -ForegroundColor Red
    exit 1
}

# Initialiser le projet si nécessaire
if (-not (Test-Path "eas.json")) {
    Write-Host "🔧 Initialisation du projet EAS..." -ForegroundColor Blue
    npx eas init --non-interactive --force
}

# Configurer les credentials automatiquement
Write-Host "🔑 Configuration des credentials..." -ForegroundColor Blue
$env:EAS_BUILD_ANDROID_CREDENTIALS_SOURCE = "remote"

# Lancer le build APK
Write-Host "🔨 Build APK Android en mode $Profile..." -ForegroundColor Blue

if ($Profile -eq "production") {
    Write-Host "⚠️  Build de production - 10-15 minutes" -ForegroundColor Yellow
}

try {
    npx eas build --platform android --profile $Profile --non-interactive
    Write-Host "✅ Build APK terminé avec succès!" -ForegroundColor Green
    Write-Host "📱 Dashboard: https://expo.dev/accounts/hernandezlele/projects/yukpomnang-mobile/builds" -ForegroundColor Cyan
    Write-Host "📧 Vérifiez votre email pour le lien de téléchargement" -ForegroundColor Blue
}
catch {
    Write-Host "❌ Erreur lors du build APK: $_" -ForegroundColor Red
    exit 1
}