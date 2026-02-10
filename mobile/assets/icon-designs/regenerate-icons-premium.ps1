# Script pour regenerer les icones PREMIUM (Y violet sur fond blanc - version amelioree)
Write-Host "Regeneration des icones Yukpo (VERSION PREMIUM AMELIOREE)..." -ForegroundColor Yellow
Write-Host "   Design moderne avec Y violet premium et effets 3D!" -ForegroundColor Cyan
Write-Host ""

# Verifier ImageMagick
if (!(Get-Command magick -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: ImageMagick n'est pas installe!" -ForegroundColor Red
    Write-Host "Installez ImageMagick depuis: https://imagemagick.org/script/download.php#windows" -ForegroundColor Yellow
    Write-Host "Cochez 'Add to PATH' lors de l'installation" -ForegroundColor Yellow
    exit 1
}

Write-Host "ImageMagick trouve!" -ForegroundColor Green
Write-Host ""

# Utiliser le fichier SVG premium
$svgFile = "yukpo-icon-violet-premium.svg"

# Verifier que le fichier SVG existe
if (!(Test-Path $svgFile)) {
    Write-Host "ERREUR: Le fichier $svgFile n'existe pas!" -ForegroundColor Red
    exit 1
}

Write-Host "Utilisation de : $svgFile (version premium amelioree)" -ForegroundColor Green
Write-Host ""

# Convertir SVG vers PNG 1024x1024 avec haute qualite
Write-Host "Conversion SVG vers PNG (haute qualite)..." -ForegroundColor Cyan
magick convert -density 300 -background none $svgFile -resize 1024x1024 icon-1024.png
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR lors de la conversion SVG vers PNG!" -ForegroundColor Red
    exit 1
}
Write-Host "  OK icon-1024.png (1024x1024) genere depuis $svgFile" -ForegroundColor Green
Write-Host ""

# Creer les dossiers
New-Item -ItemType Directory -Force -Path "ios" | Out-Null
New-Item -ItemType Directory -Force -Path "android" | Out-Null

# Tailles iOS
Write-Host "Generation des icones iOS..." -ForegroundColor Cyan
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
    magick convert icon-1024.png -resize "${size}x${size}" -unsharp 0x0.5+0.5+0.008 "ios/$file"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Erreur lors de la generation de $file" -ForegroundColor Red
    } else {
        Write-Host "  OK $file ($size x $size)" -ForegroundColor Green
    }
}
Write-Host ""

# Tailles Android
Write-Host "Generation des icones Android..." -ForegroundColor Cyan
$androidSizes = @{
    "xxxhdpi.png" = 192
    "xxhdpi.png"  = 144
    "xhdpi.png"   = 96
    "hdpi.png"    = 72
    "mdpi.png"    = 48
}

foreach ($file in $androidSizes.Keys) {
    $size = $androidSizes[$file]
    magick convert icon-1024.png -resize "${size}x${size}" -unsharp 0x0.5+0.5+0.008 "android/$file"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Erreur lors de la generation de $file" -ForegroundColor Red
    } else {
        Write-Host "  OK $file ($size x $size)" -ForegroundColor Green
    }
}
Write-Host ""

# Copier les icones principales avec verification
Write-Host "Copie des icones principales..." -ForegroundColor Cyan
$filesToCopy = @(
    @{source="icon-1024.png"; dest="../icon.png"; desc="Icône principale"},
    @{source="icon-1024.png"; dest="../icon-square.png"; desc="Icône carrée"},
    @{source="ios/icon-180.png"; dest="../icon-ios.png"; desc="Icône iOS"},
    @{source="android/xxxhdpi.png"; dest="../icon-android.png"; desc="Icône Android"},
    @{source="icon-1024.png"; dest="../adaptive-icon.png"; desc="Icône Android adaptative"}
)

foreach ($file in $filesToCopy) {
    $source = $file.source
    $dest = $file.dest
    $desc = $file.desc
    if (Test-Path $source) {
        Copy-Item $source $dest -Force
        Write-Host "  OK Copie: $desc -> $dest" -ForegroundColor Green
    } else {
        Write-Host "  Fichier source introuvable: $source" -ForegroundColor Red
    }
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "  REGENERATION PREMIUM TERMINEE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Ameliorations premium appliquees:" -ForegroundColor Cyan
Write-Host "   - Y violet PREMIUM avec gradient 4 couleurs vibrant" -ForegroundColor White
Write-Host "   - Fond blanc PUR (100% opaque) pour contraste maximal" -ForegroundColor White
Write-Host "   - Contour blanc epais (12px) pour visibilite maximale" -ForegroundColor White
Write-Host "   - Effets 3D: ombre prononcee + brillance + reflets" -ForegroundColor White
Write-Host "   - Cercle de fond subtil pour profondeur" -ForegroundColor White
Write-Host "   - Bordure subtile pour definition" -ForegroundColor White
Write-Host "   - Y optimise pour visibilite en petite taille" -ForegroundColor White
Write-Host ""
Write-Host "Fichiers generes:" -ForegroundColor Cyan
Write-Host "   - mobile/assets/icon.png (1024x1024)" -ForegroundColor White
Write-Host "   - mobile/assets/adaptive-icon.png (1024x1024)" -ForegroundColor White
Write-Host "   - mobile/assets/icon-ios.png (180x180)" -ForegroundColor White
Write-Host "   - mobile/assets/icon-android.png (192x192)" -ForegroundColor White
Write-Host "   - mobile/assets/icon-designs/ios/ (10 tailles)" -ForegroundColor White
Write-Host "   - mobile/assets/icon-designs/android/ (5 densites)" -ForegroundColor White
Write-Host ""
Write-Host "PROCHAINES ETAPES OBLIGATOIRES:" -ForegroundColor Yellow
Write-Host "   1. Nettoyer le cache Expo: npx expo start -c" -ForegroundColor White
Write-Host "   2. Rebuilder l'application: npx expo prebuild --clean" -ForegroundColor White
Write-Host "   3. Tester sur un appareil reel ou un emulateur" -ForegroundColor White
Write-Host "   4. Si l'icone ne change pas, desinstaller et reinstaller l'app" -ForegroundColor White
Write-Host ""

