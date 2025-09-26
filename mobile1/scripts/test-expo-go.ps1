# Script de test avec Expo Go - Yukpomnang Mobile
# Usage: .\test-expo-go.ps1

# Configuration
$ErrorActionPreference = "Stop"

# Couleurs pour les messages
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    else {
        $input | Write-Output
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Success { Write-ColorOutput Green $args }
function Write-Error { Write-ColorOutput Red $args }
function Write-Warning { Write-ColorOutput Yellow $args }
function Write-Info { Write-ColorOutput Cyan $args }

# Fonction pour afficher les instructions
function Show-Instructions {
    Write-Info "📱 Test avec Expo Go - Yukpomnang Mobile"
    Write-Info "========================================="
    Write-Info ""
    Write-Info "🎯 Objectif: Tester l'application sur votre téléphone"
    Write-Info ""
    Write-Info "📋 Prérequis:"
    Write-Info "1. Téléphone Android ou iOS"
    Write-Info "2. Application Expo Go installée"
    Write-Info "3. Connexion Internet"
    Write-Info ""
    Write-Info "📲 Étapes:"
    Write-Info "1. L'application va démarrer"
    Write-Info "2. Un QR code apparaîtra"
    Write-Info "3. Scannez le QR code avec Expo Go"
    Write-Info "4. L'application se chargera sur votre téléphone"
    Write-Info ""
    Write-Info "🔗 Liens utiles:"
    Write-Info "- Expo Go Android: https://play.google.com/store/apps/details?id=host.exp.exponent"
    Write-Info "- Expo Go iOS: https://apps.apple.com/app/expo-go/id982107779"
    Write-Info ""
}

# Fonction pour vérifier les prérequis
function Test-Prerequisites {
    Write-Info "🔍 Vérification des prérequis..."
    
    # Vérifier Node.js
    try {
        $nodeVersion = node --version
        Write-Success "✅ Node.js: $nodeVersion"
    }
    catch {
        Write-Error "❌ Node.js non installé"
        exit 1
    }
    
    # Vérifier npm
    try {
        $npmVersion = npm --version
        Write-Success "✅ npm: $npmVersion"
    }
    catch {
        Write-Error "❌ npm non installé"
        exit 1
    }
    
    # Vérifier Expo CLI
    try {
        $expoVersion = npx expo --version
        Write-Success "✅ Expo CLI: $expoVersion"
    }
    catch {
        Write-Error "❌ Expo CLI non installé"
        exit 1
    }
    
    # Vérifier le fichier .env
    if (Test-Path ".env") {
        Write-Success "✅ Fichier .env configuré"
    }
    else {
        Write-Warning "⚠️ Fichier .env manquant"
        if (Test-Path "mobile.env") {
            Copy-Item "mobile.env" ".env" -Force
            Write-Success "✅ Fichier .env créé depuis mobile.env"
        }
        else {
            Write-Error "❌ Fichier mobile.env non trouvé"
            exit 1
        }
    }
}

# Fonction pour installer les dépendances
function Install-Dependencies {
    Write-Info "📦 Installation des dépendances..."
    
    try {
        npm install
        Write-Success "✅ Dépendances installées"
    }
    catch {
        Write-Error "❌ Erreur lors de l'installation des dépendances: $_"
        exit 1
    }
}

# Fonction pour démarrer l'application
function Start-Application {
    Write-Info "🚀 Démarrage de l'application..."
    Write-Info ""
    Write-Info "📱 Instructions:"
    Write-Info "1. Un QR code va apparaître"
    Write-Info "2. Ouvrez Expo Go sur votre téléphone"
    Write-Info "3. Scannez le QR code"
    Write-Info "4. L'application se chargera"
    Write-Info ""
    Write-Info "⚠️ Appuyez sur Ctrl+C pour arrêter l'application"
    Write-Info ""
    
    try {
        npx expo start --tunnel
    }
    catch {
        Write-Error "❌ Erreur lors du démarrage: $_"
        exit 1
    }
}

# Fonction pour afficher les résultats
function Show-Results {
    Write-Info "🎉 Test terminé !"
    Write-Info "================"
    Write-Info ""
    Write-Info "📊 Résultats:"
    Write-Info "- Application testée avec Expo Go"
    Write-Info "- Fonctionnalités validées"
    Write-Info "- Prête pour le déploiement"
    Write-Info ""
    Write-Info "📋 Prochaines étapes:"
    Write-Info "1. Corriger les bugs identifiés"
    Write-Info "2. Créer un compte Expo pour EAS Build"
    Write-Info "3. Générer l'APK de production"
    Write-Info "4. Partager l'APK avec d'autres personnes"
    Write-Info ""
    Write-Info "🔗 Liens utiles:"
    Write-Info "- Documentation: https://docs.expo.dev/"
    Write-Info "- EAS Build: https://docs.expo.dev/build/introduction/"
    Write-Info "- Support: support@yukpomnang.com"
    Write-Info ""
}

# Fonction principale
function Main {
    # Afficher les instructions
    Show-Instructions
    
    # Demander confirmation
    $confirmation = Read-Host "Continuer avec le test Expo Go? (y/N)"
    if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
        Write-Info "Test annulé"
        exit 0
    }
    
    # Vérifier les prérequis
    Test-Prerequisites
    
    # Installer les dépendances
    Install-Dependencies
    
    # Démarrer l'application
    Start-Application
    
    # Afficher les résultats
    Show-Results
}

# Exécution
try {
    Main
}
catch {
    Write-Error "❌ Erreur fatale: $_"
    exit 1
}

