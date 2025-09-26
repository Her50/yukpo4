# Script de déploiement sur Expo Go - Yukpomnang Mobile
# Usage: .\deploy-expo-go.ps1

# Configuration
$ErrorActionPreference = "Stop"

# Couleurs pour les messages
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    } else {
        $input | Write-Output
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Success { Write-ColorOutput Green $args }
function Write-Error { Write-ColorOutput Red $args }
function Write-Warning { Write-ColorOutput Yellow $args }
function Write-Info { Write-ColorOutput Cyan $args }

# Fonction pour vérifier les prérequis
function Test-Prerequisites {
    Write-Info "🔍 Vérification des prérequis..."
    
    # Vérifier Node.js
    try {
        $nodeVersion = node --version
        Write-Success "✅ Node.js: $nodeVersion"
    } catch {
        Write-Error "❌ Node.js non installé"
        exit 1
    }
    
    # Vérifier Expo CLI
    try {
        $expoVersion = expo --version
        Write-Success "✅ Expo CLI: $expoVersion"
    } catch {
        Write-Error "❌ Expo CLI non installé. Installez avec: npm install -g @expo/cli"
        exit 1
    }
    
    # Vérifier la connexion Expo
    try {
        $expoWhoami = expo whoami
        Write-Success "✅ Connecté à Expo: $expoWhoami"
    } catch {
        Write-Error "❌ Non connecté à Expo. Connectez-vous avec: expo login"
        exit 1
    }
}

# Fonction pour configurer l'environnement
function Set-Environment {
    Write-Info "🔧 Configuration de l'environnement..."
    
    # Copier le fichier de configuration
    if (Test-Path "mobile.env") {
        Copy-Item "mobile.env" ".env" -Force
        Write-Success "✅ Fichier .env configuré"
    } else {
        Write-Warning "⚠️ Fichier mobile.env non trouvé, création d'un .env par défaut"
        
        $envContent = @"
# Configuration Mobile - Yukpomnang
EXPO_PUBLIC_API_BASE_URL=https://yukpomnang.onrender.com
EXPO_PUBLIC_API_TIMEOUT=15000
EXPO_PUBLIC_APP_NAME=Yukpomnang
EXPO_PUBLIC_APP_VERSION=1.0.0
EXPO_PUBLIC_DEBUG_MODE=true
EXPO_PUBLIC_LOG_LEVEL=debug
"@
        Set-Content -Path ".env" -Value $envContent
        Write-Success "✅ Fichier .env créé avec la configuration par défaut"
    }
}

# Fonction pour installer les dépendances
function Install-Dependencies {
    Write-Info "📦 Installation des dépendances..."
    
    try {
        npm install
        Write-Success "✅ Dépendances installées"
    } catch {
        Write-Error "❌ Erreur lors de l'installation des dépendances: $_"
        exit 1
    }
}

# Fonction pour démarrer l'application
function Start-Application {
    Write-Info "🚀 Démarrage de l'application sur Expo Go..."
    
    try {
        Write-Info "📱 L'application va démarrer sur Expo Go"
        Write-Info "📲 Scannez le QR code avec l'app Expo Go sur votre téléphone"
        Write-Info "🔗 Ou ouvrez le lien dans votre navigateur"
        Write-Info ""
        Write-Info "💡 Conseils:"
        Write-Info "   - Assurez-vous que votre téléphone et votre ordinateur sont sur le même réseau WiFi"
        Write-Info "   - Téléchargez l'app Expo Go depuis l'App Store ou Google Play"
        Write-Info "   - Scannez le QR code qui va apparaître"
        Write-Info ""
        Write-Info "⏹️ Appuyez sur Ctrl+C pour arrêter l'application"
        Write-Info ""
        
        # Démarrer Expo
        expo start --tunnel
    } catch {
        Write-Error "❌ Erreur lors du démarrage: $_"
        exit 1
    }
}

# Fonction pour afficher les instructions
function Show-Instructions {
    Write-Info "📱 Instructions pour Expo Go"
    Write-Info "============================"
    Write-Info ""
    Write-Info "1. 📲 Téléchargez l'app Expo Go:"
    Write-Info "   - iOS: https://apps.apple.com/app/expo-go/id982107779"
    Write-Info "   - Android: https://play.google.com/store/apps/details?id=host.exp.exponent"
    Write-Info ""
    Write-Info "2. 🔗 Connectez-vous à Expo Go:"
    Write-Info "   - Créez un compte Expo ou connectez-vous"
    Write-Info "   - Scannez le QR code qui va apparaître"
    Write-Info ""
    Write-Info "3. 🌐 Vérifiez la connectivité:"
    Write-Info "   - Même réseau WiFi que votre ordinateur"
    Write-Info "   - Connexion Internet stable"
    Write-Info ""
    Write-Info "4. 🧪 Testez l'application:"
    Write-Info "   - Authentification (login/register)"
    Write-Info "   - Géolocalisation"
    Write-Info "   - Services et recherche"
    Write-Info "   - Chat IA"
    Write-Info ""
    Write-Info "5. 🔧 En cas de problème:"
    Write-Info "   - Redémarrez l'application"
    Write-Info "   - Vérifiez la connexion réseau"
    Write-Info "   - Consultez les logs dans le terminal"
    Write-Info ""
}

# Fonction pour afficher le résumé
function Show-Summary {
    Write-Info "📊 Résumé du déploiement Expo Go"
    Write-Info "================================="
    Write-Info ""
    Write-Info "✅ Application déployée sur Expo Go"
    Write-Info "📱 Accessible via l'app Expo Go sur mobile"
    Write-Info "🌐 URL de développement: https://expo.dev/@your-username/yukpomnang"
    Write-Info ""
    Write-Info "🔗 Liens utiles:"
    Write-Info "   - Expo Go iOS: https://apps.apple.com/app/expo-go/id982107779"
    Write-Info "   - Expo Go Android: https://play.google.com/store/apps/details?id=host.exp.exponent"
    Write-Info "   - Documentation Expo: https://docs.expo.dev"
    Write-Info ""
    Write-Info "📞 Support:"
    Write-Info "   - Email: support@yukpomnang.com"
    Write-Info "   - Discord: https://discord.gg/yukpomnang"
    Write-Info ""
}

# Fonction principale
function Main {
    Write-Info "📱 Déploiement Expo Go - Yukpomnang Mobile"
    Write-Info "=========================================="
    
    # Afficher les instructions
    Show-Instructions
    
    # Demander confirmation
    $confirmation = Read-Host "Continuer avec le déploiement sur Expo Go? (y/N)"
    if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
        Write-Info "Déploiement annulé"
        exit 0
    }
    
    # Vérifier les prérequis
    Test-Prerequisites
    
    # Configurer l'environnement
    Set-Environment
    
    # Installer les dépendances
    Install-Dependencies
    
    # Démarrer l'application
    Start-Application
    
    # Afficher le résumé
    Show-Summary
}

# Exécution
try {
    Main
} catch {
    Write-Error "❌ Erreur fatale: $_"
    exit 1
}

