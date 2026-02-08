# Script pour régénérer les icônes à partir du SVG SANS NDOP (version garantie sans motif)
Write-Host "Régénération des icônes Yukpo (GARANTIE SANS MOTIF NDOP)..." -ForegroundColor Yellow

# Vérifier ImageMagick
if (!(Get-Command magick -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: ImageMagick n'est pas installé!" -ForegroundColor Red
    Write-Host "Installez ImageMagick depuis: https://imagemagick.org/script/download.php#windows" -ForegroundColor Yellow
    exit 1
}

# Utiliser le fichier SVG sans ndop
$svgFile = "yukpo-icon-no-ndop.svg"

# Vérifier que le fichier SVG existe
if (!(Test-Path $svgFile)) {
    Write-Host "ERREUR: Le fichier $svgFile n'existe pas!" -ForegroundColor Red
    exit 1
}

Write-Host "Utilisation du fichier: $svgFile" -ForegroundColor Cyan

# Convertir SVG vers PNG 1024x1024 avec haute qualité
Write-Host "Conversion SVG vers PNG (haute qualité)..." -ForegroundColor Cyan
magick convert -density 300 -background none $svgFile -resize 1024x1024 icon-1024.png
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR lors de la conversion SVG vers PNG!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ icon-1024.png (1024x1024) généré depuis $svgFile" -ForegroundColor Green

# Créer les dossiers
New-Item -ItemType Directory -Force -Path "ios" | Out-Null
New-Item -ItemType Directory -Force -Path "android" | Out-Null

# Tailles iOS
Write-Host "Génération des icônes iOS..." -ForegroundColor Cyan
$iosSizes = @{
    "icon-20.png"   = 20
    "icon-29.png"   = 29
    "icon-40.png"   = 40
    "icon-58.png"   = 58
    "icon-60.png"   = 60
    "icon-76.png"   = 76
    "icon-80.png"   = 80
    "icon-87.png"   = 87
    "icon-114.png"  = 114
    "icon-120.png"  = 120
    "icon-152.png"  = 152
    "icon-167.png"  = 167
    "icon-180.png"  = 180
    "icon-1024.png" = 1024
}

foreach ($file in $iosSizes.Keys) {
    $size = $iosSizes[$file]
    magick convert icon-1024.png -resize "${size}x${size}" "ios/$file"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Erreur lors de la génération de $file" -ForegroundColor Red
    } else {
        Write-Host "  ✅ $file ($size x $size)" -ForegroundColor Green
    }
}

# Tailles Android
Write-Host "Génération des icônes Android..." -ForegroundColor Cyan
$androidSizes = @{
    "xxxhdpi.png" = 192
    "xxhdpi.png"  = 144
    "xhdpi.png"   = 96
    "hdpi.png"    = 72
    "mdpi.png"    = 48
}

foreach ($file in $androidSizes.Keys) {
    $size = $androidSizes[$file]
    magick convert icon-1024.png -resize "${size}x${size}" "android/$file"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Erreur lors de la génération de $file" -ForegroundColor Red
    } else {
        Write-Host "  ✅ $file ($size x $size)" -ForegroundColor Green
    }
}

# Copier les icônes principales avec vérification
Write-Host "Copie des icônes principales..." -ForegroundColor Cyan
$filesToCopy = @(
    @{source="icon-1024.png"; dest="../icon.png"},
    @{source="icon-1024.png"; dest="../icon-square.png"},
    @{source="ios/icon-180.png"; dest="../icon-ios.png"},
    @{source="android/xxxhdpi.png"; dest="../icon-android.png"},
    @{source="icon-1024.png"; dest="../adaptive-icon.png"}
)

foreach ($file in $filesToCopy) {
    $source = $file.source
    $dest = $file.dest
    if (Test-Path $source) {
        Copy-Item $source $dest -Force
        Write-Host "  ✅ Copié: $source -> $dest" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Fichier source introuvable: $source" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "✅ Régénération terminée!" -ForegroundColor Green
Write-Host "Fichiers générés depuis $svgFile (GARANTIE SANS MOTIF NDOP):" -ForegroundColor Cyan
Write-Host "  - mobile/assets/icon.png (icône principale)" -ForegroundColor White
Write-Host "  - mobile/assets/icon-ios.png (iOS)" -ForegroundColor White
Write-Host "  - mobile/assets/icon-android.png (Android)" -ForegroundColor White
Write-Host "  - mobile/assets/adaptive-icon.png (Android adaptatif)" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  ÉTAPES OBLIGATOIRES pour voir les changements:" -ForegroundColor Yellow
Write-Host "  1. Nettoyer le cache Expo: cd mobile && npx expo start -c" -ForegroundColor White
Write-Host "  2. Rebuilder l'application: npx expo prebuild --clean" -ForegroundColor White
Write-Host "  3. Nettoyer le cache Android: Remove-Item -Recurse -Force android\app\build" -ForegroundColor White
Write-Host "  4. Rebuild: npx expo run:android" -ForegroundColor White
Write-Host "  5. Si l'icône ne change pas: Désinstaller et réinstaller l'app" -ForegroundColor White

