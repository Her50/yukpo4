# Script de vérification de l'environnement - Yukpomnang Mobile
# Usage: .\check-environment.ps1

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

# Fonction pour vérifier une commande
function Test-Command($Command, $InstallCommand) {
    try {
        $version = Invoke-Expression "$Command --version" 2>$null
        if ($version) {
            Write-Success "✅ $Command : $version"
            return $true
        } else {
            Write-Error "❌ $Command : Non installé"
            Write-Info "   Installation: $InstallCommand"
            return $false
        }
    } catch {
        Write-Error "❌ $Command : Non installé"
        Write-Info "   Installation: $InstallCommand"
        return $false
    }
}

# Fonction pour vérifier la connexion
function Test-Connection($Command, $LoginCommand) {
    try {
        $result = Invoke-Expression "$Command whoami" 2>$null
        if ($result) {
            Write-Success "✅ Connecté à $Command : $result"
            return $true
        } else {
            Write-Warning "⚠️ Non connecté à $Command"
            Write-Info "   Connexion: $LoginCommand"
            return $false
        }
    } catch {
        Write-Warning "⚠️ Non connecté à $Command"
        Write-Info "   Connexion: $LoginCommand"
        return $false
    }
}

# Fonction pour vérifier les fichiers
function Test-Files {
    Write-Info "📁 Vérification des fichiers..."
    
    $requiredFiles = @(
        "package.json",
        "app.json",
        "eas.json",
        "App.tsx",
        "src/contexts/AuthContext.tsx",
        "src/services/api.ts"
    )
    
    $missingFiles = @()
    
    foreach ($file in $requiredFiles) {
        if (Test-Path $file) {
            Write-Success "✅ $file"
        } else {
            Write-Error "❌ $file : Manquant"
            $missingFiles += $file
        }
    }
    
    if ($missingFiles.Count -gt 0) {
        Write-Error "❌ Fichiers manquants: $($missingFiles -join ', ')"
        return $false
    }
    
    return $true
}

# Fonction pour vérifier les variables d'environnement
function Test-Environment {
    Write-Info "🔧 Vérification des variables d'environnement..."
    
    $envFile = ".env"
    $configFile = "config.env"
    
    if (Test-Path $envFile) {
        Write-Success "✅ Fichier .env trouvé"
        
        # Vérifier les variables importantes
        $envContent = Get-Content $envFile
        $requiredVars = @(
            "EXPO_PUBLIC_API_BASE_URL",
            "EXPO_PUBLIC_APP_NAME"
        )
        
        foreach ($var in $requiredVars) {
            if ($envContent -match $var) {
                Write-Success "✅ $var configuré"
            } else {
                Write-Warning "⚠️ $var non configuré"
            }
        }
    } elseif (Test-Path $configFile) {
        Write-Warning "⚠️ Fichier .env manquant, mais config.env trouvé"
        Write-Info "   Copiez config.env vers .env et configurez les variables"
    } else {
        Write-Error "❌ Aucun fichier d'environnement trouvé"
        Write-Info "   Créez un fichier .env basé sur config.env"
    }
}

# Fonction pour vérifier les dépendances
function Test-Dependencies {
    Write-Info "📦 Vérification des dépendances..."
    
    if (Test-Path "package.json") {
        try {
            $packageJson = Get-Content "package.json" | ConvertFrom-Json
            Write-Success "✅ package.json valide"
            
            # Vérifier les dépendances importantes
            $importantDeps = @(
                "expo",
                "react",
                "react-native",
                "@react-navigation/native",
                "react-native-paper",
                "axios"
            )
            
            foreach ($dep in $importantDeps) {
                if ($packageJson.dependencies.$dep -or $packageJson.devDependencies.$dep) {
                    Write-Success "✅ $dep installé"
                } else {
                    Write-Warning "⚠️ $dep non trouvé"
                }
            }
        } catch {
            Write-Error "❌ Erreur lors de la lecture de package.json"
        }
    } else {
        Write-Error "❌ package.json manquant"
    }
}

# Fonction pour afficher le résumé
function Show-Summary($allGood) {
    Write-Info "📊 Résumé de la vérification"
    Write-Info "============================"
    
    if ($allGood) {
        Write-Success "🎉 Environnement prêt pour le développement!"
        Write-Info ""
        Write-Info "Prochaines étapes:"
        Write-Info "1. Configurez les credentials: .\setup-credentials.ps1"
        Write-Info "2. Testez l'application: npm run start"
        Write-Info "3. Déployez: .\deploy.ps1 -Platform all"
    } else {
        Write-Error "❌ Environnement non configuré"
        Write-Info ""
        Write-Info "Actions requises:"
        Write-Info "1. Installez les outils manquants"
        Write-Info "2. Connectez-vous aux services"
        Write-Info "3. Configurez les variables d'environnement"
        Write-Info "4. Relancez ce script"
    }
}

# Fonction principale
function Main {
    Write-Info "🔍 Vérification de l'Environnement - Yukpomnang Mobile"
    Write-Info "====================================================="
    
    $allGood = $true
    
    # Vérifier les outils
    Write-Info "🛠️ Vérification des outils..."
    $allGood = (Test-Command "node" "Téléchargez depuis nodejs.org") -and $allGood
    $allGood = (Test-Command "npm" "Inclus avec Node.js") -and $allGood
    $allGood = (Test-Command "expo" "npm install -g @expo/cli") -and $allGood
    $allGood = (Test-Command "eas" "npm install -g eas-cli") -and $allGood
    $allGood = (Test-Command "git" "Téléchargez depuis git-scm.com") -and $allGood
    
    # Vérifier les connexions
    Write-Info "🔐 Vérification des connexions..."
    $allGood = (Test-Connection "expo" "expo login") -and $allGood
    $allGood = (Test-Connection "eas" "eas login") -and $allGood
    
    # Vérifier les fichiers
    $allGood = (Test-Files) -and $allGood
    
    # Vérifier les dépendances
    Test-Dependencies
    
    # Vérifier l'environnement
    Test-Environment
    
    # Afficher le résumé
    Show-Summary $allGood
}

# Exécution
try {
    Main
} catch {
    Write-Error "❌ Erreur fatale: $_"
    exit 1
}
