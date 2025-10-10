# Script simple pour generer les icones Yukpo avec motif Ndop
Write-Host "Generation des icones Yukpo..." -ForegroundColor Yellow

# Verifier ImageMagick
if (!(Get-Command magick -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: ImageMagick n'est pas installe!" -ForegroundColor Red
    Write-Host "Installez ImageMagick depuis: https://imagemagick.org/script/download.php#windows" -ForegroundColor Yellow
    exit 1
}

# Convertir SVG vers PNG 1024x1024
Write-Host "Conversion SVG vers PNG..." -ForegroundColor Cyan
magick convert yukpo-icon-ndop.svg -resize 1024x1024 icon-1024.png
Write-Host "  ✅ icon-1024.png (1024x1024)" -ForegroundColor Green

# Creer les dossiers
New-Item -ItemType Directory -Force -Path "ios"
New-Item -ItemType Directory -Force -Path "android"

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
    magick convert icon-1024.png -resize "${size}x${size}" "ios/$file"
    Write-Host "  ✅ $file ($size x $size)" -ForegroundColor Green
}

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
    magick convert icon-1024.png -resize "${size}x${size}" "android/$file"
    Write-Host "  ✅ $file ($size x $size)" -ForegroundColor Green
}

# Copier les icones principales
Write-Host "Copie des icones principales..." -ForegroundColor Cyan
Copy-Item "icon-1024.png" "../icon.png"
Copy-Item "icon-1024.png" "../icon-square.png"
Copy-Item "ios/icon-180.png" "../icon-ios.png"
Copy-Item "android/xxxhdpi.png" "../icon-android.png"
Copy-Item "icon-1024.png" "../adaptive-icon.png"

Write-Host ""
Write-Host "Generation terminee!" -ForegroundColor Green
Write-Host "Fichiers generes:" -ForegroundColor Cyan
Write-Host "  📱 mobile/assets/icon.png (icone principale)" -ForegroundColor White
Write-Host "  📱 mobile/assets/icon-ios.png (iOS)" -ForegroundColor White
Write-Host "  📱 mobile/assets/icon-android.png (Android)" -ForegroundColor White
Write-Host "  📱 mobile/assets/adaptive-icon.png (Android adaptatif)" -ForegroundColor White
Write-Host "  📁 mobile/assets/icon-designs/ios/ (toutes tailles iOS)" -ForegroundColor White
Write-Host "  📁 mobile/assets/icon-designs/android/ (toutes tailles Android)" -ForegroundColor White


