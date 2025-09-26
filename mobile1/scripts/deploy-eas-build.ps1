# Script de déploiement EAS Build - Yukpomnang Mobile
# Usage: .\deploy-eas-build.ps1 -Platform [ios|android|all] -Profile [development|preview|production]

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("ios", "android", "all")]
    [string]$Platform,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("development", "preview", "production")]
    [string]$Profile = "preview"
)

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
    
    # Vérifier EAS CLI
    try {
        $easVersion = eas --version
        Write-Success "✅ EAS CLI: $easVersion"
    } catch {
        Write-Error "❌ EAS CLI non installé. Installez avec: npm install -g eas-cli"
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
    
    # Vérifier la connexion EAS
    try {
        $easWhoami = eas whoami
        Write-Success "✅ Connecté à EAS: $easWhoami"
    } catch {
        Write-Error "❌ Non connecté à EAS. Connectez-vous avec: eas login"
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
EXPO_PUBLIC_DEBUG_MODE=false
EXPO_PUBLIC_LOG_LEVEL=error
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

# Fonction pour configurer EAS
function Start-ConfigureEAS {
    Write-Info "⚙️ Configuration EAS..."
    
    try {
        # Vérifier si eas.json existe
        if (-not (Test-Path "eas.json")) {
            Write-Info "Configuration EAS..."
            eas build:configure
        } else {
            Write-Success "✅ Configuration EAS déjà présente"
        }
    } catch {
        Write-Error "❌ Erreur lors de la configuration EAS: $_"
        exit 1
    }
}

# Fonction pour construire l'application
function Start-BuildApplication {
    Write-Info "🏗️ Construction de l'application..."
    
    $buildCommand = "eas build --platform $Platform --profile $Profile"
    
    if ($Profile -eq "production") {
        $buildCommand += " --clear-cache"
    }
    
    Write-Info "Commande: $buildCommand"
    
    try {
        Invoke-Expression $buildCommand
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "✅ Build réussi"
        } else {
            Write-Error "❌ Build échoué"
            exit 1
        }
    } catch {
        Write-Error "❌ Erreur lors du build: $_"
        exit 1
    }
}

# Fonction pour afficher les instructions
function Show-Instructions {
    Write-Info "📱 Instructions pour EAS Build"
    Write-Info "=============================="
    Write-Info ""
    Write-Info "1. 📲 Téléchargez l'application:"
    Write-Info "   - Le build va générer un lien de téléchargement"
    Write-Info "   - Téléchargez l'APK (Android) ou utilisez TestFlight (iOS)"
    Write-Info ""
    Write-Info "2. 🔗 Partagez l'application:"
    Write-Info "   - Partagez le lien avec vos testeurs"
    Write-Info "   - L'application fonctionne sans Expo Go"
    Write-Info ""
    Write-Info "3. 🧪 Testez l'application:"
    Write-Info "   - Authentification (login/register)"
    Write-Info "   - Géolocalisation"
    Write-Info "   - Services et recherche"
    Write-Info "   - Chat IA"
    Write-Info ""
    Write-Info "4. 🔧 En cas de problème:"
    Write-Info "   - Vérifiez les logs de build"
    Write-Info "   - Consultez la documentation EAS"
    Write-Info "   - Contactez le support"
    Write-Info ""
}

# Fonction pour afficher le résumé
function Show-Summary {
    Write-Info "📊 Résumé du déploiement EAS Build"
    Write-Info "==================================="
    Write-Info ""
    Write-Info "✅ Application construite avec EAS Build"
    Write-Info "📱 Plateforme: $Platform"
    Write-Info "🔧 Profile: $Profile"
    Write-Info "🌐 URL de build: https://expo.dev/@your-username/yukpomnang"
    Write-Info ""
    Write-Info "🔗 Liens utiles:"
    Write-Info "   - EAS Build: https://docs.expo.dev/build"
    Write-Info "   - EAS Submit: https://docs.expo.dev/submit"
    Write-Info "   - Documentation Expo: https://docs.expo.dev"
    Write-Info ""
    Write-Info "📞 Support:"
    Write-Info "   - Email: support@yukpomnang.com"
    Write-Info "   - Discord: https://discord.gg/yukpomnang"
    Write-Info ""
}

# Fonction principale
function Main {
    Write-Info "🏗️ Déploiement EAS Build - Yukpomnang Mobile"
    Write-Info "============================================="
    
    # Afficher les instructions
    Show-Instructions
    
    # Demander confirmation
    $confirmation = Read-Host "Continuer avec le build EAS? (y/N)"
    if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
        Write-Info "Build annulé"
        exit 0
    }
    
    # Vérifier les prérequis
    Test-Prerequisites
    
    # Configurer l'environnement
    Set-Environment
    
    # Installer les dépendances
    Install-Dependencies
    
    # Configurer EAS
    Start-ConfigureEAS
    
    # Construire l'application
    Start-BuildApplication
    
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
