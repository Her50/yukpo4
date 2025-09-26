# Script de build de production APK - Yukpomnang Mobile
# Usage: .\build-production-apk.ps1

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

# Fonction pour configurer l'environnement de production
function Set-ProductionEnvironment {
    Write-Info "🔧 Configuration de l'environnement de production..."
    
    # Copier le fichier de configuration
    if (Test-Path "mobile.env") {
        Copy-Item "mobile.env" ".env" -Force
        Write-Success "✅ Fichier .env configuré"
    } else {
        Write-Error "❌ Fichier mobile.env non trouvé"
        exit 1
    }
    
    # Vérifier que les clés API sont configurées
    $envContent = Get-Content ".env"
    $requiredKeys = @(
        "EXPO_PUBLIC_API_BASE_URL",
        "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY",
        "EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY"
    )
    
    foreach ($key in $requiredKeys) {
        if ($envContent -match $key -and $envContent -notmatch "$key=your_.*_here") {
            Write-Success "✅ $key configuré"
        } else {
            Write-Error "❌ $key non configuré ou utilise une valeur par défaut"
            exit 1
        }
    }
}

# Fonction pour installer les dépendances
function Install-Dependencies {
    Write-Info "📦 Installation des dépendances..."
    
    try {
        # Nettoyer le cache npm
        npm cache clean --force
        
        # Supprimer node_modules et package-lock.json
        if (Test-Path "node_modules") {
            Remove-Item -Recurse -Force "node_modules"
        }
        if (Test-Path "package-lock.json") {
            Remove-Item -Force "package-lock.json"
        }
        
        # Installer les dépendances
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
        
        # Configurer les credentials Android
        Write-Info "Configuration des credentials Android..."
        eas credentials --platform android
    } catch {
        Write-Error "❌ Erreur lors de la configuration EAS: $_"
        exit 1
    }
}

# Fonction pour construire l'APK de production
function Start-BuildProductionAPK {
    Write-Info "🏗️ Construction de l'APK de production..."
    
    try {
        # Build de production pour Android
        $buildCommand = "eas build --platform android --profile production --clear-cache"
        Write-Info "Commande: $buildCommand"
        
        Invoke-Expression $buildCommand
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "✅ Build de production réussi"
        } else {
            Write-Error "❌ Build de production échoué"
            exit 1
        }
    } catch {
        Write-Error "❌ Erreur lors du build: $_"
        exit 1
    }
}

# Fonction pour afficher les instructions de partage
function Show-SharingInstructions {
    Write-Info "📱 Instructions de partage de l'APK"
    Write-Info "==================================="
    Write-Info ""
    Write-Info "🎉 Votre APK de production est prêt !"
    Write-Info ""
    Write-Info "📲 Comment partager l'APK:"
    Write-Info "1. Téléchargez l'APK depuis le lien fourni par EAS"
    Write-Info "2. Partagez le fichier APK avec vos testeurs"
    Write-Info "3. Les testeurs peuvent installer l'APK directement"
    Write-Info ""
    Write-Info "⚠️ Important pour les testeurs:"
    Write-Info "- Autoriser l'installation d'applications inconnues"
    Write-Info "- Android: Paramètres > Sécurité > Sources inconnues"
    Write-Info "- iOS: L'APK ne fonctionne que sur Android"
    Write-Info ""
    Write-Info "🔗 Liens utiles:"
    Write-Info "- EAS Build: https://expo.dev/build"
    Write-Info "- Documentation: https://docs.expo.dev/build"
    Write-Info ""
}

# Fonction pour afficher le résumé
function Show-Summary {
    Write-Info "📊 Résumé du build de production"
    Write-Info "================================="
    Write-Info ""
    Write-Info "✅ APK de production construit avec succès"
    Write-Info "📱 Plateforme: Android"
    Write-Info "🔧 Profile: Production"
    Write-Info "🌐 URL de build: https://expo.dev/@your-username/yukpomnang"
    Write-Info ""
    Write-Info "📞 Support:"
    Write-Info "   - Email: support@yukpomnang.com"
    Write-Info "   - Discord: https://discord.gg/yukpomnang"
    Write-Info ""
}

# Fonction principale
function Main {
    Write-Info "🏗️ Build de Production APK - Yukpomnang Mobile"
    Write-Info "=============================================="
    Write-Info ""
    
    # Afficher les instructions
    Show-SharingInstructions
    
    # Demander confirmation
    $confirmation = Read-Host "Continuer avec le build de production? (y/N)"
    if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
        Write-Info "Build annulé"
        exit 0
    }
    
    # Vérifier les prérequis
    Test-Prerequisites
    
    # Configurer l'environnement de production
    Set-ProductionEnvironment
    
    # Installer les dépendances
    Install-Dependencies
    
    # Configurer EAS
    Start-ConfigureEAS
    
    # Construire l'APK de production
    Start-BuildProductionAPK
    
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
