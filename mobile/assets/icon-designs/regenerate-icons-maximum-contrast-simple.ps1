# Script PowerShell pour regenerer toutes les icones depuis yukpo-icon-maximum-contrast.svg
# Ce script genere tous les formats necessaires pour iOS et Android

$ErrorActionPreference = "Stop"

# Chemins
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$svgFile = Join-Path $scriptDir "yukpo-icon-maximum-contrast.svg"
$assetsDir = Join-Path (Split-Path -Parent $scriptDir) ".."
$iconDesignsDir = $scriptDir

# Verifier que ImageMagick est installe
$magickPath = Get-Command magick -ErrorAction SilentlyContinue
if (-not $magickPath) {
    Write-Host "ImageMagick n'est pas installe ou n'est pas dans le PATH" -ForegroundColor Red
    Write-Host "Installez ImageMagick depuis: https://imagemagick.org/script/download.php" -ForegroundColor Yellow
    exit 1
}

Write-Host "ImageMagick trouve: $($magickPath.Source)" -ForegroundColor Green

# Verifier que le fichier SVG existe
if (-not (Test-Path $svgFile)) {
    Write-Host "Fichier SVG introuvable: $svgFile" -ForegroundColor Red
    exit 1
}

Write-Host "Generation des icones depuis: $svgFile" -ForegroundColor Cyan
Write-Host "Repertoire de sortie: $assetsDir" -ForegroundColor Cyan

# Creer les repertoires de sortie
$iosDir = Join-Path $iconDesignsDir "ios"
$androidDir = Join-Path $iconDesignsDir "android"

if (-not (Test-Path $iosDir)) { New-Item -ItemType Directory -Path $iosDir -Force | Out-Null }
if (-not (Test-Path $androidDir)) { New-Item -ItemType Directory -Path $androidDir -Force | Out-Null }

# Fonction pour generer une icone
function Generate-Icon {
    param(
        [string]$OutputPath,
        [int]$Size,
        [string]$BackgroundColor = "#FFFFFF"
    )
    
    Write-Host "  Generation: $OutputPath ($Size x $Size)" -ForegroundColor Gray
    
    # Convertir SVG en PNG avec fond blanc
    magick convert -background "$BackgroundColor" -resize "${Size}x${Size}" "$svgFile" "$OutputPath"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Erreur lors de la generation de $OutputPath" -ForegroundColor Red
        return $false
    }
    
    return $true
}

# Generer les icones iOS
Write-Host ""
Write-Host "Generation des icones iOS..." -ForegroundColor Cyan
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

# Generer les icones Android
Write-Host ""
Write-Host "Generation des icones Android..." -ForegroundColor Cyan
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

# Generer l'icone principale (1024x1024)
Write-Host ""
Write-Host "Generation de l'icone principale (1024x1024)..." -ForegroundColor Cyan
$mainIconPath = Join-Path $assetsDir "icon.png"
Generate-Icon -OutputPath $mainIconPath -Size 1024

# Generer l'icone adaptive pour Android (1024x1024)
Write-Host ""
Write-Host "Generation de l'icone adaptive Android (1024x1024)..." -ForegroundColor Cyan
$adaptiveIconPath = Join-Path $assetsDir "adaptive-icon.png"
Generate-Icon -OutputPath $adaptiveIconPath -Size 1024

# Generer le splash screen (2048x2048 avec fond blanc)
Write-Host ""
Write-Host "Generation du splash screen (2048x2048)..." -ForegroundColor Cyan
$splashPath = Join-Path $assetsDir "splash.png"
Write-Host "  Generation: $splashPath (2048 x 2048)" -ForegroundColor Gray
magick convert -background "#FFFFFF" -resize "2048x2048" "$svgFile" "$splashPath"

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Splash screen genere" -ForegroundColor Green
} else {
    Write-Host "  Erreur lors de la generation du splash screen" -ForegroundColor Red
}

# Generer le splash Android (2048x2048)
Write-Host ""
Write-Host "Generation du splash Android (2048x2048)..." -ForegroundColor Cyan
$splashAndroidPath = Join-Path $assetsDir "splash-android.png"
Write-Host "  Generation: $splashAndroidPath (2048 x 2048)" -ForegroundColor Gray
magick convert -background "#FFFFFF" -resize "2048x2048" "$svgFile" "$splashAndroidPath"

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Splash Android genere" -ForegroundColor Green
} else {
    Write-Host "  Erreur lors de la generation du splash Android" -ForegroundColor Red
}

Write-Host ""
Write-Host "Toutes les icones ont ete generees avec succes !" -ForegroundColor Green
Write-Host ""
Write-Host "Prochaines etapes:" -ForegroundColor Yellow
Write-Host "1. Verifiez que les fichiers icon.png et adaptive-icon.png sont bien dans mobile/assets/" -ForegroundColor White
Write-Host "2. Videz le cache Expo: npx expo start -c" -ForegroundColor White
Write-Host "3. Reconstruisez l application: npx expo prebuild --clean" -ForegroundColor White
Write-Host "4. Pour Android: npx expo run android" -ForegroundColor White
Write-Host "5. Pour iOS: npx expo run ios" -ForegroundColor White

