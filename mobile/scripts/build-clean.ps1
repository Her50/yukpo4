# Script de build automatique pour Yukpomnang Mobile
# Usage: .\scripts\build-clean.ps1 [android|ios|all] [preview|production]

param(
    [Parameter(Mandatory = $false)]
    [ValidateSet("android", "ios", "all")]
    [string]$Platform = "all",
    
    [Parameter(Mandatory = $false)]
    [ValidateSet("preview", "production", "development")]
    [string]$Profile = "preview"
)

Write-Host "🚀 Build Yukpomnang Mobile - Plateforme: $Platform, Profil: $Profile" -ForegroundColor Green

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

# Fonction de build
function Start-Build {
    param([string]$platform, [string]$buildProfile)
    
    Write-Host "🔨 Build $platform en mode $buildProfile..." -ForegroundColor Blue
    
    if ($buildProfile -eq "production") {
        Write-Host "⚠️  Build de production - 10-15 minutes" -ForegroundColor Yellow
    }
    
    try {
        npx eas build --platform $platform --profile $buildProfile
        Write-Host "✅ Build $platform terminé!" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ Erreur build $platform : $_" -ForegroundColor Red
        return $false
    }
}

# Exécuter le build
$success = $true

switch ($Platform) {
    "android" { 
        $success = Start-Build "android" $Profile
    }
    "ios" { 
        $success = Start-Build "ios" $Profile
    }
    "all" { 
        Write-Host "📱 Build toutes les plateformes..." -ForegroundColor Yellow
        $success = Start-Build "all" $Profile
    }
}

if ($success) {
    Write-Host ""
    Write-Host "🎉 Build terminé avec succès!" -ForegroundColor Green
    Write-Host "📱 Dashboard: https://expo.dev/accounts/hernandezlele/projects/yukpomnang-mobile/builds" -ForegroundColor Cyan
    Write-Host "📧 Vérifiez votre email pour les liens de téléchargement" -ForegroundColor Blue
}
else {
    Write-Host "❌ Build échoué" -ForegroundColor Red
    exit 1
}

