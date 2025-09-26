# Script de build pour Yukpomnang Mobile (PowerShell)
# Ce script facilite les builds de production

param(
    [Parameter(Mandatory = $false)]
    [ValidateSet("ios", "android", "all")]
    [string]$Platform = "all",
    
    [Parameter(Mandatory = $false)]
    [ValidateSet("development", "preview", "production")]
    [string]$Profile = "production"
)

Write-Host "🚀 Build de Yukpomnang Mobile..." -ForegroundColor Green
Write-Host "Platform: $Platform" -ForegroundColor Cyan
Write-Host "Profile: $Profile" -ForegroundColor Cyan

# Vérifier EAS CLI
try {
    $easVersion = eas --version
    Write-Host "✅ EAS CLI détecté : $easVersion" -ForegroundColor Green
}
catch {
    Write-Host "❌ EAS CLI n'est pas installé. Installez-le avec : npm install -g @expo/eas-cli" -ForegroundColor Red
    exit 1
}

# Vérifier la connexion Expo
try {
    $user = eas whoami
    Write-Host "✅ Connecté à Expo en tant que : $user" -ForegroundColor Green
}
catch {
    Write-Host "❌ Non connecté à Expo. Connectez-vous avec : eas login" -ForegroundColor Red
    exit 1
}

# Fonction pour build iOS
function Start-BuildiOS {
    Write-Host "🍎 Build iOS..." -ForegroundColor Yellow
    eas build --platform ios --profile $Profile
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Build iOS terminé avec succès !" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Erreur lors du build iOS" -ForegroundColor Red
        exit 1
    }
}

# Fonction pour build Android
function Start-BuildAndroid {
    Write-Host "🤖 Build Android..." -ForegroundColor Yellow
    eas build --platform android --profile $Profile
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Build Android terminé avec succès !" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Erreur lors du build Android" -ForegroundColor Red
        exit 1
    }
}

# Fonction pour build les deux plateformes
function Start-BuildAll {
    Write-Host "📱 Build toutes les plateformes..." -ForegroundColor Yellow
    eas build --platform all --profile $Profile
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Build terminé avec succès !" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Erreur lors du build" -ForegroundColor Red
        exit 1
    }
}

# Exécuter le build selon la plateforme
switch ($Platform) {
    "ios" { Start-BuildiOS }
    "android" { Start-BuildAndroid }
    "all" { Start-BuildAll }
}

Write-Host ""
Write-Host "📋 Prochaines étapes :" -ForegroundColor Cyan
Write-Host "1. Vérifiez le build sur EAS Dashboard" -ForegroundColor White
Write-Host "2. Téléchargez et testez l'application" -ForegroundColor White
Write-Host "3. Soumettez aux stores avec : eas submit" -ForegroundColor White
Write-Host ""
Write-Host "🎉 Build terminé !" -ForegroundColor Green
