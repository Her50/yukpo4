# Script de build rapide APK - Yukpomnang Mobile
# Usage: .\quick-build-apk.ps1

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

# Fonction pour afficher les instructions
function Show-Instructions {
    Write-Info "🏗️ Build Rapide APK - Yukpomnang Mobile"
    Write-Info "========================================"
    Write-Info ""
    Write-Info "🚀 Ce script va construire un APK de production"
    Write-Info ""
    Write-Info "📱 L'APK sera:"
    Write-Info "- Optimisé pour la production"
    Write-Info "- Prêt à partager avec d'autres personnes"
    Write-Info "- Compatible avec tous les appareils Android"
    Write-Info ""
    Write-Info "⏱️ Temps estimé: 10-15 minutes"
    Write-Info ""
    Write-Info "🔗 Après le build, vous recevrez:"
    Write-Info "- Un lien de téléchargement de l'APK"
    Write-Info "- Des instructions de partage"
    Write-Info "- Un guide d'installation pour les testeurs"
    Write-Info ""
}

# Fonction pour configurer rapidement
function Start-QuickSetup {
    Write-Info "⚡ Configuration rapide..."
    
    # Copier le fichier de configuration
    if (Test-Path "mobile.env") {
        Copy-Item "mobile.env" ".env" -Force
        Write-Success "✅ Configuration copiée"
    } else {
        Write-Error "❌ Fichier mobile.env non trouvé"
        exit 1
    }
    
    # Vérifier la connexion
    try {
        $expoWhoami = expo whoami
        Write-Success "✅ Connecté à Expo: $expoWhoami"
    } catch {
        Write-Error "❌ Non connecté à Expo. Connectez-vous avec: expo login"
        exit 1
    }
    
    try {
        $easWhoami = eas whoami
        Write-Success "✅ Connecté à EAS: $easWhoami"
    } catch {
        Write-Error "❌ Non connecté à EAS. Connectez-vous avec: eas login"
        exit 1
    }
}

# Fonction pour build rapide
function Start-QuickBuild {
    Write-Info "🏗️ Build rapide en cours..."
    
    try {
        # Build de production pour Android
        Write-Info "Construction de l'APK de production..."
        eas build --platform android --profile production --clear-cache
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "✅ Build réussi !"
        } else {
            Write-Error "❌ Build échoué"
            exit 1
        }
    } catch {
        Write-Error "❌ Erreur lors du build: $_"
        exit 1
    }
}

# Fonction pour afficher les résultats
function Show-Results {
    Write-Info "🎉 Build terminé avec succès !"
    Write-Info "=============================="
    Write-Info ""
    Write-Info "📱 Votre APK est prêt à être partagé !"
    Write-Info ""
    Write-Info "📲 Prochaines étapes:"
    Write-Info "1. Téléchargez l'APK depuis le lien fourni"
    Write-Info "2. Partagez le fichier APK avec vos testeurs"
    Write-Info "3. Les testeurs peuvent installer l'APK directement"
    Write-Info ""
    Write-Info "⚠️ Instructions pour les testeurs:"
    Write-Info "- Autoriser l'installation d'applications inconnues"
    Write-Info "- Android: Paramètres > Sécurité > Sources inconnues"
    Write-Info "- Télécharger et installer l'APK"
    Write-Info ""
    Write-Info "🔗 Liens utiles:"
    Write-Info "- EAS Build: https://expo.dev/build"
    Write-Info "- Documentation: https://docs.expo.dev/build"
    Write-Info ""
    Write-Info "📞 Support:"
    Write-Info "- Email: support@yukpomnang.com"
    Write-Info "- Discord: https://discord.gg/yukpomnang"
    Write-Info ""
}

# Fonction principale
function Main {
    # Afficher les instructions
    Show-Instructions
    
    # Demander confirmation
    $confirmation = Read-Host "Continuer avec le build rapide? (y/N)"
    if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
        Write-Info "Build annulé"
        exit 0
    }
    
    # Configuration rapide
    Start-QuickSetup
    
    # Build rapide
    Start-QuickBuild
    
    # Afficher les résultats
    Show-Results
}

# Exécution
try {
    Main
} catch {
    Write-Error "❌ Erreur fatale: $_"
    exit 1
}
