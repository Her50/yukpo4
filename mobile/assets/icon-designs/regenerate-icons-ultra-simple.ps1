# Script pour regenerer les icones ULTRA SIMPLE (Y violet epais sur fond blanc)
Write-Host "Regeneration des icones Yukpo (VERSION ULTRA SIMPLE)..." -ForegroundColor Yellow
Write-Host "   Y violet TRES EPAIS sur fond BLANC PUR - visibilite garantie!" -ForegroundColor Cyan
Write-Host ""

# Verifier ImageMagick
if (!(Get-Command magick -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: ImageMagick n'est pas installe!" -ForegroundColor Red
    Write-Host "Installez ImageMagick depuis: https://imagemagick.org/script/download.php#windows" -ForegroundColor Yellow
    exit 1
}

Write-Host "ImageMagick trouve!" -ForegroundColor Green
Write-Host ""

# Utiliser le fichier SVG ultra simple
$svgFile = "yukpo-icon-ultra-simple.svg"

if (!(Test-Path $svgFile)) {
    Write-Host "ERREUR: Le fichier $svgFile n'existe pas!" -ForegroundColor Red
    exit 1
}

Write-Host "Utilisation de : $svgFile" -ForegroundColor Green
Write-Host ""

# Convertir SVG vers PNG avec fond blanc explicite
Write-Host "Conversion SVG vers PNG..." -ForegroundColor Cyan
magick convert -density 300 -background white -flatten $svgFile -resize 1024x1024 icon-1024.png
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR lors de la conversion!" -ForegroundColor Red
    exit 1
}
Write-Host "  OK icon-1024.png genere" -ForegroundColor Green
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
    Write-Host "  OK $file" -ForegroundColor Green
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
    Write-Host "  OK $file" -ForegroundColor Green
}
Write-Host ""

# Copier les icones principales
Write-Host "Copie des icones principales..." -ForegroundColor Cyan
Copy-Item "icon-1024.png" "../icon.png" -Force
Copy-Item "icon-1024.png" "../icon-square.png" -Force
Copy-Item "ios/icon-180.png" "../icon-ios.png" -Force
Copy-Item "android/xxxhdpi.png" "../icon-android.png" -Force
Copy-Item "icon-1024.png" "../adaptive-icon.png" -Force
Write-Host "  OK Tous les fichiers copies" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "  REGENERATION TERMINEE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Design ultra simple:" -ForegroundColor Cyan
Write-Host "   - Fond BLANC PUR (100%)" -ForegroundColor White
Write-Host "   - Y VIOLET TRES EPAIS (contour 20px)" -ForegroundColor White
Write-Host "   - Design minimaliste pour visibilite maximale" -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANT: Vous DEVEZ maintenant:" -ForegroundColor Yellow
Write-Host "   1. Nettoyer le cache: cd mobile && npx expo start -c" -ForegroundColor White
Write-Host "   2. Rebuilder: npx expo prebuild --clean" -ForegroundColor White
Write-Host "   3. Rebuild Android: npx expo run:android" -ForegroundColor White
Write-Host ""

