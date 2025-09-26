# Script de démarrage rapide - Yukpomnang Mobile
# Usage: .\quick-start.ps1

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

# Fonction pour afficher le menu
function Show-Menu {
    Write-Info "🚀 Yukpomnang Mobile - Démarrage Rapide"
    Write-Info "======================================="
    Write-Info ""
    Write-Info "Choisissez une option:"
    Write-Info "1. 📱 Démarrer sur Expo Go"
    Write-Info "2. 🏗️ Build avec EAS"
    Write-Info "3. 🧪 Tests automatiques"
    Write-Info "4. 🔧 Configuration"
    Write-Info "5. 📚 Aide"
    Write-Info "6. ❌ Quitter"
    Write-Info ""
}

# Fonction pour démarrer sur Expo Go
function Start-ExpoGo {
    Write-Info "📱 Démarrage sur Expo Go..."
    
    try {
        & ".\start-app.ps1"
    }
    catch {
        Write-Error "❌ Erreur lors du démarrage: $_"
    }
}

# Fonction pour build avec EAS
function Start-BuildEAS {
    Write-Info "🏗️ Build avec EAS..."
    
    $platform = Read-Host "Plateforme (ios/android/all) [android]"
    if (-not $platform) { $platform = "android" }
    
    try {
        & ".\deploy-eas-build.ps1" -Platform $platform -Profile preview
    }
    catch {
        Write-Error "❌ Erreur lors du build: $_"
    }
}

# Fonction pour tests automatiques
function Start-RunTests {
    Write-Info "🧪 Tests automatiques..."
    
    try {
        & ".\test-app.ps1"
    }
    catch {
        Write-Error "❌ Erreur lors des tests: $_"
    }
}

# Fonction pour configuration
function Start-ConfigureApp {
    Write-Info "🔧 Configuration..."
    
    try {
        & ".\quick-deploy.ps1"
    }
    catch {
        Write-Error "❌ Erreur lors de la configuration: $_"
    }
}

# Fonction pour afficher l'aide
function Show-Help {
    Write-Info "📚 Aide - Yukpomnang Mobile"
    Write-Info "==========================="
    Write-Info ""
    Write-Info "📱 Expo Go:"
    Write-Info "  - Démarrage rapide pour les tests"
    Write-Info "  - Pas de build nécessaire"
    Write-Info "  - Accessible via l'app Expo Go"
    Write-Info ""
    Write-Info "🏗️ EAS Build:"
    Write-Info "  - Build natif (APK/IPA)"
    Write-Info "  - Performance optimale"
    Write-Info "  - Distribution facile"
    Write-Info ""
    Write-Info "🧪 Tests:"
    Write-Info "  - Tests automatiques"
    Write-Info "  - Vérification de la configuration"
    Write-Info "  - Validation du code"
    Write-Info ""
    Write-Info "🔧 Configuration:"
    Write-Info "  - Configuration des clés API"
    Write-Info "  - Paramètres d'environnement"
    Write-Info "  - Déploiement"
    Write-Info ""
    Write-Info "📖 Documentation:"
    Write-Info "  - README.md"
    Write-Info "  - QUICK_DEPLOYMENT.md"
    Write-Info "  - API_CONFIGURATION.md"
    Write-Info "  - TEST_GUIDE.md"
    Write-Info ""
}

# Fonction principale
function Main {
    do {
        Clear-Host
        Show-Menu
        
        $choice = Read-Host "Votre choix [1-6]"
        
        switch ($choice) {
            "1" { Start-ExpoGo }
            "2" { Start-BuildEAS }
            "3" { Start-RunTests }
            "4" { Start-ConfigureApp }
            "5" { Show-Help }
            "6" { 
                Write-Info "👋 Au revoir!"
                exit 0
            }
            default { 
                Write-Warning "⚠️ Choix invalide"
            }
        }
        
        if ($choice -ne "6") {
            Write-Info ""
            Read-Host "Appuyez sur Entrée pour continuer"
        }
    } while ($choice -ne "6")
}

# Exécution
try {
    Main
}
catch {
    Write-Error "❌ Erreur fatale: $_"
    exit 1
}