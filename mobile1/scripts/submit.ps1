# Script de soumission pour Yukpomnang Mobile (PowerShell)
# Ce script facilite la soumission aux stores

param(
    [Parameter(Mandatory = $false)]
    [ValidateSet("ios", "android", "all")]
    [string]$Platform = "all"
)

Write-Host "🚀 Soumission de Yukpomnang Mobile aux stores..." -ForegroundColor Green
Write-Host "Platform: $Platform" -ForegroundColor Cyan

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

# Fonction pour soumettre iOS
function Submit-iOS {
    Write-Host "🍎 Soumission iOS à l'App Store..." -ForegroundColor Yellow
    
    # Vérifier les prérequis iOS
    Write-Host "🔍 Vérification des prérequis iOS..." -ForegroundColor Yellow
    Write-Host "- Compte Apple Developer configuré" -ForegroundColor White
    Write-Host "- Certificats de distribution valides" -ForegroundColor White
    Write-Host "- Profil de provisioning configuré" -ForegroundColor White
    
    $confirm = Read-Host "Continuer avec la soumission iOS ? (y/N)"
    if ($confirm -eq "y" -or $confirm -eq "Y") {
        eas submit --platform ios
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Soumission iOS terminée avec succès !" -ForegroundColor Green
        }
        else {
            Write-Host "❌ Erreur lors de la soumission iOS" -ForegroundColor Red
            exit 1
        }
    }
    else {
        Write-Host "⏭️  Soumission iOS annulée" -ForegroundColor Yellow
    }
}

# Fonction pour soumettre Android
function Submit-Android {
    Write-Host "🤖 Soumission Android au Google Play Store..." -ForegroundColor Yellow
    
    # Vérifier les prérequis Android
    Write-Host "🔍 Vérification des prérequis Android..." -ForegroundColor Yellow
    Write-Host "- Compte Google Play Console configuré" -ForegroundColor White
    Write-Host "- Clé de signature configurée" -ForegroundColor White
    Write-Host "- Application créée sur Google Play Console" -ForegroundColor White
    
    $confirm = Read-Host "Continuer avec la soumission Android ? (y/N)"
    if ($confirm -eq "y" -or $confirm -eq "Y") {
        eas submit --platform android
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Soumission Android terminée avec succès !" -ForegroundColor Green
        }
        else {
            Write-Host "❌ Erreur lors de la soumission Android" -ForegroundColor Red
            exit 1
        }
    }
    else {
        Write-Host "⏭️  Soumission Android annulée" -ForegroundColor Yellow
    }
}

# Fonction pour soumettre les deux plateformes
function Submit-All {
    Write-Host "📱 Soumission toutes les plateformes..." -ForegroundColor Yellow
    
    $confirm = Read-Host "Continuer avec la soumission sur toutes les plateformes ? (y/N)"
    if ($confirm -eq "y" -or $confirm -eq "Y") {
        eas submit --platform all
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Soumission terminée avec succès !" -ForegroundColor Green
        }
        else {
            Write-Host "❌ Erreur lors de la soumission" -ForegroundColor Red
            exit 1
        }
    }
    else {
        Write-Host "⏭️  Soumission annulée" -ForegroundColor Yellow
    }
}

# Exécuter la soumission selon la plateforme
switch ($Platform) {
    "ios" { Submit-iOS }
    "android" { Submit-Android }
    "all" { Submit-All }
}

Write-Host ""
Write-Host "📋 Prochaines étapes :" -ForegroundColor Cyan
Write-Host "1. Surveillez le statut de review sur les stores" -ForegroundColor White
Write-Host "2. Répondez aux questions des équipes de review si nécessaire" -ForegroundColor White
Write-Host "3. Préparez la communication de lancement" -ForegroundColor White
Write-Host ""
Write-Host "📚 Ressources utiles :" -ForegroundColor Cyan
Write-Host "- App Store Connect : https://appstoreconnect.apple.com" -ForegroundColor White
Write-Host "- Google Play Console : https://play.google.com/console" -ForegroundColor White
Write-Host "- EAS Dashboard : https://expo.dev" -ForegroundColor White
Write-Host ""
Write-Host "🎉 Soumission terminée !" -ForegroundColor Green

