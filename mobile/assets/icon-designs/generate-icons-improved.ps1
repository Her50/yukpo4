# Script PowerShell pour générer toutes les icônes Yukpomnang (Version améliorée)
# Usage : .\generate-icons-improved.ps1

Write-Host ""
Write-Host "🎨 ========================================" -ForegroundColor Cyan
Write-Host "🎨  GÉNÉRATION DES ICÔNES YUKPOMNANG" -ForegroundColor Cyan
Write-Host "🎨  Version améliorée (Ndop visible)" -ForegroundColor Cyan
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
    Write-Host "💡 Alternative : Utilisez un service en ligne comme https://www.appicon.co/" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}
Write-Host "✅ ImageMagick trouvé!" -ForegroundColor Green
Write-Host ""

# Utiliser la version améliorée
$sourceIcon = "yukpo-icon-ndop.svg"

if (!(Test-Path $sourceIcon)) {
    Write-Host "❌ Fichier source non trouvé: $sourceIcon" -ForegroundColor Red
    Write-Host "📁 Répertoire actuel: $(Get-Location)" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "✅ Utilisation de : $sourceIcon (version améliorée)" -ForegroundColor Green
Write-Host ""

# Créer les dossiers si nécessaire
Write-Host "📁 Création des dossiers..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "ios" | Out-Null
New-Item -ItemType Directory -Force -Path "android" | Out-Null
Write-Host "✅ Dossiers créés" -ForegroundColor Green
Write-Host ""

# Générer l'icône haute résolution (densité élevée pour qualité maximale)
Write-Host "📐 Génération de l'icône principale (1024x1024)..." -ForegroundColor Yellow
Write-Host "   Utilisation de densité 300 DPI pour qualité maximale..." -ForegroundColor Gray
magick convert -density 300 -background none $sourceIcon icon-1024.png
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ icon-1024.png créé avec succès!" -ForegroundColor Green
} else {
    Write-Host "❌ Erreur lors de la création de icon-1024.png" -ForegroundColor Red
    Write-Host "💡 Essayez avec une densité plus faible : magick convert -density 200 -background none $sourceIcon icon-1024.png" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Copier vers assets
Write-Host "📋 Copie vers le dossier assets principal..." -ForegroundColor Yellow
$assetsPath = Join-Path $PSScriptRoot ".."
Copy-Item icon-1024.png (Join-Path $assetsPath "icon.png") -Force
Copy-Item icon-1024.png (Join-Path $assetsPath "adaptive-icon.png") -Force
Write-Host "✅ Fichiers copiés vers mobile/assets/" -ForegroundColor Green
Write-Host "   - icon.png" -ForegroundColor Gray
Write-Host "   - adaptive-icon.png" -ForegroundColor Gray
Write-Host ""

# Générer toutes les tailles iOS
Write-Host "🍎 Génération des icônes iOS..." -ForegroundColor Yellow
$iosSizes = @(180, 120, 87, 80, 76, 60, 58, 40, 29, 20)
foreach ($size in $iosSizes) {
    magick convert icon-1024.png -resize "${size}x${size}" -unsharp 0x0.5+0.5+0.008 "ios\icon-$size.png"
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
    magick convert icon-1024.png -resize "${size}x${size}" -unsharp 0x0.5+0.5+0.008 "android\$density.png"
    Write-Host "  ✅ $density.png ($size x $size)" -ForegroundColor Green
}
Write-Host ""

# Créer le splash screen avec le nouveau design
Write-Host "🌅 Génération du Splash Screen..." -ForegroundColor Yellow
magick convert -size 2048x2048 xc:"#1A237E" splash-bg.png
magick convert icon-1024.png -resize 800x800 icon-800.png
magick composite -gravity center icon-800.png splash-bg.png (Join-Path $assetsPath "splash.png")
Remove-Item splash-bg.png, icon-800.png -ErrorAction SilentlyContinue
Write-Host "✅ Splash screen créé : mobile/assets/splash.png" -ForegroundColor Green
Write-Host "   (Fond bleu indigo #1A237E pour cohérence avec l'icône)" -ForegroundColor Gray
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
Write-Host "✨ Améliorations appliquées :" -ForegroundColor Cyan
Write-Host "   ✅ Fond bleu indigo traditionnel (#1A237E) - DOMINANT" -ForegroundColor White
Write-Host "   ✅ Traits blancs épais (6-7px) pour contraste maximal" -ForegroundColor White
Write-Host "   ✅ Motif ndop simplifié mais reconnaissable" -ForegroundColor White
Write-Host "   ✅ Y plus épais avec contour blanc pour visibilité" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Prochaines étapes :" -ForegroundColor Cyan
Write-Host "   1. Vérifiez app.config.js (icon, adaptiveIcon, splash)" -ForegroundColor Yellow
Write-Host "   2. Testez avec : npx expo start -c" -ForegroundColor Yellow
Write-Host "   3. Vérifiez la visibilité du ndop en miniature (48x48px)" -ForegroundColor Yellow
Write-Host "   4. Vérifiez sur iOS et Android" -ForegroundColor Yellow
Write-Host ""
Write-Host "📖 Documentation : AMELIORATION_ICONE_NDOP.md" -ForegroundColor Gray
Write-Host ""



