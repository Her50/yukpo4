# Script PowerShell pour générer toutes les icônes Yukpomnang
# Usage : .\generate-icons.ps1

Write-Host ""
Write-Host "🎨 ========================================" -ForegroundColor Cyan
Write-Host "🎨  GÉNÉRATION DES ICÔNES YUKPOMNANG" -ForegroundColor Cyan
Write-Host "🎨 ========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier ImageMagick
Write-Host "🔍 Vérification de ImageMagick..." -ForegroundColor Yellow
if (!(Get-Command magick -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "❌ ImageMagick non trouvé!" -ForegroundColor Red
    Write-Host "📥 Téléchargez-le depuis : https://imagemagick.org/script/download.php" -ForegroundColor Yellow
    Write-Host "✅ Installez et cochez 'Add to PATH'" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
Write-Host "✅ ImageMagick trouvé!" -ForegroundColor Green
Write-Host ""

# Choisir la version
Write-Host "📋 Quelle version d'icône voulez-vous générer?" -ForegroundColor Cyan
Write-Host "   1. Version détaillée (motif Ndop complet) - RECOMMANDÉ" -ForegroundColor White
Write-Host "   2. Version simplifiée (meilleure pour petites tailles)" -ForegroundColor White
Write-Host ""
$choice = Read-Host "Votre choix (1 ou 2)"

$sourceIcon = if ($choice -eq "2") { "yukpo-icon-simple.svg" } else { "yukpo-icon-ndop.svg" }

if (!(Test-Path $sourceIcon)) {
    Write-Host "❌ Fichier source non trouvé: $sourceIcon" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Utilisation de : $sourceIcon" -ForegroundColor Green
Write-Host ""

# Créer les dossiers si nécessaire
Write-Host "📁 Création des dossiers..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "ios" | Out-Null
New-Item -ItemType Directory -Force -Path "android" | Out-Null
Write-Host "✅ Dossiers créés" -ForegroundColor Green
Write-Host ""

# Générer l'icône haute résolution
Write-Host "📐 Génération de l'icône principale (1024x1024)..." -ForegroundColor Yellow
magick convert -density 300 -background none $sourceIcon icon-1024.png
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ icon-1024.png créé avec succès!" -ForegroundColor Green
}
else {
    Write-Host "❌ Erreur lors de la création de icon-1024.png" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Copier vers assets
Write-Host "📋 Copie vers le dossier assets principal..." -ForegroundColor Yellow
Copy-Item icon-1024.png ..\icon.png -Force
Copy-Item icon-1024.png ..\adaptive-icon.png -Force
Write-Host "✅ Fichiers copiés vers mobile/assets/" -ForegroundColor Green
Write-Host "   - icon.png" -ForegroundColor Gray
Write-Host "   - adaptive-icon.png" -ForegroundColor Gray
Write-Host ""

# Générer toutes les tailles iOS
Write-Host "🍎 Génération des icônes iOS..." -ForegroundColor Yellow
$iosSizes = @(180, 120, 87, 80, 76, 60, 58, 40, 29, 20)
foreach ($size in $iosSizes) {
    magick convert icon-1024.png -resize "$($size)x$($size)" "ios\icon-$size.png"
    Write-Host "  ✅ icon-$size.png" -ForegroundColor Green
}
Write-Host ""

# Générer toutes les tailles Android
Write-Host "🤖 Génération des icônes Android..." -ForegroundColor Yellow
$androidSizes = @{
    "xxxhdpi" = 192
    "xxhdpi"  = 144
    "xhdpi"   = 96
    "hdpi"    = 72
    "mdpi"    = 48
}
foreach ($density in $androidSizes.Keys) {
    $size = $androidSizes[$density]
    magick convert icon-1024.png -resize "$($size)x$($size)" "android\$density.png"
    Write-Host "  ✅ $density.png ($size x $size)" -ForegroundColor Green
}
Write-Host ""

# Créer le splash screen
Write-Host "🌅 Génération du Splash Screen..." -ForegroundColor Yellow
magick convert -size 2048x2048 xc:"#0F172A" splash-bg.png
magick convert icon-1024.png -resize 800x800 icon-800.png
magick composite -gravity center icon-800.png splash-bg.png ..\splash.png
Remove-Item splash-bg.png, icon-800.png
Write-Host "✅ Splash screen créé : mobile/assets/splash.png" -ForegroundColor Green
Write-Host ""

# Résumé
Write-Host ""
Write-Host "🎉 ========================================" -ForegroundColor Green
Write-Host "🎉  GÉNÉRATION TERMINÉE AVEC SUCCÈS!" -ForegroundColor Green
Write-Host "🎉 ========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📁 Fichiers générés :" -ForegroundColor Cyan
Write-Host "   📍 mobile/assets/icon.png (1024x1024)" -ForegroundColor White
Write-Host "   📍 mobile/assets/adaptive-icon.png (1024x1024)" -ForegroundColor White
Write-Host "   📍 mobile/assets/splash.png (2048x2048)" -ForegroundColor White
Write-Host "   📍 mobile/assets/icon-designs/ios/ (10 tailles)" -ForegroundColor White
Write-Host "   📍 mobile/assets/icon-designs/android/ (5 densités)" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Prochaines étapes :" -ForegroundColor Cyan
Write-Host "   1. Vérifiez app.json (icon, adaptive-icon, splash)" -ForegroundColor Yellow
Write-Host "   2. Testez avec : npx expo start -c" -ForegroundColor Yellow
Write-Host "   3. Vérifiez sur iOS et Android" -ForegroundColor Yellow
Write-Host ""
Write-Host "📖 Guide complet : GUIDE_GENERATION_ICONES.md" -ForegroundColor Gray
Write-Host ""

