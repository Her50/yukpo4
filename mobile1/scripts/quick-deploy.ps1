# Script de déploiement rapide - Yukpomnang Mobile
# Usage: .\quick-deploy.ps1

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

# Fonction pour afficher le menu
function Show-Menu {
    Write-Info "🚀 Yukpomnang Mobile - Déploiement Rapide"
    Write-Info "=========================================="
    Write-Info ""
    Write-Info "Choisissez une option de déploiement:"
    Write-Info "1. 📱 Expo Go (Recommandé pour les tests)"
    Write-Info "2. 🏗️ EAS Build (Build natif)"
    Write-Info "3. 🔧 Configuration des clés API"
    Write-Info "4. 📚 Afficher l'aide"
    Write-Info "5. ❌ Quitter"
    Write-Info ""
}

# Fonction pour déployer sur Expo Go
function Start-DeployExpoGo {
    Write-Info "📱 Déploiement sur Expo Go..."
    
    try {
        & ".\deploy-expo-go.ps1"
    } catch {
        Write-Error "❌ Erreur lors du déploiement Expo Go: $_"
    }
}

# Fonction pour déployer avec EAS Build
function Start-DeployEASBuild {
    Write-Info "🏗️ Déploiement avec EAS Build..."
    
    $platform = Read-Host "Plateforme (ios/android/all) [android]"
    if (-not $platform) { $platform = "android" }
    
    $buildProfile = Read-Host "Profile (development/preview/production) [preview]"
    if (-not $buildProfile) { $buildProfile = "preview" }
    
    try {
        & ".\deploy-eas-build.ps1" -Platform $platform -Profile $buildProfile
    } catch {
        Write-Error "❌ Erreur lors du déploiement EAS Build: $_"
    }
}

# Fonction pour configurer les clés API
function Start-ConfigureAPIKeys {
    Write-Info "🔧 Configuration des clés API..."
    
    # Copier le fichier de configuration
    if (Test-Path "mobile.env") {
        Copy-Item "mobile.env" ".env" -Force
        Write-Success "✅ Fichier .env configuré"
    } else {
        Write-Warning "⚠️ Fichier mobile.env non trouvé"
    }
    
    Write-Info "📝 Éditez le fichier .env avec vos clés API:"
    Write-Info "   - EXPO_PUBLIC_API_BASE_URL"
    Write-Info "   - EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY"
    Write-Info "   - EXPO_PUBLIC_GOOGLE_MAPS_API_KEY"
    Write-Info "   - EXPO_PUBLIC_WS_URL"
    Write-Info ""
    
    $openEditor = Read-Host "Ouvrir l'éditeur pour configurer les clés? (y/N)"
    if ($openEditor -eq 'y' -or $openEditor -eq 'Y') {
        try {
            notepad .env
        } catch {
            Write-Warning "⚠️ Impossible d'ouvrir l'éditeur. Éditez manuellement le fichier .env"
        }
    }
}

# Fonction pour afficher l'aide
function Show-Help {
    Write-Info "📚 Aide - Déploiement Rapide"
    Write-Info "============================="
    Write-Info ""
    Write-Info "📱 Expo Go (Option 1):"
    Write-Info "  - Gratuit et facile d'accès"
    Write-Info "  - Pas de build nécessaire"
    Write-Info "  - Tests instantanés sur téléphone"
    Write-Info "  - Partage facile avec testeurs"
    Write-Info ""
    Write-Info "🏗️ EAS Build (Option 2):"
    Write-Info "  - Application native (APK/IPA)"
    Write-Info "  - Performance optimale"
    Write-Info "  - Pas besoin d'Expo Go"
    Write-Info "  - Distribution facile"
    Write-Info ""
    Write-Info "🔧 Configuration (Option 3):"
    Write-Info "  - Configure les clés API"
    Write-Info "  - Édite le fichier .env"
    Write-Info "  - Prépare l'environnement"
    Write-Info ""
    Write-Info "📖 Documentation:"
    Write-Info "  - QUICK_DEPLOYMENT.md"
    Write-Info "  - API_CONFIGURATION.md"
    Write-Info "  - DEPLOYMENT_GUIDE.md"
    Write-Info ""
    Write-Info "🌐 Liens utiles:"
    Write-Info "  - Expo Go iOS: https://apps.apple.com/app/expo-go/id982107779"
    Write-Info "  - Expo Go Android: https://play.google.com/store/apps/details?id=host.exp.exponent"
    Write-Info "  - Documentation Expo: https://docs.expo.dev"
    Write-Info ""
}

# Fonction principale
function Main {
    do {
        Clear-Host
        Show-Menu
        
        $choice = Read-Host "Votre choix [1-5]"
        
        switch ($choice) {
            "1" { Start-DeployExpoGo }
            "2" { Start-DeployEASBuild }
            "3" { Start-ConfigureAPIKeys }
            "4" { Show-Help }
            "5" { 
                Write-Info "👋 Au revoir!"
                exit 0
            }
            default { 
                Write-Warning "⚠️ Choix invalide"
            }
        }
        
        if ($choice -ne "5") {
            Write-Info ""
            Read-Host "Appuyez sur Entrée pour continuer"
        }
    } while ($choice -ne "5")
}

# Exécution
try {
    Main
} catch {
    Write-Error "❌ Erreur fatale: $_"
    exit 1
}
