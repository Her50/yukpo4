# Script de génération des screenshots - Yukpomnang Mobile
# Usage: .\generate-screenshots.ps1

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

# Fonction pour créer les dossiers
function New-ScreenshotDirectories {
    Write-Info "📁 Création des dossiers de screenshots..."
    
    $directories = @(
        "screenshots/ios/iphone",
        "screenshots/ios/ipad",
        "screenshots/android/phone",
        "screenshots/android/tablet"
    )
    
    foreach ($dir in $directories) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Success "✅ Créé: $dir"
        } else {
            Write-Info "ℹ️ Existe déjà: $dir"
        }
    }
}

# Fonction pour générer les screenshots iOS
function New-iOSScreenshots {
    Write-Info "📱 Génération des screenshots iOS..."
    
    # Démarrer l'application en mode iOS
    Write-Info "Démarrage de l'application iOS..."
    Start-Process -FilePath "expo" -ArgumentList "start", "--ios" -NoNewWindow -Wait
    
    Write-Info "📸 Prenez les screenshots suivants:"
    Write-Info "1. Écran d'accueil (HomeScreen)"
    Write-Info "2. Liste des services (ServicesScreen)"
    Write-Info "3. Chat IA (AIChatScreen)"
    Write-Info "4. Profil utilisateur (ProfileScreen)"
    Write-Info "5. Recherche (SearchScreen)"
    
    Write-Warning "⚠️ Sauvegardez les screenshots dans:"
    Write-Info "   iPhone: screenshots/ios/iphone/"
    Write-Info "   iPad: screenshots/ios/ipad/"
}

# Fonction pour générer les screenshots Android
function New-AndroidScreenshots {
    Write-Info "🤖 Génération des screenshots Android..."
    
    # Démarrer l'application en mode Android
    Write-Info "Démarrage de l'application Android..."
    Start-Process -FilePath "expo" -ArgumentList "start", "--android" -NoNewWindow -Wait
    
    Write-Info "📸 Prenez les screenshots suivants:"
    Write-Info "1. Écran d'accueil (HomeScreen)"
    Write-Info "2. Liste des services (ServicesScreen)"
    Write-Info "3. Chat IA (AIChatScreen)"
    Write-Info "4. Profil utilisateur (ProfileScreen)"
    Write-Info "5. Recherche (SearchScreen)"
    
    Write-Warning "⚠️ Sauvegardez les screenshots dans:"
    Write-Info "   Phone: screenshots/android/phone/"
    Write-Info "   Tablet: screenshots/android/tablet/"
}

# Fonction pour valider les screenshots
function Test-Screenshots {
    Write-Info "🔍 Validation des screenshots..."
    
    $requiredScreenshots = @(
        "screenshots/ios/iphone/iphone-1.png",
        "screenshots/ios/iphone/iphone-2.png",
        "screenshots/ios/iphone/iphone-3.png",
        "screenshots/android/phone/phone-1.png",
        "screenshots/android/phone/phone-2.png",
        "screenshots/android/phone/phone-3.png"
    )
    
    $missingScreenshots = @()
    
    foreach ($screenshot in $requiredScreenshots) {
        if (Test-Path $screenshot) {
            Write-Success "✅ $screenshot"
        } else {
            Write-Error "❌ $screenshot`: Manquant"
            $missingScreenshots += $screenshot
        }
    }
    
    if ($missingScreenshots.Count -gt 0) {
        Write-Error "❌ Screenshots manquants: $($missingScreenshots.Count)"
        return $false
    } else {
        Write-Success "✅ Tous les screenshots sont présents"
        return $true
    }
}

