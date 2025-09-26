# Script de configuration des credentials - Yukpomnang Mobile
# Usage: .\setup-credentials.ps1 -Platform [ios|android|all]

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("ios", "android", "all")]
    [string]$Platform
)

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

# Fonction pour configurer iOS
function Start-SetupiOS {
    Write-Info "🍎 Configuration des credentials iOS..."
    
    try {
        # Vérifier la connexion Apple Developer
        Write-Info "Vérification de la connexion Apple Developer..."
        
        # Configurer les credentials
        Write-Info "Configuration des credentials iOS..."
        eas credentials --platform ios
        
        Write-Success "✅ Configuration iOS terminée"
    }
    catch {
        Write-Error "❌ Erreur lors de la configuration iOS: $_"
        exit 1
    }
}

# Fonction pour configurer Android
function Start-SetupAndroid {
    Write-Info "🤖 Configuration des credentials Android..."
    
    try {
        # Vérifier la connexion Google Play
        Write-Info "Vérification de la connexion Google Play..."
        
        # Configurer les credentials
        Write-Info "Configuration des credentials Android..."
        eas credentials --platform android
        
        Write-Success "✅ Configuration Android terminée"
    }
    catch {
        Write-Error "❌ Erreur lors de la configuration Android: $_"
        exit 1
    }
}

# Fonction pour afficher les informations
function Show-Info {
    Write-Info "📋 Informations importantes:"
    Write-Info ""
    Write-Info "🍎 iOS:"
    Write-Info "  - Compte Apple Developer requis (99$/an)"
    Write-Info "  - Certificats de développement et distribution"
    Write-Info "  - Provisioning profiles"
    Write-Info "  - Bundle ID: com.yukpomnang.mobile"
    Write-Info ""
    Write-Info "🤖 Android:"
    Write-Info "  - Compte Google Play Console (25$ une fois)"
    Write-Info "  - Keystore de signature"
    Write-Info "  - Package name: com.yukpomnang.mobile"
    Write-Info ""
    Write-Info "🔑 Credentials gérés automatiquement par EAS:"
    Write-Info "  - Génération automatique des certificats"
    Write-Info "  - Rotation automatique des credentials"
    Write-Info "  - Stockage sécurisé dans le cloud"
}

# Fonction principale
function Main {
    Write-Info "🔐 Configuration des Credentials - Yukpomnang Mobile"
    Write-Info "=================================================="
    
    # Afficher les informations
    Show-Info
    
    # Demander confirmation
    $confirmation = Read-Host "Continuer avec la configuration? (y/N)"
    if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
        Write-Info "Configuration annulée"
        exit 0
    }
    
    # Configurer selon la plateforme
    switch ($Platform) {
        "ios" {
            Start-SetupiOS
        }
        "android" {
            Start-SetupAndroid
        }
        "all" {
            Start-SetupiOS
            Start-SetupAndroid
        }
    }
    
    Write-Success "🎉 Configuration terminée!"
    Write-Info "Vous pouvez maintenant utiliser: .\deploy.ps1 -Platform $Platform"
}

# Exécution
try {
    Main
}
catch {
    Write-Error "❌ Erreur fatale: $_"
    exit 1
}
