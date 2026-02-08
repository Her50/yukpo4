# Script pour régénérer les icônes à partir du SVG nettoyé (sans ndop)
Write-Host "Régénération des icônes Yukpo (version nettoyée sans ndop)..." -ForegroundColor Yellow

# Vérifier ImageMagick
if (!(Get-Command magick -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: ImageMagick n'est pas installé!" -ForegroundColor Red
    Write-Host "Installez ImageMagick depuis: https://imagemagick.org/script/download.php#windows" -ForegroundColor Yellow
    exit 1
}

# Vérifier que le fichier SVG nettoyé existe
if (!(Test-Path "yukpo-icon-clean.svg")) {
    Write-Host "ERREUR: Le fichier yukpo-icon-clean.svg n'existe pas!" -ForegroundColor Red
    exit 1
}

# Convertir SVG nettoyé vers PNG 1024x1024
Write-Host "Conversion SVG nettoyé vers PNG..." -ForegroundColor Cyan
magick convert -density 300 -background none yukpo-icon-clean.svg -resize 1024x1024 icon-1024.png
Write-Host "  ✅ icon-1024.png (1024x1024) généré depuis yukpo-icon-clean.svg" -ForegroundColor Green

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
    Write-Host "  ✅ $file ($size x $size)" -ForegroundColor Green
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
    Write-Host "  ✅ $file ($size x $size)" -ForegroundColor Green
}

# Copier les icônes principales
Write-Host "Copie des icônes principales..." -ForegroundColor Cyan
Copy-Item "icon-1024.png" "../icon.png" -Force
Copy-Item "icon-1024.png" "../icon-square.png" -Force
Copy-Item "ios/icon-180.png" "../icon-ios.png" -Force
Copy-Item "android/xxxhdpi.png" "../icon-android.png" -Force
Copy-Item "icon-1024.png" "../adaptive-icon.png" -Force

Write-Host ""
Write-Host "✅ Régénération terminée!" -ForegroundColor Green
Write-Host "Fichiers générés depuis yukpo-icon-clean.svg (sans motif ndop):" -ForegroundColor Cyan
Write-Host "  📱 mobile/assets/icon.png (icône principale)" -ForegroundColor White
Write-Host "  📱 mobile/assets/icon-ios.png (iOS)" -ForegroundColor White
Write-Host "  📱 mobile/assets/icon-android.png (Android)" -ForegroundColor White
Write-Host "  📱 mobile/assets/adaptive-icon.png (Android adaptatif)" -ForegroundColor White
Write-Host "  📁 mobile/assets/icon-designs/ios/ (toutes tailles iOS)" -ForegroundColor White
Write-Host "  📁 mobile/assets/icon-designs/android/ (toutes tailles Android)" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  IMPORTANT: Après régénération, vous devez:" -ForegroundColor Yellow
Write-Host "  1. Nettoyer le cache Expo: npx expo start -c" -ForegroundColor White
Write-Host "  2. Rebuilder l'application (npx expo prebuild --clean)" -ForegroundColor White
Write-Host "  3. Tester sur un appareil réel ou un émulateur" -ForegroundColor White