# Fonction pour optimiser les screenshots
function Optimize-Screenshots {
    Write-Info "🔧 Optimisation des screenshots..."
    
    # Vérifier si ImageMagick est installé
    try {
        $null = magick --version
        Write-Success "✅ ImageMagick disponible"
        
        # Optimiser les screenshots
        $screenshotDirs = @(
            "screenshots/ios/iphone",
            "screenshots/ios/ipad",
            "screenshots/android/phone",
            "screenshots/android/tablet"
        )
        
        foreach ($dir in $screenshotDirs) {
            if (Test-Path $dir) {
                $files = Get-ChildItem -Path $dir -Filter "*.png"
                foreach ($file in $files) {
                    Write-Info "Optimisation: $($file.Name)"
                    # Optimiser l'image (réduire la taille sans perte de qualité)
                    magick $file.FullName -strip -quality 85 $file.FullName
                }
            }
        }
        
        Write-Success "✅ Screenshots optimisés"
    } catch {
        Write-Warning "⚠️ ImageMagick non installé. Installez-le pour optimiser les images."
        Write-Info "   Téléchargement: https://imagemagick.org/script/download.php"
    }
}

# Fonction pour afficher les instructions
function Show-Instructions {
    Write-Info "📋 Instructions pour les screenshots"
    Write-Info "===================================="
    Write-Info ""
    Write-Info "📱 iOS (iPhone):"
    Write-Info "  - Résolution: 1170x2532 (iPhone 14 Pro)"
    Write-Info "  - Format: PNG"
    Write-Info "  - Dossier: screenshots/ios/iphone/"
    Write-Info ""
    Write-Info "📱 iOS (iPad):"
    Write-Info "  - Résolution: 2048x2732 (iPad Pro 12.9 inch)"
    Write-Info "  - Format: PNG"
    Write-Info "  - Dossier: screenshots/ios/ipad/"
    Write-Info ""
    Write-Info "🤖 Android (Phone):"
    Write-Info "  - Résolution: 1080x1920 (Full HD)"
    Write-Info "  - Format: PNG"
    Write-Info "  - Dossier: screenshots/android/phone/"
    Write-Info ""
    Write-Info "🤖 Android (Tablet):"
    Write-Info "  - Résolution: 1920x1200 (WUXGA)"
    Write-Info "  - Format: PNG"
    Write-Info "  - Dossier: screenshots/android/tablet/"
    Write-Info ""
    Write-Info "📸 Écrans à capturer:"
    Write-Info "  1. Écran d'accueil (HomeScreen)"
    Write-Info "  2. Liste des services (ServicesScreen)"
    Write-Info "  3. Chat IA (AIChatScreen)"
    Write-Info "  4. Profil utilisateur (ProfileScreen)"
    Write-Info "  5. Recherche (SearchScreen)"
    Write-Info ""
    Write-Info "💡 Conseils:"
    Write-Info "  - Utilisez des données de test réalistes"
    Write-Info "  - Évitez les informations personnelles"
    Write-Info "  - Assurez-vous que l'interface est complète"
    Write-Info "  - Vérifiez la lisibilité du texte"
}

# Fonction principale
function Main {
    Write-Info "📸 Génération des Screenshots - Yukpomnang Mobile"
    Write-Info "================================================="
    
    # Afficher les instructions
    Show-Instructions
    
    # Demander confirmation
    $confirmation = Read-Host "Continuer avec la génération des screenshots? (y/N)"
    if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
        Write-Info "Génération annulée"
        exit 0
    }
    
    # Créer les dossiers
    New-ScreenshotDirectories
    
    # Demander la plateforme
    $platform = Read-Host "Plateforme (ios/android/both) [both]"
    if (-not $platform) { $platform = "both" }
    
    # Générer les screenshots
    switch ($platform) {
        "ios" {
            New-iOSScreenshots
        }
        "android" {
            New-AndroidScreenshots
        }
        "both" {
            New-iOSScreenshots
            New-AndroidScreenshots
        }
    }
    
    # Valider les screenshots
    $allGood = Test-Screenshots
    
    if ($allGood) {
        # Optimiser les screenshots
        Optimize-Screenshots
        
        Write-Success "🎉 Génération des screenshots terminée!"
        Write-Info "Les screenshots sont prêts pour les stores"
    } else {
        Write-Error "❌ Screenshots manquants"
        Write-Info "Complétez les screenshots manquants et relancez le script"
    }
}

# Exécution
try {
    Main
} catch {
    Write-Error "❌ Erreur fatale: $_"
    exit 1
}
