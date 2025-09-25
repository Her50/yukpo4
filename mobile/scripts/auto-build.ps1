# Script de build automatique pour l'application mobile
# Ce script transforme le frontend en mobile, puis build l'application

param(
    [switch]$Clean,
    [switch]$Transform,
    [switch]$Build,
    [switch]$Install,
    [string]$Platform = "android"
)

$MobilePath = Join-Path $PSScriptRoot ".."
$FrontendPath = Join-Path $PSScriptRoot "../../frontend"

Write-Host "🚀 Script de build automatique mobile" -ForegroundColor Cyan
Write-Host "📱 Plateforme cible : $Platform" -ForegroundColor Yellow

# Fonction pour nettoyer
function Clean-Build {
    Write-Host "🧹 Nettoyage des fichiers de build..." -ForegroundColor Yellow
    
    # Nettoyer les node_modules
    if (Test-Path (Join-Path $MobilePath "node_modules")) {
        Write-Host "Suppression de node_modules..." -ForegroundColor Yellow
        Remove-Item (Join-Path $MobilePath "node_modules") -Recurse -Force
    }
    
    # Nettoyer les fichiers de build
    $BuildPaths = @(
        (Join-Path $MobilePath "android/app/build"),
        (Join-Path $MobilePath "ios/build"),
        (Join-Path $MobilePath ".expo"),
        (Join-Path $MobilePath "dist")
    )
    
    foreach ($BuildPath in $BuildPaths) {
        if (Test-Path $BuildPath) {
            Write-Host "Suppression de $BuildPath..." -ForegroundColor Yellow
            Remove-Item $BuildPath -Recurse -Force
        }
    }
    
    Write-Host "✅ Nettoyage terminé" -ForegroundColor Green
}

# Fonction pour transformer le frontend
function Transform-Frontend {
    Write-Host "🔄 Transformation du frontend vers mobile..." -ForegroundColor Yellow
    
    $TransformScript = Join-Path $PSScriptRoot "auto-transform.ps1"
    if (Test-Path $TransformScript) {
        & $TransformScript
        Write-Host "✅ Transformation terminée" -ForegroundColor Green
    } else {
        Write-Host "❌ Script de transformation non trouvé" -ForegroundColor Red
        return $false
    }
    
    return $true
}

# Fonction pour installer les dépendances
function Install-Dependencies {
    Write-Host "📦 Installation des dépendances..." -ForegroundColor Yellow
    
    Set-Location $MobilePath
    
    try {
        # Installer les dépendances npm
        Write-Host "Installation des packages npm..." -ForegroundColor Yellow
        npm install
        
        # Installer les dépendances Expo
        Write-Host "Installation des dépendances Expo..." -ForegroundColor Yellow
        npx expo install --fix
        
        Write-Host "✅ Installation des dépendances terminée" -ForegroundColor Green
        return $true
}
catch {
        Write-Host "❌ Erreur lors de l'installation : $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Fonction pour builder l'application
function Build-Application {
    param(
        [string]$Platform
    )
    
    Write-Host "🔨 Build de l'application pour $Platform..." -ForegroundColor Yellow
    
    Set-Location $MobilePath
    
    try {
        if ($Platform -eq "android") {
            # Build Android
            Write-Host "Build Android..." -ForegroundColor Yellow
            npx expo build:android --type apk
            
        } elseif ($Platform -eq "ios") {
            # Build iOS
            Write-Host "Build iOS..." -ForegroundColor Yellow
            npx expo build:ios
            
        } else {
            Write-Host "❌ Plateforme non supportée : $Platform" -ForegroundColor Red
            return $false
        }
        
        Write-Host "✅ Build terminé avec succès" -ForegroundColor Green
        return $true
}
catch {
        Write-Host "❌ Erreur lors du build : $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Fonction pour démarrer l'application en mode développement
function Start-Development {
    Write-Host "🚀 Démarrage en mode développement..." -ForegroundColor Yellow
    
    Set-Location $MobilePath
    
    try {
        # Démarrer Expo
        Write-Host "Démarrage d'Expo..." -ForegroundColor Yellow
        npx expo start
        
        Write-Host "✅ Application démarrée en mode développement" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ Erreur lors du démarrage : $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Fonction principale
function Main {
    Write-Host "🚀 Démarrage du build automatique..." -ForegroundColor Green
    
    # Nettoyage si demandé
    if ($Clean) {
        Clean-Build
    }
    
    # Transformation si demandée
    if ($Transform) {
        if (-not (Transform-Frontend)) {
            Write-Host "❌ Échec de la transformation" -ForegroundColor Red
            exit 1
        }
    }
    
    # Installation des dépendances si demandée
    if ($Install) {
        if (-not (Install-Dependencies)) {
            Write-Host "❌ Échec de l'installation des dépendances" -ForegroundColor Red
            exit 1
        }
    }
    
    # Build si demandé
    if ($Build) {
        if (-not (Build-Application $Platform)) {
            Write-Host "❌ Échec du build" -ForegroundColor Red
            exit 1
        }
    }
    
    # Si aucun paramètre spécifique, démarrer en mode développement
    if (-not $Clean -and -not $Transform -and -not $Build -and -not $Install) {
        Start-Development
    }
    
    Write-Host "`n🎉 Processus terminé avec succès !" -ForegroundColor Green
}

# Exécuter la fonction principale
Main