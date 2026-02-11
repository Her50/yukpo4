# Script PowerShell pour régénérer toutes les icônes depuis yukpo-icon-maximum-contrast.svg
# Ce script génère tous les formats nécessaires pour iOS et Android

$ErrorActionPreference = "Stop"

# Chemins
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$svgFile = Join-Path $scriptDir "yukpo-icon-maximum-contrast.svg"
$assetsDir = Join-Path (Split-Path -Parent $scriptDir) ".."
$iconDesignsDir = $scriptDir

# Vérifier que ImageMagick est installé
$magickPath = Get-Command magick -ErrorAction SilentlyContinue
if (-not $magickPath) {
    Write-Host "❌ ImageMagick n'est pas installé ou n'est pas dans le PATH" -ForegroundColor Red
    Write-Host "Installez ImageMagick depuis: https://imagemagick.org/script/download.php" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ ImageMagick trouvé: $($magickPath.Source)" -ForegroundColor Green

# Vérifier que le fichier SVG existe
if (-not (Test-Path $svgFile)) {
    Write-Host "❌ Fichier SVG introuvable: $svgFile" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Génération des icônes depuis: $svgFile" -ForegroundColor Cyan
Write-Host "📁 Répertoire de sortie: $assetsDir" -ForegroundColor Cyan

# Créer les répertoires de sortie
$iosDir = Join-Path $iconDesignsDir "ios"
$androidDir = Join-Path $iconDesignsDir "android"

if (-not (Test-Path $iosDir)) { New-Item -ItemType Directory -Path $iosDir -Force | Out-Null }
if (-not (Test-Path $androidDir)) { New-Item -ItemType Directory -Path $androidDir -Force | Out-Null }

# Fonction pour générer une icône
function Generate-Icon {
    param(
        [string]$OutputPath,
        [int]$Size,
        [string]$BackgroundColor = "#FFFFFF"
    )
    
    Write-Host "  Génération: $OutputPath ($Size x $Size)" -ForegroundColor Gray
    
    # Convertir SVG en PNG avec fond blanc
    magick convert `
        -background "$BackgroundColor" `
        -resize "${Size}x${Size}" `
        "$svgFile" `
        "$OutputPath"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Erreur lors de la génération de $OutputPath" -ForegroundColor Red
        return $false
    }
    
    return $true
}

# Générer les icônes iOS
Write-Host "`n🍎 Génération des icônes iOS..." -ForegroundColor Cyan
$iosSizes = @(
    @{Size=20; File="icon-20.png"},
    @{Size=29; File="icon-29.png"},
    @{Size=40; File="icon-40.png"},
    @{Size=58; File="icon-58.png"},
    @{Size=60; File="icon-60.png"},
    @{Size=76; File="icon-76.png"},
    @{Size=80; File="icon-80.png"},
    @{Size=87; File="icon-87.png"},
    @{Size=114; File="icon-114.png"},
    @{Size=120; File="icon-120.png"},
    @{Size=152; File="icon-152.png"},
    @{Size=167; File="icon-167.png"},
    @{Size=180; File="icon-180.png"},
    @{Size=1024; File="icon-1024.png"}
)

foreach ($icon in $iosSizes) {
    $outputPath = Join-Path $iosDir $icon.File
    Generate-Icon -OutputPath $outputPath -Size $icon.Size
}

# Générer les icônes Android
Write-Host "`n🤖 Génération des icônes Android..." -ForegroundColor Cyan
$androidSizes = @(
    @{Size=48; File="mdpi.png"; Density="mdpi"},
    @{Size=72; File="hdpi.png"; Density="hdpi"},
    @{Size=96; File="xhdpi.png"; Density="xhdpi"},
    @{Size=144; File="xxhdpi.png"; Density="xxhdpi"},
    @{Size=192; File="xxxhdpi.png"; Density="xxxhdpi"}
)

foreach ($icon in $androidSizes) {
    $outputPath = Join-Path $androidDir $icon.File
    Generate-Icon -OutputPath $outputPath -Size $icon.Size
}

# Générer l'icône principale (1024x1024)
Write-Host "`n📱 Génération de l'icône principale (1024x1024)..." -ForegroundColor Cyan
$mainIconPath = Join-Path $assetsDir "icon.png"
Generate-Icon -OutputPath $mainIconPath -Size 1024

# Générer l'icône adaptive pour Android (1024x1024)
Write-Host "`n📱 Génération de l'icône adaptive Android (1024x1024)..." -ForegroundColor Cyan
$adaptiveIconPath = Join-Path $assetsDir "adaptive-icon.png"
Generate-Icon -OutputPath $adaptiveIconPath -Size 1024

# Générer le splash screen (2048x2048 avec fond blanc)
Write-Host "`n🌊 Génération du splash screen (2048x2048)..." -ForegroundColor Cyan
$splashPath = Join-Path $assetsDir "splash.png"
Write-Host "  Génération: $splashPath (2048 x 2048)" -ForegroundColor Gray
magick convert `
    -background "#FFFFFF" `
    -resize "2048x2048" `
    "$svgFile" `
    "$splashPath"

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ Splash screen généré" -ForegroundColor Green
} else {
    Write-Host "  ❌ Erreur lors de la génération du splash screen" -ForegroundColor Red
}

# Générer le splash Android (2048x2048)
Write-Host "`n🌊 Génération du splash Android (2048x2048)..." -ForegroundColor Cyan
$splashAndroidPath = Join-Path $assetsDir "splash-android.png"
Write-Host "  Génération: $splashAndroidPath (2048 x 2048)" -ForegroundColor Gray
magick convert `
    -background "#FFFFFF" `
    -resize "2048x2048" `
    "$svgFile" `
    "$splashAndroidPath"

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ Splash Android généré" -ForegroundColor Green
} else {
    Write-Host "  ❌ Erreur lors de la génération du splash Android" -ForegroundColor Red
}

# Générer l'icône iOS (1024x1024)
Write-Host "`n📱 Génération de l'icône iOS (1024x1024)..." -ForegroundColor Cyan
$iconIosPath = Join-Path $assetsDir "icon-ios.png"
Generate-Icon -OutputPath $iconIosPath -Size 1024

# Générer l'icône Android (1024x1024)
Write-Host "`n📱 Génération de l'icône Android (1024x1024)..." -ForegroundColor Cyan
$iconAndroidPath = Join-Path $assetsDir "icon-android.png"
Generate-Icon -OutputPath $iconAndroidPath -Size 1024

# Générer l'icône carrée (1024x1024)
Write-Host "`n📱 Génération de l'icône carrée (1024x1024)..." -ForegroundColor Cyan
$iconSquarePath = Join-Path $assetsDir "icon-square.png"
Generate-Icon -OutputPath $iconSquarePath -Size 1024

Write-Host "`n✅ Toutes les icônes ont été générées avec succès !" -ForegroundColor Green
Write-Host ""
Write-Host "Prochaines etapes:" -ForegroundColor Yellow
Write-Host "1. Verifiez que les fichiers icon.png et adaptive-icon.png sont bien dans mobile/assets/" -ForegroundColor White
Write-Host "2. Videz le cache Expo: npx expo start -c" -ForegroundColor White
Write-Host "3. Reconstruisez l application: npx expo prebuild --clean" -ForegroundColor White
Write-Host "4. Pour Android: npx expo run android" -ForegroundColor White
Write-Host "5. Pour iOS: npx expo run ios" -ForegroundColor White

