# Script de démarrage rapide - Yukpomnang Mobile
# Usage: .\start-app.ps1

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
    Write-Info "📱 Yukpomnang Mobile - Démarrage Rapide"
    Write-Info "======================================="
    Write-Info ""
    Write-Info "🚀 L'application va démarrer sur Expo Go"
    Write-Info ""
    Write-Info "📲 Étapes suivantes:"
    Write-Info "1. Téléchargez Expo Go sur votre téléphone"
    Write-Info "2. Scannez le QR code qui va apparaître"
    Write-Info "3. Testez l'application sur votre téléphone"
    Write-Info ""
    Write-Info "🔗 Liens utiles:"
    Write-Info "   - Expo Go iOS: https://apps.apple.com/app/expo-go/id982107779"
    Write-Info "   - Expo Go Android: https://play.google.com/store/apps/details?id=host.exp.exponent"
    Write-Info ""
    Write-Info "⏹️ Appuyez sur Ctrl+C pour arrêter l'application"
    Write-Info ""
}

# Fonction pour configurer l'environnement
function Set-Environment {
    Write-Info "🔧 Configuration de l'environnement..."
    
    # Copier le fichier de configuration
    if (Test-Path "mobile.env") {
        Copy-Item "mobile.env" ".env" -Force
        Write-Success "✅ Fichier .env configuré"
    }
    else {
        Write-Warning "⚠️ Fichier mobile.env non trouvé"
    }
}

# Fonction pour installer les dépendances
function Install-Dependencies {
    Write-Info "📦 Vérification des dépendances..."
    
    if (-not (Test-Path "node_modules")) {
        Write-Info "Installation des dépendances..."
        npm install
        Write-Success "✅ Dépendances installées"
    }
    else {
        Write-Success "✅ Dépendances déjà installées"
    }
}

# Fonction pour démarrer l'application
function Start-Application {
    Write-Info "🚀 Démarrage de l'application..."
    
    try {
        # Démarrer Expo
        expo start --tunnel
    }
    catch {
        Write-Error "❌ Erreur lors du démarrage: $_"
        exit 1
    }
}

# Fonction principale
function Main {
    # Afficher les instructions
    Show-Instructions
    
    # Demander confirmation
    $confirmation = Read-Host "Continuer avec le démarrage? (y/N)"
    if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
        Write-Info "Démarrage annulé"
        exit 0
    }
    
    # Configurer l'environnement
    Set-Environment
    
    # Installer les dépendances
    Install-Dependencies
    
    # Démarrer l'application
    Start-Application
}

# Exécution
try {
    Main
}
catch {
    Write-Error "❌ Erreur fatale: $_"
    exit 1
}

