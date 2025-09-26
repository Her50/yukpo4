# Script de déploiement complet - Yukpomnang Mobile
# Usage: .\deploy.ps1 -Platform [ios|android|all] -Profile [development|preview|production] -Submit [true|false]

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("ios", "android", "all")]
    [string]$Platform,
    
    [Parameter(Mandatory = $false)]
    [ValidateSet("development", "preview", "production")]
    [string]$Profile = "production",
    
    [Parameter(Mandatory = $false)]
    [bool]$Submit = $false,
    
    [Parameter(Mandatory = $false)]
    [bool]$SkipTests = $false
)

# Configuration
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

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
    
    # Vérifier Expo CLI
    try {
        $expoVersion = expo --version
        Write-Success "✅ Expo CLI: $expoVersion"
    }
    catch {
        Write-Error "❌ Expo CLI non installé. Installez avec: npm install -g @expo/cli"
        exit 1
    }
    
    # Vérifier EAS CLI
    try {
        $easVersion = eas --version
        Write-Success "✅ EAS CLI: $easVersion"
    }
    catch {
        Write-Error "❌ EAS CLI non installé. Installez avec: npm install -g eas-cli"
        exit 1
    }
    
    # Vérifier Git
    try {
        $gitVersion = git --version
        Write-Success "✅ Git: $gitVersion"
    }
    catch {
        Write-Error "❌ Git non installé"
        exit 1
    }
    
    # Vérifier la connexion Expo
    try {
        $expoWhoami = expo whoami
        Write-Success "✅ Connecté à Expo: $expoWhoami"
    }
    catch {
        Write-Error "❌ Non connecté à Expo. Connectez-vous avec: expo login"
        exit 1
    }
    
    # Vérifier la connexion EAS
    try {
        $easWhoami = eas whoami
        Write-Success "✅ Connecté à EAS: $easWhoami"
    }
    catch {
        Write-Error "❌ Non connecté à EAS. Connectez-vous avec: eas login"
        exit 1
    }
}

# Fonction pour exécuter les tests
function Invoke-Tests {
    if ($SkipTests) {
        Write-Warning "⚠️ Tests ignorés"
        return
    }
    
    Write-Info "🧪 Exécution des tests..."
    
    try {
        # Tests TypeScript
        Write-Info "📝 Vérification TypeScript..."
        npx tsc --noEmit
        
        # Tests ESLint
        Write-Info "🔍 Vérification ESLint..."
        npx eslint src/ --ext .ts, .tsx
        
        # Tests de build
        Write-Info "🏗️ Test de build..."
        expo export --platform web
        
        Write-Success "✅ Tous les tests passent"
    }
    catch {
        Write-Error "❌ Tests échoués"
        exit 1
    }
}

# Fonction pour construire l'application
function Invoke-Build {
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
        }
        else {
            Write-Error "❌ Build échoué"
            exit 1
        }
    }
    catch {
        Write-Error "❌ Erreur lors du build: $_"
        exit 1
    }
}

# Fonction pour soumettre l'application
function Invoke-Submit {
    if (-not $Submit) {
        Write-Info "ℹ️ Soumission ignorée (utilisez -Submit pour soumettre)"
        return
    }
    
    Write-Info "📤 Soumission de l'application..."
    
    try {
        $submitCommand = "eas submit --platform $Platform --latest"
        Write-Info "Commande: $submitCommand"
        
        Invoke-Expression $submitCommand
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "✅ Soumission réussie"
        }
        else {
            Write-Error "❌ Soumission échouée"
            exit 1
        }
    }
    catch {
        Write-Error "❌ Erreur lors de la soumission: $_"
        exit 1
    }
}

# Fonction pour afficher le résumé
function Show-Summary {
    Write-Info "📊 Résumé du déploiement"
    Write-Info "Platform: $Platform"
    Write-Info "Profile: $Profile"
    Write-Info "Submit: $Submit"
    Write-Info "Tests: $(-not $SkipTests)"
    
    if ($Submit) {
        Write-Success "🎉 Déploiement complet terminé!"
        Write-Info "Vérifiez les stores dans 24-48h pour iOS, 1-3 jours pour Android"
    }
    else {
        Write-Success "🎉 Build terminé!"
        Write-Info "Utilisez -Submit pour soumettre aux stores"
    }
}

# Fonction principale
function Main {
    Write-Info "🚀 Déploiement Yukpomnang Mobile"
    Write-Info "=================================="
    
    # Vérifier les prérequis
    Test-Prerequisites
    
    # Exécuter les tests
    Invoke-Tests
    
    # Construire l'application
    Invoke-Build
    
    # Soumettre l'application
    Invoke-Submit
    
    # Afficher le résumé
    Show-Summary
}

# Exécution
try {
    Main
}
catch {
    Write-Error "❌ Erreur fatale: $_"
    exit 1
}

